const fs = require('fs');
const path = require('path');
const config = require('../config');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        return match.response;
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
        return match.response;
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
    const data = {
      statusCode: response.statusCode,
      headers: response.headers || {},
      body: response.body
    };
    if (response.json) data.json = response.json;
    if (response.text) data.text = response.text;
    return data;
  },

  sanitize(data) {
    const customSanitizers = config.recorder.sanitizers;
    return this._sanitizeRecursive(data, customSanitizers);
  },

  _sanitizeRecursive(data, customSanitizers) {
    if (typeof data === 'string') {
      if (UUID_REGEX.test(data)) return '<UUID>';
      if (ISO_DATE_REGEX.test(data)) return '<ISO_TIMESTAMP>';
      if (EMAIL_REGEX.test(data)) return '<EMAIL>';
      return data;
    }
    if (Array.isArray(data)) {
      return data.map(item => this._sanitizeRecursive(item, customSanitizers));
    }
    if (data !== null && typeof data === 'object') {
      const sanitized = {};
      for (const key in data) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'authorization' && typeof data[key] === 'string' && data[key].toLowerCase().startsWith('bearer ')) {
          sanitized[key] = 'Bearer <TOKEN>';
        } else if (lowerKey === 'x-api-key' || lowerKey === 'api-key') {
          sanitized[key] = '<API_KEY>';
        } else {
          sanitized[key] = this._sanitizeRecursive(data[key], customSanitizers);
        }
      }
      for (const sanitizer of customSanitizers) {
        sanitizer(sanitized);
      }
      return sanitized;
    }
    return data;
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
