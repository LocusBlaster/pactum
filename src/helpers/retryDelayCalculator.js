const config = require('../config');

/**
 * SeededRandom - Linear Congruential Generator for deterministic randomness
 * Uses parameters from Numerical Recipes (Knuth's MMIX)
 */
class SeededRandom {
  constructor(seed) {
    this.seed = normalizeSeed(seed);
    this.m = 0x80000000; // 2^31
    this.a = 1103515245;
    this.c = 12345;
    this.state = this.seed;
  }

  /**
   * Returns next random float in range [0, 1)
   */
  next() {
    this.state = ((this.a * this.state) >>> 0) + this.c;
    this.state = this.state >>> 0;
    this.state = this.state % this.m;
    return this.state / (this.m - 1);
  }

  /**
   * Returns random integer in range [min, max)
   */
  range(min, max) {
    if (min >= max) {
      throw new Error('min must be less than max');
    }
    const randomFloat = this.next();
    return Math.floor(min + randomFloat * (max - min));
  }
}

/**
 * Normalize seed to ensure it's a valid 32-bit unsigned integer
 */
function normalizeSeed(seed) {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) {
      throw new Error('Seed must be a finite number');
    }
    return Math.abs(Math.floor(seed)) >>> 0;
  }
  if (typeof seed === 'string') {
    return getSeedFromString(seed);
  }
  throw new Error('Seed must be a number or string');
}

/**
 * Convert string to numeric seed using FNV-1a hash algorithm
 */
function getSeedFromString(str) {
  if (typeof str !== 'string') {
    throw new Error('Seed must be a string');
  }

  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0);
}

/**
 * Calculate retry delay based on strategy and options
 * @param {number} attempt - Current attempt number (0-based)
 * @param {object} options - Retry options
 * @param {number} prevDelay - Previous delay (for decorrelated jitter)
 * @returns {number} Delay in milliseconds (integer)
 */
function calculateDelay(attempt, options = {}, prevDelay = null) {
  if (typeof attempt !== 'number' || attempt < 0 || !Number.isInteger(attempt)) {
    throw new Error('Attempt must be a non-negative integer');
  }

  const baseDelay = typeof options.delay === 'number'
    ? options.delay
    : config.request.retry.delay;

  const strategy = options.strategy || config.request.retry.strategy || 'fixed';
  const multiplier = typeof options.multiplier === 'number'
    ? options.multiplier
    : (config.request.retry.multiplier !== undefined ? config.request.retry.multiplier : 2);

  const maxDelay = typeof options.maxDelay === 'number'
    ? options.maxDelay
    : (config.request.retry.maxDelay !== undefined ? config.request.retry.maxDelay : 30000);

  const jitterType = options.jitterType || config.request.retry.jitterType || 'full';

  if (baseDelay < 0) {
    throw new Error('Base delay must be non-negative');
  }

  if (baseDelay === 0) {
    return 0;
  }

  if (multiplier <= 0) {
    throw new Error('Multiplier must be positive');
  }

  if (maxDelay < baseDelay) {
    throw new Error('Max delay cannot be less than base delay');
  }

  let delay;

  switch (strategy) {
    case 'fixed':
      delay = baseDelay;
      break;

    case 'exponential':
      delay = calculateExponentialDelay(attempt, baseDelay, multiplier, maxDelay);
      break;

    case 'exponential-jitter':
      delay = calculateExponentialJitterDelay(
        attempt,
        baseDelay,
        multiplier,
        maxDelay,
        jitterType,
        options.seed,
        prevDelay
      );
      break;

    default:
      throw new Error(`Unknown retry strategy: ${strategy}`);
  }

  return Math.floor(delay);
}

/**
 * Calculate exponential backoff delay
 */
function calculateExponentialDelay(attempt, baseDelay, multiplier, maxDelay) {
  const expDelay = baseDelay * Math.pow(multiplier, attempt);
  return Math.min(expDelay, maxDelay);
}

/**
 * Calculate exponential backoff with jitter
 */
function calculateExponentialJitterDelay(attempt, baseDelay, multiplier, maxDelay, jitterType, seed, prevDelay) {
  const expDelay = calculateExponentialDelay(attempt, baseDelay, multiplier, maxDelay);

  let random;
  if (seed !== undefined && seed !== null) {
    const numericSeed = typeof seed === 'string' ? getSeedFromString(seed) : (typeof seed === 'number' ? normalizeSeed(seed) : seed);
    const attemptSeed = (numericSeed + attempt * 2654435761) >>> 0;
    const rng = new SeededRandom(attemptSeed);
    random = rng.next();
  } else {
    random = Math.random();
  }

  let delay;

  switch (jitterType) {
    case 'full':
      delay = random * expDelay;
      break;

    case 'equal':
      delay = expDelay / 2 + random * (expDelay / 2);
      break;

    case 'decorrelated':
      if (prevDelay === null || prevDelay === undefined || attempt === 0) {
        delay = random * baseDelay;
      } else {
        const cappedPrevDelay = Math.min(prevDelay, maxDelay);
        const tempDelay = baseDelay + random * (cappedPrevDelay * multiplier - baseDelay);
        delay = Math.min(Math.max(tempDelay, baseDelay), maxDelay);
      }
      break;

    default:
      throw new Error(`Unknown jitter type: ${jitterType}`);
  }

  return Math.min(delay, maxDelay);
}

module.exports = {
  calculateDelay,
  SeededRandom,
  getSeedFromString
};
