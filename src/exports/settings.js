const config = require('../config');
const logger = require('../plugins/logger');
const jsonLike = require('../plugins/json.like');
const jsonMatch = require('../plugins/json.match');
const jsonSchema = require('../plugins/json.schema');
const fd = require('../plugins/form.data');
const { PactumConfigurationError } = require('../helpers/errors');

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
    config.request.retry.delay = delay;
  },

  setRequestDefaultRetryStrategy(strategy) {
    const validStrategies = ['fixed', 'exponential', 'exponential-jitter'];
    if (!validStrategies.includes(strategy)) {
      throw new PactumConfigurationError(`Invalid retry strategy: ${strategy}. Must be one of: ${validStrategies.join(', ')}`);
    }
    config.request.retry.strategy = strategy;
  },

  setRequestDefaultRetryMultiplier(multiplier) {
    if (typeof multiplier !== 'number' || multiplier <= 0) {
      throw new PactumConfigurationError(`Multiplier must be a positive number, received: ${multiplier}`);
    }
    config.request.retry.multiplier = multiplier;
  },

  setRequestDefaultRetryMaxDelay(maxDelay) {
    if (typeof maxDelay !== 'number' || maxDelay < config.request.retry.delay) {
      throw new PactumConfigurationError(`Max delay must be a number greater than or equal to base delay (${config.request.retry.delay}), received: ${maxDelay}`);
    }
    config.request.retry.maxDelay = maxDelay;
  },

  setRequestDefaultRetryJitterType(jitterType) {
    const validJitterTypes = ['none', 'full', 'equal', 'decorrelated'];
    if (!validJitterTypes.includes(jitterType)) {
      throw new PactumConfigurationError(`Invalid jitter type: ${jitterType}. Must be one of: ${validJitterTypes.join(', ')}`);
    }
    config.request.retry.jitterType = jitterType;
  },

  setDataDirectory(path) {
    config.data.dir = path;
  }

};

module.exports = settings;