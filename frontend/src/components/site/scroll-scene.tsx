"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Site-wide 3D backdrop. One fixed canvas behind every section: a gyroscope of rings around a glowing
 * crystal, plus a deep particle field. The camera flies through it as the page scrolls, the crystal
 * swings left/right between sections, and the whole thing leans toward the pointer.
 */
function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
  return { accent: get("--accent", "#3d55d6"), data: get("--data", "#138a77"), dark: document.documentElement.classList.contains("dark") };
}

export default function ScrollScene() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = ref.current;
    if (!wrap) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 768;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !small, alpha: true, powerPreference: "low-power" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.domElement.className = "absolute inset-0 size-full";
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
    camera.position.set(0, 0, 14);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(4, 6, 8);
    scene.add(key);
    const rim = new THREE.PointLight(0xffffff, 40, 40, 1.6);
    rim.position.set(-6, -3, 4);
    scene.add(rim);

    let c = themeColors();
    const accent = new THREE.Color(c.accent);
    const data = new THREE.Color(c.data);

    // hero object: faceted crystal + wire shell + three gyroscope rings
    const hero = new THREE.Group();
    scene.add(hero);
    const crystalMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.18, metalness: 0.65, flatShading: true, transparent: true, opacity: 0.85 });
    const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), crystalMat);
    hero.add(crystal);
    const shellMat = new THREE.LineBasicMaterial({ color: data, transparent: true, opacity: 0.5 });
    const shell = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.3, 1)), shellMat);
    hero.add(shell);
    const ringMats: THREE.MeshStandardMaterial[] = [];
    const rings = [3.1, 3.7, 4.3].map((r, i) => {
      const m = new THREE.MeshStandardMaterial({ color: i % 2 ? data : accent, roughness: 0.3, metalness: 0.7, transparent: true, opacity: 0.55 });
      ringMats.push(m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 120), m);
      ring.rotation.set(Math.PI * 0.5 * (i / 2), i * 0.9, 0);
      hero.add(ring);
      return ring;
    });

    // depth particles
    const count = small ? 350 : 900;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 2] = -40 + Math.random() * 50;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.09, color: accent, transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    const applyTheme = () => {
      c = themeColors();
      accent.set(c.accent);
      data.set(c.data);
      crystalMat.color.copy(accent);
      shellMat.color.copy(data);
      pMat.color.copy(accent);
      ringMats.forEach((m, i) => m.color.copy(i % 2 ? data : accent));
      const o = c.dark ? 1 : 0.7;
      crystalMat.opacity = 0.85 * o;
      pMat.opacity = c.dark ? 0.6 : 0.4;
    };
    applyTheme();
    const mo = new MutationObserver(applyTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // section-aware tint: the crystal changes colour as each section takes over the viewport
    const palette: Record<string, [string, string]> = {
      about: ["#3d55d6", "#138a77"],
      research: ["#138a77", "#3d55d6"],
      projects: ["#7c5cff", "#22d3ee"],
      skills: ["#ec4899", "#7c5cff"],
      experience: ["#138a77", "#f59e0b"],
      education: ["#f59e0b", "#7c5cff"],
      contact: ["#f59e0b", "#ec4899"],
    };
    const tintA = new THREE.Color(), tintB = new THREE.Color();
    const goalA = new THREE.Color(), goalB = new THREE.Color();
    tintA.copy(accent); tintB.copy(data);
    let sections: HTMLElement[] = [];
    const readSections = () => { sections = Array.from(document.querySelectorAll<HTMLElement>("section[id]")); };
    readSections();
    const pickSection = () => {
      if (!sections.length || !sections[0].isConnected) readSections();
      const mid = window.innerHeight * 0.5;
      let id = "";
      for (const el of sections) {
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) { id = el.id; break; }
      }
      const pal = palette[id];
      if (pal) { goalA.set(pal[0]); goalB.set(pal[1]); } else { goalA.copy(accent); goalB.copy(data); }
    };
    let lastActive = performance.now();
    let mx = 0, my = 0, tx = 0, ty = 0, sp = 0, st = 0;
    const onMove = (e: PointerEvent) => {
      lastActive = performance.now();
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onScroll = () => {
      lastActive = performance.now();
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      st = window.scrollY / max;
    };
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    onScroll();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    const wake = () => { lastActive = performance.now(); if (!running && !document.hidden) { running = true; raf = requestAnimationFrame(frame); } };
    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("scroll", wake, { passive: true });

    let raf = 0;
    let running = true;
    const t0 = performance.now();
    const frame = (now: number) => {
      // performance: stop rendering after 4s without scroll/pointer input; any input wakes it again
      if (document.hidden || (now - lastActive > 4000 && Math.abs(st - sp) < 0.0005)) { running = false; return; }
      const t = (now - t0) / 1000;
      tx += (mx - tx) * 0.04;
      ty += (my - ty) * 0.04;
      sp += (st - sp) * 0.05;
      const k = reduce ? 0 : 1;
      pickSection();
      tintA.lerp(goalA, 0.04);
      tintB.lerp(goalB, 0.04);
      crystalMat.color.copy(tintA);
      pMat.color.copy(tintA);
      shellMat.color.copy(tintB);
      ringMats.forEach((m, i) => m.color.copy(i % 2 ? tintB : tintA));

      // crystal drifts side to side down the page (kept toward the edges so it never sits behind text on desktop)
      const side = small ? 0 : Math.tanh(Math.sin(sp * Math.PI * 3.2) * 3) * 8.5;
      hero.position.set(side + tx * 0.6 * k, 1.2 - sp * 6 + Math.sin(t * 0.8) * 0.25 * k - ty * 0.4 * k, -9 - (small ? 3 : 0));
      hero.rotation.y = sp * Math.PI * 4 + t * 0.15 * k;
      hero.rotation.x = sp * 1.4 + ty * 0.25;
      crystal.rotation.y = t * 0.4 * k;
      shell.rotation.y = -t * 0.12 * k;
      shell.rotation.z = t * 0.07 * k;
      rings.forEach((r, i) => {
        r.rotation.x += 0.004 * (i + 1) * k;
        r.rotation.y += 0.003 * (3 - i) * k;
      });
      const s = 1 + Math.sin(sp * Math.PI * 6) * 0.12;
      hero.scale.setScalar(s * (small ? 0.7 : 1));

      // fly forward through the particle field
      camera.position.z = 14 - sp * 18;
      camera.position.x = tx * 0.8 * k;
      camera.position.y = -ty * 0.5 * k - sp * 6;
      camera.lookAt(hero.position.x * 0.3, hero.position.y * 0.6, -6 - sp * 12);
      particles.rotation.z = t * 0.01 * k + sp * 0.4;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const resume = () => {
      if (!running && !document.hidden) { running = true; raf = requestAnimationFrame(frame); }
    };
    document.addEventListener("visibilitychange", resume);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("scroll", wake);
      mo.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-50 dark:opacity-70" />;
}
