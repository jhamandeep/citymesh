import * as THREE from 'three';
/** Fit only physical geometry; labels must not influence camera framing. */
export function physicalBounds(root: THREE.Object3D) {
  const bounds = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.isLabel) {
      o.geometry.computeBoundingBox();
      if (o.geometry.boundingBox)
        bounds.union(
          o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld),
        );
    }
  });
  return bounds;
}
export function inspectionView(
  bounds: THREE.Box3,
  fov: number,
  aspect: number,
) {
  if (bounds.isEmpty()) return null;
  const sphere = bounds.getBoundingSphere(new THREE.Sphere()),
    half = Math.atan(
      Math.tan((fov * Math.PI) / 360) * Math.min(1, Math.max(0.1, aspect)),
    ),
    distance = Math.max(2.5, (sphere.radius / Math.sin(half)) * 1.3);
  return {
    target: sphere.center,
    position: sphere.center
      .clone()
      .add(
        new THREE.Vector3(0.9, 0.55, 1).normalize().multiplyScalar(distance),
      ),
  };
}
