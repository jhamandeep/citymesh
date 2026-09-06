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
await build({entryPoints:['app/page.tsx'],outfile:'.test-network-bundle.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'isolated-controls',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'stub'}));b.onResolve({filter:/network-viewer$/},()=>({path:'network',namespace:'stub'}));b.onResolve({filter:/site-viewer$/},()=>({path:'viewer',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},args=>({resolveDir:process.cwd(),loader:'jsx',contents:args.path==='network'?"export default function NetworkViewer(){return null;}":args.path==='link'?`import React from 'react'; export default function Link(props){return <a {...props}/>;}`:`import React from 'react'; export default function Viewer({equipment,selected,onSelect,siteType}){return <div aria-label="3D model adapter"><span data-testid="site-model-type">{siteType}</span>{equipment.map(e=><button key={e.id} onClick={()=>onSelect(e.id)}>{e.id}</button>)}<output data-testid="selected-asset">{selected}</output></div>;}`}));}}]});
const React=await import('react');const {render,screen,fireEvent,cleanup,waitFor}=await import('@testing-library/react');const {default:Sites}=await import(pathToFileURL(path.resolve('.test-network-bundle.mjs')).href);

render(React.createElement(Sites));assert.ok(screen.getByRole('heading',{name:'One network. Every site connected.'}));assert.equal(screen.getAllByRole('row').length,31);assert.ok(document.querySelectorAll('.circuit-trace li').length>5);fireEvent.click(document.querySelector('.cable-list button'));assert.ok(document.querySelector('.cable-detail').textContent.includes('LC/UPC'));
const physicalLinks=screen.getAllByRole('link').map(a=>a.getAttribute('href')).filter(h=>h?.startsWith('/sites?site='));assert.equal(new Set(physicalLinks.map(h=>h.split('&')[0])).size,30);
fireEvent.click(screen.getByRole('button',{name:'IBS-01 Assembly hall',exact:true}));assert.equal(screen.getByRole('link',{name:'Inspect 3D site'}).getAttribute('href'),'/sites?site=IBS-01');
fireEvent.click(screen.getByRole('button',{name:'Simulate complete site outage'}));assert.equal(document.querySelector('.network-detail .site-health').textContent,'Disconnected');assert.ok(document.querySelector('.trace-warning').textContent.includes('No transport path'));
fireEvent.click(screen.getByRole('button',{name:'Restore simulated site'}));assert.notEqual(document.querySelector('.network-detail .site-health').textContent,'Disconnected');assert.equal(document.querySelector('.trace-warning'),null);
fireEvent.click(screen.getByRole('button',{name:'2D topology'}));fireEvent.click(screen.getByRole('button',{name:/^L01:/}));fireEvent.click(screen.getByRole('button',{name:'Simulate link failure'}));assert.ok(screen.getByText('Offline',{exact:true,selector:'dd'}));fireEvent.click(screen.getByRole('button',{name:'Restore transport link'}));assert.ok(screen.getByText('Available',{exact:true,selector:'dd'}));
fireEvent.change(screen.getByRole('textbox',{name:'Search network sites'}),{target:{value:'IBS-'}});assert.equal(screen.getAllByRole('row').length,11);
cleanup();dom.window.close();console.log('Network control integration passed: all 30 physical-twin links, site selection, site outage/restore, transport outage/restore, and IBS portfolio search. Type-selection popup layout is not verified by this jsdom check.');






