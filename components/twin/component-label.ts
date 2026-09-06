import * as THREE from 'three';
/** Camera-facing callout. Identity stays attached to the selectable label. */
export function componentLabel(text:string,anchor:THREE.Vector3,index:number,metadata:Record<string,unknown>){
 const group=new THREE.Group(),canvas=document.createElement('canvas');canvas.width=640;canvas.height=80;const ctx=canvas.getContext('2d');if(!ctx)return group;
 ctx.fillStyle='#102738ee';ctx.fillRect(0,0,640,80);ctx.strokeStyle='#7195a7';ctx.strokeRect(1,1,638,78);ctx.fillStyle='#edf7fc';ctx.font='bold 25px sans-serif';ctx.textAlign='center';ctx.fillText(text,320,49,615);
 const end=anchor.clone().add(new THREE.Vector3(index%2===0?3:-3,.7+(index%3)*.5,0));const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false,sizeAttenuation:false}));sprite.scale.set(.17,.02125,1);sprite.position.copy(end);sprite.renderOrder=20;sprite.userData={...metadata,isLabel:true};group.add(sprite);
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([anchor,end]),new THREE.LineBasicMaterial({color:'#90b6cb',transparent:true,opacity:.7}));line.userData.isLabel=true;group.add(line);return group;
}
