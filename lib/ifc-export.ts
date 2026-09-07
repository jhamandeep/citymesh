import { parseProject, type Project } from './site-model.ts';
import { createCableCurve } from './cable-geometry.ts';
import { buildSiteCabling, externalCable } from './cabling.ts';
import * as THREE from 'three';
import { createStructure, disposeObject } from './site-geometry.ts';
import { siteDefinitions, networkLinks } from './private-network.ts';
import { siteWorldPosition } from './network-geometry.ts';
import { siteGeo } from './geo-rf.ts';
import { ground, buildingBase, type Environment } from './environment-model.ts';
import { environmentMeshes } from './environment-geometry.ts';
// STEP strings use IFC Unicode escapes; doubled apostrophes preserve literal text.
function stepText(value: string) {
  let output = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i),
      c = value[i];
    output +=
      c === "'"
        ? "''"
        : c === '\\' || code < 32 || code > 126
          ? `\\X2\\${code.toString(16).toUpperCase().padStart(4, '0')}\\X0\\`
          : c;
  }
  return `'${output}'`;
}
async function guid(key: string) {
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)),
  );
  let n = BigInt(0);
  for (const v of hash.slice(0, 16)) n = n * BigInt(256) + BigInt(v);
  const alphabet =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let out = '';
  for (let i = 0; i < 22; i++) {
    out = alphabet[Number(n % BigInt(64))] + out;
    n /= BigInt(64);
  }
  return `'${out}'`;
}
const real = (n: number) => Number(n.toFixed(8)).toFixed(8);
async function buildSingleIfc(
  input: Project,
  options: { includeCabling?: boolean } = {},
) {
  const p = parseProject(input);
  const wiring = options.includeCabling
    ? buildSiteCabling(p)
    : { devices: [], cables: [] };
  const elementRefs = new Map<string, string>();
  const lines: string[] = [];
  const add = (entity: string) => {
    lines.push(`#${lines.length + 1}=${entity};`);
    return `#${lines.length}`;
  };
  const origin = add('IFCCARTESIANPOINT((0.,0.,0.))'),
    up = add('IFCDIRECTION((0.,0.,1.))'),
    east = add('IFCDIRECTION((1.,0.,0.))'),
    world = add(`IFCAXIS2PLACEMENT3D(${origin},${up},${east})`),
    context = add(
      `IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.00001,${world},$)`,
    ),
    unit = add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'),
    units = add(`IFCUNITASSIGNMENT((${unit}))`);
  const project = add(
      `IFCPROJECT(${await guid(p.siteId + ':project')},$,${stepText(p.name)},'Citymesh synthetic equipment model',$,$,${stepText(p.stage)},(${context}),${units})`,
    ),
    placement = add(`IFCLOCALPLACEMENT($,${world})`),
    site = add(
      `IFCSITE(${await guid(p.siteId + ':site')},$,${stepText(p.name)},${stepText(p.survey.note)},$,${placement},$,$,.ELEMENT.,$,$,0.,$,$)`,
    );
  add(
    `IFCRELAGGREGATES(${await guid(p.siteId + ':aggregate')},$,$,$,${project},(${site}))`,
  );
  const contained: string[] = [];
  const origin2d = add('IFCCARTESIANPOINT((0.,0.))'),
    profilePlacement = add(`IFCAXIS2PLACEMENT2D(${origin2d},$)`);
  for (const e of [...p.equipment, ...wiring.devices]) {
    const theta = (e.azimuth * Math.PI) / 180;
    const point = add(
        `IFCCARTESIANPOINT((${real(e.position[0])},${real(-e.position[2])},${real(e.position[1] - e.size[1] / 2)}))`,
      ),
      direction = add(
        `IFCDIRECTION((${real(Math.cos(theta))},${real(-Math.sin(theta))},0.))`,
      ),
      axis = add(`IFCAXIS2PLACEMENT3D(${point},${up},${direction})`),
      local = add(`IFCLOCALPLACEMENT(${placement},${axis})`),
      profile = add(
        `IFCRECTANGLEPROFILEDEF(.AREA.,$,${profilePlacement},${real(e.size[0])},${real(e.size[2])})`,
      ),
      solid = add(
        `IFCEXTRUDEDAREASOLID(${profile},${world},${up},${real(e.size[1])})`,
      ),
      shape = add(
        `IFCSHAPEREPRESENTATION(${context},'Body','SweptSolid',(${solid}))`,
      ),
      representation = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shape}))`),
      element = add(
        `${options.includeCabling ? 'IFCDISTRIBUTIONELEMENT' : 'IFCBUILDINGELEMENTPROXY'}(${await guid(p.siteId + ':' + e.id)},$,${stepText(e.name)},${stepText(e.kind)},${stepText(e.kind)},${local},${representation},${stepText(e.id)}${options.includeCabling ? '' : ',.NOTDEFINED.'})`,
      );
    contained.push(element);
    elementRefs.set(e.id, element);
    const properties = Object.entries({
      SiteId: p.siteId,
      DesignFixture: String(wiring.devices.some((d) => d.id === e.id)),
      AssetId: e.id,
      LogicalId: e.logicalId,
      Manufacturer: e.vendor,
      Model: e.model,
      SerialNumber: e.serial,
      Condition: e.condition,
      PowerWatts: String(e.power),
      MassKg: String(e.weight),
      AzimuthDegrees: String(e.azimuth),
      Revision: String(p.revision),
    }).map(([key, value]) =>
      add(
        `IFCPROPERTYSINGLEVALUE(${stepText(key)},$,IFCLABEL(${stepText(value)}),$)`,
      ),
    );
    const pset = add(
      `IFCPROPERTYSET(${await guid(p.siteId + ':' + e.id + ':properties')},$,'Citymesh_Equipment',$,(${properties.join(',')}))`,
    );
    add(
      `IFCRELDEFINESBYPROPERTIES(${await guid(p.siteId + ':' + e.id + ':relation')},$,$,$,(${element}),${pset})`,
    );
  }
  const portRefs = new Map<string, string>();
  for (const c of wiring.cables) {
    const coords = (v: number[]) =>
      `${real(v[0])},${real(-v[2])},${real(v[1])}`;

    const points = createCableCurve(c)
      .getPoints(32)
      .map((v) => add(`IFCCARTESIANPOINT((${coords(v.toArray())}))`));
    const axisCurve = add(`IFCPOLYLINE((${points.join(',')}))`),
      shape = add(
        `IFCSHAPEREPRESENTATION(${context},'Axis','Curve3D',(${axisCurve}))`,
      ),
      rep = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shape}))`);
    const cable = add(
      `IFCCABLESEGMENT(${await guid(c.id + ':cable')},$,${stepText(c.label)},${stepText(c.details)},${stepText(c.medium)},${placement},${rep},${stepText(c.id)},.CABLESEGMENT.)`,
    );
    contained.push(cable);
    const props = Object.entries({
      CableId: c.id,
      Medium: c.medium,
      CableSpecification: c.cable,
      EstimatedLengthMetres: String(c.length),
      LengthBasis: c.lengthBasis,
      Service: c.service,
      FromAsset: c.from.assetId,
      FromPort: c.from.port,
      FromConnector: c.from.connector,
      ToAsset: c.to.assetId,
      ToPort: c.to.port,
      ToConnector: c.to.connector,
      DesignStatus: 'Illustrative; not surveyed or field-tested',
      TransportLink: c.networkLink || '',
    }).map(([key, value]) =>
      add(
        `IFCPROPERTYSINGLEVALUE(${stepText(key)},$,IFCLABEL(${stepText(value)}),$)`,
      ),
    );
    const set = add(
      `IFCPROPERTYSET(${await guid(c.id + ':pset')},$,'Citymesh_Cabling',$,(${props.join(',')}))`,
    );
    add(
      `IFCRELDEFINESBYPROPERTIES(${await guid(c.id + ':properties')},$,$,$,(${cable}),${set})`,
    );
    const ends: string[] = [];
    for (const end of [c.from, c.to]) {
      const key = `${p.siteId}/${end.assetId}/${end.port}`;
      let port = portRefs.get(key);
      if (!port) {
        const point = add(`IFCCARTESIANPOINT((${coords(end.position)}))`),
          axis = add(`IFCAXIS2PLACEMENT3D(${point},${up},${east})`),
          local = add(`IFCLOCALPLACEMENT(${placement},${axis})`);
        port = add(
          `IFCDISTRIBUTIONPORT(${await guid(key + ':port')},$,${stepText(end.port)},${stepText(end.connector)},${stepText(c.medium)},${local},$,.SOURCEANDSINK.,.CABLE.,.${c.medium === 'dc' || c.medium === 'ground' ? 'ELECTRICAL' : 'COMMUNICATION'}.)`,
        );
        portRefs.set(key, port);
        const owner = elementRefs.get(end.assetId);
        if (!owner) throw new Error(`Missing BIM endpoint: ${end.assetId}`);
        add(
          `IFCRELNESTS(${await guid(key + ':nest')},$,$,$,${owner},(${port}))`,
        );
      }
      ends.push(port);
    }
    add(
      `IFCRELCONNECTSPORTS(${await guid(c.id + ':connection')},$,${stepText(c.label)},${stepText('Physical cable continuity; bidirectional design connection')},${ends[0]},${ends[1]},${cable})`,
    );
  }
  if (contained.length)
    add(
      `IFCRELCONTAINEDINSPATIALSTRUCTURE(${await guid(p.siteId + ':containment')},$,$,$,(${contained.join(',')}),${site})`,
    );
  const text = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\nFILE_NAME(${stepText(p.siteId + '.ifc')},${stepText(new Date().toISOString())},('Citymesh'),('Prototype'),'Citymesh','Citymesh','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
  return {
    text,
    lines,
    project,
    placement,
    site,
    context,
    units,
    world,
    up,
    east,
    elementRefs,
    portRefs,
  };
}

export async function exportIfc(
  input: Project,
  options: { includeCabling?: boolean } = {},
) {
  return (await buildSingleIfc(input, options)).text;
}
/** Remap STEP references without touching # characters inside quoted property strings. */
function remapStep(
  line: string,
  offset: number,
  projectRef: string,
  root: string,
) {
  return line.replace(/'(?:''|[^'])*'|#\d+/g, (token) =>
    token.startsWith("'")
      ? token
      : token === projectRef
        ? root
        : `#${Number(token.slice(1)) + offset}`,
  );
}
export async function exportPortfolioIfc(
  input: Record<string, Project>,
  environment?: Environment,
) {
  if (
    Object.keys(input).length !== siteDefinitions.length ||
    siteDefinitions.some((s) => !input[s.id] || input[s.id].siteId !== s.id)
  )
    throw new Error(
      'Export requires all 30 correctly identified site projects.',
    );
  const elevation = (id: string) => {
    if (!environment) return 0;
    const pos = siteWorldPosition(id),
      value = ground(environment.terrain, pos.x, pos.z);
    if (value === null)
      throw new Error(id + ' lies outside the source terrain');
    return value;
  };
  const portfolio = Object.fromEntries(
      siteDefinitions.map((s) => [s.id, parseProject(input[s.id])]),
    ),
    lines: string[] = [],
    owners = new Map<string, string>(),
    ports = new Map<string, string>(),
    placements = new Map<string, string>();
  let next = 0,
    root = '',
    context = '',
    units = '',
    world = '',
    up = '',
    east = '',
    globalPlacement = '';
  const add = (entity: string) => {
    const ref = `#${++next}`;
    lines.push(`${ref}=${entity};`);
    return ref;
  };
  for (const p of Object.values(portfolio)) {
    const part = await buildSingleIfc(p, { includeCabling: true }),
      offset = next,
      ref = (r: string) => `#${Number(r.slice(1)) + offset}`;
    if (!root) root = ref(part.project);
    const projectRoot = root;
    for (const line of part.lines) {
      if (offset && line.startsWith(part.project + '=')) continue;
      lines.push(
        remapStep(line, offset, offset ? part.project : '', projectRoot),
      );
    }
    next = offset + part.lines.length;
    if (!context) {
      context = ref(part.context);
      units = ref(part.units);
      world = ref(part.world);
      up = ref(part.up);
      east = ref(part.east);
      globalPlacement = add(`IFCLOCALPLACEMENT($,${world})`);
      const index = lines.findIndex((l) => l.startsWith(root + '='));
      lines[index] =
        `${root}=IFCPROJECT(${await guid('citymesh:campus:project')},$,'Citymesh Austin private network','30 hypothetical sites with coordinated local wiring and transport',$,$,'Mixed site revisions',(${context}),${units});`;
    }
    const pos = siteWorldPosition(p.siteId),
      point = add(
        `IFCCARTESIANPOINT((${real(pos.x)},${real(-pos.z)},${real(elevation(p.siteId))}))`,
      ),
      axis = add(`IFCAXIS2PLACEMENT3D(${point},${up},${east})`),
      placement = ref(part.placement);
    placements.set(p.siteId, placement);
    const index = lines.findIndex((l) => l.startsWith(placement + '='));
    lines[index] = `${placement}=IFCLOCALPLACEMENT($,${axis});`;
    for (const [id, r] of part.elementRefs)
      owners.set(`${p.siteId}/${id}`, ref(r));
    for (const [id, r] of part.portRefs) ports.set(id, ref(r));
    const structure = createStructure(
      siteDefinitions.find((s) => s.id === p.siteId)!.type,
    );
    structure.updateMatrixWorld(true);
    const vertices: number[][] = [],
      faces: number[][] = [];
    structure.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const positions = o.geometry.getAttribute('position'),
        base = vertices.length;
      for (let i = 0; i < positions.count; i++) {
        const v = new THREE.Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(o.matrixWorld);
        vertices.push([v.x, -v.z, v.y]);
      }
      const indices = o.geometry.index;
      for (let i = 0; i < (indices?.count || positions.count); i += 3)
        faces.push(
          [0, 1, 2].map(
            (j) => base + (indices ? indices.getX(i + j) : i + j) + 1,
          ),
        );
    });
    disposeObject(structure);
    const pointList = add(
        `IFCCARTESIANPOINTLIST3D((${vertices.map((v) => '(' + v.map(real).join(',') + ')').join(',')}))`,
      ),
      tessellation = add(
        `IFCTRIANGULATEDFACESET(${pointList},$,.F.,(${faces.map((v) => '(' + v.join(',') + ')').join(',')}),$)`,
      ),
      body = add(
        `IFCSHAPEREPRESENTATION(${context},'Body','Tessellation',(${tessellation}))`,
      ),
      representation = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${body}))`),
      structureElement = add(
        `IFCBUILDINGELEMENTPROXY(${await guid(p.siteId + ':structure')},$,${stepText(p.siteId + ' parametric structure')},'Demonstration mast, building, pole or foundation; not surveyed','Site structure',${placement},${representation},${stepText(p.siteId + '/STRUCTURE')},.NOTDEFINED.)`,
      );
    add(
      `IFCRELCONTAINEDINSPATIALSTRUCTURE(${await guid(p.siteId + ':structure:containment')},$,$,$,(${structureElement}),${ref(part.site)})`,
    );
    const geo = siteGeo(p.siteId),
      props = Object.entries({
        SiteId: p.siteId,
        Latitude: String(geo.lat),
        Longitude: String(geo.lon),
        CoordinateReference:
          'Local metres: X east, Y north, Z up; origin Austin 30.2672,-97.7431',
        GroundElevationMetres: String(elevation(p.siteId)),
        ElevationBasis: environment
          ? 'USGS source elevation in metres; vertical datum alignment not independently verified'
          : 'Flat hypothetical design datum',
        PositionStatus: 'Hypothetical placement; not a surveyed georeference',
        Revision: String(p.revision),
      }).map(([k, v]) =>
        add(
          `IFCPROPERTYSINGLEVALUE(${stepText(k)},$,IFCLABEL(${stepText(v)}),$)`,
        ),
      ),
      pset = add(
        `IFCPROPERTYSET(${await guid(p.siteId + ':geographic')},$,'Citymesh_Location',$,(${props.join(',')}))`,
      );
    add(
      `IFCRELDEFINESBYPROPERTIES(${await guid(p.siteId + ':geographic:relation')},$,$,$,(${ref(part.site)}),${pset})`,
    );
  }
  const transport: string[] = [];
  for (const l of networkLinks) {
    const c = externalCable(l, portfolio),
      wireless = l.kind === 'microwave';
    if (
      [c.from, c.to].some((end) => !owners.has(`${end.siteId}/${end.assetId}`))
    )
      throw new Error(
        `${l.id} has a missing site termination. Restore its gateway before exporting a connected campus.`,
      );
    const coords = (end: typeof c.from) => {
        const offset = siteWorldPosition(end.siteId);
        return [
          offset.x + end.position[0],
          -(offset.z + end.position[2]),
          end.position[1] + elevation(end.siteId),
        ];
      },
      a = coords(c.from),
      b = coords(c.to),
      path = wireless
        ? [a, b]
        : [
            a,
            [a[0], a[1] - 1, elevation(c.from.siteId) + 0.3],
            [b[0], b[1] - 1, elevation(c.to.siteId) + 0.3],
            b,
          ],
      points = path.map((v) =>
        add(`IFCCARTESIANPOINT((${v.map(real).join(',')}))`),
      ),
      curve = add(`IFCPOLYLINE((${points.join(',')}))`),
      shape = add(
        `IFCSHAPEREPRESENTATION(${context},'Axis','Curve3D',(${curve}))`,
      ),
      rep = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shape}))`);
    const element = add(
      wireless
        ? `IFCANNOTATION(${await guid(l.id + ':wireless')},$,${stepText(c.label)},'Wireless air path; no physical intersite cable','Microwave',${globalPlacement},${rep})`
        : `IFCCABLESEGMENT(${await guid(l.id + ':trunk')},$,${stepText(c.label)},${stepText(c.details)},'fiber',${globalPlacement},${rep},${stepText(l.id)},.CABLESEGMENT.)`,
    );
    transport.push(element);
    const ends: string[] = [];
    for (const end of [c.from, c.to]) {
      const exportedPort = wireless ? end.port : `${end.port} / trunk`;
      const key = `${end.siteId}/${end.assetId}/${exportedPort}`;
      let port = ports.get(key);
      if (!port) {
        const point = add(
            `IFCCARTESIANPOINT((${real(end.position[0])},${real(-end.position[2])},${real(end.position[1])}))`,
          ),
          axis = add(`IFCAXIS2PLACEMENT3D(${point},${up},${east})`),
          local = add(
            `IFCLOCALPLACEMENT(${placements.get(end.siteId)},${axis})`,
          );
        port = add(
          `IFCDISTRIBUTIONPORT(${await guid(key + ':port')},$,${stepText(exportedPort)},${stepText(wireless ? end.connector : `${end.connector}; internal tray ${end.port}`)},${stepText(wireless ? 'Wireless air interface' : 'Optical trunk')},${local},$,.SOURCEANDSINK.,.${wireless ? 'NOTDEFINED' : 'CABLE'}.,.COMMUNICATION.)`,
        );
        ports.set(key, port);
        add(
          `IFCRELNESTS(${await guid(key + ':nest')},$,$,$,${owners.get(`${end.siteId}/${end.assetId}`)},(${port}))`,
        );
      }
      ends.push(port);
    }
    add(
      `IFCRELCONNECTSPORTS(${await guid(l.id + ':campusconnection')},$,${stepText(l.id)},${stepText(wireless ? 'Logical wireless connection; inspect the microwave path annotation' : 'Physical optical trunk continuity')},${ends[0]},${ends[1]},${wireless ? '$' : element})`,
    );
    const props = Object.entries({
        LinkId: l.id,
        FromSite: l.a,
        ToSite: l.b,
        Medium: l.kind,
        CapacityMbps: String(l.capacity),
        LatencyMs: String(l.latency),
        VLAN: String(l.vlan),
        EstimatedLengthMetres: String(c.length),
        LengthBasis: c.lengthBasis,
        PhysicalCable: String(!wireless),
        FromPort: c.from.port,
        ToPort: c.to.port,
      }).map(([k, v]) =>
        add(
          `IFCPROPERTYSINGLEVALUE(${stepText(k)},$,IFCLABEL(${stepText(v)}),$)`,
        ),
      ),
      pset = add(
        `IFCPROPERTYSET(${await guid(l.id + ':transportprops')},$,'Citymesh_Transport',$,(${props.join(',')}))`,
      );
    add(
      `IFCRELDEFINESBYPROPERTIES(${await guid(l.id + ':transportrel')},$,$,$,(${element}),${pset})`,
    );
  }

  if (environment) {
    const env = environment,
      objects = environmentMeshes(env, false),
      members: string[] = [],
      buildingGroups = new Map<number, THREE.Group>();
    const emitMesh = async (
      object: THREE.Object3D,
      key: string,
      name: string,
      description: string,
    ) => {
      object.updateWorldMatrix(true, true);
      const vertices: number[][] = [],
        faces: number[][] = [];
      object.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const points = o.geometry.getAttribute('position'),
          base = vertices.length;
        for (let i = 0; i < points.count; i++) {
          const v = new THREE.Vector3()
            .fromBufferAttribute(points, i)
            .applyMatrix4(o.matrixWorld);
          vertices.push([v.x, -v.z, v.y + env.terrain.reference]);
        }
        const index = o.geometry.index;
        for (let i = 0; i < (index?.count || points.count); i += 3)
          faces.push(
            [0, 1, 2].map(
              (j) => base + (index ? index.getX(i + j) : i + j) + 1,
            ),
          );
      });
      const coords = add(
          `IFCCARTESIANPOINTLIST3D((${vertices.map((v) => '(' + v.map(real).join(',') + ')').join(',')}))`,
        ),
        tess = add(
          `IFCTRIANGULATEDFACESET(${coords},$,.F.,(${faces.map((v) => '(' + v.join(',') + ')').join(',')}),$)`,
        ),
        shape = add(
          `IFCSHAPEREPRESENTATION(${context},'Body','Tessellation',(${tess}))`,
        ),
        rep = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shape}))`);
      return add(
        `IFCBUILDINGELEMENTPROXY(${await guid(key)},$,${stepText(name)},${stepText(description)},'Sourced city context',${globalPlacement},${rep},${stepText(key)},.NOTDEFINED.)`,
      );
    };
    const properties = async (
      ref: string,
      key: string,
      values: Record<string, string>,
    ) => {
      const props = Object.entries(values).map(([k, v]) =>
          add(
            `IFCPROPERTYSINGLEVALUE(${stepText(k)},$,IFCLABEL(${stepText(v)}),$)`,
          ),
        ),
        set = add(
          `IFCPROPERTYSET(${await guid(key + ':properties')},$,'Citymesh_Environment',$,(${props.join(',')}))`,
        );
      add(
        `IFCRELDEFINESBYPROPERTIES(${await guid(key + ':relation')},$,$,$,(${ref}),${set})`,
      );
    };
    const terrainRef = await emitMesh(
      objects.terrain,
      'austin:usgs:terrain',
      'USGS Austin terrain',
      '25 m sample grid; native source elevation metres',
    );
    members.push(terrainRef);
    await properties(terrainRef, 'austin:usgs:terrain', {
      Source: env.terrain.source,
      RetrievedAt: env.terrain.retrievedAt,
      GridSpacingMetres: String(env.terrain.step),
      VerticalCoordinates:
        'Native USGS elevation metres; datum alignment not independently verified',
    });
    const buildingParts = objects.buildings.children.slice();
    for (const mesh of buildingParts) {
      const id = mesh.userData.buildingId;
      let group = buildingGroups.get(id);
      if (!group) {
        group = new THREE.Group();
        buildingGroups.set(id, group);
      }
      group.add(mesh);
    }
    for (const b of env.buildings) {
      const group = buildingGroups.get(b.id),
        base = buildingBase(env.terrain, b);
      if (!group || base === null) continue;
      const key = 'austin:building:' + b.id;
      let ref: string;
      if (b.height !== null)
        ref = await emitMesh(
          group,
          key,
          'Austin building ' + b.id,
          'Source footprint extruded to maximum height; roof form simplified',
        );
      else {
        const curves = b.rings.map((r) => {
            const points = r.map((p) =>
              add(
                `IFCCARTESIANPOINT((${real(p[0])},${real(-p[1])},${real(base)}))`,
              ),
            );
            return add(`IFCPOLYLINE((${points.join(',')}))`);
          }),
          shape = add(
            `IFCSHAPEREPRESENTATION(${context},'FootPrint','Curve3D',(${curves.join(',')}))`,
          ),
          rep = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(${shape}))`);
        ref = add(
          `IFCANNOTATION(${await guid(key)},$,'Austin building height unknown','Footprint only: no invented building height','Unknown-height footprint',${globalPlacement},${rep})`,
        );
      }
      members.push(ref);
      await properties(ref, key, {
        Source: env.buildingSource,
        SourceYear: String(env.buildingYear),
        SourceObjectId: String(b.id),
        HeightMetres: b.height === null ? 'Unknown' : String(b.height),
        BaseElevationMetres: String(base),
        HeightStatus:
          b.height === null
            ? 'Unknown; footprint annotation only'
            : 'Source maximum height; simplified roof',
        Units: 'Metres; source US survey feet converted by importer',
      });
      disposeObject(group);
    }
    disposeObject(objects.terrain);
    const contextGroup = add(
      `IFCGROUP(${await guid('austin:context')},$,'Sourced Austin environment','Terrain and individual building context; not telecom inventory','Geographic context')`,
    );
    add(
      `IFCRELASSIGNSTOGROUP(${await guid('austin:context:members')},$,$,$,(${members.join(',')}),$,${contextGroup})`,
    );
  }
  // Group world-coordinate transport paths without changing the 30 physical site placements.
  const group = add(
    `IFCGROUP(${await guid('citymesh:transportgroup')},$,'Inter-site transport','31 optical trunks and 7 wireless air paths','Transport network')`,
  );
  add(
    `IFCRELASSIGNSTOGROUP(${await guid('citymesh:transportmembers')},$,$,$,(${transport.join(',')}),$,${group})`,
  );
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\nFILE_NAME('citymesh-austin-30-sites.ifc',${stepText(new Date().toISOString())},('Citymesh'),('Prototype'),'Citymesh','Citymesh','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
