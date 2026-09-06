import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applySurveyAlignment,setSurveyOverlay,validateAlignment} from './lib/survey-alignment.ts';
import {makeSurvey,saveSurvey,getSurvey,removeSurvey} from './lib/survey-store.ts';
import {surveyBytes} from './survey.test.mjs';
const wrapper=new THREE.Group(),source=new THREE.Group();source.position.set(5,0,1);const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),new THREE.MeshBasicMaterial());source.add(sphere);wrapper.add(source);
const transform={offset:[10,20,30],yaw:90,scale:2,overlay:true};
applySurveyAlignment(wrapper,transform);const center=source.getWorldPosition(new THREE.Vector3());assert.ok(center.distanceTo(new THREE.Vector3(8,20,40))<1e-10);assert.deepEqual(source.position.toArray(),[5,0,1]);
const ray=new THREE.Raycaster(new THREE.Vector3(8,20,30),new THREE.Vector3(0,0,1));const hit=ray.intersectObject(wrapper,true)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.z-38)<1e-5);const size=new THREE.Box3().setFromObject(wrapper).getSize(new THREE.Vector3());assert.ok(Math.abs(size.x-4)<1e-5);
applySurveyAlignment(wrapper,transform);assert.ok(source.getWorldPosition(new THREE.Vector3()).distanceTo(center)<1e-10,'Repeated edits must not accumulate transforms');applySurveyAlignment(wrapper,validateAlignment(undefined));assert.deepEqual(source.getWorldPosition(new THREE.Vector3()).toArray(),[5,0,1]);
for(const a of [{...transform,scale:0},{...transform,scale:NaN},{...transform,offset:[Infinity,0,0]},{...transform,yaw:361},{...transform,overlay:'true'}])assert.throws(()=>validateAlignment(a));
setSurveyOverlay(wrapper,true);assert.equal(sphere.material.opacity,.3);assert.equal(sphere.material.depthWrite,false);setSurveyOverlay(wrapper,false);assert.equal(sphere.material.opacity,1);assert.equal(sphere.material.depthWrite,true);
const legacy=await makeSurvey('RTT-01','survey.glb',surveyBytes,{source:'Fixture',capturedAt:'',note:''});await saveSurvey(legacy);assert.deepEqual(validateAlignment((await getSurvey('RTT-01')).alignment),{offset:[0,0,0],yaw:0,scale:1,overlay:false});await saveSurvey({...legacy,alignment:transform});const restored=await getSurvey('RTT-01');assert.deepEqual(restored.alignment,transform);assert.equal(restored.sha256,legacy.sha256);assert.deepEqual(restored.bytes,legacy.bytes);await removeSurvey('RTT-01');sphere.geometry.dispose();sphere.material.dispose();
console.log('Survey alignment verified: source transforms retained, clockwise rotation/scale/offset, transformed raycast and bounds, idempotent edits, invalid-value rejection, legacy defaults and persisted alignment with unchanged source bytes.');

