const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

export class OneEuroFilter {
  private value: number | null = null;
  private raw = 0;
  private derivative = 0;
  private time = 0;
  constructor(private readonly minCutoff = 1.5, private readonly beta = .08) {}

  filter(value: number, timeMs: number): number {
    if (this.value === null || timeMs <= this.time || timeMs - this.time > 500) {
      this.value = value; this.raw = value; this.derivative = 0; this.time = timeMs;
      return value;
    }
    const dt = Math.max(.001, (timeMs - this.time) / 1000);
    const derivative = (value - this.raw) / dt;
    this.derivative += alpha(1, dt) * (derivative - this.derivative);
    this.value += alpha(this.minCutoff + this.beta * Math.abs(this.derivative), dt) * (value - this.value);
    this.raw = value; this.time = timeMs;
    return this.value;
  }
}
