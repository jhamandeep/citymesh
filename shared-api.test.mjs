import assert from 'node:assert/strict';
import {createPortfolio} from './lib/site-model.ts';
const origin='http://localhost:3000',url=origin+'/api/portfolio';
let response=await fetch(url);assert.equal(response.status,200,await response.clone().text());assert.match(response.headers.get('cache-control'),/no-store/);const initial=await response.json();
const put=(version,projects,from=origin)=>fetch(url,{method:'PUT',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:version,projects})});
assert.equal((await put(initial.version,createPortfolio(),'https://invalid.example')).status,403);assert.equal((await put(initial.version,{})).status,400);
const p=createPortfolio();p['GBT-01'].equipment[0].name='Local emulator verified revision';response=await put(initial.version,p);assert.equal(response.status,200,await response.clone().text());const next=await response.json();assert.equal(next.version,initial.version+1);assert.equal((await put(initial.version,createPortfolio())).status,409);const restored=await (await fetch(url)).json();assert.equal(restored.version,next.version);assert.deepEqual(restored.projects,p);
const outcomes=await Promise.all([put(next.version,p),put(next.version,p)]);assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);assert.equal((await fetch(url,{method:'PUT',headers:{Origin:origin,'Content-Type':'text/plain'},body:'{}'})).status,415);
console.log('Local workerd/D1 API passed: no-cache read, origin and content-type checks, complete portfolio publish/reload, validation rejection, stale-save rejection and competing publishers.');
