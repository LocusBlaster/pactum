const { PactumRequestError } = require('./errors');

function getSeedFromString(str) {
  if (typeof str !== 'string') {
    throw new PactumRequestError(`Seed must be a string, received: ${typeof str}`);
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

class SeededRandom {
  constructor(seed = 0) {
    if (typeof seed === 'string') {
      this.seed = getSeedFromString(seed);
    } else {
      this.seed = seed;
    }
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }
}

function calculateDelay(attempt, options = {}) {
  if (typeof attempt !== 'number' || attempt < 0) {
    throw new PactumRequestError(`Attempt must be a non-negative number, received: ${attempt}`);
  }

  const config = require('../config');
  const baseDelay = options.delay != null ? options.delay : config.request.retry.delay;
  const strategy = options.strategy || config.request.retry.strategy || 'fixed';
  const multiplier = options.multiplier != null ? options.multiplier : config.request.retry.multiplier || 2;
  const maxDelay = options.maxDelay != null ? options.maxDelay : config.request.retry.maxDelay || Infinity;
  const jitterType = options.jitterType || config.request.retry.jitterType || 'none';
  const seed = options.seed != null ? options.seed : null;
  const prevDelay = options.prevDelay != null ? options.prevDelay : baseDelay;

  if (typeof baseDelay !== 'number' || baseDelay < 0) {
    throw new PactumRequestError(`Base delay must be a non-negative number, received: ${baseDelay}`);
  }
  if (typeof multiplier !== 'number' || multiplier <= 0) {
    throw new PactumRequestError(`Multiplier must be a positive number, received: ${multiplier}`);
  }
  if (typeof maxDelay !== 'number' || maxDelay < 0) {
    throw new PactumRequestError(`Max delay must be a non-negative number, received: ${maxDelay}`);
  }

  let delay;

  switch (strategy) {
    case 'fixed':
      delay = baseDelay;
      break;
    case 'exponential':
      delay = baseDelay * Math.pow(multiplier, attempt);
      break;
    case 'exponential-jitter': {
      const exponentialDelay = baseDelay * Math.pow(multiplier, attempt);
      delay = applyJitter(exponentialDelay, jitterType, baseDelay, prevDelay, seed, attempt);
      break;
    }
    default:
      throw new PactumRequestError(`Invalid retry strategy: ${strategy}. Must be one of: 'fixed', 'exponential', 'exponential-jitter'`);
  }

  delay = Math.floor(delay);
  if (maxDelay !== Infinity) {
    delay = Math.min(delay, maxDelay);
  }
  delay = Math.max(delay, 0);

  return delay;
}

function applyJitter(baseDelay, jitterType, initialBaseDelay, prevDelay, seed, attempt) {
  let effectiveSeed = seed != null ? seed : Math.floor(Math.random() * 2147483647);
  if (typeof effectiveSeed === 'string') {
    effectiveSeed = getSeedFromString(effectiveSeed);
  }
  const rng = new SeededRandom(effectiveSeed + attempt);

  switch (jitterType) {
    case 'full':
      return rng.range(0, Math.ceil(baseDelay));
    case 'equal': {
      const minEqualDelay = initialBaseDelay / 2;
      return rng.range(Math.floor(minEqualDelay), Math.ceil(baseDelay));
    }
    case 'decorrelated': {
      const minDecorrelated = initialBaseDelay;
      const maxDecorrelated = prevDelay * 3;
      return rng.range(minDecorrelated, Math.ceil(maxDecorrelated));
    }
    case 'none':
      return baseDelay;
    default:
      throw new PactumRequestError(`Invalid jitter type: ${jitterType}. Must be one of: 'none', 'full', 'equal', 'decorrelated'`);
  }
}

module.exports = {
  calculateDelay,
  SeededRandom,
  getSeedFromString
};
