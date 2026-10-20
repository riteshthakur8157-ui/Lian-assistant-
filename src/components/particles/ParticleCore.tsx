import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type AssistantState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING" | "ERROR";

export type OrbTheme = "dark" | "sunset" | "light" | "red";

interface ParticleCoreProps {
  state: AssistantState;
  audioLevel: number; // 0.0 to 1.0 from Web Audio API
  theme?: OrbTheme;
  onTapCore?: () => void;
  onThemeChange?: (theme: OrbTheme) => void;
}

const FOV = 45;
const VIS = 3.1;
const ORBIT = 36;
const COUNT = 6000;

const STATES = {
  idle: { scale: 1.0, speed: 0.35, cyan: 0.35, purple: 0.45, bright: 1.0, glow: 0.5, ring: 0.15, wob: 0 },
  listening: { scale: 1.05, speed: 0.85, cyan: 1.0, purple: 0.25, bright: 1.12, glow: 0.95, ring: 0.35, wob: 0 },
  thinking: { scale: 1.0, speed: 1.55, cyan: 0.3, purple: 1.0, bright: 1.05, glow: 0.75, ring: 1.0, wob: 1 },
  speaking: { scale: 1.04, speed: 1.15, cyan: 0.9, purple: 0.9, bright: 1.2, glow: 1.0, ring: 0.45, wob: 0 },
  error: { scale: 1.02, speed: 0.9, cyan: 0.1, purple: 0.1, bright: 1.3, glow: 1.1, ring: 0.8, wob: 0.8 },
};

const LIGHTPAL = [
  [0.04, 0.1, 0.5],
  [0.12, 0.32, 0.95],
  [0.1, 0.78, 1.0],
  [0.55, 0.28, 0.95],
];

const THEMES: Record<
  string,
  {
    bg: string;
    fg: string;
    sub: string;
    glass: string;
    gb: string;
    chip: string;
    t: string[];
    add: boolean;
    sh: string;
    pal: number[][];
  }
> = {
  dark: {
    bg: "radial-gradient(120% 80% at 50% 35%,#171c40 0%,#0a0d1f 60%,#04050d 100%)",
    fg: "#e8ecff",
    sub: "#8f98c8",
    glass: "rgba(255,255,255,.07)",
    gb: "rgba(255,255,255,.12)",
    chip: "#aab3e6",
    t: ["#5b8cff", "#9b7bff", "#4fe3ff"],
    add: true,
    sh: "rgba(80,120,255,.2)",
    pal: [
      [0.1, 0.2, 0.8],
      [0.25, 0.5, 1.0],
      [0.3, 0.92, 1.0],
      [0.7, 0.45, 1.0],
    ],
  },
  sunset: {
    bg: "radial-gradient(120% 80% at 50% 35%,#fff6ef 0%,#ffe7e1 60%,#fbd8e8 100%)",
    fg: "#4a2340",
    sub: "#98677f",
    glass: "rgba(255,255,255,.6)",
    gb: "rgba(255,255,255,.85)",
    chip: "#7a4566",
    t: ["#ff6a3d", "#e83e8c", "#8b5cf6"],
    add: false,
    sh: "rgba(170,70,110,.22)",
    pal: [
      [0.55, 0.12, 0.45],
      [0.95, 0.3, 0.45],
      [1.0, 0.55, 0.2],
      [0.6, 0.3, 0.9],
    ],
  },
  light: {
    bg: "radial-gradient(120% 80% at 50% 35%,#fff 0%,#f4f6fb 60%,#eceff7 100%)",
    fg: "#1d2340",
    sub: "#6b7390",
    glass: "rgba(255,255,255,.72)",
    gb: "rgba(255,255,255,.9)",
    chip: "#4a527a",
    t: ["#2f6bff", "#8b5cf6", "#c15de0"],
    add: false,
    sh: "rgba(70,80,170,.22)",
    pal: LIGHTPAL,
  },
  red: {
    bg: "radial-gradient(120% 80% at 50% 35%,#2a0a10 0%,#120508 60%,#050203 100%)",
    fg: "#ffe8ea",
    sub: "#c98a92",
    glass: "rgba(255,255,255,.07)",
    gb: "rgba(255,120,130,.18)",
    chip: "#f0a8b0",
    t: ["#ff4d5e", "#ff2d6f", "#ff8a5c"],
    add: true,
    sh: "rgba(255,60,80,.2)",
    pal: [
      [0.55, 0.05, 0.1],
      [0.95, 0.15, 0.2],
      [1.0, 0.45, 0.3],
      [1.0, 0.25, 0.55],
    ],
  },
};

export const ParticleCore: React.FC<ParticleCoreProps> = ({
  state,
  audioLevel,
  theme = "dark",
  onTapCore,
  onThemeChange,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  const [activeTheme, setActiveTheme] = useState<OrbTheme>(theme);
  const [showThemeBar, setShowThemeBar] = useState(false);

  const stateRef = useRef(state);
  const audioLevelRef = useRef(audioLevel);
  const themeRef = useRef(activeTheme);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    setActiveTheme(theme);
    themeRef.current = theme;
  }, [theme]);

  const handleSelectTheme = (t: OrbTheme) => {
    setActiveTheme(t);
    themeRef.current = t;
    if (onThemeChange) onThemeChange(t);
  };

  useEffect(() => {
    const mount = mountRef.current;
    const canvas = canvasRef.current;
    const shadowEl = shadowRef.current;
    if (!mount || !canvas || !shadowEl) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch (e) {
      console.error("WebGL failed:", e);
      return;
    }
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
    camera.position.set(0, 0, 6);

    // Shared Uniforms
    const U = {
      uTime: { value: 0 },
      uAmp: { value: 0 },
      uBass: { value: 0 },
      uHigh: { value: 0 },
      uCyan: { value: 0.35 },
      uPurple: { value: 0.45 },
      uBright: { value: 1.0 },
      uPx: { value: 300 },
      uCamZ: { value: 6 },
      DEEP: { value: new THREE.Color() },
      BLUE: { value: new THREE.Color() },
      CYAN: { value: new THREE.Color() },
      PURP: { value: new THREE.Color() },
    };

    const UNI =
      "uniform float uTime,uAmp,uBass,uHigh,uCyan,uPurple,uBright,uPx,uCamZ;uniform vec3 DEEP,BLUE,CYAN,PURP;";

    // Custom 3D Particle Volume Shaders
    const partV =
      UNI +
      `attribute float aRnd;varying vec3 vC;varying float vA;
void main(){
 float base=length(position);vec3 d=position/base;float t=uTime;
 float n=sin(d.x*3.+t*.8+aRnd*6.)*sin(d.y*3.-t*.6)*sin(d.z*3.+t*.5);
 float r=base*(1.+n*.05+uAmp*.1*aRnd+.015*sin(t*2.+aRnd*20.));
 vec4 mv=modelViewMatrix*vec4(d*r,1.);
 float depth=smoothstep(-1.,1.,mv.z+uCamZ);
 vA=mix(.22,1.,depth);
 vec3 c=mix(BLUE,CYAN,smoothstep(-.5,.9,d.y+n)*uCyan);
 c=mix(c,PURP,smoothstep(.1,.9,d.x*.6-d.y*.3+aRnd*.4)*uPurple);
 c=mix(DEEP,c,.5+.5*aRnd);
 vC=c*uBright*mix(.6,1.,depth);
 gl_PointSize=max((.009+aRnd*.017)*(1.+uAmp*.5)*uPx/(-mv.z)*mix(.85,1.2,depth),1.7);
 gl_Position=projectionMatrix*mv;}`;

    const dotF =
      "precision highp float;varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vC,smoothstep(.5,.05,d)*vA);}";

    // Build Particles
    const pos = new Float32Array(COUNT * 3);
    const rnd = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (2 * (i + 0.5)) / COUNT;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.39996;
      const shell = 0.93 + 0.07 * Math.random();
      pos[i * 3] = Math.cos(th) * r * shell;
      pos[i * 3 + 1] = y * shell;
      pos[i * 3 + 2] = Math.sin(th) * r * shell;
      rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));
    const pointsMesh = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        vertexShader: partV,
        fragmentShader: dotF,
        uniforms: U,
        transparent: true,
        depthWrite: false,
      })
    );
    pointsMesh.frustumCulled = false;
    pointsMesh.renderOrder = 1;

    const orb = new THREE.Group();
    orb.add(pointsMesh);
    scene.add(orb);

    // Glow Material
    const glowMat = new THREE.ShaderMaterial({
      vertexShader:
        "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `varying vec2 vUv;uniform float uTime,uStrength,uMix;uniform vec3 uA,uB,uC;
void main(){vec2 c=vUv-.5;float d=length(c)*2.,a=atan(c.y,c.x);
 float g=(d>.68?exp(-(d-.68)*6.5)*.75:0.)*smoothstep(1.,.78,d);
 vec3 col=mix(mix(uA,uB,.5+.5*sin(a+uTime*.4)),uC,uMix*(.5+.5*sin(a*2.-uTime*.6)));
 gl_FragColor=vec4(col,clamp(g*uStrength*.5,0.,.55));}`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uStrength: { value: 0.5 },
        uMix: { value: 0.3 },
        uA: U.BLUE,
        uB: U.PURP,
        uC: U.CYAN,
      },
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(VIS, VIS), glowMat);
    glow.position.z = -0.05;
    glow.renderOrder = -2;
    scene.add(glow);

    // Concentric Ring Helpers
    function createRing(r0: number, r1: number, segs: number, seed: number, alpha: number) {
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(r0, r1, 128, 1),
        new THREE.ShaderMaterial({
          vertexShader:
            "varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
          fragmentShader: `varying vec2 vP;uniform float uAlpha,uSeed,uSegs;uniform vec3 uA,uB,uC;
void main(){float a=atan(vP.y,vP.x);
 float m=smoothstep(-.25,.35,sin(a*uSegs+uSeed))*smoothstep(-.9,-.2,sin(a+uSeed*.7));
 vec3 col=mix(mix(uC,uA,.5+.5*sin(a+uSeed)),uB,.5+.5*sin(a*2.-uSeed));
 gl_FragColor=vec4(col,m*uAlpha);}`,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          uniforms: {
            uAlpha: { value: alpha },
            uSeed: { value: seed },
            uSegs: { value: segs },
            uA: U.BLUE,
            uB: U.PURP,
            uC: U.CYAN,
          },
        })
      );
      ringMesh.renderOrder = 0;
      scene.add(ringMesh);
      return ringMesh;
    }

    const ring1 = createRing(1.255, 1.272, 2, 0, 0.5);
    const ring2 = createRing(1.38, 1.388, 3, 2.1, 0.3);

    // Orbiting Stardust Particles
    const ptData: any[] = [];
    const orbitPos = new Float32Array(ORBIT * 3);
    const orbitSize = new Float32Array(ORBIT);
    const orbitAlpha = new Float32Array(ORBIT);
    const orbitColor = new Float32Array(ORBIT * 3);
    const pal = [
      [0.1, 0.7, 1.0],
      [0.2, 0.4, 1.0],
      [0.55, 0.3, 0.95],
    ];
    for (let i = 0; i < ORBIT; i++) {
      orbitColor.set(pal[i % 3], i * 3);
      orbitSize[i] = 0.02 + Math.random() * 0.045;
      ptData.push({
        a: Math.random() * 6.283,
        r: 1.5 + Math.random() * 0.55,
        sp: (0.08 + Math.random() * 0.18) * (Math.random() < 0.5 ? -1 : 1),
        ph: Math.random() * 6.283,
        tilt: (Math.random() - 0.5) * 1.2,
        y: (Math.random() - 0.5) * 1.1,
        fs: 0.2 + Math.random() * 0.4,
      });
    }

    const orbitGeom = new THREE.BufferGeometry();
    orbitGeom.setAttribute("position", new THREE.BufferAttribute(orbitPos, 3));
    orbitGeom.setAttribute("aSize", new THREE.BufferAttribute(orbitSize, 1));
    orbitGeom.setAttribute("aAlpha", new THREE.BufferAttribute(orbitAlpha, 1));
    orbitGeom.setAttribute("aColor", new THREE.BufferAttribute(orbitColor, 3));

    const orbitPts = new THREE.Points(
      orbitGeom,
      new THREE.ShaderMaterial({
        vertexShader:
          "attribute float aSize,aAlpha;attribute vec3 aColor;uniform float uPx;varying float vA;varying vec3 vC;void main(){vA=aAlpha;vC=aColor;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=max(aSize*uPx/(-mv.z),1.);gl_Position=projectionMatrix*mv;}",
        fragmentShader: dotF,
        transparent: true,
        depthWrite: false,
        uniforms: { uPx: U.uPx },
      })
    );
    orbitPts.frustumCulled = false;
    orbitPts.renderOrder = 3;
    scene.add(orbitPts);

    // Theme setter
    function applyThemeColors(tName: string) {
      const t = THEMES[tName] || THEMES.dark;
      ["DEEP", "BLUE", "CYAN", "PURP"].forEach((k, i) => {
        (U as any)[k].value.setRGB(t.pal[i][0], t.pal[i][1], t.pal[i][2]);
      });

      const oc = orbitPts.geometry.attributes.aColor as THREE.BufferAttribute;
      const cols = [t.pal[2], t.pal[1], t.pal[3]];
      for (let i = 0; i < ORBIT; i++) {
        oc.setXYZ(i, cols[i % 3][0], cols[i % 3][1], cols[i % 3][2]);
      }
      oc.needsUpdate = true;

      const add = t.add;
      [pointsMesh.material, orbitPts.material, glowMat, ring1.material, ring2.material].forEach(
        (m: any) => {
          m.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
          m.needsUpdate = true;
        }
      );
    }
    applyThemeColors(themeRef.current);

    // Interactive Drag to Rotate with Inertia
    let dragging = false;
    let px = 0;
    let py = 0;
    let velX = 0;
    let velY = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      px = e.clientX;
      py = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      velY += (e.clientX - px) * 0.012;
      velX += (e.clientY - py) * 0.012;
      px = e.clientX;
      py = e.clientY;
    };

    const onPointerUp = () => {
      dragging = false;
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // Double-click canvas to toggle theme bar
    const onDblClick = () => {
      setShowThemeBar((prev) => !prev);
    };
    canvas.addEventListener("dblclick", onDblClick);

    // Resize handling
    let pxPerUnit = 300;
    function handleResize() {
      if (!mount || !renderer) return;
      const w = Math.max(mount.clientWidth, 1);
      const h = Math.max(mount.clientHeight, 1);
      const pr = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const visH = VIS / Math.min(1, w / h);
      const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      camera.position.z = visH / (2 * tan);
      U.uCamZ.value = camera.position.z;
      camera.updateProjectionMatrix();
      pxPerUnit = h / visH;
      U.uPx.value = (h * pr) / (2 * tan);
      if (shadowEl) {
        shadowEl.style.top = Math.round(h / 2 + pxPerUnit * 1.2) + "px";
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);

    // State parameters
    const cur: any = { ...STATES.thinking };
    const tgt: any = { ...STATES.thinking };

    const audio = { level: 0, bass: 0, high: 0 };
    let time = 0;
    let flow = 0;
    let r1a = 0;
    let r2a = 0;
    let last = performance.now();
    let animId: number;

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Update active state targets
      const currentAssistantState = stateRef.current.toLowerCase();
      const stateObj = (STATES as any)[currentAssistantState] || STATES.idle;
      Object.assign(tgt, stateObj);

      // Smooth state interpolation
      const k = 1 - Math.exp(-dt * 3.5);
      for (const key in cur) {
        cur[key] += (tgt[key] - cur[key]) * k;
      }

      // Read audio level from Web Audio API or simulated
      const rawAudio = audioLevelRef.current;
      let l = rawAudio;
      let b = rawAudio * 1.1;
      let h = rawAudio * 0.9;

      if (rawAudio <= 0.01) {
        // Subtle organic breathing simulation
        const t = time;
        if (currentAssistantState === "speaking") {
          const syl = Math.pow(Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1)), 0.8);
          const gate = Math.sin(t * 0.9) > -0.7 ? 1 : 0.15;
          l = (0.3 + 0.45 * syl) * gate;
          b = l * (0.6 + 0.4 * Math.sin(t * 5));
          h = l * (0.5 + 0.5 * Math.sin(t * 11));
        } else if (currentAssistantState === "listening") {
          l = 0.2 + 0.2 * Math.abs(Math.sin(t * 3.1) * Math.sin(t * 1.3));
          b = l * 0.8;
          h = l * 0.5;
        } else {
          l = 0.06 + 0.04 * Math.sin(t * 1.2);
          b = l;
          h = l * 0.5;
        }
      }

      const audioK = 1 - Math.exp(-dt * (l > audio.level ? 18 : 6));
      audio.level += (l - audio.level) * audioK;
      audio.bass += (b - audio.bass) * audioK;
      audio.high += (h - audio.high) * audioK;

      time += dt;
      flow += dt * cur.speed;
      r1a += dt * (0.12 + cur.ring * 0.6);
      r2a -= dt * (0.08 + cur.ring * 0.35);

      const idlePulse =
        Math.pow(Math.max(0, Math.sin(time * 0.5)), 12) * 0.15 * (1 - cur.wob);
      const s =
        cur.scale *
        (1 +
          0.018 * Math.sin(time * 1.2) +
          audio.level * 0.07 +
          cur.wob * 0.025 * Math.sin(time * 3.6));

      orb.scale.setScalar(s);
      orb.rotation.y += dt * 0.18 * (0.5 + cur.speed) + velY * Math.min(dt * 20, 1) * 0.5;
      orb.rotation.x = Math.max(
        -1.2,
        Math.min(1.2, orb.rotation.x + velX * Math.min(dt * 20, 1) * 0.5)
      );
      velX *= Math.exp(-dt * 5);
      velY *= Math.exp(-dt * 5);
      if (!dragging && Math.abs(orb.rotation.x) > 0.001) {
        orb.rotation.x *= Math.exp(-dt * 0.6);
      }

      U.uTime.value = flow;
      U.uAmp.value = audio.level + cur.wob * 0.25;
      U.uBass.value = audio.bass;
      U.uHigh.value = audio.high;
      U.uCyan.value = cur.cyan;
      U.uPurple.value = cur.purple;
      U.uBright.value = cur.bright + idlePulse;

      glowMat.uniforms.uTime.value = time;
      glowMat.uniforms.uMix.value = cur.cyan;
      glowMat.uniforms.uStrength.value = cur.glow + audio.level * 0.6 + idlePulse * 2;

      const pulse = cur.ring * 0.5 * (0.5 + 0.5 * Math.sin(time * 4)) + audio.bass * 0.8;
      ring1.rotation.z = r1a;
      ring2.rotation.z = r2a;
      ring1.scale.setScalar(s * (1 + pulse * 0.03));
      ring2.scale.setScalar(s * (1 + pulse * 0.02));
      ring1.material.uniforms.uAlpha.value = 0.4 + cur.ring * 0.3 + audio.level * 0.35;
      ring2.material.uniforms.uAlpha.value = 0.22 + cur.ring * 0.2 + audio.level * 0.2;
      if (shadowEl) {
        shadowEl.style.width = Math.round(pxPerUnit * 1.5 * s) + "px";
      }

      // Update orbiting particles
      const P = orbitPts.geometry.attributes;
      const boost = 0.6 + cur.speed * 0.8 + (currentAssistantState === "thinking" ? 1.2 : 0);
      for (let i = 0; i < ORBIT; i++) {
        const d = ptData[i];
        d.a += d.sp * dt * boost;
        const r =
          d.r +
          Math.sin(time * d.fs + d.ph) * 0.12 -
          (currentAssistantState === "thinking" ? 0.15 : 0) +
          audio.level * 0.1;
        const x = Math.cos(d.a) * r;
        const z = Math.sin(d.a) * r * 0.6;
        const y = d.y * 0.8 + Math.sin(d.a * 1.3 + d.ph) * 0.18 + x * d.tilt * 0.25;
        (P.position as THREE.BufferAttribute).setXYZ(i, x, y, z);
        (P.aAlpha as THREE.BufferAttribute).setX(
          i,
          Math.pow(0.5 + 0.5 * Math.sin(time * d.fs * 1.6 + d.ph), 1.5) *
            (0.55 + cur.glow * 0.3)
        );
      }
      P.position.needsUpdate = true;
      P.aAlpha.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("dblclick", onDblClick);
      g.dispose();
      pointsMesh.material.dispose();
      glow.geometry.dispose();
      glowMat.dispose();
      ring1.geometry.dispose();
      ring1.material.dispose();
      ring2.geometry.dispose();
      ring2.material.dispose();
      orbitGeom.dispose();
      orbitPts.material.dispose();
      renderer.dispose();
    };
  }, [activeTheme]);

  return (
    <div
      ref={mountRef}
      onClick={onTapCore}
      className="absolute inset-0 w-full h-full select-none overflow-hidden"
      style={{ touchAction: "none" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block cursor-grab" />
      {/* Soft Contact Grounding Shadow */}
      <div
        ref={shadowRef}
        className="absolute left-1/2 -translate-x-1/2 h-[22px] rounded-full pointer-events-none filter blur-[5px] transition-all duration-300"
        style={{
          background: "radial-gradient(closest-side, rgba(80, 120, 255, 0.25), transparent)",
        }}
      />

      {/* Floating Theme Selector (Double-click background to toggle) */}
      <div className="absolute top-20 right-6 z-20 pointer-events-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowThemeBar(!showThemeBar);
          }}
          className="px-2.5 py-1 rounded-full bg-black/40 hover:bg-black/60 border border-neutral-800 text-[11px] text-neutral-400 hover:text-neutral-200 transition cursor-pointer backdrop-blur-md"
        >
          Theme: <span className="uppercase text-cyan-400 font-semibold">{activeTheme}</span>
        </button>

        {showThemeBar && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-2 p-1.5 rounded-xl bg-black/80 border border-neutral-800 backdrop-blur-md flex items-center gap-1 shadow-xl animate-in fade-in duration-150"
          >
            {(["dark", "sunset", "light", "red"] as OrbTheme[]).map((t) => (
              <button
                key={t}
                onClick={() => handleSelectTheme(t)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                  activeTheme === t
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
