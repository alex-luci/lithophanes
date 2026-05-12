import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type LithophaneViewerProps = {
  glbUrl: string;
  lightColor: string;
};

export function LithophaneViewer({ glbUrl, lightColor }: LithophaneViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<THREE.PointLight | null>(null);
  const glowRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    lightRef.current?.color.set(lightColor);
    const material = glowRef.current?.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.color.set(lightColor);
    }
  }, [lightColor]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f2ed");

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight("#ffffff", 0.82);
    scene.add(ambient);

    const backLight = new THREE.PointLight(lightColor, 8500, 700);
    backLight.position.set(0, 0, -95);
    lightRef.current = backLight;
    scene.add(backLight);

    const sideLight = new THREE.DirectionalLight("#ffffff", 2.25);
    sideLight.position.set(1, 1, 2);
    scene.add(sideLight);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshBasicMaterial({
        color: lightColor,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      }),
    );
    glow.position.z = -10;
    glowRef.current = glow;
    scene.add(glow);

    const modelRoot = new THREE.Group();
    scene.add(modelRoot);

    let frameId = 0;
    let disposed = false;

    function resize() {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    }

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
          child.material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.48,
            metalness: 0,
            side: THREE.DoubleSide,
          });
        }
      });

      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      gltf.scene.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      camera.position.set(0, 0, maxDim * 2.25);
      camera.near = Math.max(0.1, maxDim / 100);
      camera.far = maxDim * 12;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      glow.scale.setScalar(maxDim / 180);
    });

    function animate() {
      frameId = window.requestAnimationFrame(animate);
      modelRoot.rotation.x = -0.08;
      modelRoot.rotation.y = -0.24 + Math.sin(Date.now() * 0.00045) * 0.08;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frameId);
      renderer.dispose();
      mount.innerHTML = "";
    };
  }, [glbUrl]);

  return <div className="model-viewer" ref={mountRef} aria-label="Generated lithophane 3D preview" />;
}
