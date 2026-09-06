import {siteById} from './private-network.ts';

export type PhotoRecord={id:string;siteId:string;assetId:string;revision:number;filename:string;mime:string;bytes:ArrayBuffer;sha256:string;source:string;capturedAt:string;note:string;addedAt:string};
export const PHOTO_DATABASE='citymesh.inspection-photos.v1';
export const PHOTO_LIMIT=5*1024*1024;
export function photoMime(bytes:ArrayBuffer){
 const b=new Uint8Array(bytes),s=(a:number,z:number)=>String.fromCharCode(...b.slice(a,z));
 if(b.length>8&&b[0]===137&&s(1,4)==='PNG'&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10)return 'image/png';
 if(b.length>3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.length>12&&s(0,4)==='RIFF'&&s(8,12)==='WEBP')return 'image/webp';
 throw new Error('Choose a JPEG, PNG or WebP photo.');
}
async function digest(bytes:ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}
function validate(r:PhotoRecord){
 if(!siteById(r.siteId)||!r.id||typeof r.id!=='string'||r.id.length>100||typeof r.assetId!=='string'||!r.assetId||r.assetId.length>200||!Number.isInteger(r.revision)||r.revision<1)throw new Error('Invalid photo association.');
 if(!(r.bytes instanceof ArrayBuffer)||r.bytes.byteLength>PHOTO_LIMIT||photoMime(r.bytes)!==r.mime)throw new Error('Photo must be JPEG, PNG or WebP, up to 5 MB.');
 if(!['filename','source','capturedAt','note','addedAt','sha256'].every(k=>typeof r[k as keyof PhotoRecord]==='string')||!r.filename||r.filename.length>240||r.source.length>240||r.note.length>2000||!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isFinite(Date.parse(r.addedAt))||(r.capturedAt!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.capturedAt)||new Date(r.capturedAt).toISOString().slice(0,10)!==r.capturedAt)))throw new Error('Invalid photo metadata.');
 return r;
}
export async function makePhoto(input:Pick<PhotoRecord,'siteId'|'assetId'|'revision'|'filename'|'bytes'|'source'|'capturedAt'|'note'>):Promise<PhotoRecord>{return validate({...input,id:crypto.randomUUID(),mime:photoMime(input.bytes),sha256:await digest(input.bytes),addedAt:new Date().toISOString()});}
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 if(typeof indexedDB==='undefined'){reject(new Error('Photo storage is unavailable in this browser.'));return;}
 let blocked=false;const req=indexedDB.open(PHOTO_DATABASE,1);
 req.onupgradeneeded=()=>req.result.createObjectStore('photos',{keyPath:'id'}).createIndex('siteId','siteId');
 req.onerror=()=>reject(req.error);req.onblocked=()=>{blocked=true;reject(new Error('Close older Citymesh tabs to open photo storage.'));};
 req.onsuccess=()=>{if(blocked){req.result.close();return;}req.result.onversionchange=()=>req.result.close();resolve(req.result);};
 });}
export async function listPhotos(siteId:string){
 if(!siteById(siteId))throw new Error('Unknown site.');const db=await open();
 const records=await new Promise<PhotoRecord[]>((resolve,reject)=>{const tx=db.transaction('photos'),req=tx.objectStore('photos').index('siteId').getAll(siteId);tx.oncomplete=()=>{db.close();resolve(req.result);};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||req.error);};});
 for(const r of records){validate(r);if(await digest(r.bytes)!==r.sha256)throw new Error('Saved photo failed its integrity check.');}
 return records.sort((a,b)=>b.addedAt.localeCompare(a.addedAt));
}
export async function savePhoto(r:PhotoRecord){
 validate(r);if(await digest(r.bytes)!==r.sha256)throw new Error('Photo checksum does not match its file.');const db=await open();
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('photos','readwrite'),store=tx.objectStore('photos'),count=store.index('siteId').count(r.siteId);let failure:Error|null=null;
 count.onsuccess=()=>{if(count.result>=20){failure=new Error('This site has 20 photos. Download and remove older evidence before adding more.');tx.abort();}else {try{store.add(r);}catch(error){failure=error instanceof Error?error:new Error("Photo could not be saved.");tx.abort();}}};
 tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(failure||tx.error||new Error('Photo could not be saved. Existing evidence remains unchanged.'));};});
}
export async function removePhoto(siteId:string,id:string){
 if(!siteById(siteId))throw new Error('Unknown site.');const db=await open();
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('photos','readwrite'),store=tx.objectStore('photos'),req=store.get(id);req.onsuccess=()=>{if(req.result?.siteId===siteId)store.delete(id);else tx.abort();};tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||new Error('Photo does not belong to this site.'));};});
}
