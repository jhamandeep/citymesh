import {siteById} from './private-network.ts';
export type SurveyRecord={siteId:string;filename:string;bytes:ArrayBuffer;sha256:string;addedAt:string;source:string;capturedAt:string;note:string;units:'metres'};
export const SURVEY_DATABASE='citymesh.site-surveys.v1';
export function validateSurvey(record:SurveyRecord){
 if(!siteById(record.siteId))throw new Error('Choose a known site for the survey.');
 if(!(record.bytes instanceof ArrayBuffer)||record.bytes.byteLength<20||record.bytes.byteLength>20*1024*1024||new DataView(record.bytes).getUint32(0,true)!==0x46546c67)throw new Error('Choose a self-contained GLB smaller than 20 MB.');
 if(!['filename','source','note','capturedAt','addedAt','sha256'].every(key=>typeof record[key as keyof SurveyRecord]==='string')||!record.filename||record.filename.length>240||record.source.length>240||record.note.length>2000||record.units!=='metres'||(!/^\d{4}-\d{2}-\d{2}$/.test(record.capturedAt)&&record.capturedAt!=='')||!Number.isFinite(Date.parse(record.addedAt))||!/^[a-f0-9]{64}$/.test(record.sha256))throw new Error('Invalid survey metadata.');
 return record;
}
async function digest(bytes:ArrayBuffer){const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');}
export async function makeSurvey(siteId:string,filename:string,bytes:ArrayBuffer,details:{source:string;capturedAt:string;note:string}):Promise<SurveyRecord>{
 return validateSurvey({siteId,filename,bytes,sha256:await digest(bytes),addedAt:new Date().toISOString(),units:'metres',...details});
}
function openDatabase():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('Survey storage is unavailable in this browser.'));return;}let blocked=false;const request=indexedDB.open(SURVEY_DATABASE,1);request.onupgradeneeded=()=>{request.result.createObjectStore('surveys',{keyPath:'siteId'});};request.onerror=()=>reject(request.error||new Error('Unable to open survey storage.'));request.onblocked=()=>{blocked=true;reject(new Error('Close older Citymesh tabs to update survey storage.'));};request.onsuccess=()=>{if(blocked){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};});}
async function transaction<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction('surveys',mode);let result:T;let req:IDBRequest<T>;try{req=operation(tx.objectStore('surveys'));}catch(error){tx.abort();db.close();reject(error);return;}req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||req.error||new Error('Survey storage transaction failed.'));};});}
export async function getSurvey(siteId:string){const value=await transaction<SurveyRecord|undefined>('readonly',store=>store.get(siteId));if(!value)return null;validateSurvey(value);if(await digest(value.bytes)!==value.sha256)throw new Error('Saved survey checksum does not match its file. Import a verified copy.');return value;}
export async function saveSurvey(record:SurveyRecord){validateSurvey(record);if(await digest(record.bytes)!==record.sha256)throw new Error('Survey checksum does not match its file.');await transaction('readwrite',store=>store.put(record));}
export async function removeSurvey(siteId:string){if(!siteById(siteId))throw new Error('Unknown site.');await transaction('readwrite',store=>store.delete(siteId));}

