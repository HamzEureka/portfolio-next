"use client";
import { useEffect, useRef } from "react";

/** Hero effects from the approved preview: WebGL fog (CSS fallback), and the "showreel" screen inside the ring with REC + ticking timecode.
 *  Server render = static markup (CSS fog, frame A of the reel). Everything animated starts in useEffect and is cleaned up. */
const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
const FS = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform vec2 r;uniform float t;" +
  "float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}" +
  "float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}" +
  "float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return v;}" +
  "void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=vec2(uv.x*r.x/r.y,uv.y)*2.4;" +
  "vec2 q=vec2(fbm(p+t*.03),fbm(p+vec2(5.2,1.3)-t*.02));float d=fbm(p+1.6*q+vec2(t*.02,0.));d=smoothstep(.38,.85,d);" +
  "float band=smoothstep(0.,.6,1.-uv.y)*.9+.2*(1.-abs(uv.y-.45));float a=d*band*.6;" +
  "vec3 c=mix(vec3(.05,.22,.06),vec3(.24,.62,.16),d);gl_FragColor=vec4(c*a,a);}";

const pad = (n: number) => (n < 10 ? "0" : "") + n;
const tc = (sec: number) => { const f = Math.floor((sec % 1) * 24), s = Math.floor(sec) % 60, m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600); return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`; };

export default function HeroFx() {
  const cv = useRef<HTMLCanvasElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = cv.current, hero = canvas?.closest(".hero") as HTMLElement | null;
    if (!canvas || !hero) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, alive = true, visible = true, last = "";
    const t0 = performance.now();

    // ---- fog (WebGL, falls back to the CSS fog if unavailable) ----
    let gl: WebGLRenderingContext | null = null, uR: WebGLUniformLocation | null = null, uT: WebGLUniformLocation | null = null;
    if (!reduce) {
      try {
        gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
        if (gl) {
          const sh = (type: number, src: string) => { const s = gl!.createShader(type)!; gl!.shaderSource(s, src); gl!.compileShader(s); if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error("shader"); return s; };
          const pr = gl.createProgram()!; gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
          const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
          const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
          uR = gl.getUniformLocation(pr, "r"); uT = gl.getUniformLocation(pr, "t");
        }
      } catch { gl = null; }
    }
    const size = () => { if (!gl) return; const k = window.innerWidth < 900 ? 0.35 : 0.5; canvas.width = Math.max(2, Math.round(canvas.clientWidth * k)); canvas.height = Math.max(2, Math.round(canvas.clientHeight * k)); gl.viewport(0, 0, canvas.width, canvas.height); };
    const draw = (t: number) => { if (!gl) return; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform2f(uR, canvas.width, canvas.height); gl.uniform1f(uT, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    if (gl) { hero.dataset.fog = "webgl"; size(); draw(12); }

    const onResize = () => { if (gl) { size(); draw(12); } };
    window.addEventListener("resize", onResize);
    const io = "IntersectionObserver" in window ? new IntersectionObserver((e) => { visible = e[0].isIntersecting; }) : null;
    io?.observe(hero);

    const loop = () => {
      if (!alive) return;
      if (visible && !document.hidden) {
        if (gl) draw((performance.now() - t0) / 1000);
        if (!reduce && tcRef.current) { const v = tc(((performance.now() - t0) / 1000) % 12); if (v !== last) { tcRef.current.textContent = v; last = v; } }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); io?.disconnect(); delete hero.dataset.fog; };
  }, []);

  return (
    <>
      <canvas ref={cv} id="fog" aria-hidden="true" />
      <div className="fogcss" aria-hidden="true"><i /><i /></div>
      <div className="reel" aria-hidden="true">
        <i className="fr a" /><i className="fr b" /><i className="fr c" /><i className="fr d" />
        <span className="rec">REC</span><span className="tc" ref={tcRef}>00:00:00:00</span>
      </div>
    </>
  );
}
