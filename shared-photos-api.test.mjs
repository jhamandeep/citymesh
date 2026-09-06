import assert from 'node:assert/strict';
import {makePhoto} from './lib/photo-store.ts';
import {createPortfolio} from './lib/site-model.ts';
const origin='http://localhost:3000',url=origin+'/api/photos?site=GBT-01';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5V8AAAAASUVORK5CYII=','base64'),bytes=png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength);
const p=await makePhoto({siteId:'GBT-01',assetId:'ANT-A',revision:1,filename:'local-check.png',bytes,source:'Local runtime test',capturedAt:'2026-09-06',note:'Test fixture only'});
const current=await (await fetch(origin+'/api/portfolio')).json();const publish=await fetch(origin+'/api/portfolio',{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:current.version,projects:createPortfolio()})});assert.equal(publish.status,200,await publish.clone().text());const {version}=await publish.json();
async function upload(record=p,from=origin,v=version){const {bytes,...metadata}=record,form=new FormData();form.append('metadata',JSON.stringify({...metadata,portfolioVersion:v}));form.append('file',new Blob([bytes],{type:record.mime}),record.filename);return fetch(url,{method:'POST',headers:{Origin:from},body:form});}
const remove=()=>fetch(url+'&id='+p.id,{method:'DELETE',headers:{Origin:origin}});
try{
 assert.equal((await upload(p,'https://elsewhere.example')).status,403);
 assert.equal((await upload({...p,assetId:'NOT-IN-SNAPSHOT'})).status,409);
 assert.equal((await upload({...p,revision:999})).status,409);
 assert.equal((await upload({...p,sha256:'0'.repeat(64)})).status,400);
 const result=await upload();assert.equal(result.status,200,await result.clone().text());const saved=await result.json();assert.equal(saved.portfolioVersion,version);assert.equal(saved.assetId,'ANT-A');
 const retry=await Promise.all([upload(),upload()]);assert.deepEqual(retry.map(r=>r.status),[200,200]);
 assert.equal((await upload({...p,note:'conflicting note'})).status,409);
 const list=await (await fetch(url)).json();assert.equal(list.photos.filter(r=>r.id===p.id).length,1);assert.equal(list.photos.find(r=>r.id===p.id).sha256,p.sha256);
 const original=await fetch(url+'&id='+p.id);assert.equal(original.status,200);assert.equal(original.headers.get('content-type'),'image/png');assert.equal(original.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(new Uint8Array(await original.arrayBuffer()),new Uint8Array(bytes));
 assert.equal((await fetch(origin+'/api/photos?site=IBS-01&id='+p.id)).status,404);
 assert.equal((await fetch(url+'&id='+p.id,{method:'DELETE',headers:{Origin:'https://elsewhere.example'}})).status,403);
 assert.equal((await fetch(origin+'/api/photos?site=IBS-01&id='+p.id,{method:'DELETE',headers:{Origin:origin}})).status,404);
 assert.equal((await remove()).status,200);assert.equal((await fetch(url+'&id='+p.id)).status,404);
}finally{await remove();}
console.log('PASS: real local workerd/D1/R2 upload, immutable snapshot association, original-byte download, retry deduplication, conflict rejection, cross-site isolation, origin checks and shared removal. Only local emulator state changed.');
