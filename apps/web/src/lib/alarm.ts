"use client";

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** Unlocks audio after the first user gesture (browsers block autoplay). */
export function primeAlarm() {
  const c = getContext();
  if (c && c.state === "suspended") c.resume().catch(() => undefined);
}

/** Short two-tone siren (~1.2 s) generated with WebAudio. */
export function playAlarm() {
  const c = getContext();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => undefined);
  const start = c.currentTime + 0.02;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
  gain.gain.setValueAtTime(0.25, start + 1.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
  gain.connect(c.destination);

  const osc = c.createOscillator();
  osc.type = "square";
  for (let i = 0; i < 4; i++) {
    osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, start + i * 0.3);
  }
  osc.connect(gain);
  osc.start(start);
  osc.stop(start + 1.25);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}
