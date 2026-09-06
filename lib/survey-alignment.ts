import * as THREE from 'three';
export type SurveyAlignment={offset:[number,number,number];yaw:number;scale:number;overlay:boolean};
export const defaultSurveyAlignment=():SurveyAlignment=>({offset:[0,0,0],yaw:0,scale:1,overlay:false});
export function validateAlignment(value:unknown):SurveyAlignment{
 if(value===undefined)return defaultSurveyAlignment();
 if(!value||typeof value!=='object')throw new Error('Invalid survey alignment.');
 const a=value as SurveyAlignment;
 if(!Array.isArray(a.offset)||a.offset.length!==3||!a.offset.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=10000)||typeof a.yaw!=='number'||!Number.isFinite(a.yaw)||Math.abs(a.yaw)>360||typeof a.scale!=='number'||!Number.isFinite(a.scale)||a.scale<.001||a.scale>1000||typeof a.overlay!=='boolean')throw new Error('Use offsets within ±10,000 m, rotation within ±360°, and scale from 0.001 to 1,000.');
 return {offset:[...a.offset],yaw:a.yaw,scale:a.scale,overlay:a.overlay};
}
// Apply to a dedicated parent group so the source GLB's own node transforms remain intact.
export function applySurveyAlignment(group:THREE.Group,value:SurveyAlignment){const a=validateAlignment(value);group.position.set(...a.offset);group.rotation.set(0,-a.yaw*Math.PI/180,0);group.scale.setScalar(a.scale);group.updateMatrixWorld(true);return new THREE.Box3().setFromObject(group);}
const originalMaterials=new WeakMap<THREE.Material,{opacity:number;transparent:boolean;depthWrite:boolean}>();
export function setSurveyOverlay(group:THREE.Group,overlay:boolean){group.traverse(object=>{if(!(object instanceof THREE.Mesh))return;for(const material of Array.isArray(object.material)?object.material:[object.material]){if(!originalMaterials.has(material))originalMaterials.set(material,{opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});const original=originalMaterials.get(material)!;material.opacity=overlay?original.opacity*.3:original.opacity;material.transparent=overlay||original.transparent;material.depthWrite=overlay?false:original.depthWrite;material.needsUpdate=true;}});}
