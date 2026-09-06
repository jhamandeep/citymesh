import {parseProject,type Project} from './site-model.ts';
import {siteDefinitions} from './private-network.ts';
import type {D1Database} from '@cloudflare/workers-types';
export type SharedSnapshot={version:number;updatedAt:string;projects:Record<string,Project>|null};
export function validatePortfolio(value:unknown):Record<string,Project>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==30)throw new Error('Publish a complete 30-site portfolio.');const result:Record<string,Project>={};for(const site of siteDefinitions){const p=parseProject((value as Record<string,unknown>)[site.id]);if(p.siteId!==site.id)throw new Error('Site identity does not match its portfolio key.');const json=JSON.stringify(p);if(new TextEncoder().encode(json).byteLength>1500000)throw new Error(`${site.id} exceeds the 1.5 MB shared site limit. Export its history before publishing.`);result[site.id]=p;}return result;}
export async function readSharedPortfolio(db:D1Database):Promise<SharedSnapshot>{
 const rows=await db.prepare('SELECT m.version,m.updated_at,p.site_id,p.body FROM portfolio_meta m LEFT JOIN portfolio_sites p ON 1=1 WHERE m.id=1').all<{version:number;updated_at:string;site_id:string|null;body:string|null}>();
 if(!rows.results.length)return {version:0,updatedAt:'',projects:null};const first=rows.results[0];const projects=Object.fromEntries(rows.results.filter(r=>r.site_id&&r.body).map(r=>[r.site_id!,JSON.parse(r.body!)]));return {version:first.version,updatedAt:first.updated_at,projects:first.version===0?null:validatePortfolio(projects)};
}
export async function publishSharedPortfolio(db:D1Database,expectedVersion:number,projects:unknown){
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new Error('Invalid shared version.');const next=validatePortfolio(projects),token=crypto.randomUUID(),at=new Date().toISOString();
 // D1 batch is atomic. A request token gates every site row after the version compare-and-swap.
 const statements=[db.prepare('INSERT OR IGNORE INTO portfolio_meta(id,version,token,updated_at) VALUES(1,0,\'\',\'\')'),db.prepare('UPDATE portfolio_meta SET version=version+1,token=?,updated_at=? WHERE id=1 AND version=?').bind(token,at,expectedVersion),...Object.entries(next).map(([id,p])=>db.prepare('INSERT INTO portfolio_sites(site_id,body) SELECT ?,? WHERE EXISTS(SELECT 1 FROM portfolio_meta WHERE id=1 AND token=?) ON CONFLICT(site_id) DO UPDATE SET body=excluded.body').bind(id,JSON.stringify(p),token))];
 const results=await db.batch(statements);if(results[1].meta.changes!==1)return {conflict:true as const};return {conflict:false as const,version:expectedVersion+1,updatedAt:at};
}
