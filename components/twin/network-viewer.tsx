'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {siteDefinitions,siteById,networkLinks} from '@/lib/private-network';
import {disposeObject} from '@/lib/site-geometry';
type Props={selected:string;selectedLink:string|null;route:number[];broken:boolean[];layer:string;onSite:(id:string)=>void;onLink:(id:string)=>void};
export default function NetworkViewer(props:Props){
 const host=useRef<HTMLDivElement>(null),state=useRef(props),refresh=useRef<()=>void>(()=>{}),reset=useRef<()=>void>(()=>{});const [error,setError]=useState('');
 useEffect(()=>{state.current=props;refresh.current();},[props]);
 useEffect(()=>{
  if(!host.current)return;const el=host.current;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{queueMicrotask(()=>setError('WebGL is unavailable. Choose 2D topology to inspect all 30 sites.'));return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#101f2a');el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','3D private network: 30 sites and 38 transport paths. Use the site directory for keyboard selection.');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,1500);scene.add(new THREE.AmbientLight(0xdcefff,2));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(80,160,60);scene.add(sun);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxDistance=600;controls.minDistance=15;reset.current=()=>{camera.position.set(170,230,285);controls.target.set(0,0,0);controls.update();};reset.current();
  const grid=new THREE.GridHelper(320,32,0x45606b,0x203742);scene.add(grid);const content=new THREE.Group();scene.add(content);
  const position=(id:string)=>{const s=siteById(id)!;return new THREE.Vector3((s.x-500)*.32,0,(s.y-350)*.32);};
  const label=(text:string)=>{const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#11242ee8';ctx.fillRect(0,0,256,64);ctx.fillStyle='#e9f3f5';ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillText(text,128,42);const texture=new THREE.CanvasTexture(canvas);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));sprite.scale.set(17,4.25,1);return sprite;};
  refresh.current=()=>{disposeObject(content);content.clear();const p=state.current;
   for(const s of siteDefinitions){const group=new THREE.Group();group.position.copy(position(s.id));const color=s.id===p.selected?'#f6c874':s.type==='CORE'?'#6ea7dc':'#72aaa4';
    const box=(w:number,h:number,d:number,x:number,y:number,z:number)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.7}));m.position.set(x,y,z);m.userData.siteId=s.id;group.add(m);};
    if(s.type==='GBT'||s.type==='RTT'){if(s.type==='RTT')box(7,6,6,0,3,0);const base=s.type==='RTT'?6:0;box(.7,12,.7,0,base+6,0);for(let i=0;i<3;i++){const angle=i*Math.PI*2/3;box(.6,3,.8,Math.cos(angle)*1.6,base+10,Math.sin(angle)*1.6);}box(2,2,1.5,3,1,0);}
    else if(s.type==='IBS'){box(8,10,6,0,5,0);for(let floor=1;floor<=3;floor++)box(8.15,.2,6.15,0,floor*3,0);}
    else if(s.type==='SMALL_CELL'){box(.4,8,.4,0,4,0);box(.8,1.5,.8,0,7.5,0);}else{box(10,4,7,0,2,0);box(2,1,2,0,4.5,0);}
    const text=label(s.id);text.position.set(0,s.type==='RTT'?21:s.type==='GBT'?16:s.type==='IBS'?13:11,0);text.userData.siteId=s.id;group.add(text);content.add(group);
   }
   networkLinks.forEach((l,i)=>{if(p.layer!=='all'&&p.layer!==l.kind)return;const a=position(l.a),b=position(l.b),wireless=l.kind==='microwave';a.y=b.y=wireless?12:.5;const middle=a.clone().lerp(b,.5);middle.y=wireless?18:1.2+(i%3)*.3;const curve=new THREE.CatmullRomCurve3([a,middle,b]);const selected=p.selectedLink===l.id,onRoute=p.route.includes(i);const material=new THREE.MeshBasicMaterial({color:p.broken[i]?'#ee7777':selected?'#ffffff':onRoute?'#f4c76d':wireless?'#ae91dd':l.kind==='ethernet'?'#6ca9e3':'#49bfac',transparent:true,opacity:selected||onRoute?1:.65});const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,24,selected?.65:onRoute?.45:.23,5,false),material);mesh.userData.linkId=l.id;content.add(mesh);});
  };refresh.current();
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=[0,0];const start=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};const click=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=el.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(content.children,true)[0];if(hit?.object.userData.siteId)state.current.onSite(hit.object.userData.siteId);else if(hit?.object.userData.linkId)state.current.onLink(hit.object.userData.linkId);};renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointerup',click);
  const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/Math.max(el.clientHeight,1);camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();let frame=0;const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);};animate();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();disposeObject(scene);content.traverse(o=>{if(o instanceof THREE.Sprite)o.material.map?.dispose();});renderer.dispose();renderer.domElement.remove();refresh.current=()=>{};};
 },[]);
 return <div className="network-3d"><div ref={host} className="network-3d-host"/>{error&&<p role="alert">{error}</p>}<button className="network-3d-reset" onClick={()=>reset.current()}>Reset 3D view</button><div className="network-3d-note">30 sites · drag to orbit · scroll to zoom<br/>Gold = selected route · elevated purple = microwave<br/>Schematic placement and heights · open a site for local cabling</div></div>;
}
