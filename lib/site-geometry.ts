import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Equipment } from './site-model';
import {siteById,networkLinks,type SiteType} from './private-network.ts';
export const surface=(color:string,opacity=1)=>new THREE.MeshStandardMaterial({color,roughness:.7,metalness:.25,transparent:opacity<1,opacity});
export function disposeObject(group:THREE.Object3D){group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Sprite){if(!(o instanceof THREE.Sprite))o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)v.dispose();});m.dispose();});}});}
export function createStructure(type:SiteType='GBT'){const structure=new THREE.Group();structure.name=type+' demonstration structure';
 const box=(size:[number,number,number],position:[number,number,number],opacity=.3,color='#5b839a')=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),surface(color,opacity));m.position.set(...position);structure.add(m);};
 if(type==='RTT'){const mast=createStructure('GBT');mast.scale.y=1/3;mast.position.y=12;structure.add(mast);box([16,12,14],[0,6,0],.22);box([16,.2,14],[0,12,0],.6);return structure;}
 if(type==='IBS'){for(let level=0;level<=3;level++)box([16,.12,12],[0,level*4,0],.3);for(const x of [-7.8,7.8])for(const z of [-5.8,5.8])box([.25,12,.25],[x,6,z],1);box([16,12,.08],[0,6,6],.07);box([.08,12,12],[-8,6,0],.07);return structure;}
 if(type==='CORE'){box([13,.2,10],[0,-.12,0],1);box([13,4,.1],[0,2,-5],.12);box([.1,4,10],[-6.5,2,0],.12);for(const x of [-6.3,6.3])for(const z of [-4.8,4.8])box([.15,4,.15],[x,2,z],.8);return structure;}
 if(type==='SMALL_CELL'){const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,10,12),surface('#849ca9'));pole.position.y=5;structure.add(pole);box([5,.2,5],[0,-.12,0],1);return structure;}
 function beam(a:THREE.Vector3,b:THREE.Vector3,r=.07){const d=b.clone().sub(a);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),7),surface('#76919f'));mesh.position.copy(a.clone().add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());structure.add(mesh);}
 for(let side=0;side<3;side++){const theta=side*Math.PI*2/3,next=(side+1)*Math.PI*2/3;const point=(angle:number,y:number)=>new THREE.Vector3(Math.cos(angle)*(1.5-y/40),y,Math.sin(angle)*(1.5-y/40));beam(point(theta,0),point(theta,24),.11);for(let y=0;y<24;y+=2){beam(point(theta,y),point(next,y));beam(point(theta,y),point(next,y+2),.04);beam(point(theta,y+2),point(next,y),.04);}}
 const pad=new THREE.Mesh(new THREE.BoxGeometry(12,.2,9),surface('#344957'));pad.position.y=-.12;pad.name='Site foundation';structure.add(pad);return structure;
}
export function createEquipmentMesh(e:Equipment,selected=false,ghost=false){const color=ghost?'#8fa6b5':selected?'#ffbd67':e.condition==='offline'?'#ef746f':e.condition==='warning'?'#ffc66a':e.kind==='antenna'?'#dce9eb':e.kind==='radio'?'#90b9ca':'#74939d';const mesh=new THREE.Mesh(new THREE.BoxGeometry(...e.size),surface(color,ghost?.22:1));mesh.position.set(...e.position);mesh.rotation.y=-e.azimuth*Math.PI/180;mesh.name=e.name;mesh.userData={assetId:e.id,logicalId:e.logicalId,vendor:e.vendor,model:e.model,serial:e.serial,kind:e.kind};return mesh;}
export async function loadSiteGlb(buffer:ArrayBuffer){if(buffer.byteLength>20*1024*1024)throw new Error('Choose a self-contained GLB smaller than 20 MB.');if(buffer.byteLength<20||new DataView(buffer).getUint32(0,true)!==0x46546c67)throw new Error('Choose a binary GLB model.');const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;throw new Error('Only self-contained GLB models are supported.');});const gltf=await new GLTFLoader(manager).parseAsync(buffer,'');const bounds=new THREE.Box3().setFromObject(gltf.scene);const size=bounds.getSize(new THREE.Vector3());const extent=Math.max(size.x,size.y,size.z);if(!Number.isFinite(extent)||extent<=0||extent>10000){disposeObject(gltf.scene);throw new Error('Model has empty or unsupported bounds.');}return {scene:gltf.scene,bounds,extent};}



export function createWiringFixtureMesh(e:Equipment,siteId:string,elevation:(id:string)=>number=()=>0):THREE.Object3D {
 if(!e.id.startsWith('W-MW-'))return createEquipmentMesh(e);
 const group=new THREE.Group();group.name=e.name;group.position.set(...e.position);
 const link=networkLinks.find(l=>e.id==='W-MW-'+l.id)!,here=siteById(siteId)!,remote=siteById(link.a===siteId?link.b:link.a)!;
 const direction=new THREE.Vector3((remote.x-here.x)*2.5,Math.max(3,remote.height-2)-e.position[1]+elevation(remote.id)-elevation(siteId),(remote.y-here.y)*2.5).normalize();
 const dish=new THREE.Group();dish.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);group.add(dish);
 const add=(name:string,g:THREE.BufferGeometry,pos:[number,number,number],color='#e5edf2')=>{const m=new THREE.Mesh(g,surface(color));m.name=name;m.position.set(...pos);dish.add(m);return m;};
 const profile=Array.from({length:25},(_,i)=>{const r=i/24*.6;return new THREE.Vector2(r,-r*r*.55);});
 const bowl=add('Parabolic reflector · 1.2 m diameter',new THREE.LatheGeometry(profile,48),[0,0,0]);bowl.rotation.x=Math.PI/2;(bowl.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
 add('Reflector rim',new THREE.TorusGeometry(.6,.022,8,48),[0,0,.198]);
 add('Feed horn',new THREE.BoxGeometry(.12,.12,.2),[0,0,.4],'#acb8c4');
 for(const x of [-.4,.4]){const a=new THREE.Vector3(x,0,.16),b=new THREE.Vector3(0,0,.4),d=b.clone().sub(a);const arm=add('Feed support',new THREE.CylinderGeometry(.015,.015,d.length(),6),[0,0,0],'#71899a');arm.position.copy(a.add(b).multiplyScalar(.5));arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());}
 add('Outdoor radio / ODU',new THREE.BoxGeometry(.3,.35,.18),[0,-.28,-.16],'#668da7');
 const mount=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,1.8,8),surface('#8396a4'));mount.name='Dish mounting pole';mount.position.set(0,-.5,-.3);group.add(mount);
 const port=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),surface('#66aaff'));port.name='Weatherproof GE / PoE termination';port.position.set(0,-.45,0);group.add(port);
 group.userData={fixtureId:e.id,siteId,peer:remote.id};return group;
}
