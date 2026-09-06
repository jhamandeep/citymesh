import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/sites',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','HTMLInputElement','HTMLTextAreaElement','getComputedStyle','localStorage','FormData','Event','MouseEvent','File'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true,writable:true});
window.PointerEvent=window.MouseEvent;globalThis.PointerEvent=window.MouseEvent;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
globalThis.requestAnimationFrame=cb=>setTimeout(cb,0);globalThis.cancelAnimationFrame=clearTimeout;
window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
Element.prototype.scrollIntoView=function(){};
await build({entryPoints:['app/sites/page.tsx'],outfile:'.test-site-bundle.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'isolated-controls',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'stub'}));b.onResolve({filter:/site-viewer$/},()=>({path:'viewer',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},args=>({resolveDir:process.cwd(),loader:'jsx',contents:args.path==='link'?`import React from 'react'; export default function Link(props){return <a {...props}/>;}`:`import React from 'react'; export default function Viewer({equipment,selected,onSelect,siteType}){return <div aria-label="3D model adapter"><span data-testid="site-model-type">{siteType}</span>{equipment.map(e=><button key={e.id} onClick={()=>onSelect(e.id)}>{e.id}</button>)}<output data-testid="selected-asset">{selected}</output></div>;}`}));}}]});
const React=await import('react');const {render,screen,fireEvent,cleanup}=await import('@testing-library/react');const {default:Sites}=await import(pathToFileURL(path.resolve('.test-site-bundle.mjs')).href);
render(React.createElement(Sites));
assert.ok(screen.getByRole('heading',{name:'North perimeter'}));
const tab=name=>fireEvent.click(screen.getByRole('tab',{name:new RegExp(name)}));
tab('03');fireEvent.click(screen.getByRole('button',{name:'Add antenna'}));
fireEvent.change(screen.getByLabelText('Elevation (m)'),{target:{value:'26'}});fireEvent.click(screen.getByRole('button',{name:'Apply equipment changes'}));
assert.equal(JSON.parse(localStorage.getItem('citymesh.site-projects.v1'))['GBT-01'].equipment.length,9);
tab('02');fireEvent.click(screen.getByRole('button',{name:'Approve revision'}));assert.ok(screen.getByText('Resolve design errors before approval.'));
tab('03');fireEvent.change(screen.getByLabelText('Elevation (m)'),{target:{value:'21'}});fireEvent.click(screen.getByRole('button',{name:'Apply equipment changes'}));
tab('02');fireEvent.click(screen.getByRole('button',{name:'Approve revision'}));assert.equal(JSON.parse(localStorage.getItem('citymesh.site-projects.v1'))['GBT-01'].stage,'approved');
tab('04');fireEvent.click(screen.getByRole('button',{name:'Start field build'}));fireEvent.click(screen.getByRole('button',{name:'Accept as-built revision'}));assert.ok(screen.getByText(/Complete every field check/));
for(const box of screen.getAllByRole('checkbox'))fireEvent.click(box);
for(const note of screen.getAllByLabelText('Evidence / verification note'))fireEvent.change(note,{target:{value:'Verified by demo field engineer; evidence reference TEST-42.'}});
fireEvent.click(screen.getByRole('button',{name:'Accept as-built revision'}));assert.equal(JSON.parse(localStorage.getItem('citymesh.site-projects.v1'))['GBT-01'].stage,'accepted');
fireEvent.change(screen.getByLabelText('Observation'),{target:{value:'Cable routing inspection'}});fireEvent.change(screen.getByLabelText('Details'),{target:{value:'Inspect the mounting tray at the next visit.'}});fireEvent.click(screen.getByRole('button',{name:'Record issue'}));assert.equal(JSON.parse(localStorage.getItem('citymesh.site-projects.v1'))['GBT-01'].issues.length,1);fireEvent.click(screen.getByRole('button',{name:'Mark resolved'}));assert.equal(JSON.parse(localStorage.getItem('citymesh.site-projects.v1'))['GBT-01'].issues[0].status,'resolved');
tab('03');fireEvent.click(screen.getByRole('button',{name:'Open revision 2'}));assert.equal(JSON.parse(localStorage.getItem('citymesh.site-projects.v1'))['GBT-01'].revision,2);
cleanup();render(React.createElement(Sites));assert.ok(screen.getByText('Revision 2'));assert.ok(screen.getAllByRole('button',{name:/Proposed antenna/}).length>0);
cleanup();for(const [id,type,name] of [['GBT-08','GBT','Transit corridor'],['RTT-03','RTT','Security command rooftop'],['IBS-10','IBS','Logistics terminal'],['SC-02','SMALL_CELL','Staff transit hub'],['CORE-02','CORE','Disaster recovery core']]){window.history.replaceState({},'','/sites?site='+id);render(React.createElement(Sites));assert.ok(screen.getByRole('heading',{name}));assert.equal(screen.getByTestId('site-model-type').textContent,type);assert.ok(screen.getByTestId('selected-asset').textContent);cleanup();}dom.window.close();console.log('Site control integration passed: model selection adapter, invalid design rejection, editing, approval, evidence-gated acceptance, issue lifecycle, revision restart, and persistence after remount. WebGL rendering is not mocked into a claimed visual pass.');




