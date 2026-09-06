import {siteDefinitions,siteById} from './private-network.ts';
export const city={name:'Austin, Texas',lat:30.2672,lon:-97.7431};
export function siteGeo(id:string){const s=siteById(id)!;return {lat:city.lat-(s.y-350)*2.5/111320,lon:city.lon+(s.x-500)*2.5/(111320*Math.cos(city.lat*Math.PI/180))};}
export function mercator(lat:number,lon:number,z:number){const n=256*2**z,r=lat*Math.PI/180;return {x:(lon+180)/360*n,y:(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n};}
export type RFConfig={frequency:number;power:number;gain:number;loss:number;exponent:number;margin:number;threshold:number;bandwidth:number;noiseFigure:number;azimuth:number;beamwidth:number};
export const defaults=(id:string):RFConfig=>({frequency:3500,power:id.startsWith('IBS')?20:30,gain:id.startsWith('IBS')?3:15,loss:2,exponent:id.startsWith('IBS')?3.5:3,margin:10,threshold:-95,bandwidth:20,noiseFigure:7,azimuth:0,beamwidth:120});
export const defaultRF=()=>Object.fromEntries(siteDefinitions.map(s=>[s.id,defaults(s.id)]));
export const eirp=(c:RFConfig)=>c.power+c.gain-c.loss;
export function receivedPower(c:RFConfig,distance:number,bearing=c.azimuth){const delta=Math.abs(((bearing-c.azimuth+540)%360)-180),attenuation=Math.min(30,12*(delta/c.beamwidth)**2);return eirp(c)-(32.44+20*Math.log10(c.frequency)-60+10*c.exponent*Math.log10(Math.max(1,distance)))-c.margin-attenuation;}
export function coverageRadius(c:RFConfig,threshold=c.threshold){return Math.max(0,10**((eirp(c)-c.margin-threshold-(32.44+20*Math.log10(c.frequency)-60))/(10*c.exponent)));}
export const noiseFloor=(c:RFConfig)=>-174+10*Math.log10(c.bandwidth*1e6)+c.noiseFigure;
export const rfFields:[keyof RFConfig,string,number,number,number][]=[['frequency','Frequency (MHz)',700,6000,50],['power','TX power (dBm)',0,46,1],['gain','Antenna gain (dBi)',0,25,1],['loss','Feeder loss (dB)',0,15,.5],['exponent','Path loss exponent',2,5,.1],['margin','Clutter / fade margin (dB)',0,40,1],['threshold','Coverage threshold (dBm)',-120,-50,1],['bandwidth','Bandwidth (MHz)',5,100,5],['noiseFigure','Receiver noise figure (dB)',0,15,1],['azimuth','Sector bearing (° true north)',0,359,1],['beamwidth','Horizontal beamwidth (°)',30,360,5]];
export function parseRF(raw:string){const data=JSON.parse(raw);const result=defaultRF();for(const s of siteDefinitions){const c=data[s.id];if(!c)continue;for(const [k,,min,max] of rfFields){if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<min||c[k]>max)throw new Error('Invalid RF configuration');result[s.id][k]=c[k];}}return result;}
