/** Tracks uploads owned by one editor. A rejected save may already be queued locally
 * or accepted remotely, so an attachment submitted to save must never be deleted
 * by editor cancellation. Server-side reference checks alone cannot see the outbox.
 */
export class AttachmentLifecycle {
  private currentId: string | null = null;
  private submitted = new Set<string>();

  constructor(private remove: (id: string) => Promise<unknown>) {}

  get id() { return this.currentId; }

  stage(id: string | null) { this.currentId = id; }

  retainForSave(id: string | undefined) {
    if (id) this.submitted.add(id);
  }

  async discard() {
    const id = this.currentId;
    if (!id) return;
    if (!this.submitted.has(id)) await this.remove(id);
    if (this.currentId === id) this.currentId = null;
  }
}
