import type {Equipment} from './site-model.ts';
import type {CablePlan} from './cabling.ts';
export function inspectionText(data:Record<string,unknown>,equipment:Equipment[],plan?:CablePlan){const id=data.assetId||data.fixtureId;const asset=[...equipment,...(plan?.devices||[])].find(e=>e.id===id);if(asset)return `${asset.id} · ${asset.name}`;const cable=plan?.cables.find(c=>c.id===data.cableId);return cable?`${cable.label} · ${cable.from.assetId}/${cable.from.port} → ${cable.to.assetId}/${cable.to.port}`:'';}
