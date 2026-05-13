import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type LithophaneViewerProps = {
  glbUrl: string;
  imageUrl: string | null;
  lightColor: string;
};

const DEFAULT_ROTATION = { x: -0.08, y: -0.18 };

export function LithophaneViewer({ glbUrl, imageUrl, lightColor }: LithophaneViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);
  const backlightRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const lightColorRef = useRef(lightColor);

  useEffect(() => {
    lightColorRef.current = lightColor;
    const color = new THREE.Color(lightColor);
    materialsRef.current.forEach((material) => {
      material.uniforms.uLightColor.value.copy(color);
    });
    if (backlightRef.current) {
      backlightRef.current.color.copy(color);
    }
  }, [lightColor]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#252723");

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    mount.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.82, 0.7);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    const modelRoot = new THREE.Group();
    modelRoot.rotation.set(DEFAULT_ROTATION.x, DEFAULT_ROTATION.y, 0);
    modelRef.current = modelRoot;
    scene.add(modelRoot);

    const texture = createTransmissionTexture(imageUrl);

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
      composer.setSize(width, height);
      bloomPass.setSize(width, height);
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
      materialsRef.current = [];
      backlightRef.current = null;
      modelRoot.clear();
      modelRoot.add(gltf.scene);

      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.computeVertexNormals();
          ensureUv(child.geometry);
          const thickness = getThicknessRange(child.geometry);
          const material = createLithophaneMaterial(texture, lightColorRef.current, thickness.min, thickness.max);
          child.material = material;
          materialsRef.current.push(material);
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

      const backlightMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(lightColorRef.current),
        opacity: 0.46,
        transparent: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const backlight = new THREE.Mesh(
        new THREE.PlaneGeometry(size.x * 1.08, size.y * 1.08),
        backlightMaterial,
      );
      backlight.position.set(0, 0, -Math.max(6, size.z + maxDim * 0.025));
      backlight.renderOrder = -1;
      modelRoot.add(backlight);
      backlightRef.current = backlightMaterial;
    });

    function animate() {
      frameId = window.requestAnimationFrame(animate);
      modelRoot.rotation.x += (targetRotationX - modelRoot.rotation.x) * 0.16;
      modelRoot.rotation.y += (targetRotationY - modelRoot.rotation.y) * 0.16;
      composer.render();
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
      texture.dispose();
      composer.dispose();
      renderer.dispose();
      mount.innerHTML = "";
      modelRef.current = null;
      materialsRef.current = [];
      backlightRef.current = null;
    };
  }, [glbUrl, imageUrl]);

  return (
    <div className="model-viewer-wrap">
      <div className="model-glow" style={{ background: lightColor }} />
      <div className="model-viewer" ref={mountRef} aria-label="Generated lithophane 3D preview" />
    </div>
  );
}

function createLithophaneMaterial(
  texture: THREE.Texture,
  lightColor: string,
  minThickness: number,
  maxThickness: number,
) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    toneMapped: true,
    uniforms: {
      uTransmissionMap: { value: texture },
      uLightColor: { value: new THREE.Color(lightColor) },
      uMinThickness: { value: minThickness },
      uMaxThickness: { value: maxThickness },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying float vThickness;

      void main() {
        vUv = uv;
        vWorldNormal = normalize(normalMatrix * normal);
        vThickness = position.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTransmissionMap;
      uniform vec3 uLightColor;
      uniform float uMinThickness;
      uniform float uMaxThickness;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying float vThickness;

      void main() {
        vec3 photo = texture2D(uTransmissionMap, vUv).rgb;
        float photoLum = dot(photo, vec3(0.299, 0.587, 0.114));
        float thickness = clamp((vThickness - uMinThickness) / max(0.001, uMaxThickness - uMinThickness), 0.0, 1.0);
        float thinness = 1.0 - thickness;

        float compressedLum = clamp(0.18 + photoLum * 0.68, 0.0, 1.0);
        float mapTransmission = smoothstep(0.05, 0.95, compressedLum);
        float depthTransmission = smoothstep(0.02, 0.95, thinness);
        float transmission = clamp(0.24 + mapTransmission * 0.42 + depthTransmission * 0.16, 0.24, 0.82);
        float blocked = smoothstep(0.58, 1.0, thickness) * (1.0 - compressedLum) * 0.34;

        float frontFacing = pow(clamp(dot(normalize(vWorldNormal), vec3(0.0, 0.0, 1.0)) * 0.5 + 0.5, 0.0, 1.0), 0.65);
        float innerGlow = transmission * (0.44 + frontFacing * 0.32);
        float raisedRelief = 0.92 - thickness * 0.18;

        vec3 resinShadow = vec3(0.42, 0.31, 0.19);
        vec3 warmResin = vec3(0.88, 0.70, 0.43);
        vec3 lampLight = uLightColor * (0.26 + innerGlow * 0.72);

        vec3 color = mix(resinShadow, warmResin, compressedLum * 0.48 + thinness * 0.14);
        color += lampLight * innerGlow;
        color *= raisedRelief;
        color = mix(color, resinShadow, blocked);
        color += pow(innerGlow, 4.0) * uLightColor * 0.42;
        color = min(color, vec3(1.18, 1.02, 0.78));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

function createTransmissionTexture(imageUrl: string | null) {
  const texture = imageUrl
    ? new THREE.TextureLoader().load(imageUrl)
    : new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function ensureUv(geometry: THREE.BufferGeometry) {
  if (geometry.getAttribute("uv")) return;

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const position = geometry.getAttribute("position");
  if (!box || !position) return;

  const width = Math.max(0.001, box.max.x - box.min.x);
  const height = Math.max(0.001, box.max.y - box.min.y);
  const uv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    uv[index * 2] = (position.getX(index) - box.min.x) / width;
    uv[index * 2 + 1] = 1 - (position.getY(index) - box.min.y) / height;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

function getThicknessRange(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  if (!position) return { min: 0, max: 1 };

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < position.count; index += 1) {
    const z = position.getZ(index);
    min = Math.min(min, z);
    max = Math.max(max, z);
  }
  return { min, max };
}
