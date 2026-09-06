import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {makePhoto} from './lib/photo-store.ts';
import {createPortfolio} from './lib/site-model.ts';
const origin='http://localhost:3000',nativeFetch=globalThis.fetch;
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:origin+'/sites'});
for(const k of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','Event','MouseEvent'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true,writable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.fetch=(url,init={})=>nativeFetch(new URL(url,origin),{...init,headers:{...init.headers,...(init.method?{Origin:origin}:{})}});
await build({entryPoints:['components/twin/shared-photos.tsx'],outfile:'.test-shared-photos-bundle.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',loader:{'.css':'empty'}});
const React=await import('react'),{render,screen,fireEvent,cleanup,waitFor}=await import('@testing-library/react'),{default:Panel}=await import(pathToFileURL(path.resolve('.test-shared-photos-bundle.mjs')).href);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5V8AAAAASUVORK5CYII=','base64'),bytes=png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength);
const photo=await makePhoto({siteId:'GBT-01',assetId:'ANT-A',revision:1,filename:'shared-controls.png',bytes,source:'UI test fixture',capturedAt:'2026-09-06',note:'Local emulator test'});
let located='';const props={siteId:'GBT-01',local:[photo],equipment:createPortfolio()['GBT-01'].equipment,onSelect:id=>located=id};
try{
 render(React.createElement(Panel,props));await waitFor(()=>assert.equal(screen.getByRole('button',{name:'Refresh shared photos'}).disabled,false));
 fireEvent.change(screen.getByLabelText('Local photo to share'),{target:{value:photo.id}});fireEvent.click(screen.getByRole('button',{name:'Share selected photo'}));await waitFor(()=>assert.ok(screen.getByText(/Photo shared with portfolio v/)));
 fireEvent.click(screen.getByRole('button',{name:'Locate shared component'}));assert.equal(located,'ANT-A');assert.match(screen.getByRole('link',{name:'Download shared original'}).href,new RegExp(photo.id));
 cleanup();render(React.createElement(Panel,{...props,local:[]}));await waitFor(()=>assert.ok(screen.getByText(photo.filename)));assert.ok(screen.getByText(/equipment r1 · portfolio v/));
 fireEvent.click(screen.getByRole('button',{name:'Remove shared photo'}));fireEvent.click(screen.getByRole('button',{name:'Cancel shared removal'}));assert.ok(screen.getByText(photo.filename));fireEvent.click(screen.getByRole('button',{name:'Remove shared photo'}));fireEvent.click(screen.getByRole('button',{name:'Confirm shared removal'}));await waitFor(()=>assert.ok(screen.getByText('Shared photo removed.')));assert.ok(screen.getByText('No shared photos for this site.'));
}finally{cleanup();await fetch('/api/photos?site=GBT-01&id='+photo.id,{method:'DELETE'});globalThis.fetch=nativeFetch;dom.window.close();}
console.log('PASS: actual shared photo controls against local D1/R2: explicit share, equipment locate, download link, reopen without local copy, cancel and confirmed shared deletion. No browser rendering claim.');
