'use client';
import FullscreenButton from '@/components/twin/fullscreen-button';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { siteDefinitions, networkLinks } from '@/lib/private-network';
import type { Project } from '@/lib/site-model';
import { buildSiteCabling, cableColors, type CableMedium } from '@/lib/cabling';
import { createNetworkModel, siteWorldPosition } from '@/lib/network-geometry';
import { inspectionText } from '@/lib/inspection-text';
import {
  coverageMeshes,
  streetTileLayout,
  type GeographicLayers,
} from '@/lib/geographic-geometry';
import { ground } from '@/lib/environment-model';
import {
  environmentMeshes,
  losMeshes,
  drapeGeometry,
} from '@/lib/environment-geometry';
import { disposeObject } from '@/lib/site-geometry';
type Props = {
  geographic?: GeographicLayers;
  portfolio: Record<string, Project>;
  selected: string;
  selectedLink: string | null;
  selectedCable?: string;
  selectedAsset?: string;
  route: number[];
  broken: boolean[];
  layer: string;
  onSite: (id: string) => void;
  onLink: (id: string) => void;
  onCable: (siteId: string, id: string) => void;
  onAsset: (siteId: string, id: string) => void;
};
export default function NetworkViewer(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    state = useRef(props),
    refresh = useRef<() => void>(() => {}),
    rebuild = useRef<() => void>(() => {}),
    reset = useRef<() => void>(() => {}),
    focus = useRef<() => void>(() => {}),
    focusPath = useRef<() => void>(() => {});
  const [error, setError] = useState('');
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    state.current = props;
    refresh.current();
  }, [props]);
  useEffect(() => {
    rebuild.current();
  }, [props.portfolio, props.geographic?.environment]);
  useEffect(() => {
    if (!host.current) return;
    const el = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      queueMicrotask(() =>
        setError(
          'WebGL is unavailable. Choose 2D topology or use the cable schedule.',
        ),
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor('#080f21');
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      'aria-label',
      '30-site 3D network. Focus a site to inspect its equipment and cables. Keyboard alternatives are in the directory and cable schedule.',
    );
    const height = (id: string) => {
      const env = state.current.geographic?.environment,
        p = siteWorldPosition(id);
      return env
        ? (ground(env.terrain, p.x, p.z) ?? env.terrain.reference) -
            env.terrain.reference
        : 0;
    };
    const worldSite = (id: string) =>
      siteWorldPosition(id).add(new THREE.Vector3(0, height(id), 0));
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 15000);
    scene.add(new THREE.AmbientLight(0xdcefff, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(800, 1600, 600);
    scene.add(sun);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxDistance = 20000;
    controls.minDistance = 0.5;
    let overview = true;
    controls.addEventListener('start', () => {
      overview = false;
    });
    const aim = (center: THREE.Vector3, size = 35) => {
      overview = false;
      controls.target.copy(center);
      camera.position
        .copy(center)
        .add(new THREE.Vector3(size * 0.9, size * 0.7, size));
      controls.update();
    };
    reset.current = () => {
      const sphere = new THREE.Box3()
        .setFromPoints(siteDefinitions.map((s) => worldSite(s.id)))
        .expandByScalar(40)
        .getBoundingSphere(new THREE.Sphere());
      const half = Math.atan(
        Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, camera.aspect),
      );
      controls.target.copy(sphere.center);
      camera.position
        .copy(sphere.center)
        .add(
          new THREE.Vector3(0.9, 0.7, 1)
            .normalize()
            .multiplyScalar((sphere.radius / Math.sin(half)) * 1.12),
        );
      controls.update();
      overview = true;
    };
    focus.current = () =>
      aim(
        worldSite(state.current.selected).add(new THREE.Vector3(0, 11, 0)),
        35,
      );
    focusPath.current = () => {
      const geo = state.current.geographic,
        profile = geo?.profile;
      if (!geo?.environment || !profile) return;
      aim(
        new THREE.Vector3(
          (profile.a.x + profile.b.x) / 2,
          (profile.a.y + profile.b.y) / 2 - geo.environment.terrain.reference,
          (profile.a.z + profile.b.z) / 2,
        ),
        Math.max(60, profile.distance * 0.7),
      );
    };
    reset.current();
    const grid = new THREE.GridHelper(2600, 52, 0x45606b, 0x203742);
    scene.add(grid);
    const streets = new THREE.Group();
    scene.add(streets);
    let coverage = new THREE.Group();
    scene.add(coverage);
    let terrainObjects = new THREE.Group(),
      buildingObjects = new THREE.Group(),
      losObjects = new THREE.Group();
    scene.add(terrainObjects, buildingObjects, losObjects);
    let priorEnvironment: GeographicLayers['environment'];
    let priorGeo: GeographicLayers | undefined,
      priorSelected = '',
      tilesLoaded = false,
      disposed = false;
    const addStreets = () => {
      if (tilesLoaded) return;
      tilesLoaded = true;
      const loader = new THREE.TextureLoader();
      for (const tile of streetTileLayout()) {
        const material = new THREE.MeshBasicMaterial({ color: '#d8e1df' }),
          mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(tile.size, tile.size, 32, 32),
            material,
          );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(tile.worldX, -0.3, tile.worldZ);
        if (state.current.geographic?.environment) {
          drapeGeometry(
            mesh.geometry,
            state.current.geographic.environment,
            tile.worldX,
            tile.worldZ,
          );
          mesh.position.y = 0;
        }
        streets.add(mesh);
        loader.load(
          `https://tile.openstreetmap.org/${tile.zoom}/${tile.x}/${tile.y}.png`,
          (texture) => {
            if (disposed) {
              texture.dispose();
              return;
            }
            texture.colorSpace = THREE.SRGBColorSpace;
            material.map = texture;
            material.color.set('#ffffff');
            material.needsUpdate = true;
          },
          undefined,
          () => {
            if (!disposed)
              setError(
                'Street tiles are unavailable. Site geometry and coverage remain usable.',
              );
          },
        );
      }
    };
    let model: ReturnType<typeof createNetworkModel> | null = null;
    const labels = new THREE.Group();
    scene.add(labels);
    let priorCable = '';
    const label = (id: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#11242eee';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#e9f3f5';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(id, 128, 42);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(canvas),
          depthTest: false,
          sizeAttenuation: false,
        }),
      );
      sprite.scale.set(0.07, 0.0175, 1);
      sprite.userData.siteId = id;
      return sprite;
    };
    for (const s of siteDefinitions) {
      const text = label(s.id);
      text.position
        .copy(siteWorldPosition(s.id))
        .add(new THREE.Vector3(0, s.height + 5, 0));
      labels.add(text);
    }
    const focusCable = (id: string) => {
      const s = id.split('/')[0],
        p = state.current.portfolio[s];
      if (!p) return;
      const c = buildSiteCabling(p).cables.find((c) => c.id === id);
      if (!c) return;
      const a = new THREE.Vector3(...c.from.position),
        b = new THREE.Vector3(...c.to.position);
      aim(
        a.clone().lerp(b, 0.5).add(worldSite(s)),
        Math.max(2, a.distanceTo(b) * 0.9),
      );
    };
    refresh.current = () => {
      if (!model) return;
      const p = state.current;
      const geo = p.geographic;
      if (geo?.environment !== priorEnvironment) {
        scene.remove(terrainObjects, buildingObjects);
        disposeObject(terrainObjects);
        disposeObject(buildingObjects);
        if (geo?.environment) {
          const envModel = environmentMeshes(geo.environment);
          terrainObjects = envModel.terrain;
          buildingObjects = envModel.buildings;
          for (const child of streets.children as THREE.Mesh[]) {
            drapeGeometry(
              child.geometry,
              geo.environment,
              child.position.x,
              child.position.z,
            );
            child.position.y = 0;
          }
        } else {
          terrainObjects = new THREE.Group();
          buildingObjects = new THREE.Group();
        }
        scene.add(terrainObjects, buildingObjects);
        priorEnvironment = geo?.environment;
      }
      terrainObjects.visible = !!geo?.layers.includes('terrain');
      buildingObjects.visible = !!geo?.layers.includes('buildings');
      grid.visible = !geo;
      streets.visible = !!geo?.layers.includes('streets');
      if (streets.visible) addStreets();
      labels.visible = !geo || geo.layers.includes('labels');
      for (const lod of model.lods.values())
        lod.visible = !geo || geo.layers.includes('sites');
      if (geo !== priorGeo || p.selected !== priorSelected) {
        scene.remove(coverage, losObjects);
        disposeObject(coverage);
        disposeObject(losObjects);
        losObjects =
          geo?.profile && geo.environment
            ? losMeshes(geo.profile, geo.environment.terrain.reference)
            : new THREE.Group();
        scene.add(losObjects);
        coverage = geo ? coverageMeshes(geo, p.selected) : new THREE.Group();
        if (geo?.environment)
          for (const mesh of coverage.children as THREE.Mesh[]) {
            const positions = mesh.geometry.getAttribute('position');
            for (let i = 0; i < positions.count; i++) {
              const x = positions.getX(i) + mesh.position.x,
                z = -positions.getY(i) + mesh.position.z;
              positions.setZ(
                i,
                (ground(geo.environment.terrain, x, z) ??
                  geo.environment.terrain.reference) -
                  geo.environment.terrain.reference,
              );
            }
            positions.needsUpdate = true;
          }
        scene.add(coverage);
        priorGeo = geo;
        priorSelected = p.selected;
      }
      coverage.visible = !!geo?.layers.includes('coverage');
      losObjects.visible = !!geo?.layers.includes('los');
      networkLinks.forEach((l, i) => {
        const line = model!.links.get(l.id)!;
        line.visible = p.geographic
          ? p.geographic.layers.includes(l.kind)
          : p.layer === 'all' || p.layer === l.kind;
        (line.material as THREE.LineBasicMaterial).color.set(
          p.broken[i]
            ? '#ee7777'
            : p.selectedLink === l.id
              ? '#ffffff'
              : p.route.includes(i)
                ? '#f4c76d'
                : l.kind === 'microwave'
                  ? '#ae91dd'
                  : l.kind === 'ethernet'
                    ? '#6ca9e3'
                    : '#49bfac',
        );
      });
      for (const [id, mesh] of model.cables)
        (mesh.material as THREE.MeshBasicMaterial).color.set(
          id === p.selectedCable
            ? '#ffffff'
            : cableColors[mesh.userData.medium as CableMedium],
        );
      for (const [id, mesh] of model.assets)
        (mesh.material as THREE.MeshStandardMaterial).emissive.set(
          id === `${p.selected}/${p.selectedAsset}` ? '#634916' : '#000000',
        );
      for (const sprite of labels.children as THREE.Sprite[]) {
        (sprite.material as THREE.SpriteMaterial).color.set(
          sprite.userData.siteId === p.selected ? '#ffcf78' : '#ffffff',
        );
        sprite.position.y =
          siteDefinitions.find((s) => s.id === sprite.userData.siteId)!.height +
          5 +
          height(sprite.userData.siteId);
      }
      if (p.selectedCable && p.selectedCable !== priorCable)
        focusCable(p.selectedCable);
      priorCable = p.selectedCable || '';
    };
    rebuild.current = () => {
      if (model) {
        scene.remove(model.group);
        disposeObject(model.group);
      }
      model = createNetworkModel(state.current.portfolio, height);
      scene.add(model.group);
      refresh.current();
    };
    rebuild.current();
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = [0, 0];
    const start = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const click = (e: PointerEvent) => {
      if (!model || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5)
        return;
      const r = el.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      ray.params.Line.threshold = Math.max(
        0.08,
        controls.target.distanceTo(camera.position) * 0.002,
      );
      for (const lod of model.lods.values()) lod.update(camera);
      const pickables: THREE.Object3D[] = [];
      for (const root of [model.group, labels])
        root.traverseVisible((o) => {
          if (
            o instanceof THREE.Mesh ||
            o instanceof THREE.Line ||
            o instanceof THREE.Sprite
          )
            pickables.push(o);
        });
      const hit = ray.intersectObjects(pickables, false)[0];
      if (!hit) return;
      const data = hit.object.userData;
      if (data.linkId) state.current.onLink(data.linkId);
      else if (data.cableId) {
        state.current.onCable(data.siteId, data.cableId);
        focusCable(data.cableId);
      } else if (data.assetId) {
        state.current.onAsset(data.siteId, data.assetId);
        aim(hit.object.getWorldPosition(new THREE.Vector3()), 5);
      } else if (data.siteId) {
        state.current.onSite(data.siteId);
        aim(worldSite(data.siteId).add(new THREE.Vector3(0, 11, 0)), 35);
      }
    };
    const hover = (e: PointerEvent) => {
      if (!model || e.buttons) {
        setTooltip(null);
        return;
      }
      const r = el.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      ray.params.Line.threshold = Math.max(
        0.08,
        controls.target.distanceTo(camera.position) * 0.002,
      );
      const targets: THREE.Object3D[] = [];
      model.group.traverseVisible((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) targets.push(o);
      });
      buildingObjects.traverseVisible((o) => {
        if (o instanceof THREE.Mesh) targets.push(o);
      });
      const hit = ray.intersectObjects(targets, false)[0],
        raw = hit?.object.userData,
        buildingId =
          raw?.buildingBatch && hit?.face
            ? (hit.object as THREE.Mesh).geometry
                .getAttribute('buildingId')
                .getX(hit.face.a)
            : undefined,
        data = buildingId
          ? {
              buildingId,
              height: state.current.geographic?.environment?.buildings.find(
                (b) => b.id === buildingId,
              )?.height,
            }
          : raw,
        p = data?.siteId ? state.current.portfolio[data.siteId] : null,
        l = networkLinks.find((l) => l.id === data?.linkId);
      const text = data?.buildingId
        ? `Austin building ${data.buildingId} · ${data.height === null ? 'height unknown' : data.height + ' m source height'} · 2023 footprint`
        : p
          ? inspectionText(data!, p.equipment, buildSiteCabling(p)) || p.siteId
          : l
            ? l.id + ' · ' + l.kind + ' · ' + l.a + ' ↔ ' + l.b
            : '';
      setTooltip(
        text
          ? {
              text,
              x: Math.max(8, Math.min(r.width - 250, e.clientX - r.left + 14)),
              y: Math.max(8, Math.min(r.height - 65, e.clientY - r.top + 14)),
            }
          : null,
      );
    };
    const leave = () => setTooltip(null);
    renderer.domElement.addEventListener('pointermove', hover);
    renderer.domElement.addEventListener('pointerleave', leave);
    renderer.domElement.addEventListener('pointerdown', start);
    renderer.domElement.addEventListener('pointerup', click);
    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / Math.max(el.clientHeight, 1);
      camera.updateProjectionMatrix();
      if (overview) reset.current();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', hover);
      renderer.domElement.removeEventListener('pointerleave', leave);
      renderer.domElement.removeEventListener('pointerdown', start);
      renderer.domElement.removeEventListener('pointerup', click);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      refresh.current = () => {};
      rebuild.current = () => {};
    };
  }, []);
  return (
    <div className="network-3d">
      <div ref={host} className="network-3d-host" />
      {tooltip && (
        <div
          role="tooltip"
          className="equipment-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="network-3d-navigation">
        <FullscreenButton target=".network-3d" label="3D network" />
        {props.geographic?.profile && (
          <button onClick={() => focusPath.current()}>Focus LoS path</button>
        )}
        <button onClick={() => focus.current()}>Focus {props.selected}</button>
        <button onClick={() => reset.current()}>Show all 30 sites</button>
      </div>
      <div className="network-3d-note">
        {props.geographic && (
          <>
            Austin terrain & buildings · N is toward −Z
            <br />
          </>
        )}
        Click a site to inspect its equipment and local cables in this map.
        <br />
        Click equipment or cabling for details · scroll to zoom · drag to orbit
        <br />
        Site geometry in metres · schematic campus placement · distant sites use
        simplified shapes
      </div>
      {props.geographic && (
        <a
          className="geo-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      )}
    </div>
  );
}
