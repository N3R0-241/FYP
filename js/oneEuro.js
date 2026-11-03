// One Euro filter (Casiez, Roussel, Vogel, 2012).
// At low speed the cutoff stays near minCutoff and high-frequency jitter is removed.
// At high speed the cutoff rises with beta so the filtered point can follow a fast head turn.

export class LowPassFilter {
  constructor() {
    this.y = 0;
    this.initialized = false;
  }

  filter(value, alpha) {
    if (!this.initialized) {
      this.y = value;
      this.initialized = true;
      return value;
    }
    this.y = alpha * value + (1 - alpha) * this.y;
    return this.y;
  }

  reset() {
    this.initialized = false;
  }
}

export class OneEuroFilter {
  constructor({ minCutoff = 1, beta = 0, dCutoff = 1 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPassFilter();
    this.dx = new LowPassFilter();
    this.lastTime = undefined;
  }

  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * Math.max(cutoff, 1e-3));
    return 1 / (1 + tau / dt);
  }

  filter(value, timeSeconds) {
    if (this.lastTime === undefined) {
      this.lastTime = timeSeconds;
      this.dx.filter(0, 1);
      return this.x.filter(value, 1);
    }
    const dt = Math.max(timeSeconds - this.lastTime, 1e-4);
    this.lastTime = timeSeconds;
    const previous = this.x.y;
    const derivative = (value - previous) / dt;
    const smoothedDerivative = this.dx.filter(derivative, OneEuroFilter.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative);
    return this.x.filter(value, OneEuroFilter.alpha(cutoff, dt));
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.lastTime = undefined;
  }
}

export class FilterBank {
  constructor() {
    this.filters = new Map();
  }

  filter(key, value, timeSeconds, params) {
    let filter = this.filters.get(key);
    if (!filter) {
      filter = new OneEuroFilter(params);
      this.filters.set(key, filter);
    } else {
      filter.minCutoff = params.minCutoff;
      filter.beta = params.beta;
      filter.dCutoff = params.dCutoff ?? 1;
    }
    return filter.filter(value, timeSeconds);
  }

  reset() {
    this.filters.clear();
  }
}
