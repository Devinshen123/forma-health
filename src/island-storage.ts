/** Remove only the deleted account's local virtual-world keepsakes. */
export function clearIslandCache(accountId:string) {
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(accountId)||accountId==='demo')return;
  const prefix=`forma-island:${accountId}:`;
  for(const storage of[localStorage,sessionStorage]){
    const keys=Array.from({length:storage.length},(_,index)=>storage.key(index)).filter((key):key is string=>Boolean(key?.startsWith(prefix)));
    for(const key of keys)storage.removeItem(key);
  }
}
