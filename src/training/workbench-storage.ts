/** Remove only the deleted account's workbench cache, never the standalone openGym app. */
export async function clearWorkbenchCache(accountId: string): Promise<void> {
  if (!/^[a-f0-9-]{36}$/i.test(accountId)) throw Error('Invalid account cache');
  const prefix = `forma-workbench:${accountId}:`;
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of Object.keys(storage)) if (key.startsWith(prefix)) storage.removeItem(key);
  }
  if ('caches' in window) for (const key of await caches.keys()) if (key.startsWith(prefix)) await caches.delete(key);
  const databases = await indexedDB.databases();
  await Promise.all(databases.filter(database => database.name?.startsWith(prefix)).map(database => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(database.name!);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(Error('Could not clear the deleted account’s training cache.'));
    request.onblocked = () => reject(Error('Account deleted. Close its other training tabs to finish clearing the local cache.'));
  })));
}
