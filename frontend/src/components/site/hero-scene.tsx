"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Full-bleed Three.js animated 3D background for the hero section.
 * Renders floating icosahedra, tori, and ring geometries drifting slowly
 * in a parallax field. Subtle, non-distracting. Adapts to dark/light theme.
 */

function readThemeColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
  return {
    accent: get("--accent", "#3d55d6"),
    data: get("--data", "#138a77"),
    dark: document.documentElement.classList.contains("dark"),
  };
}

interface ShapeConfig {
  geometry: THREE.BufferGeometry;
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  speedX: number;
  speedY: number;
  speedZ: number;
  scale: number;
  colorIdx: number;
  mesh?: THREE.Mesh | THREE.LineSegments;
}

export default function HeroScene() {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = canvasRef.current;
    if (!wrap) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "absolute inset-0 size-full";
    renderer.domElement.setAttribute("aria-hidden", "true");
    wrap.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0, 18);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(5, 8, 10);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8899ff, 0.4);
    fill.position.set(-6, -3, 5);
    scene.add(fill);

    let colors = readThemeColors();

    const rng = (() => { let s = 42; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    const rand = (min: number, max: number) => min + rng() * (max - min);

    // Build shape configs
    const shapeConfigs: ShapeConfig[] = [
      { geometry: new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.6, 1)), x: -6, y: 2.5, z: -3, rotX: 0, rotY: 0.3, rotZ: 0, speedX: 0.0003, speedY: 0.0005, speedZ: 0.0002, scale: 1, colorIdx: 0 },
      { geometry: new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.1, 1)), x: 7, y: -1, z: -5, rotX: 0, rotY: 0, rotZ: 0, speedX: 0.0004, speedY: 0.0003, speedZ: 0.0003, scale: 1, colorIdx: 1 },
      { geometry: new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.7, 1)), x: 3.5, y: 3.5, z: -2, rotX: 0, rotY: 0, rotZ: 0, speedX: 0.0007, speedY: 0.0004, speedZ: 0.0005, scale: 1, colorIdx: 0 },
      { geometry: new THREE.WireframeGeometry(new THREE.TorusKnotGeometry(0.9, 0.28, 80, 12)), x: 5, y: 2, z: -1, rotX: 0, rotY: 0, rotZ: 0, speedX: 0.0004, speedY: 0.0006, speedZ: 0.0002, scale: 1, colorIdx: 1 },
      { geometry: new THREE.WireframeGeometry(new THREE.TorusKnotGeometry(0.6, 0.18, 60, 10, 2, 3)), x: -4.5, y: -2.5, z: -4, rotX: 0, rotY: 0, rotZ: 0, speedX: 0.0005, speedY: 0.0003, speedZ: 0.0004, scale: 1, colorIdx: 0 },
      { geometry: new THREE.TorusGeometry(1.4, 0.07, 10, 60), x: -7, y: -2, z: -6, rotX: 1.1, rotY: 0, rotZ: 0, speedX: 0.0002, speedY: 0.0005, speedZ: 0.0001, scale: 1, colorIdx: 1 },
      { geometry: new THREE.TorusGeometry(0.9, 0.05, 8, 48), x: 6.5, y: 3, z: -7, rotX: 0.4, rotY: 0, rotZ: 0, speedX: 0.0003, speedY: 0.0002, speedZ: 0.0004, scale: 1, colorIdx: 0 },
      ...Array.from({ length: 8 }, (_, i) => ({
        geometry: new THREE.SphereGeometry(rand(0.07, 0.18), 10, 8),
        x: rand(-8, 8), y: rand(-4, 4), z: rand(-8, -1),
        rotX: 0, rotY: 0, rotZ: 0,
        speedX: rand(-0.0003, 0.0003), speedY: rand(-0.0003, 0.0003), speedZ: 0,
        scale: 1, colorIdx: i % 2,
      })),
      { geometry: new THREE.OctahedronGeometry(0.7, 0), x: -2, y: -3.5, z: -2, rotX: 0, rotY: 0, rotZ: 0, speedX: 0.0005, speedY: 0.0007, speedZ: 0.0003, scale: 1, colorIdx: 0 },
      { geometry: new THREE.OctahedronGeometry(0.5, 0), x: 2.5, y: -3, z: -3, rotX: 0, rotY: 0, rotZ: 0, speedX: 0.0006, speedY: 0.0004, speedZ: 0.0003, scale: 1, colorIdx: 1 },
    ];

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);

    for (const cfg of shapeConfigs) {
      let obj: THREE.Mesh | THREE.LineSegments;
      const accentColor = new THREE.Color(colors.accent);
      const dataColor = new THREE.Color(colors.data);
      const color = cfg.colorIdx === 0 ? accentColor : dataColor;

      if (cfg.geometry instanceof THREE.WireframeGeometry) {
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28 });
        obj = new THREE.LineSegments(cfg.geometry, mat);
      } else if (cfg.geometry instanceof THREE.TorusGeometry) {
        const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.3, roughness: 0.4, metalness: 0.3 });
        obj = new THREE.Mesh(cfg.geometry, mat);
      } else {
        const opacity = cfg.geometry instanceof THREE.SphereGeometry ? 0.65 : 0.35;
        const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.3, metalness: 0.4 });
        obj = new THREE.Mesh(cfg.geometry, mat);
      }

      obj.position.set(cfg.x, cfg.y, cfg.z);
      obj.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);
      obj.scale.setScalar(cfg.scale);
      cfg.mesh = obj;
      meshGroup.add(obj);
    }

    // Mouse parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove);

    // Resize
    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Theme watch
    const mo = new MutationObserver(() => {
      colors = readThemeColors();
      for (const cfg of shapeConfigs) {
        if (!cfg.mesh) continue;
        const color = new THREE.Color(cfg.colorIdx === 0 ? colors.accent : colors.data);
        const mats = Array.isArray((cfg.mesh as THREE.Mesh).material)
          ? ((cfg.mesh as THREE.Mesh).material as THREE.Material[])
          : [(cfg.mesh as THREE.Mesh).material as THREE.Material];
        for (const m of mats) {
          if ("color" in m) (m as THREE.MeshStandardMaterial).color = color;
          m.needsUpdate = true;
        }
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Animation
    let raf = 0;
    const t0 = performance.now();
    const floatAmps = shapeConfigs.map(() => rand(0.08, 0.22));
    const floatFreqs = shapeConfigs.map(() => rand(0.4, 1.1));
    const floatOffsets = shapeConfigs.map(() => rand(0, Math.PI * 2));

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      if (!reduce) {
        targetX += (mouseX - targetX) * 0.03;
        targetY += (mouseY - targetY) * 0.03;
        meshGroup.rotation.y = targetX * 0.08;
        meshGroup.rotation.x = -targetY * 0.05;
      }
      shapeConfigs.forEach((cfg, i) => {
        if (!cfg.mesh) return;
        cfg.mesh.rotation.x += cfg.speedX * (reduce ? 0.1 : 1);
        cfg.mesh.rotation.y += cfg.speedY * (reduce ? 0.1 : 1);
        cfg.mesh.rotation.z += cfg.speedZ * (reduce ? 0.1 : 1);
        cfg.mesh.position.y = cfg.y + Math.sin(t * floatFreqs[i] + floatOffsets[i]) * floatAmps[i];
        cfg.mesh.position.x = cfg.x + Math.cos(t * floatFreqs[i] * 0.6 + floatOffsets[i]) * floatAmps[i] * 0.4;
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      scene.traverse((o) => {
        const any = o as THREE.Mesh;
        any.geometry?.dispose?.();
        const m = any.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => x.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    />
  );
}
