import {networkLinks} from './private-network.ts';
import type {Project} from './site-model.ts';
export type Observation={key:string;kind:'equipment'|'link';siteId:string;assetId:string;linkId:string;observedAt:string;state:'up'|'down'|'degraded'|'unknown';source:string;temperatureC?:number;rxPowerDbm?:number;throughputMbps?:number};
export const OBSERVATION_FRESH_MS=5*60*1000;
export function parseObservations(value:unknown,portfolio:Record<string,Project>,now=Date.now()):Observation[]{
 if(!value||typeof value!=='object')throw new Error('Send an observation batch.');const batch=value as Record<string,unknown>;
 if(batch.schema!==1||typeof batch.source!=='string'||!batch.source.trim()||batch.source.length>160||!Array.isArray(batch.observations)||batch.observations.length<1||batch.observations.length>500)throw new Error('Use schema 1, a source name, and 1–500 observations.');
 const source=batch.source.trim();const keys=new Set<string>();return batch.observations.map(raw=>{if(!raw||typeof raw!=='object')throw new Error('Invalid observation.');const r=raw as Record<string,unknown>;let siteId='',assetId='',linkId='',key='';
 if(r.kind==='equipment'){if(typeof r.siteId!=='string'||typeof r.assetId!=='string'||!portfolio[r.siteId]?.equipment.some(e=>e.id===r.assetId))throw new Error('Equipment must exist in the shared portfolio (or initial demo inventory when no portfolio is published).');siteId=r.siteId;assetId=r.assetId;key=`equipment:${siteId}:${assetId}`;}
 else if(r.kind==='link'){if(typeof r.linkId!=='string'||!networkLinks.some(l=>l.id===r.linkId))throw new Error('Choose a known transport link.');linkId=r.linkId;key=`link:${linkId}`;}else throw new Error('Observation kind must be equipment or link.');
 if(keys.has(key))throw new Error('Include each equipment or link only once in a batch.');keys.add(key);
 if(typeof r.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(r.observedAt)||!Number.isFinite(Date.parse(r.observedAt))||Date.parse(r.observedAt)>now+60000||Date.parse(r.observedAt)<now-30*86400000)throw new Error('Use UTC observation times within the last 30 days and at most 60 seconds ahead.');
 if(new Date(r.observedAt).toISOString().slice(0,19)!==r.observedAt.slice(0,19))throw new Error('Invalid observation calendar date.');
 if(!['up','down','degraded','unknown'].includes(String(r.state)))throw new Error('Use up, down, degraded or unknown state.');
 const result:Observation={key,kind:r.kind,siteId,assetId,linkId,observedAt:new Date(r.observedAt).toISOString(),state:r.state as Observation['state'],source};
 for(const [field,min,max] of [['temperatureC',-100,250],['rxPowerDbm',-200,100],['throughputMbps',0,1000000]] as const){if(r[field]!==undefined){if(typeof r[field]!=='number'||!Number.isFinite(r[field])||r[field]<min||r[field]>max)throw new Error(`Invalid ${field}.`);result[field]=r[field];}}
 return result;
 });
}
export function freshObservation(r:Observation,now=Date.now()){const age=now-Date.parse(r.observedAt);return age>=0&&age<=OBSERVATION_FRESH_MS;}
export function observationScenario(portfolio:Record<string,Project>,records:Observation[],enabled:boolean,now=Date.now()){
 if(!enabled)return {portfolio,links:[] as string[]};let next=portfolio;const links:string[]=[];
 for(const r of records){if(!freshObservation(r,now))continue;if(r.kind==='link'){if(r.state==='down')links.push(r.linkId);continue;}if(r.state!=='down'&&r.state!=='degraded')continue;const p=next[r.siteId],asset=p?.equipment.find(e=>e.id===r.assetId);if(!asset)continue;const condition=r.state==='down'?'offline':'warning';if(asset.condition==='offline'||asset.condition===condition)continue;if(next===portfolio)next={...portfolio};next[r.siteId]={...p,equipment:p.equipment.map(e=>e.id===asset.id?{...e,condition}:e)};
 }return {portfolio:next,links};
}
