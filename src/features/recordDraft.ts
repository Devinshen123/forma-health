function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(fingerprint).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => JSON.stringify(key) + ':' + fingerprint(item)).join(',') + '}';
  return JSON.stringify(value) ?? 'undefined';
}

/** An editor may accept its own uncertain writes, but never an unseen revision. */
export class RecordDraft<T> {
  private baseline: string;
  private submitted = new Set<string>();
  constructor(original: T | undefined) { this.baseline = fingerprint(original); }

  submittedValue(value: T | undefined) { this.submitted.add(fingerprint(value)); }

  observe(current: T | undefined) {
    const value = fingerprint(current);
    if (this.submitted.has(value)) {
      this.baseline = value;
      this.submitted.clear();
    }
  }

  canSave(current: T | undefined): boolean {
    this.observe(current);
    return fingerprint(current) === this.baseline;
  }
}
