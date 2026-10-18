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

/** A partially confirmed batch keeps its identity until all results are reviewed. */
export class RecordBatchDraft<T extends { id: string }> {
  private records = new Map<string, RecordDraft<T>>();
  private submittedIds: Set<string> | null = null;

  get hasSubmitted() { return this.submittedIds !== null; }

  observe(current: T[]) {
    const byId = new Map(current.map(record => [record.id, record]));
    this.records.forEach((draft, id) => draft.observe(byId.get(id)));
  }

  canSave(values: T[], current: T[]): boolean {
    const ids = new Set(values.map(value => value.id));
    const submittedIds = this.submittedIds;
    if (ids.size !== values.length || submittedIds &&
      (ids.size !== submittedIds.size || [...ids].some(id => !submittedIds.has(id)))) return false;
    const byId = new Map(current.map(record => [record.id, record]));
    return values.every(value => {
      let draft = this.records.get(value.id);
      if (!draft) { draft = new RecordDraft<T>(undefined); this.records.set(value.id, draft); }
      return draft.canSave(byId.get(value.id));
    });
  }

  submittedValues(values: T[]) {
    this.submittedIds ??= new Set(values.map(value => value.id));
    for (const value of values) {
      let draft = this.records.get(value.id);
      if (!draft) { draft = new RecordDraft<T>(undefined); this.records.set(value.id, draft); }
      draft.submittedValue(value);
    }
  }
}
