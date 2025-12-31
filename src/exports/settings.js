const config = require('../config');
const logger = require('../plugins/logger');
const jsonLike = require('../plugins/json.like');
const jsonMatch = require('../plugins/json.match');
const jsonSchema = require('../plugins/json.schema');
const fd = require('../plugins/form.data');

const settings = {

  setLogLevel(level) {
    logger.setLevel(level);
  },

  setLogger(lgr) {
    logger.setAdapter(lgr);
  },

  setJsonLikeAdapter(adapter) {
    jsonLike.setAdapter(adapter);
  },

  setJsonMatchAdapter(adapter) {
    jsonMatch.setAdapter(adapter);
  },

  setJsonSchemaAdapter(adapter) {
    jsonSchema.setAdapter(adapter);
  },

  setFormDataAdapter(adapter) {
    fd.setAdapter(adapter);
  },

  setAssertHandlerStrategy(strategy) {
    config.strategy.assert.handler = strategy;
  },

  setAssertExpressionStrategy(strategy) {
    config.strategy.assert.expression = strategy;
  },

  setCaptureHandlerStrategy(strategy) {
    config.strategy.capture.handler = strategy;
  },

  setSnapshotDirectoryPath(path) {
    config.snapshot.dir = path;
  },

  setReporterAutoRun(val) {
    config.reporter.autoRun = val;
  },

  setRequestDefaultRetryCount(count) {
    config.request.retry.count = count;
  },

  setRequestDefaultRetryDelay(delay) {
    if (typeof delay !== 'number' || !Number.isFinite(delay) || delay < 0) {
      throw new Error('Retry delay must be a non-negative finite number');
    }
    if (config.request.retry.maxDelay !== undefined && delay > config.request.retry.maxDelay) {
      throw new Error(`Retry delay (${delay}) cannot exceed max delay (${config.request.retry.maxDelay})`);
    }
    config.request.retry.delay = delay;
  },

  setRequestDefaultRetryStrategy(strategy) {
    const validStrategies = ['fixed', 'exponential', 'exponential-jitter'];
    if (typeof strategy !== 'string') {
      throw new Error('Retry strategy must be a string');
    }
    if (!validStrategies.includes(strategy)) {
      throw new Error(`Invalid retry strategy: ${strategy}. Must be one of: ${validStrategies.join(', ')}`);
    }
    config.request.retry.strategy = strategy;
  },

  setRequestDefaultRetryMultiplier(multiplier) {
    if (typeof multiplier !== 'number' || !Number.isFinite(multiplier) || multiplier <= 0) {
      throw new Error('Retry multiplier must be a positive finite number');
    }
    if (multiplier < 1) {
      throw new Error('Retry multiplier must be >= 1 for exponential growth');
    }
    config.request.retry.multiplier = multiplier;
  },

  setRequestDefaultRetryMaxDelay(maxDelay) {
    if (typeof maxDelay !== 'number' || !Number.isFinite(maxDelay) || maxDelay <= 0) {
      throw new Error('Retry max delay must be a positive finite number');
    }
    if (maxDelay < config.request.retry.delay) {
      throw new Error(`Retry max delay (${maxDelay}) cannot be less than base delay (${config.request.retry.delay})`);
    }
    config.request.retry.maxDelay = maxDelay;
  },

  setRequestDefaultRetryJitterType(jitterType) {
    const validJitterTypes = ['full', 'equal', 'decorrelated'];
    if (typeof jitterType !== 'string') {
      throw new Error('Jitter type must be a string');
    }
    if (!validJitterTypes.includes(jitterType)) {
      throw new Error(`Invalid jitter type: ${jitterType}. Must be one of: ${validJitterTypes.join(', ')}`);
    }
    config.request.retry.jitterType = jitterType;
  },

  setDataDirectory(path) {
    config.data.dir = path;
  }

};

module.exports = settings;