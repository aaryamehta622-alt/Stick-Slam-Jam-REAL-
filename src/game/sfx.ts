// Tiny WebAudio sound effects — no external assets needed
let ctx: AudioContext | null = null;
let enabled = true;
export function setSoundEnabled(value: boolean) { enabled = value; }

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();
}

function tone(opts: { freq: number; type?: OscillatorType; dur?: number; vol?: number; sweepTo?: number }) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const { freq, type = "square", dur = 0.08, vol = 0.15, sweepTo } = opts;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (sweepTo !== undefined) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), c.currentTime + dur);
  }
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

function noise(dur = 0.12, vol = 0.2, filterFreq = 1200) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  src.connect(filt).connect(g).connect(c.destination);
  src.start();
  src.stop(c.currentTime + dur);
}

export const sfx = {
  cast() { tone({freq:900,sweepTo:180,type:'sine',dur:.19,vol:.10}); noise(.07,.07,2400); },
  reel() { tone({freq:180,sweepTo:950,type:'triangle',dur:.25,vol:.09}); },
  splash() { noise(.24,.15,1600); tone({freq:220,sweepTo:70,type:'sine',dur:.22,vol:.13}); },
  heal() { tone({freq:420,sweepTo:960,type:'sine',dur:.4,vol:.12}); },
  punch: () => { tone({ freq: 220, type: "square", dur: 0.05, vol: 0.08, sweepTo: 90 }); noise(0.08, 0.14, 800); },
  kick: () => { tone({ freq: 160, type: "sawtooth", dur: 0.09, vol: 0.1, sweepTo: 50 }); noise(0.14, 0.22, 500); },
  finisher: () => { tone({ freq: 110, type: "sawtooth", dur: 0.35, vol: 0.18, sweepTo: 40 }); noise(0.3, 0.28, 400); tone({ freq: 880, type: "square", dur: 0.05, vol: 0.06 }); },
  whiff: () => { noise(0.06, 0.05, 2200); tone({ freq: 2200, type: "sine", dur: 0.04, vol: 0.04, sweepTo: 600 }); },
  jump: () => tone({ freq: 380, type: "triangle", dur: 0.1, vol: 0.06, sweepTo: 720 }),
  dash: () => { noise(0.12, 0.12, 3000); tone({ freq: 540, type: "triangle", dur: 0.1, vol: 0.05, sweepTo: 240 }); },
  hurt: () => tone({ freq: 520, type: "square", dur: 0.07, vol: 0.07, sweepTo: 180 }),
  block: () => { tone({ freq: 1400, type: "square", dur: 0.04, vol: 0.07, sweepTo: 900 }); noise(0.04, 0.06, 4000); },
  ability: () => { tone({ freq: 660, type: "sawtooth", dur: 0.18, vol: 0.1, sweepTo: 1320 }); noise(0.18, 0.12, 2500); },
  ko: () => { tone({ freq: 440, type: "sawtooth", dur: 0.5, vol: 0.18, sweepTo: 60 }); noise(0.5, 0.2, 400); },
  bell: () => { tone({ freq: 880, type: "sine", dur: 0.25, vol: 0.15 }); setTimeout(() => tone({ freq: 1320, type: "sine", dur: 0.35, vol: 0.12 }), 120); },
};
