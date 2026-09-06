import assert from 'node:assert/strict';
import {IfcAPI,IFCDISTRIBUTIONELEMENT,IFCDISTRIBUTIONPORT,IFCCABLESEGMENT,IFCRELCONNECTSPORTS,IFCRELNESTS,IFCPROPERTYSET} from 'web-ifc';
import {createPortfolio} from './lib/site-model.ts';
import {buildSiteCabling} from './lib/cabling.ts';
import {exportIfc} from './lib/ifc-export.ts';
const api=new IfcAPI();await api.Init();let cables=0,ports=0;
const rows=(id,type)=>{const ids=api.GetLineIDsWithType(id,type);return Array.from({length:ids.size()},(_,i)=>api.GetLine(id,ids.get(i),true));};
for(const p of Object.values(createPortfolio())){
 const plan=buildSiteCabling(p),text=await exportIfc(p,{includeCabling:true}),id=api.OpenModel(new TextEncoder().encode(text),{COORDINATE_TO_ORIGIN:false});assert.ok(id>=0);
 const elements=rows(id,IFCDISTRIBUTIONELEMENT),segments=rows(id,IFCCABLESEGMENT),terminations=rows(id,IFCDISTRIBUTIONPORT),connections=rows(id,IFCRELCONNECTSPORTS),nests=rows(id,IFCRELNESTS);
 assert.equal(elements.length,p.equipment.length+plan.devices.length);assert.equal(segments.length,plan.cables.length);assert.equal(connections.length,plan.cables.length);assert.equal(terminations.length,plan.cables.length*2);assert.equal(nests.length,terminations.length);
 const owners=new Map(nests.map(n=>[n.RelatedObjects[0].expressID,n.RelatingObject.Tag.value]));
 for(const c of plan.cables){const segment=segments.find(s=>s.Tag.value===c.id),connection=connections.find(r=>r.RealizingElement.Tag.value===c.id);assert.ok(segment&&connection,c.id);assert.equal(segment.PredefinedType.value,'CABLESEGMENT');assert.equal(connection.RelatingPort.Name.value,c.from.port);assert.equal(connection.RelatedPort.Name.value,c.to.port);assert.equal(owners.get(connection.RelatingPort.expressID),c.from.assetId);assert.equal(owners.get(connection.RelatedPort.expressID),c.to.assetId);assert.equal(connection.RelatingPort.SystemType.value,c.medium==='dc'||c.medium==='ground'?'ELECTRICAL':'COMMUNICATION');
  const axis=segment.Representation.Representations[0];assert.equal(axis.RepresentationIdentifier.value,'Axis');assert.equal(axis.RepresentationType.value,'Curve3D');const points=axis.Items[0].Points;for(const [actual,expected] of [[points[0],c.from.position],[points.at(-1),c.to.position]]){const xyz=actual.Coordinates.map(v=>v.value);assert.ok(Math.abs(xyz[0]-expected[0])<1e-6);assert.ok(Math.abs(xyz[1]+expected[2])<1e-6);assert.ok(Math.abs(xyz[2]-expected[1])<1e-6);}
 }
 const props=rows(id,IFCPROPERTYSET).filter(s=>s.Name.value==='Citymesh_Cabling');assert.equal(props.length,plan.cables.length);assert.ok(props.every(s=>s.HasProperties.some(v=>v.Name.value==='DesignStatus'&&v.NominalValue.value.includes('not surveyed'))));
 const guids=[...elements,...segments,...terminations,...connections,...nests,...props].map(o=>o.GlobalId.value);assert.equal(new Set(guids).size,guids.length);cables+=segments.length;ports+=terminations.length;api.CloseModel(id);
}
console.log(`Connected IFC4 exports verified for all 30 sites: ${cables} cable axes, ${ports} uniquely owned ports, endpoint relationships, coordinates, metadata and unique IDs. Parser checks do not imply external BIM viewer certification.`);
