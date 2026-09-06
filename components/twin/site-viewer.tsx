'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStructure, createEquipmentMesh, disposeObject, loadSiteGlb } from '@/lib/site-geometry';
import type { Equipment } from '@/lib/site-model';
import type { SiteType } from '@/lib/private-network';
import { RotateCcw, Ruler, Box, ArrowUp, Upload, X } from 'lucide-react';
type Props={equipment:Equipment[];baseline:Equipment[];selected:string;onSelect:(id:string)=>void;compare:boolean;siteType:SiteType};
export default function SiteViewer({equipment,baseline,selected,onSelect,compare,siteType}:Props){
 const host=useRef<HTMLDivElement>(null);const state=useRef({equipment,baseline,selected,onSelect,compare});
 const engine=useRef<{update:()=>void;view:(top:boolean)=>void;load:(buffer:ArrayBuffer)=>Promise<void>;clear:()=>void}|null>(null);
 const measuring=useRef(false);const [measure,setMeasure]=useState(false);const [distance,setDistance]=useState('');const [error,setError]=useState('');const [modelName,setModelName]=useState('');const [loading,setLoading]=useState(false);
 useEffect(()=>{
 if(!host.current)return;const parent=host.current;let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{queueMicrotask(()=>setError('3D rendering is unavailable in this browser. All equipment dimensions and workflows remain available in the inventory.'));return;}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor('#111e2a');parent.appendChild(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','3D tower model. Drag to orbit, scroll to zoom. Use inventory buttons to select equipment with the keyboard.');
 const scene=new THREE.Scene();scene.add(new THREE.AmbientLight(0xb6d5ed,2));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(20,30,15);scene.add(sun);
 const camera=new THREE.PerspectiveCamera(40,1,.1,300);const focus=siteType==="CORE"?2:siteType==="IBS"?6:siteType==="SMALL_CELL"?4:11;const radius=siteType==="CORE"?18:siteType==="SMALL_CELL"?20:32;camera.position.set(radius*.9,focus+12,radius);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,focus,0);controls.enableDamping=true;controls.maxDistance=100;controls.minDistance=2;
 const structure=createStructure(siteType);scene.add(structure);const assetsGroup=new THREE.Group();scene.add(assetsGroup);const ghost=new THREE.Group();scene.add(ghost);const measurements=new THREE.Group();scene.add(measurements);let imported:THREE.Group|null=null;
 const dispose=disposeObject;
 const clearGroup=(group:THREE.Group)=>{dispose(group);group.clear();};
 const grid=new THREE.GridHelper(70,70,0x425566,0x233441);grid.position.y=-.25;scene.add(grid);
 const equipmentMesh=(e:Equipment,isGhost=false)=>createEquipmentMesh(e,e.id===state.current.selected,isGhost);
 const update=()=>{clearGroup(assetsGroup);clearGroup(ghost);for(const e of state.current.equipment)assetsGroup.add(equipmentMesh(e));if(state.current.compare)for(const e of state.current.baseline)ghost.add(equipmentMesh(e,true));};update();
 let points:THREE.Vector3[]=[];const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();let down={x:0,y:0};
 const start=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
 const click=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(measuring.current?(imported?[imported]:[assetsGroup,structure]):[assetsGroup],true);if(!hits.length)return;if(!measuring.current){if(imported)return;const id=hits[0].object.userData.assetId;if(id)state.current.onSelect(id);return;}if(points.length===2){points=[];clearGroup(measurements);}const point=hits[0].point;points.push(point);const marker=new THREE.Mesh(new THREE.SphereGeometry(.11),new THREE.MeshBasicMaterial({color:'#ffcb78',depthTest:false}));marker.position.copy(point);measurements.add(marker);if(points.length===2){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#ffcb78',depthTest:false}));measurements.add(line);setDistance(`${points[0].distanceTo(points[1]).toFixed(2)} m`);}else setDistance('Select a second surface point');};
 renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerup',click);
 const view=(top:boolean)=>{controls.target.set(0,top?0:focus,0);camera.position.set(top?0:radius*.9,top?42:focus+12,top?.01:radius);controls.update();};
 const clear=()=>{if(imported){dispose(imported);scene.remove(imported);imported=null;}controls.maxDistance=100;camera.far=300;camera.updateProjectionMatrix();structure.visible=true;grid.visible=true;assetsGroup.visible=true;ghost.visible=true;clearGroup(measurements);points=[];setDistance('');view(false);};
 let disposed=false;
 engine.current={update,view,clear,load:async(buffer)=>{const loaded=await loadSiteGlb(buffer);const gltf={scene:loaded.scene},box=loaded.bounds,scale=loaded.extent;if(disposed){dispose(gltf.scene);return;}clear();imported=gltf.scene;scene.add(imported);structure.visible=false;assetsGroup.visible=false;ghost.visible=false;const center=box.getCenter(new THREE.Vector3());controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(scale*1.2,scale*.7,scale*1.2));camera.far=Math.max(300,scale*10);camera.updateProjectionMatrix();controls.maxDistance=scale*8;controls.update();}};
 const resize=()=>{const w=parent.clientWidth,h=parent.clientHeight;renderer.setSize(w,h);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(parent);resize();
 let frame=0;const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);};animate();
 return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',start);renderer.domElement.removeEventListener('pointerup',click);dispose(scene);renderer.dispose();renderer.domElement.remove();engine.current=null;};
 },[siteType]);
 useEffect(()=>{state.current={equipment,baseline,selected,onSelect,compare};engine.current?.update();},[equipment,baseline,selected,compare,onSelect]);
 return <div className="twin-viewer"><div ref={host} className="three-host"/><div className="viewer-caption"><span className="viewer-light"/>{modelName||'Parametric site model'}<small>{modelName?'Imported geometry · units assumed metres':'Demonstration · dimensions in metres'}</small></div><div className="viewer-actions"><button title="Orbit view" aria-label="Reset orbit view" onClick={()=>{engine.current?.clear();setModelName('');}}><RotateCcw size={18}/></button><button title="Top view" aria-label="Top view" onClick={()=>engine.current?.view(true)}><ArrowUp size={18}/></button><button aria-pressed={measure} title="Measure between surface points" onClick={()=>{measuring.current=!measure;setMeasure(!measure);setDistance('');}}><Ruler size={18}/><span>Measure</span></button><label className="glb-upload" title="Import self-contained GLB, up to 20 MB"><Upload size={18}/><span>{loading?'Loading…':'Load GLB'}</span><input aria-label="Load a GLB site survey model" disabled={loading} type="file" accept=".glb" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>20*1024*1024){setError('Choose a self-contained GLB smaller than 20 MB.');return;}setLoading(true);setError('');try{if(!engine.current)throw new Error('3D renderer unavailable.');await engine.current.load(await file.arrayBuffer());setModelName(file.name);}catch(err){setError(err instanceof Error?err.message:'Unable to read model.');}finally{setLoading(false);}}}/></label></div>{error&&<div className="viewer-error" role="alert">{error}<button aria-label="Dismiss model error" onClick={()=>setError('')}><X size={16}/></button></div>}<div className="viewer-footer"><span><Box size={15}/>{measure?(distance||'Select two surfaces to measure distance'):'Drag to orbit · scroll to zoom · click equipment to inspect'}</span><span>{compare?'BASELINE OVERLAY':'DESIGN MODEL'}</span></div></div>;
}




