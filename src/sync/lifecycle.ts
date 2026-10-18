export interface WriteBinding {
  epoch: number;
  accountId: string | undefined;
  engine: object | null;
}

/** A delayed editor must keep the identity of the render that created it. */
export function assertWriteBinding(expected: WriteBinding, current: WriteBinding): void {
  if (expected.epoch !== current.epoch || expected.accountId !== current.accountId || expected.engine !== current.engine) {
    throw new Error('Account changed. Reopen the editor before saving.');
  }
}
