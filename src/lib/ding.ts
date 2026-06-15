// Living Sprints — the transition "ding" (Direction D, sensory half). A soft
// 880Hz sine blip generated with WebAudio (no audio asset), marking the moment
// of consequence (a move transition). Ported from the design reference's
// playDing(). Pure util, no React. Callers gate it on the cues preference; the
// AudioContext is reused (one per app) and resumed on use, since browsers
// require a user gesture before audio can start.

let ctx: AudioContext | null = null;

type AudioCtor = typeof AudioContext;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Play the soft transition cue. No-op if WebAudio is unavailable. */
export function playDing(): void {
  const ac = audioContext();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ac.destination);
    const t = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
  } catch {
    /* audio unavailable — silently skip */
  }
}
