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
  baseColor?: THREE.Color;
  baseOpacity?: number;
}

export default function HeroScene() {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = canvasRef.current;
    if (!wrap) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return; // WebGL unavailable: the page works without the 3D scene
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
    const pointerLight = new THREE.PointLight(0x8ea2ff, 0, 22, 1.6);
    pointerLight.position.set(0, 0, 4);
    scene.add(pointerLight);

    // depth starfield: tiny points on several layers, drifts with the pointer for parallax
    const starCount = 260;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 34;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      starPos[i * 3 + 2] = -2 - Math.random() * 16;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.07, color: 0xaab6ff, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
    const hot = new THREE.Color();
    let hotH = 238;
    const hueAt = (nx: number, ny: number) => {
      const x = Math.min(1, Math.max(0, nx));
      return (x < 0.5 ? 238 - 68 * (x / 0.5) : 170 - 128 * ((x - 0.5) / 0.5)) - ny * 18;
    };

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
      const m0 = obj.material as THREE.LineBasicMaterial | THREE.MeshStandardMaterial;
      cfg.baseColor = m0.color.clone();
      cfg.baseOpacity = m0.opacity;
      meshGroup.add(obj);
    }

    // Mouse parallax
    let mouseX = 0;
    let ndcX = 0;
    let ndcY = 0;
    let pointerSeen = false;
    const ray = new THREE.Vector3();
    const pointerWorld = new THREE.Vector3(0, 0, -3);
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      const r = wrap.getBoundingClientRect();
      ndcX = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
      ndcY = -(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1);
      pointerSeen = true;
      hotH = hueAt(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", onMouseMove);

    // Scroll depth: the whole field drifts and turns as the page scrolls, so the hero feels like a space you move through.
    let scrollP = 0;
    let scrollTarget = 0;
    const onScroll = () => {
      scrollTarget = Math.min(1.5, window.scrollY / Math.max(1, window.innerHeight));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

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
        cfg.baseColor = color.clone();
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

    let visible = true;
    let running = true;
    const frame = (now: number) => {
      if (!visible || document.hidden) {
        running = false; // paused: restarted by the observer below
        return;
      }
      const t = (now - t0) / 1000;
      if (!reduce) {
        targetX += (mouseX - targetX) * 0.03;
        targetY += (mouseY - targetY) * 0.03;
        scrollP += (scrollTarget - scrollP) * 0.06;
        meshGroup.rotation.y = targetX * 0.08 + scrollP * 0.35;
        meshGroup.rotation.x = -targetY * 0.05 + scrollP * 0.12;
        meshGroup.position.y = scrollP * 3.2;
        camera.position.z = 18 - scrollP * 4;
      }
      shapeConfigs.forEach((cfg, i) => {
        if (!cfg.mesh) return;
        cfg.mesh.rotation.x += cfg.speedX * (reduce ? 0.1 : 1);
        cfg.mesh.rotation.y += cfg.speedY * (reduce ? 0.1 : 1);
        cfg.mesh.rotation.z += cfg.speedZ * (reduce ? 0.1 : 1);
        cfg.mesh.position.y = cfg.y + Math.sin(t * floatFreqs[i] + floatOffsets[i]) * floatAmps[i];
        cfg.mesh.position.x = cfg.x + Math.cos(t * floatFreqs[i] * 0.6 + floatOffsets[i]) * floatAmps[i] * 0.4;
      });
      // pointer -> world point on the z=-3 plane; shapes near it glow and take the pointer's colour
      if (pointerSeen && !reduce) {
        ray.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
        const dist = (-3 - camera.position.z) / ray.z;
        pointerWorld.copy(camera.position).addScaledVector(ray, dist);
        pointerLight.position.set(pointerWorld.x, pointerWorld.y, 3);
        hot.setHSL(hotH / 360, 0.85, 0.62);
        pointerLight.color.copy(hot);
        pointerLight.intensity += (26 - pointerLight.intensity) * 0.08;
        for (const cfg of shapeConfigs) {
          if (!cfg.mesh || !cfg.baseColor) continue;
          const dx = cfg.mesh.position.x - pointerWorld.x;
          const dy = cfg.mesh.position.y - pointerWorld.y;
          const p = Math.max(0, 1 - Math.hypot(dx, dy) / 5.5);
          const k = p * p;
          const mat = cfg.mesh.material as THREE.LineBasicMaterial | THREE.MeshStandardMaterial;
          mat.color.copy(cfg.baseColor).lerp(hot, k * 0.9);
          mat.opacity = Math.min(0.95, (cfg.baseOpacity ?? 0.3) + k * 0.55);
          cfg.mesh.scale.setScalar(1 + k * 0.16);
        }
        starMat.color.copy(hot).lerp(new THREE.Color(0xffffff), 0.35);
      }
      stars.position.x += ((-mouseX * 0.8) - stars.position.x) * 0.04;
      stars.position.y += ((mouseY * 0.5) - stars.position.y) * 0.04;
      stars.rotation.y = t * 0.012;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const resume = () => {
      if (!running && visible && !document.hidden) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    const vis = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      resume();
    });
    vis.observe(wrap);
    document.addEventListener("visibilitychange", resume);

    return () => {
      vis.disconnect();
      document.removeEventListener("visibilitychange", resume);
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
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
