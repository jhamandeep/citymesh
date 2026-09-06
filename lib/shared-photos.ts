import type {D1Database,R2Bucket} from '@cloudflare/workers-types';
import {validatePhoto,photoDigest,type PhotoRecord} from './photo-store.ts';
import {parseProject} from './site-model.ts';
export type SharedPhoto=Omit<PhotoRecord,'bytes'>&{byteLength:number;portfolioVersion:number;sharedAt:string};
type Row={id:string;site_id:string;object_key:string;metadata:string;portfolio_version:number;shared_at:string};
export class PhotoError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
const metadata=(r:Row):SharedPhoto=>({...JSON.parse(r.metadata),portfolioVersion:r.portfolio_version,sharedAt:r.shared_at});
export async function readPhoto(db:D1Database,site:string,id:string){return db.prepare('SELECT * FROM inspection_photos WHERE site_id=? AND id=?').bind(site,id).first<Row>();}
export async function sharedPhotoList(db:D1Database,site:string){const result=await db.prepare('SELECT * FROM inspection_photos WHERE site_id=? ORDER BY shared_at DESC LIMIT 20').bind(site).all<Row>();return result.results.map(metadata);}
export async function publishPhoto(db:D1Database,bucket:R2Bucket,photo:PhotoRecord,version:number){
 validatePhoto(photo);if(await photoDigest(photo.bytes)!==photo.sha256)throw new PhotoError('Photo checksum does not match its original.');
 const {bytes,...details}=photo,body=JSON.stringify({...details,byteLength:bytes.byteLength});
 const existing=await readPhoto(db,photo.siteId,photo.id);
 if(existing){if(existing.metadata!==body)throw new PhotoError('This photo ID is already associated with different evidence.',409);return metadata(existing);}
 if(!Number.isSafeInteger(version)||version<1)throw new PhotoError('Publish a shared portfolio before sharing photos.',409);
 const snapshot=await db.prepare('SELECT body FROM portfolio_revision_sites WHERE version=? AND site_id=?').bind(version,photo.siteId).first<{body:string}>();
 if(!snapshot)throw new PhotoError('The selected shared portfolio version is unavailable.',409);
 const project=parseProject(JSON.parse(snapshot.body));
 if(project.revision!==photo.revision||!project.equipment.some(e=>e.id===photo.assetId))throw new PhotoError('Publish the matching equipment revision before sharing this photo.',409);
 const objectKey=`photos/${photo.siteId}/${crypto.randomUUID()}`,sharedAt=new Date().toISOString();
 await bucket.put(objectKey,bytes,{httpMetadata:{contentType:photo.mime},customMetadata:{sha256:photo.sha256}});
 // Each attempt owns a unique object. Never erase it after an ambiguous database failure.
 const result=await db.prepare('INSERT INTO inspection_photos(id,site_id,object_key,metadata,portfolio_version,shared_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM inspection_photos WHERE site_id=?)<20 ON CONFLICT(id) DO NOTHING').bind(photo.id,photo.siteId,objectKey,body,version,sharedAt,photo.siteId).run();
 if(result.meta.changes!==1){await bucket.delete(objectKey);const winner=await readPhoto(db,photo.siteId,photo.id);if(winner?.metadata===body)return metadata(winner);throw new PhotoError(winner?'Photo ID conflict.':'This site has 20 shared photos. Remove older shared evidence before uploading more.',409);}
 return {...details,byteLength:bytes.byteLength,portfolioVersion:version,sharedAt};
}
export async function deleteSharedPhoto(db:D1Database,bucket:R2Bucket,site:string,id:string){const row=await readPhoto(db,site,id);if(!row)throw new PhotoError('Shared photo not found.',404);await db.prepare('DELETE FROM inspection_photos WHERE site_id=? AND id=? AND object_key=?').bind(site,id,row.object_key).run();try{await bucket.delete(row.object_key);}catch{console.warn('Removed photo metadata; unreferenced object cleanup required.');}}
