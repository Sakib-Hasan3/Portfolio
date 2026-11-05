"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { SkillCategory } from "@/lib/types";

/**
 * The hero's 3-D scene. Every published skill is a sphere in a latent space;
 * on load the points fly in from noise and settle into one cluster per
 * category (the "training converges" moment). Drag or use the arrow keys to
 * orbit; hover a point to read it. Reduced motion: no intro, no auto-spin.
 */

type Hover = { name: string; cat: string; x: number; y: number } | null;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
}
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return {
    accent: get("--accent", "#8ea2ff"),
    data: get("--data", "#57cdb8"),
    line: get("--line-strong", "#363b48"),
    faint: get("--faint", "#626a7b"),
    dark: document.documentElement.classList.contains("dark"),
  };
}

function haloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.25)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function SkillGalaxy({ categories }: { categories: SkillCategory[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [hover, setHover] = useState<Hover>(null);
  const [activeCat, setActiveCat] = useState<number | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !categories.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---------------------------------------------------------- renderer & scene
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "absolute inset-0 size-full";
    renderer.domElement.setAttribute("aria-hidden", "true");
    wrap.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, reduce ? 12.5 : 16);
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 6, 8);
    scene.add(key);

    const world = new THREE.Group();
    world.rotation.set(0.35, reduce ? 0.4 : -1.4, 0);
    scene.add(world);

    // ---------------------------------------------------------- layout
    const k = categories.length;
    const R = 2.7;
    const centers = categories.map((_, i) => {
      // Fibonacci sphere: evenly spread clusters in 3-D
      const y = k === 1 ? 0 : 1 - (i / (k - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = i * Math.PI * (3 - Math.sqrt(5));
      return new THREE.Vector3(Math.cos(th) * rad * R, y * R * 0.82, Math.sin(th) * rad * R);
    });
    const r = rng(7);
    type P = { cat: number; name: string; start: THREE.Vector3; target: THREE.Vector3; pos: THREE.Vector3 };
    const pts: P[] = [];
    categories.forEach((c, ci) =>
      c.skills.forEach((s) => {
        const target = centers[ci].clone().add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.42));
        const start = new THREE.Vector3(gauss(r), gauss(r), gauss(r)).normalize().multiplyScalar(5 + r() * 3);
        pts.push({ cat: ci, name: s.name, start, target, pos: (reduce ? target : start).clone() });
      }),
    );

    // ---------------------------------------------------------- objects
    let colors = readColors();
    const sphere = new THREE.SphereGeometry(1, 20, 14);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 });
    const mesh = new THREE.InstancedMesh(sphere, mat, pts.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    world.add(mesh);

    // edges: each point to its two nearest neighbours inside its cluster
    const pairs: [number, number][] = [];
    pts.forEach((a, i) => {
      pts
        .map((b, j) => ({ j, d: j === i || b.cat !== a.cat ? Infinity : a.target.distanceToSquared(b.target) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, 2)
        .forEach((n) => n.d < Infinity && i < n.j && pairs.push([i, n.j]));
    });
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new Float32Array(pairs.length * 6);
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0 });
    world.add(new THREE.LineSegments(lineGeo, lineMat));

    // faint latent-space shell and dust for depth
    const shell = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R + 1.2, 1)),
      new THREE.LineBasicMaterial({ transparent: true, opacity: 0.05 }),
    );
    world.add(shell);
    const dustGeo = new THREE.BufferGeometry();
    const dust = new Float32Array(360 * 3);
    for (let i = 0; i < dust.length; i += 3) {
      const v = new THREE.Vector3(gauss(r), gauss(r), gauss(r)).normalize().multiplyScalar(1.5 + r() * 5);
      dust.set([v.x, v.y, v.z], i);
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
    const dustMat = new THREE.PointsMaterial({ size: 0.025, transparent: true, opacity: 0.45, sizeAttenuation: true });
    world.add(new THREE.Points(dustGeo, dustMat));

    const halo = haloTexture();
    const halos = centers.map((c) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, opacity: 0 }));
      s.position.copy(c);
      s.scale.setScalar(2.2);
      world.add(s);
      return s;
    });

    const paint = () => {
      const a = new THREE.Color(colors.accent);
      const d = new THREE.Color(colors.data);
      pts.forEach((p, i) => mesh.setColorAt(i, p.cat % 3 === 1 ? d : a));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mat.emissive = new THREE.Color(colors.dark ? 0x222244 : 0x000000);
      lineMat.color = new THREE.Color(colors.line);
      (shell.material as THREE.LineBasicMaterial).color = new THREE.Color(colors.faint);
      dustMat.color = new THREE.Color(colors.faint);
      halos.forEach((h, i) => {
        const m = h.material as THREE.SpriteMaterial;
        m.color = i % 3 === 1 ? d : a;
        m.blending = colors.dark ? THREE.AdditiveBlending : THREE.NormalBlending;
        m.needsUpdate = true;
      });
    };
    paint();

    // ---------------------------------------------------------- interaction
    const state = { vx: 0, vy: 0, dragging: false, lastX: 0, lastY: 0, idleUntil: 0, hoverIdx: -1, dirty: true };
    const pointer = new THREE.Vector2(-9, -9);
    const raycaster = new THREE.Raycaster();
    const el = renderer.domElement;

    const onDown = (e: PointerEvent) => {
      state.dragging = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      if (e.pointerType !== "touch") el.setPointerCapture(e.pointerId);
      wrap.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      if (state.dragging) {
        const dx = e.clientX - state.lastX;
        const dy = e.pointerType === "touch" ? 0 : e.clientY - state.lastY;
        world.rotation.y += dx * 0.006;
        world.rotation.x = Math.max(-1.1, Math.min(1.1, world.rotation.x + dy * 0.004));
        state.vx = dx * 0.006;
        state.vy = dy * 0.004;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        state.idleUntil = performance.now() + 2500;
      }
      state.dirty = true;
    };
    const onUp = () => {
      state.dragging = false;
      wrap.style.cursor = "";
    };
    const onLeave = () => {
      pointer.set(-9, -9);
      state.dirty = true;
    };
    const onKey = (e: KeyboardEvent) => {
      const step = 0.18;
      if (e.key === "ArrowLeft") world.rotation.y -= step;
      else if (e.key === "ArrowRight") world.rotation.y += step;
      else if (e.key === "ArrowUp") world.rotation.x = Math.max(-1.1, world.rotation.x - step);
      else if (e.key === "ArrowDown") world.rotation.x = Math.min(1.1, world.rotation.x + step);
      else return;
      e.preventDefault();
      state.idleUntil = performance.now() + 4000;
      state.dirty = true;
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("keydown", onKey);

    // ---------------------------------------------------------- sizing / visibility / theme
    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      state.dirty = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) loop();
    });
    io.observe(wrap);
    const mo = new MutationObserver(() => {
      colors = readColors();
      paint();
      state.dirty = true;
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // ---------------------------------------------------------- frame loop
    const t0 = performance.now();
    const INTRO = 2600;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const v = new THREE.Vector3();
    let raf = 0;
    let last = t0;
    let lastHover = -2;

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = reduce ? 1 : Math.min(1, (now - t0) / INTRO);
      const e = ease(t);
      const animating = t < 1;

      if (!reduce) {
        camera.position.z = 16 - 3.5 * e;
        if (!state.dragging) {
          if (now > state.idleUntil) world.rotation.y += dt * (animating ? 0.55 * (1 - e) + 0.08 : 0.08);
          world.rotation.y += state.vx;
          world.rotation.x = Math.max(-1.1, Math.min(1.1, world.rotation.x + state.vy));
          state.vx *= 0.92;
          state.vy *= 0.92;
        }
      }

      // positions
      const drift = reduce ? 0 : 0.03;
      pts.forEach((p, i) => {
        p.pos.lerpVectors(p.start, p.target, e);
        if (drift) p.pos.y += Math.sin(now / 1800 + i) * drift * e;
        const size = (i === state.hoverIdx ? 0.13 : 0.075) * (0.4 + 0.6 * e);
        m4.compose(p.pos, q, scl.setScalar(size));
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      pairs.forEach(([a, b], i) => {
        linePos.set([pts[a].pos.x, pts[a].pos.y, pts[a].pos.z, pts[b].pos.x, pts[b].pos.y, pts[b].pos.z], i * 6);
      });
      lineGeo.attributes.position.needsUpdate = true;
      lineMat.opacity = 0.55 * e;
      const labelAlpha = Math.max(0, (t - 0.6) / 0.4);
      halos.forEach((h) => ((h.material as THREE.SpriteMaterial).opacity = (colors.dark ? 0.16 : 0.1) * e));

      // hover
      world.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      const hit = state.dragging ? [] : raycaster.intersectObject(mesh);
      const idx = hit.length ? (hit[0].instanceId ?? -1) : -1;
      state.hoverIdx = idx;
      if (idx !== lastHover) {
        lastHover = idx;
        setActiveCat(idx >= 0 ? pts[idx].cat : null);
        wrap.style.cursor = state.dragging ? "grabbing" : idx >= 0 ? "pointer" : "";
      }
      const rect = wrap.getBoundingClientRect();
      if (idx >= 0) {
        v.copy(pts[idx].pos).applyMatrix4(world.matrixWorld).project(camera);
        setHover({ name: pts[idx].name, cat: categories[pts[idx].cat].name, x: (v.x * 0.5 + 0.5) * rect.width, y: (-v.y * 0.5 + 0.5) * rect.height });
      } else setHover((h) => (h ? null : h));

      // cluster labels projected to screen, dimmed by depth
      centers.forEach((c, i) => {
        const node = labelRefs.current[i];
        if (!node) return;
        v.copy(c).add(new THREE.Vector3(0, 0.75, 0)).applyMatrix4(world.matrixWorld);
        const depth = v.clone().applyMatrix4(camera.matrixWorldInverse).z; // more negative = further
        v.project(camera);
        const near = THREE.MathUtils.clamp((-depth - 9) / -4 + 1, 0.25, 1);
        node.style.transform = `translate(${(v.x * 0.5 + 0.5) * rect.width}px, ${(-v.y * 0.5 + 0.5) * rect.height}px) translate(-50%, -50%)`;
        node.style.opacity = String(labelAlpha * near);
        node.style.zIndex = String(Math.round(near * 10));
      });

      renderer.render(scene, camera);
      state.dirty = false;
      const moving = animating || state.dragging || Math.abs(state.vx) > 1e-4 || Math.abs(state.vy) > 1e-4 || !reduce;
      if (visible && (moving || state.dirty)) loop();
    };
    const loop = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    // with reduced motion we still need to redraw on interaction
    const kick = () => loop();
    window.addEventListener("pointermove", kick);
    wrap.addEventListener("keydown", kick);
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", kick);
      wrap.removeEventListener("keydown", kick);
      scene.traverse((o) => {
        const any = o as THREE.Mesh;
        any.geometry?.dispose?.();
        const m = any.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => x.dispose());
      });
      halo.dispose();
      renderer.dispose();
      el.remove();
    };
  }, [categories]);

  const total = categories.reduce((n, c) => n + c.skills.length, 0);
  const short = (n: string) => (n.length > 24 ? n.replace(/ & .*/, "") : n);

  return (
    <figure className="relative">
      <div
        ref={wrapRef}
        tabIndex={0}
        role="img"
        aria-label={`3-D map of ${total} skills in ${categories.length} groups. Use the arrow keys to rotate.`}
        className="relative h-[340px] w-full cursor-grab touch-pan-y select-none overflow-hidden rounded-2xl sm:h-[420px] lg:h-[520px]"
      >
        {categories.map((c, i) => (
          <span
            key={c.id}
            ref={(n) => {
              labelRefs.current[i] = n;
            }}
            className={`pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium opacity-0 transition-colors ${activeCat === i ? "bg-surface text-text shadow-[var(--shadow)]" : "text-muted"}`}
          >
            {short(c.name)}
          </span>
        ))}
        {hover && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-[var(--shadow)]"
            style={{ left: hover.x, top: hover.y }}
          >
            <span className="font-medium text-text">{hover.name}</span>
            <span className="block text-faint">{hover.cat}</span>
          </div>
        )}
      </div>
      <figcaption className="mt-3 text-sm text-faint">
        {total} skills from this portfolio, clustered by area. Drag to orbit, point at one to read it.
      </figcaption>
      <ul className="sr-only">
        {categories.map((c) => (
          <li key={c.id}>
            {c.name}: {c.skills.map((s) => s.name).join(", ")}
          </li>
        ))}
      </ul>
    </figure>
  );
}
