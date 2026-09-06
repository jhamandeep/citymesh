import assert from 'node:assert/strict';
import { simulate, assets, scenarios } from './lib/simulation.ts';
const normal=simulate('normal',100);
assert.equal(normal.online,12);assert.equal(normal.delivered,normal.requested);
const fiber=simulate('fiber',100);assert.equal(fiber.online,12);assert.equal(fiber.loads[0],0);assert.ok(fiber.states.find(a=>a.id==='hospital').route.includes(2));
const power=simulate('power',100);assert.equal(power.online,8);assert.equal(power.states.find(a=>a.id==='hospital').status,'offline');
const tower=simulate('tower',100);assert.equal(tower.online,11);assert.equal(tower.states.find(a=>a.id==='north').delivered,0);
const core=simulate('normal',100,['core']);assert.equal(core.online,0);assert.equal(core.delivered,0);assert.equal(core.latency,0);
const peak=simulate('peak',250);assert.ok(peak.delivered<peak.requested);assert.ok(peak.states.some(a=>a.status==='degraded'));
for(const s of scenarios)for(const demand of [25,100,250])for(const failures of [[],...assets.map(a=>[a.id])]){const r=simulate(s.id,demand,failures);assert.ok(r.delivered>=0&&r.delivered<=r.requested);assert.ok(Number.isFinite(r.latency));r.states.forEach(a=>{if(a.status==='offline')assert.equal(a.delivered,0);});}
console.log('Simulation checks passed: baseline, alternate routing, power dependency, tower failure, core failure, congestion, and 195 invariant combinations.');
