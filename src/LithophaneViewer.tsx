import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type LithophaneViewerProps = {
  glbUrl: string;
  lightColor: string;
};

const DEFAULT_ROTATION = { x: -0.08, y: -0.18 };

export function LithophaneViewer({ glbUrl, lightColor }: LithophaneViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const lightColorRef = useRef(lightColor);

  useEffect(() => {
    lightColorRef.current = lightColor;
    applyFakeLighting(modelRef.current, lightColor);
  }, [lightColor]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f2ed");

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const modelRoot = new THREE.Group();
    modelRoot.rotation.set(DEFAULT_ROTATION.x, DEFAULT_ROTATION.y, 0);
    modelRef.current = modelRoot;
    scene.add(modelRoot);

    let frameId = 0;
    let disposed = false;
    let targetRotationX = DEFAULT_ROTATION.x;
    let targetRotationY = DEFAULT_ROTATION.y;
    const drag = {
      active: false,
      x: 0,
      y: 0,
      rotationX: targetRotationX,
      rotationY: targetRotationY,
    };

    function resize() {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    }

    function handlePointerDown(event: PointerEvent) {
      drag.active = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.rotationX = targetRotationX;
      drag.rotationY = targetRotationY;
      mount.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!drag.active) return;
      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      targetRotationY = drag.rotationY + deltaX * 0.01;
      targetRotationX = Math.max(-1.15, Math.min(1.15, drag.rotationX + deltaY * 0.01));
    }

    function handlePointerUp(event: PointerEvent) {
      drag.active = false;
      if (mount.hasPointerCapture(event.pointerId)) {
        mount.releasePointerCapture(event.pointerId);
      }
    }

    mount.addEventListener("pointerdown", handlePointerDown);
    mount.addEventListener("pointermove", handlePointerMove);
    mount.addEventListener("pointerup", handlePointerUp);
    mount.addEventListener("pointercancel", handlePointerUp);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const loader = new GLTFLoader();
    loader.load(glbUrl, (gltf) => {
      if (disposed) return;
      modelRoot.clear();
      modelRoot.add(gltf.scene);

      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.computeVertexNormals();
          child.material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            toneMapped: false,
          });
        }
      });

      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      gltf.scene.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      camera.position.set(0, 0, maxDim * 2.18);
      camera.near = Math.max(0.1, maxDim / 100);
      camera.far = maxDim * 12;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      applyFakeLighting(modelRoot, lightColorRef.current);
    });

    function animate() {
      frameId = window.requestAnimationFrame(animate);
      modelRoot.rotation.x += (targetRotationX - modelRoot.rotation.x) * 0.16;
      modelRoot.rotation.y += (targetRotationY - modelRoot.rotation.y) * 0.16;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      mount.removeEventListener("pointerdown", handlePointerDown);
      mount.removeEventListener("pointermove", handlePointerMove);
      mount.removeEventListener("pointerup", handlePointerUp);
      mount.removeEventListener("pointercancel", handlePointerUp);
      window.cancelAnimationFrame(frameId);
      renderer.dispose();
      mount.innerHTML = "";
      modelRef.current = null;
    };
  }, [glbUrl]);

  return (
    <div className="model-viewer-wrap">
      <div className="model-glow" style={{ background: lightColor }} />
      <div className="model-viewer" ref={mountRef} aria-label="Generated lithophane 3D preview" />
    </div>
  );
}

function applyFakeLighting(root: THREE.Group | null, lightColor: string) {
  if (!root) return;

  const light = new THREE.Color(lightColor);
  const shadow = new THREE.Color("#2b2a25");

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const positionAttribute = child.geometry.getAttribute("position");
    if (!positionAttribute) return;

    const count = positionAttribute.count;
    const colors = new Float32Array(count * 3);
    const zValues: number[] = [];
    for (let index = 0; index < count; index += 1) {
      zValues.push(positionAttribute.getZ(index));
    }

    const minZ = Math.min(...zValues);
    const maxZ = Math.max(...zValues);
    const depthRange = Math.max(0.001, maxZ - minZ);
    const baseBrightness = getBaseBrightness(child.geometry, count);

    for (let index = 0; index < count; index += 1) {
      const z = positionAttribute.getZ(index);
      const thinness = 1 - (z - minZ) / depthRange;
      const storedBrightness = baseBrightness[index] ?? thinness;
      const glow = Math.max(0.08, Math.min(1, thinness * 0.78 + storedBrightness * 0.42));
      const color = shadow.clone().lerp(light, glow).lerp(new THREE.Color("#fff8df"), glow * 0.2);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }

    child.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    child.geometry.attributes.color.needsUpdate = true;
  });
}

function getBaseBrightness(geometry: THREE.BufferGeometry, count: number): Float32Array {
  if (geometry.userData.baseBrightness instanceof Float32Array) {
    return geometry.userData.baseBrightness;
  }

  const existingColors = geometry.getAttribute("color");
  const brightness = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    if (existingColors) {
      brightness[index] = (existingColors.getX(index) + existingColors.getY(index) + existingColors.getZ(index)) / 3;
    } else {
      brightness[index] = 0.5;
    }
  }
  geometry.userData.baseBrightness = brightness;
  return brightness;
}
