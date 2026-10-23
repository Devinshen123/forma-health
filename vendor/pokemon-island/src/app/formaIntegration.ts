// Forma adapter; no health data, sessions or API credentials enter the island.
export function validIslandScope(value: string | null): string {
  return value && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : 'demo';
}
export function islandStoragePrefix(scope: string): string { return `forma-island:${validIslandScope(scope)}:`; }
export function islandResidentIds(base: readonly string[], id?: string): string[] {
  const dex=Number(id), normalized=String(dex).padStart(3,'0');
  return Number.isInteger(dex)&&dex>=1&&dex<=151&&!base.includes(normalized)?[...base,normalized]:[...base];
}
export function scopedIslandStorage(storage: Pick<Storage,'getItem'|'setItem'>, scope: string,isCurrent:()=>boolean=()=>true) {
  const prefix=islandStoragePrefix(scope);
  const check=()=>{if(!isCurrent())throw Error('Island account changed');};
  return { getItem:(key:string)=>{check();return storage.getItem(prefix+key);}, setItem:(key:string,value:string)=>{check();storage.setItem(prefix+key,value);} };
}
export const islandScope=validIslandScope(typeof location==='undefined'?null:new URLSearchParams(location.search).get('scope'));
export function islandStorage() {
  try{return scopedIslandStorage(islandScope==='demo'?window.sessionStorage:window.localStorage,islandScope,()=>islandScope==='demo'||window.localStorage.getItem('forma-active-account')===islandScope);}catch{return null;}
}
export function islandIcon(id:string) { return `/companions/forms/${Number(id)}-thumb.webp?v=pokedex151-20261023`; }
