// STATUS: UNVERIFIED (DeepSeek draft, reviewed by Claude; tsx --test + tsc passed in the cloud sandbox only, not yet on the owner's machine)
/**
 * W4: the tick and boom sounds of the category detonation (v4 site/index.html:2359-2407).
 *
 * QUIRKS (preserved from the original v4 code):
 * - The AudioContext is created lazily on the first sound and reused. If its constructor throws, the variable is
 *   still null, so the next sound tries to create it again (index.html:2359-2362).
 * - `resume()` is called on EVERY `getAudioCtx()` when the state is exactly 'suspended' (index.html:2362).
 * - Both `playTick` and `playBoom` swallow every error, including context creation and `resume()` (index.html:2366-2376,
 *   2378-2407).
 * - The tick writes `o.frequency.value = freq` (assignment, index.html:2370); the boom uses `setValueAtTime`
 *   (index.html:2400).
 * - The boom buffer has `Math.floor(sampleRate * 0.6)` samples, filled with
 *   `(random * 2 - 1) * Math.pow(1 - i / bufferSize, 2)` (index.html:2381-2385).
 * - The connect chains keep their original order: noise -> filter -> noiseGain -> destination and
 *   oscillator -> gain -> destination (index.html:2395, 2404).
 *
 * DEVIATIONS (intentional, no visible behaviour change):
 * - `dispose()` is new: it closes the context if one exists, swallows sync throws and thenable rejections, marks the
 *   module disposed so later sounds are no-ops, and is idempotent. The original never closes the context.
 * - Context creation is injected through `env.createContext()` instead of reading `window.AudioContext`.
 */
import type { AudioContextLike, CreateSounds, Sounds } from "./contract";

// SOURCE: index.html:2359-2364
export const createSounds: CreateSounds = (env) => {
  // SOURCE: index.html:2359
  let audioCtx: AudioContextLike | null = null;
  let disposed = false;

  // SOURCE: index.html:2360-2364
  const getAudioCtx = (): AudioContextLike => {
    if (!audioCtx) audioCtx = env.createContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  };

  // SOURCE: index.html:2366-2376
  const playTick = (freq: number): void => {
    if (disposed) return;
    try {
      const ctx = getAudioCtx();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.16);
    } catch {}
  };

  // SOURCE: index.html:2378-2407
  const playBoom = (): void => {
    if (disposed) return;
    try {
      const ctx = getAudioCtx();
      const bufferSize = Math.floor(ctx.sampleRate * 0.6);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (env.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }
      const noise = ctx.createBufferSource(); noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(3200, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.6);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.9, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      noise.connect(filter).connect(noiseGain).connect(ctx.destination);
      noise.start();

      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(140, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.5);
      og.gain.setValueAtTime(0.9, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.connect(og).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  // DEVIATION: new teardown, the original never closes the context.
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (!audioCtx) return;
    const ctx = audioCtx;
    audioCtx = null;
    try {
      const closed = ctx.close();
      if (closed && (typeof closed === "object" || typeof closed === "function")) {
        const thenable = closed as { then?: unknown };
        if (typeof thenable.then === "function") {
          (thenable as { then(onFulfilled?: () => void, onRejected?: () => void): unknown }).then(
            undefined,
            () => {},
          );
        }
      }
    } catch {}
  };

  return { playTick, playBoom, dispose };
};
