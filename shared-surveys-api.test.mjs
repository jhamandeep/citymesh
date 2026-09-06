import assert from 'node:assert/strict';
import {surveyBytes} from './survey.test.mjs';
import {makeSurvey} from './lib/survey-store.ts';
import {validateSurveyContainer} from './lib/shared-surveys.ts';
const origin='http://localhost:3000',url=origin+'/api/surveys?site=GBT-01';
const record=await makeSurvey('GBT-01','local-survey.glb',surveyBytes,{source:'Local test survey',capturedAt:'2026-09-06',note:'Runtime fixture only'});record.alignment={offset:[10,2,-3],yaw:45,scale:2,overlay:true};
validateSurveyContainer(record.bytes);const bad=record.bytes.slice(0);new DataView(bad).setUint32(8,20,true);assert.throws(()=>validateSurveyContainer(bad),/length/);
const initial=await (await fetch(url)).json();let version=initial.version;
const put=(expected,r=record,from=origin)=>{const {bytes,...metadata}=r;return fetch(url+'&version='+expected,{method:'PUT',headers:{Origin:from,'Content-Type':'model/gltf-binary','X-Citymesh-Survey':encodeURIComponent(JSON.stringify(metadata))},body:bytes});};
try{
 assert.equal((await put(version,record,'https://elsewhere.example')).status,403);
 assert.equal((await put(version,{...record,bytes:bad})).status,400);
 assert.equal((await put(version,{...record,sha256:'0'.repeat(64)})).status,400);
 const uploaded=await put(version);assert.equal(uploaded.status,200,await uploaded.clone().text());const first=await uploaded.json();version=first.version;assert.deepEqual(first.survey.alignment,record.alignment);
 assert.equal((await put(initial.version)).status,409);
 let original=await fetch(url+'&file=1&version='+version);assert.equal(original.status,200);assert.deepEqual(new Uint8Array(await original.arrayBuffer()),new Uint8Array(record.bytes));
 assert.equal((await fetch(origin+'/api/surveys?site=IBS-01&file=1&version='+version)).status,404);
 const competing=await Promise.all([put(version),put(version,{...record,note:'Competing revision'})]);assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);const next=await (await fetch(url)).json();assert.equal(next.version,version+1);assert.equal((await fetch(url+'&file=1&version='+version)).status,409);version=next.version;
 assert.equal((await fetch(url+'&version='+initial.version,{method:'DELETE',headers:{Origin:origin}})).status,409);
 assert.equal((await fetch(url+'&version='+version,{method:'DELETE',headers:{Origin:'https://elsewhere.example'}})).status,403);
 assert.equal((await fetch(url+'&version='+version,{method:'DELETE',headers:{Origin:origin}})).status,200);const removed=await (await fetch(url)).json();assert.equal(removed.version,version+1);assert.equal(removed.survey,null);assert.equal((await put(0)).status,409);assert.equal((await fetch(url+'&file=1&version='+version)).status,404);
}finally{const state=await (await fetch(url)).json();if(state.survey)await fetch(url+'&version='+state.version,{method:'DELETE',headers:{Origin:origin}});}
console.log('PASS: actual local D1/R2 survey upload, original bytes and alignment, malformed/checksum rejection, cross-site isolation, competing writes, stale download/removal protection and monotonic tombstone versions.');
