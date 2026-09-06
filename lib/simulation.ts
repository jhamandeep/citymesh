export type Asset = { id: string; name: string; type: string; x: number; y: number; demand: number; zone: string; backup?: boolean };
export const assets: Asset[] = [
{id:'core',name:'Central exchange',type:'Core router',x:410,y:285,demand:0,zone:'Central',backup:true},
{id:'west',name:'West aggregation',type:'Fiber cabinet',x:220,y:280,demand:0,zone:'West'},
{id:'east',name:'East aggregation',type:'Fiber cabinet',x:615,y:295,demand:0,zone:'East'},
{id:'north',name:'North cell tower',type:'5G tower',x:390,y:115,demand:170,zone:'North'},
{id:'south',name:'South cell tower',type:'5G tower',x:440,y:465,demand:150,zone:'South'},
{id:'hospital',name:'District hospital',type:'Healthcare',x:205,y:140,demand:80,zone:'West',backup:true},
{id:'school',name:'City school',type:'Education',x:100,y:355,demand:65,zone:'West'},
{id:'homes',name:'Residential quarter',type:'Residential',x:175,y:470,demand:230,zone:'West'},
{id:'hall',name:'Municipal offices',type:'Civic service',x:570,y:130,demand:45,zone:'East'},
{id:'industry',name:'Industrial estate',type:'Industry',x:710,y:415,demand:210,zone:'East'},
{id:'water',name:'Water treatment',type:'Water utility',x:615,y:510,demand:20,zone:'East'},
{id:'traffic',name:'Traffic control',type:'Transport',x:385,y:365,demand:30,zone:'Central'},
];
export const links = [
{a:'core',b:'west',capacity:1000},{a:'core',b:'east',capacity:1000},{a:'west',b:'east',capacity:500},
{a:'core',b:'north',capacity:500},{a:'core',b:'south',capacity:500},
{a:'west',b:'hospital',capacity:200},{a:'west',b:'school',capacity:200},{a:'west',b:'homes',capacity:500},
{a:'east',b:'hall',capacity:100},{a:'east',b:'industry',capacity:500},{a:'east',b:'water',capacity:100},
{a:'core',b:'traffic',capacity:100},
];
export const scenarios = [
{id:'normal',name:'Normal operations',description:'All infrastructure available. Establish a baseline.'},
{id:'fiber',name:'Fiber cut',description:'Sever the central-to-west fiber. Traffic uses the east ring.'},
{id:'power',name:'West power outage',description:'West assets lose power. Hospital has backup power, but its network cabinet does not.'},
{id:'tower',name:'Cell tower failure',description:'North tower goes offline. Its users lose connectivity.'},
{id:'peak',name:'Evening demand surge',description:'Double citywide demand and observe link congestion.'},
];
export function simulate(scenario:string, demand:number, disabled:string[] = []) {
 const failed = new Set(disabled);
 if(scenario==='power') assets.filter(a=>a.zone==='West'&&!a.backup).forEach(a=>failed.add(a.id));
 if(scenario==='tower') failed.add('north');
 const broken = (i:number) => failed.has(links[i].a)||failed.has(links[i].b)||(scenario==='fiber'&&i===0);
 const loads=links.map(()=>0); const routes:Record<string,number[]>={};
 for(const asset of assets) {
  if(failed.has(asset.id)||failed.has('core')) continue;
  const queue:[string,number[]][]=[['core',[]]]; const seen=new Set(['core']);
  while(queue.length){ const [id,path]=queue.shift()!; if(id===asset.id){routes[id]=path;break;}
   links.forEach((l,i)=>{const next=l.a===id?l.b:l.b===id?l.a:null;if(next&&!broken(i)&&!seen.has(next)){seen.add(next);queue.push([next,[...path,i]]);}});
  }
 }
 const multiplier=demand/100*(scenario==='peak'?2:1);
 assets.forEach(a=>routes[a.id]?.forEach(i=>loads[i]+=a.demand*multiplier));
 const states=assets.map(a=>{
  const route=routes[a.id];const requested=a.demand*multiplier;
  const fraction=route?Math.min(1,...route.map(i=>links[i].capacity/Math.max(1,loads[i]))):0;
  return {...a,status:!route?'offline':fraction<1?'degraded':'online',requested,delivered:requested*fraction,latency:!route?0:3+route.length*2+Math.max(0,1-fraction)*80,route};
 });
 const services=states.filter(a=>a.demand>0);const online=states.filter(a=>a.status!=='offline').length;
 const delivered=services.reduce((s,a)=>s+a.delivered,0);const requested=services.reduce((s,a)=>s+a.requested,0);
 return {states,loads,broken:links.map((_,i)=>broken(i)),online,delivered,requested,availability:online/assets.length*100,latency:services.filter(a=>a.status!=='offline').reduce((s,a)=>s+a.latency,0)/Math.max(1,services.filter(a=>a.status!=='offline').length)};
}
