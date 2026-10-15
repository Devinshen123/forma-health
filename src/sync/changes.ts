import type { AppState, SyncChange, SyncCollection } from '../types';
export const collections: SyncCollection[] = ['meals','workouts','sleeps','reports','planVersions','suggestions','routines','schedules','activeWorkouts','profile','currentPlanId','completedActions'];
export function entities(state: AppState, collection: SyncCollection): Map<string, unknown> {
  if (collection === 'profile' || collection === 'currentPlanId') return new Map([[collection,state[collection]]]);
  if (collection === 'completedActions') return new Map(Object.entries(state.completedActions));
  return new Map((state[collection] ?? []).map(x=>[x.id,x]));
}
export const versionKey = (collection: SyncCollection,id:string) => `${collection}:${id}`;
export function diffStates(before:AppState,after:AppState,versions:Record<string,number>):SyncChange[] {
  const changes:SyncChange[]=[];
  for (const collection of collections) {
    const old=entities(before,collection), next=entities(after,collection);
    for (const id of new Set([...old.keys(),...next.keys()])) {
      if (JSON.stringify(old.get(id))===JSON.stringify(next.get(id))) continue;
      changes.push({collection,id,baseVersion:versions[versionKey(collection,id)]??0,kind:next.has(id)?'upsert':'delete',...(next.has(id)?{value:next.get(id)}:{})});
    }
  }
  return changes;
}
export function applyChanges(state:AppState,changes:SyncChange[]):AppState {
  const next=structuredClone(state);
  for (const change of changes) {
    const {collection,id,kind,value}=change;
    if (collection==='profile') { next.profile=kind==='delete'?null:value as AppState['profile']; continue; }
    if (collection==='currentPlanId') { next.currentPlanId=kind==='delete'?null:value as string|null; continue; }
    if (collection==='completedActions') { if (kind==='delete') delete next.completedActions[id]; else next.completedActions[id]=value as string[]; continue; }
    const items=(next[collection]??[]) as {id:string}[];
    const index=items.findIndex(x=>x.id===id);
    if (kind==='delete') { if(index>=0)items.splice(index,1); }
    else if (index<0) items.push(structuredClone(value) as {id:string});
    else items[index]=structuredClone(value) as {id:string};
    // The collection discriminant is already restricted to entity arrays.
    Object.assign(next,{[collection]:items});
  }
  return next;
}
