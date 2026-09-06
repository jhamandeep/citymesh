import assert from 'node:assert/strict';
import {inspectionText} from './lib/inspection-text.ts';
import {createPortfolio} from './lib/site-model.ts';
import {buildSiteCabling} from './lib/cabling.ts';
for(const p of Object.values(createPortfolio())){const plan=buildSiteCabling(p);for(const e of p.equipment)assert.equal(inspectionText({assetId:e.id},p.equipment,plan),`${e.id} · ${e.name}`);for(const e of plan.devices)assert.equal(inspectionText({fixtureId:e.id},p.equipment,plan),`${e.id} · ${e.name}`);for(const c of plan.cables){const text=inspectionText({cableId:c.id},p.equipment,plan);assert(text.includes(c.from.port)&&text.includes(c.to.port));}assert.equal(inspectionText({},p.equipment,plan),'');}console.log('PASS: hover text resolves every inventory item, wiring fixture and cable endpoint across all 30 sites.');
