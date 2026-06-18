/**
 * Tiny synthesized SFX via Web Audio API.
 *
 * No audio assets to load · every sound is a short oscillator burst.
 * Cheap, fast, no CDN, no licensing. Sounds approximate real chess
 * piece taps + capture thuds.
 *
 * Disabled by default. Toggle via setSoundEnabled().
 */

let enabled = false;
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  // Persist preference
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("stakemate.sound", value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
}

export function loadSoundPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem("stakemate.sound");
    enabled = v === "1";
    return enabled;
  } catch {
    return false;
  }
}

interface BeepOptions {
  freq: number;
  duration: number; // seconds
  type?: OscillatorType;
  attack?: number;
  release?: number;
  volume?: number;
}

function beep({
  freq,
  duration,
  type = "sine",
  attack = 0.005,
  release = 0.08,
  volume = 0.15,
}: BeepOptions): void {
  if (!enabled) return;
  const audio = getCtx();
  if (!audio) return;

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  const now = audio.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + attack + duration + release);

  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + attack + duration + release + 0.02);
}

/** Soft tap · piece moves to empty square. */
export const playMove = () => beep({ freq: 320, duration: 0.04, type: "triangle", volume: 0.08 });

/** Heavier hit · capture. */
export const playCapture = () => {
  beep({ freq: 180, duration: 0.06, type: "sawtooth", volume: 0.12 });
  beep({ freq: 90, duration: 0.08, type: "square", volume: 0.08 });
};

/** Sharp alert · check. */
export const playCheck = () => {
  beep({ freq: 660, duration: 0.06, type: "triangle", volume: 0.14 });
  setTimeout(() => beep({ freq: 880, duration: 0.06, type: "triangle", volume: 0.12 }), 70);
};

/** Bell tone · checkmate. */
export const playMate = () => {
  beep({ freq: 523, duration: 0.4, type: "sine", volume: 0.18, release: 0.6 });
  setTimeout(() => beep({ freq: 392, duration: 0.4, type: "sine", volume: 0.16, release: 0.6 }), 120);
  setTimeout(() => beep({ freq: 261, duration: 0.6, type: "sine", volume: 0.14, release: 0.8 }), 240);
};

/** Coin clink · wager placed. */
export const playWager = () => {
  beep({ freq: 1200, duration: 0.05, type: "triangle", volume: 0.1 });
  setTimeout(() => beep({ freq: 900, duration: 0.06, type: "triangle", volume: 0.08 }), 40);
};
