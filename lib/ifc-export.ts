import { parseProject, type Project } from './site-model.ts';
import {createCableCurve} from './cable-geometry.ts';
import {buildSiteCabling} from './cabling.ts';
// STEP strings use IFC Unicode escapes; doubled apostrophes preserve literal text.
function stepText(value:string){let output='';for(let i=0;i<value.length;i++){const code=value.charCodeAt(i),c=value[i];output+=c==="'"?"''":c==='\\'||code<32||code>126?`\\X2\\${code.toString(16).toUpperCase().padStart(4,'0')}\\X0\\`:c;}return `'${output}'`;}
async function guid(key:string){const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)));let n=BigInt(0);for(const v of hash.slice(0,16))n=n*BigInt(256)+BigInt(v);const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';let out='';for(let i=0;i<22;i++){out=alphabet[Number(n%BigInt(64))]+out;n/=BigInt(64);}return `'${out}'`;}
const real=(n:number)=>Number(n.toFixed(8)).toFixed(8);
export async function exportIfc(input:Project,options:{includeCabling?:boolean}={}){const p=parseProject(input);const wiring=options.includeCabling?buildSiteCabling(p):{devices:[],cables:[]};const elementRefs=new Map<string,string>();const lines:string[]=[];const add=(entity:string)=>{lines.push(`#${lines.length+1}=${entity};`);return `#${lines.length}`;};
 const origin=add('IFCCARTESIANPOINT((0.,0.,0.))'),up=add('IFCDIRECTION((0.,0.,1.))'),east=add('IFCDIRECTION((1.,0.,0.))'),world=add(`IFCAXIS2PLACEMENT3D(${origin},${up},${east})`),context=add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.00001,${world},$)`),unit=add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'),units=add(`IFCUNITASSIGNMENT((${unit}))`);
 const project=add(`IFCPROJECT(${await guid(p.siteId+':project')},$,${stepText(p.name)},'Citymesh synthetic equipment model',$,$,${stepText(p.stage)},(${context}),${units})`),placement=add(`IFCLOCALPLACEMENT($,${world})`),site=add(`IFCSITE(${await guid(p.siteId+':site')},$,${stepText(p.name)},${stepText(p.survey.note)},$,${placement},$,$,.ELEMENT.,$,$,0.,$,$)`);
 add(`IFCRELAGGREGATES(${await guid(p.siteId+':aggregate')},$,$,$,${project},(${site}))`);const contained:string[]=[];
 const origin2d=add('IFCCARTESIANPOINT((0.,0.))'),profilePlacement=add(`IFCAXIS2PLACEMENT2D(${origin2d},$)`);
 for(const e of [...p.equipment,...wiring.devices]){const theta=e.azimuth*Math.PI/180;const point=add(`IFCCARTESIANPOINT((${real(e.position[0])},${real(-e.position[2])},${real(e.position[1]-e.size[1]/2)}))`),direction=add(`IFCDIRECTION((${real(Math.cos(theta))},${real(-Math.sin(theta))},0.))`),axis=add(`IFCAXIS2PLACEMENT3D(${point},${up},${direction})`),local=add(`IFCLOCALPLACEMENT(${placement},${axis})`),profile=add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${profilePlacement},${real(e.size[0])},${real(e.size[2])})`),solid=add(`IFCEXTRUDEDAREASOLID(${profile},${world},${up},${real(e.size[1])})`),shape=add(`IFCSHAPEREPRESENTATION(${context},'Body','SweptSolid',(${solid}))`),representation=add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shape}))`),element=add(`${options.includeCabling?"IFCDISTRIBUTIONELEMENT":"IFCBUILDINGELEMENTPROXY"}(${await guid(p.siteId+':'+e.id)},$,${stepText(e.name)},${stepText(e.kind)},${stepText(e.kind)},${local},${representation},${stepText(e.id)}${options.includeCabling?"":",.NOTDEFINED."})`);contained.push(element);elementRefs.set(e.id,element);
 const properties=Object.entries({SiteId:p.siteId,DesignFixture:String(wiring.devices.some(d=>d.id===e.id)),AssetId:e.id,LogicalId:e.logicalId,Manufacturer:e.vendor,Model:e.model,SerialNumber:e.serial,Condition:e.condition,PowerWatts:String(e.power),MassKg:String(e.weight),AzimuthDegrees:String(e.azimuth),Revision:String(p.revision)}).map(([key,value])=>add(`IFCPROPERTYSINGLEVALUE(${stepText(key)},$,IFCLABEL(${stepText(value)}),$)`));const pset=add(`IFCPROPERTYSET(${await guid(p.siteId+':'+e.id+':properties')},$,'Citymesh_Equipment',$,(${properties.join(',')}))`);add(`IFCRELDEFINESBYPROPERTIES(${await guid(p.siteId+':'+e.id+':relation')},$,$,$,(${element}),${pset})`);
 }
 const portRefs=new Map<string,string>();
 for(const c of wiring.cables){
  const coords=(v:number[])=>`${real(v[0])},${real(-v[2])},${real(v[1])}`;

  const points=createCableCurve(c).getPoints(32).map(v=>add(`IFCCARTESIANPOINT((${coords(v.toArray())}))`));
  const axisCurve=add(`IFCPOLYLINE((${points.join(',')}))`),shape=add(`IFCSHAPEREPRESENTATION(${context},'Axis','Curve3D',(${axisCurve}))`),rep=add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shape}))`);
  const cable=add(`IFCCABLESEGMENT(${await guid(c.id+':cable')},$,${stepText(c.label)},${stepText(c.details)},${stepText(c.medium)},${placement},${rep},${stepText(c.id)},.CABLESEGMENT.)`);contained.push(cable);
  const props=Object.entries({CableId:c.id,Medium:c.medium,CableSpecification:c.cable,EstimatedLengthMetres:String(c.length),LengthBasis:c.lengthBasis,Service:c.service,FromAsset:c.from.assetId,FromPort:c.from.port,FromConnector:c.from.connector,ToAsset:c.to.assetId,ToPort:c.to.port,ToConnector:c.to.connector,DesignStatus:'Illustrative; not surveyed or field-tested',TransportLink:c.networkLink||''}).map(([key,value])=>add(`IFCPROPERTYSINGLEVALUE(${stepText(key)},$,IFCLABEL(${stepText(value)}),$)`));
  const set=add(`IFCPROPERTYSET(${await guid(c.id+':pset')},$,'Citymesh_Cabling',$,(${props.join(',')}))`);add(`IFCRELDEFINESBYPROPERTIES(${await guid(c.id+':properties')},$,$,$,(${cable}),${set})`);
  const ends:string[]=[];
  for(const end of [c.from,c.to]){const key=`${p.siteId}/${end.assetId}/${end.port}`;let port=portRefs.get(key);
   if(!port){const point=add(`IFCCARTESIANPOINT((${coords(end.position)}))`),axis=add(`IFCAXIS2PLACEMENT3D(${point},${up},${east})`),local=add(`IFCLOCALPLACEMENT(${placement},${axis})`);
    port=add(`IFCDISTRIBUTIONPORT(${await guid(key+':port')},$,${stepText(end.port)},${stepText(end.connector)},${stepText(c.medium)},${local},$,.SOURCEANDSINK.,.CABLE.,.${c.medium==='dc'||c.medium==='ground'?'ELECTRICAL':'COMMUNICATION'}.)`);portRefs.set(key,port);
    const owner=elementRefs.get(end.assetId);if(!owner)throw new Error(`Missing BIM endpoint: ${end.assetId}`);
    add(`IFCRELNESTS(${await guid(key+':nest')},$,$,$,${owner},(${port}))`);
   }ends.push(port);
  }
  add(`IFCRELCONNECTSPORTS(${await guid(c.id+':connection')},$,${stepText(c.label)},${stepText('Physical cable continuity; bidirectional design connection')},${ends[0]},${ends[1]},${cable})`);
 }
 if(contained.length)add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${await guid(p.siteId+':containment')},$,$,$,(${contained.join(',')}),${site})`);
 return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\nFILE_NAME(${stepText(p.siteId+'.ifc')},${stepText(new Date().toISOString())},('Citymesh'),('Prototype'),'Citymesh','Citymesh','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
}





