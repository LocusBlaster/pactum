const fs = require('fs');
const path = require('path');
const config = require('../config');

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_DATE_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})/g;
const EMAIL_REGEX = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

const recorder = {
  mode: null,
  session: null,
  recordings: [],

  setMode(mode, session) {
    this.mode = mode;
    this.session = session;
    this.loadRecordings();
  },

  stop() {
    this.mode = null;
    this.session = null;
    this.recordings = [];
  },

  loadRecordings() {
    if (!this.session) return;
    const filePath = path.join(config.recorder.dir, `${this.session}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        this.recordings = JSON.parse(data);
      } catch (e) {
        this.recordings = [];
      }
    } else {
      this.recordings = [];
    }
  },

  saveRecordings() {
    if (!this.session) return;
    if (!fs.existsSync(config.recorder.dir)) {
      fs.mkdirSync(config.recorder.dir, { recursive: true });
    }
    const filePath = path.join(config.recorder.dir, `${this.session}.json`);
    fs.writeFileSync(filePath, JSON.stringify(this.recordings, null, 2));
  },

  clear(session) {
    const s = session || this.session;
    if (!s) return;
    const filePath = path.join(config.recorder.dir, `${s}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // ignore
      }
    }
    if (s === this.session) {
      this.recordings = [];
    }
  },

  async handle(request, next) {
    if (!this.mode) return next();

    const sanitizedRequest = this.sanitize(this.extractRequestData(request));

    if (this.mode === 'PLAYBACK') {
      const match = this.findMatch(sanitizedRequest);
      if (match) {
        return this.reconstructResponse(match.response);
      }
      throw new Error('No recording found');
    }

    if (this.mode === 'RECORD') {
      const response = await next();
      const sanitizedResponse = this.sanitize(this.extractResponseData(response));
      this.recordings.push({
        request: sanitizedRequest,
        response: sanitizedResponse
      });
      this.saveRecordings();
      return response;
    }

    if (this.mode === 'AUTO') {
      const match = this.findMatch(sanitizedRequest);
      if (match) {
        return this.reconstructResponse(match.response);
      }
      const response = await next();
      const sanitizedResponse = this.sanitize(this.extractResponseData(response));
      this.recordings.push({
        request: sanitizedRequest,
        response: sanitizedResponse
      });
      this.saveRecordings();
      return response;
    }

    return next();
  },

  extractRequestData(request) {
    return {
      method: request.method,
      path: request.path,
      queryParams: request.queryParams || {},
      headers: request.headers || {},
      body: request.body
    };
  },

  extractResponseData(response) {
    return {
      statusCode: response.statusCode,
      headers: response.headers || {},
      body: response.body
    };
  },

  reconstructResponse(recordedResponse) {
    const res = { ...recordedResponse };
    if (typeof res.body === 'object' && res.body !== null) {
      res.json = res.body;
      res.text = JSON.stringify(res.body);
    } else {
      res.text = res.body || '';
      try {
        res.json = JSON.parse(res.text);
      } catch (e) {
        // not json
      }
    }
    return res;
  },

  sanitize(data) {
    const customSanitizers = config.recorder.sanitizers;
    return this._sanitizeRecursive(data, customSanitizers);
  },

  _sanitizeRecursive(data, customSanitizers) {
    let sanitized = data;

    if (typeof data === 'string') {
      sanitized = data.replace(UUID_REGEX, '<UUID>')
                      .replace(ISO_DATE_REGEX, '<ISO_TIMESTAMP>')
                      .replace(EMAIL_REGEX, '<EMAIL>');
    } else if (Array.isArray(data)) {
      sanitized = data.map(item => this._sanitizeRecursive(item, customSanitizers));
    } else if (data !== null && typeof data === 'object') {
      sanitized = {};
      const keys = Object.keys(data);
      for (const key of keys) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'authorization' && typeof data[key] === 'string' && data[key].toLowerCase().startsWith('bearer ')) {
          sanitized[key] = 'Bearer <TOKEN>';
        } else if (
          lowerKey.includes('key') || 
          lowerKey.includes('token') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('auth') || 
          lowerKey.includes('password')
        ) {
          sanitized[key] = '<REDACTED>';
        } else {
          sanitized[key] = this._sanitizeRecursive(data[key], customSanitizers);
        }
      }
    }

    if (customSanitizers && customSanitizers.length > 0) {
      for (const sanitizer of customSanitizers) {
        const result = sanitizer(sanitized);
        if (result !== undefined) {
          sanitized = result;
        }
      }
    }

    return sanitized;
  },

  findMatch(request) {
    for (let i = this.recordings.length - 1; i >= 0; i--) {
      const recording = this.recordings[i];
      if (this.isMatch(request, recording.request)) {
        return recording;
      }
    }
    return null;
  },

  isMatch(actual, expected) {
    if (actual.method !== expected.method) return false;
    if (actual.path !== expected.path) return false;
    if (!this.compareObjects(actual.queryParams, expected.queryParams)) return false;
    if (!this.compareHeaders(actual.headers, expected.headers)) return false;
    if (!this.compareObjects(actual.body, expected.body)) return false;
    return true;
  },

  compareHeaders(actual, expected) {
    if (actual === expected) return true;
    if (!actual || !expected) return false;
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    if (actualKeys.length !== expectedKeys.length) return false;
    for (const key of expectedKeys) {
      const actualKey = actualKeys.find(k => k.toLowerCase() === key.toLowerCase());
      if (!actualKey || !this.compareObjects(actual[actualKey], expected[key])) return false;
    }
    return true;
  },

  compareObjects(actual, expected) {
    if (actual === expected) return true;
    if (actual === undefined || actual === null || expected === undefined || expected === null) return actual === expected;
    if (typeof actual !== 'object' || typeof expected !== 'object') return actual === expected;

    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);

    if (actualKeys.length !== expectedKeys.length) return false;

    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(actual, key) || !this.compareObjects(actual[key], expected[key])) {
        return false;
      }
    }
    return true;
  }
};

module.exports = recorder;
