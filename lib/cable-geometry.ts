import * as THREE from 'three';
import {cableColors,type PhysicalCable} from './cabling.ts';
export function createCableMesh(c:PhysicalCable,selected=false){
 const a=new THREE.Vector3(...c.from.position),b=new THREE.Vector3(...c.to.position);
 const lane=((Array.from(c.id).reduce((n,s)=>n+s.charCodeAt(0),0)%11)-5)*.045;
 const points=a.distanceTo(b)<.05?[a,a.clone().add(new THREE.Vector3(.25,.12,.2)),b.clone().add(new THREE.Vector3(0,.02,0))]:[a,a.clone().add(new THREE.Vector3(0,0,.3+lane)),new THREE.Vector3(b.x,a.y,b.z+.3+lane),b.clone().add(new THREE.Vector3(0,0,.3+lane)),b];
 const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,32,selected?.055:.024,5,false),new THREE.MeshBasicMaterial({color:selected?'#ffffff':cableColors[c.medium]}));
 mesh.userData.cableId=c.id;
 if(selected)for(const point of [a,b]){const marker=new THREE.Mesh(new THREE.SphereGeometry(.095,8,6),new THREE.MeshBasicMaterial({color:'#ffcb78',depthTest:false}));marker.position.copy(point);marker.userData.cableId=c.id;mesh.add(marker);}
 return mesh;
}
