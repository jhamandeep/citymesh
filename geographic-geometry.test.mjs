import assert from 'node:assert/strict';
import {streetTileLayout,coverageMeshes} from './lib/geographic-geometry.ts';
import {defaultRF,mercator,city,siteGeo} from './lib/geo-rf.ts';
import {inventorySectors} from './lib/inventory-rf.ts';
import {createPortfolio} from './lib/site-model.ts';
import {siteWorldPosition} from './lib/network-geometry.ts';
import {disposeObject} from './lib/site-geometry.ts';
const p=createPortfolio(),sectors=Object.fromEntries(Object.entries(p).map(([id,p])=>[id,inventorySectors(p)])),g=coverageMeshes({configs:defaultRF(),sectors,layers:['coverage']},'GBT-01');assert.equal(g.children.length,330);g.updateMatrixWorld(true);for(const m of g.children){assert(m.geometry.attributes.position.count>0);for(const n of m.geometry.attributes.position.array)assert(Number.isFinite(n));assert.equal(m.rotation.x,-Math.PI/2);}disposeObject(g);const tiles=streetTileLayout();assert(tiles.length<=20);const center=mercator(city.lat,city.lon,15),mpp=tiles[0].size/256;for(const id of Object.keys(p)){const geo=siteGeo(id),pixel=mercator(geo.lat,geo.lon,15),world=siteWorldPosition(id);assert(Math.abs((pixel.x-center.x)*mpp-world.x)<1);assert(Math.abs((pixel.y-center.y)*mpp-world.z)<1);assert(tiles.some(t=>Math.abs(t.worldX-world.x)<=t.size/2&&Math.abs(t.worldZ-world.z)<=t.size/2));}console.log(`PASS: 330 sector contours, finite geographic geometry and ${tiles.length} street tiles aligned with all 30 site coordinates (under 1 m projection discrepancy).`);
