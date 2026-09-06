import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {surveyBytes} from './survey.test.mjs';
import {makeSurvey,saveSurvey,getSurvey,removeSurvey} from './lib/survey-store.ts';
import {loadSiteGlb,disposeObject} from './lib/site-geometry.ts';
const origin='http://localhost:3000',nativeFetch=globalThis.fetch,dom=new JSDOM('<!doctype html><html><body></body></html>',{url:origin+'/sites',pretendToBeVisual:true});
for(const k of ['window','document','navigator','HTMLElement','Element','Node','MutationObserver','HTMLInputElement','HTMLTextAreaElement','getComputedStyle','FormData','Event','MouseEvent','File'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true,writable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;window.PointerEvent=window.MouseEvent;globalThis.PointerEvent=window.MouseEvent;globalThis.requestAnimationFrame=cb=>setTimeout(cb,0);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.fetch=(url,init={})=>nativeFetch(new URL(url,origin),{...init,headers:{...init.headers,...(init.method?{Origin:origin}:{})}});
await build({entryPoints:['components/twin/survey-panel.tsx'],outfile:'.test-shared-surveys-bundle.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',loader:{'.css':'empty'}});
const React=await import('react'),{render,screen,fireEvent,cleanup,waitFor}=await import('@testing-library/react'),{default:Panel}=await import(pathToFileURL(path.resolve('.test-shared-surveys-bundle.mjs')).href);
const record=await makeSurvey('GBT-01','cross-device.glb',surveyBytes,{source:'Control test',capturedAt:'2026-09-06',note:'Local test only'});record.alignment={offset:[7,3,-4],yaw:90,scale:1.5,overlay:true};await saveSurvey(record);
let opened=0,last;const props={siteId:'GBT-01',active:true,onDesign(){},onOpen:async r=>{const glb=await loadSiteGlb(r.bytes);disposeObject(glb.scene);last=r;opened++;}};
const url='/api/surveys?site=GBT-01';
try{
 render(React.createElement(Panel,props));await waitFor(()=>assert.equal(screen.getByRole('button',{name:'Share current model & alignment'}).disabled,false));
 fireEvent.click(screen.getByRole('button',{name:'Share current model & alignment'}));await waitFor(()=>assert.ok(screen.getByText(/Survey and alignment shared as v/)));const state=await (await fetch(url)).json();assert.deepEqual(state.survey.alignment,record.alignment);
 cleanup();await removeSurvey('GBT-01');const previous=opened;render(React.createElement(Panel,props));await waitFor(()=>assert.equal(screen.getByRole('button',{name:'Open shared survey'}).disabled,false));
 fireEvent.click(screen.getByRole('button',{name:'Open shared survey'}));await waitFor(()=>assert.ok(screen.getByText(/opened with its saved alignment/)));assert.equal(opened,previous+1);assert.deepEqual(last.alignment,record.alignment);assert.deepEqual((await getSurvey('GBT-01')).bytes,record.bytes);assert.deepEqual((await getSurvey('GBT-01')).alignment,record.alignment);
 fireEvent.click(screen.getByRole('button',{name:'Open shared survey'}));assert.ok(screen.getByText(/Replace this browser’s survey/));fireEvent.click(screen.getByRole('button',{name:'Cancel shared survey action'}));assert.equal(opened,previous+1);
 fireEvent.click(screen.getByRole('button',{name:'Remove shared survey'}));fireEvent.click(screen.getByRole('button',{name:'Confirm shared survey remove'}));await waitFor(()=>assert.ok(screen.getByText('Shared survey removed. Local copies are unchanged.')));assert.ok(await getSurvey('GBT-01'));
}finally{cleanup();const state=await (await fetch(url)).json();if(state.survey)await fetch(url+'&version='+state.version,{method:'DELETE'});await removeSurvey('GBT-01');globalThis.fetch=nativeFetch;dom.window.close();}
console.log('PASS: complete survey panel shares to local D1/R2, reopens with no local model through real GLTF parsing, preserves original bytes/alignment in browser storage, confirms replacement and removes only the shared copy.');
