import assert from 'node:assert/strict';
import { IfcAPI, IFCBUILDINGELEMENTPROXY, IFCPROPERTYSET, IFCRELDEFINESBYPROPERTIES } from 'web-ifc';
import {createProject} from './lib/site-model.ts';
import {exportIfc} from './lib/ifc-export.ts';
const p=createProject();p.equipment[0].name="Antenna 'A' తెలుగు";const text=await exportIfc(p);assert.ok(text.includes("FILE_SCHEMA(('IFC4'))"));
const api=new IfcAPI();await api.Init();const id=api.OpenModel(new TextEncoder().encode(text),{COORDINATE_TO_ORIGIN:false});assert.ok(id>=0);assert.equal(api.GetModelSchema(id),'IFC4');const assets=api.GetLineIDsWithType(id,IFCBUILDINGELEMENTPROXY);assert.equal(assets.size(),p.equipment.length);assert.equal(api.GetLine(id,assets.get(0)).Name.value,p.equipment[0].name);
const psets=api.GetLineIDsWithType(id,IFCPROPERTYSET);assert.equal(psets.size(),p.equipment.length);const props=api.GetLine(id,psets.get(0),true);assert.equal(props.HasProperties.find(v=>v.Name.value==='LogicalId').NominalValue.value,p.equipment[0].logicalId);assert.equal(api.GetLineIDsWithType(id,IFCRELDEFINESBYPROPERTIES).size(),p.equipment.length);
const geometries=api.LoadAllGeometry(id);let solids=0;for(let i=0;i<geometries.size();i++){const flat=geometries.get(i);if(!Array.from({length:assets.size()},(_,n)=>assets.get(n)).includes(flat.expressID))continue;solids++;assert.ok(flat.geometries.size()>0);const geom=api.GetGeometry(id,flat.geometries.get(0).geometryExpressID);assert.ok(geom.GetIndexDataSize()>=36);geom.delete();}
assert.equal(solids,p.equipment.length);const second=api.OpenModel(new TextEncoder().encode(await exportIfc(p)));assert.equal(api.GetLine(id,assets.get(0)).GlobalId.value,api.GetLine(second,api.GetLineIDsWithType(second,IFCBUILDINGELEMENTPROXY).get(0)).GlobalId.value);api.CloseModel(second);api.CloseModel(id);console.log('IFC4 export passed independent parser checks: schema, all equipment solids, Unicode names, logical identity properties, and stable GlobalIds.');

