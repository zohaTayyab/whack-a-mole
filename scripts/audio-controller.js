/* Original game audio, generated in the browser. Nothing here is loaded from a
   file or a network request: the background loop is a sample buffer this module
   renders once, and every effect is a short oscillator figure.

   The audio context is created lazily, from the user interaction that first
   needs it, because browsers refuse to start audio any other way. */

import {
  DEFAULT_MUSIC_VOLUME,
  MAX_MUSIC_VOLUME,
  MIN_MUSIC_VOLUME,
} from "./config.js";

const TWO_PI = Math.PI * 2;
const A4_MIDI = 69;
const A4_HZ = 440;

/* Mixing levels. Music sits well below the effects so it never competes with
   the feedback the player needs to hear. */
const MUSIC_LEVEL = 0.2;
const MELODY_LEVEL = 0.26;
const BASS_LEVEL = 0.2;
const START_EFFECT_LEVEL = 0.26;
const HIT_EFFECT_LEVEL = 0.3;
const GAME_OVER_EFFECT_LEVEL = 0.28;

/* Every note fades in and out rather than switching on, which is what keeps
   the effects free of clicks and sudden transients. */
const NOTE_ATTACK_SECONDS = 0.008;
const NOTE_RELEASE_SECONDS = 0.015;
const EFFECT_TAIL_SECONDS = 0.03;

/* The loop: four bars of eighth notes at a brisk but unhurried tempo. The
   melody is a short original figure over D, B minor, G and A, kept to a
   pentatonic shape so no interval turns sour on the twentieth repeat, and
   broken by rests so it bounces instead of chattering. MIDI note numbers,
   null for a rest. */
const MUSIC_TEMPO_BPM = 128;
const MUSIC_STEPS_PER_BEAT = 2;
const MELODY_STEPS = [
  74, 71, null, 74, 78, null, 76, 74,
  71, 69, null, 71, 74, null, 71, 69,
  76, 74, null, 76, 81, null, 78, 76,
  74, 71, null, 69, 66, null, 69, 71,
];
const BASS_STEPS = [
  50, null, null, null, 50, null, null, null,
  47, null, null, null, 47, null, null, null,
  43, null, null, null, 43, null, null, null,
  45, null, null, null, 45, null, null, null,
];
const MELODY_NOTE_STEPS = 0.95;
const BASS_NOTE_STEPS = 1.9;
const MELODY_DECAY_SECONDS = 0.19;
const BASS_DECAY_SECONDS = 0.4;

function midiToFrequency(midiNote) {
  return A4_HZ * Math.pow(2, (midiNote - A4_MIDI) / 12);
}

/* A triangle built from its first four harmonics: mellow, and with no energy
   high enough to sound sharp over a small speaker. */
function triangleWave(phase) {
  return (
    ((Math.sin(TWO_PI * phase) -
      Math.sin(TWO_PI * 3 * phase) / 9 +
      Math.sin(TWO_PI * 5 * phase) / 25 -
      Math.sin(TWO_PI * 7 * phase) / 49) *
      8) /
    (Math.PI * Math.PI)
  );
}

/* A sine with a little of its octave, so the bass still reads as a pitch on
   speakers that cannot reproduce the fundamental. */
function bassWave(phase) {
  return (Math.sin(TWO_PI * phase) + 0.25 * Math.sin(TWO_PI * 2 * phase)) / 1.25;
}

/* Each waveform is evaluated once into a table and then read back by phase.
   Rendering the loop directly from the harmonic series above would mean
   millions of trigonometric calls, which is long enough to stall the page at
   the very moment a round starts. */
const WAVETABLE_LENGTH = 2048;

function buildWavetable(shape) {
  /* One extra entry repeats the first, so interpolating across the wrap needs
     no special case. */
  const table = new Float32Array(WAVETABLE_LENGTH + 1);

  for (let index = 0; index < WAVETABLE_LENGTH; index += 1) {
    table[index] = shape(index / WAVETABLE_LENGTH);
  }

  table[WAVETABLE_LENGTH] = table[0];
  return table;
}

function readWavetable(table, phase) {
  const position = (phase - Math.floor(phase)) * WAVETABLE_LENGTH;
  const index = position | 0;
  const fraction = position - index;
  return table[index] + (table[index + 1] - table[index]) * fraction;
}

function addNote(samples, sampleRate, startSeconds, lengthSeconds, frequency, level, table, decaySeconds) {
  const start = Math.round(startSeconds * sampleRate);
  const length = Math.round(lengthSeconds * sampleRate);
  const attack = Math.max(1, Math.round(NOTE_ATTACK_SECONDS * sampleRate));
  const release = Math.max(1, Math.round(NOTE_RELEASE_SECONDS * sampleRate));
  const phaseStep = frequency / sampleRate;
  /* The same exponential decay as before, advanced one step at a time rather
     than recomputed from the elapsed time at every sample. */
  const decayStep = Math.exp(-1 / (decaySeconds * sampleRate));

  let phase = 0;
  let decay = 1;

  for (let offset = 0; offset < length && start + offset < samples.length; offset += 1) {
    let envelope = decay;

    if (offset < attack) {
      envelope *= offset / attack;
    }

    const untilEnd = length - offset;
    if (untilEnd < release) {
      envelope *= untilEnd / release;
    }

    samples[start + offset] += level * envelope * readWavetable(table, phase);
    phase += phaseStep;
    decay *= decayStep;
  }
}

function addVoice(samples, sampleRate, steps, stepSeconds, noteSteps, level, table, decaySeconds) {
  steps.forEach((midiNote, index) => {
    if (midiNote === null) {
      return;
    }

    addNote(
      samples,
      sampleRate,
      index * stepSeconds,
      noteSteps * stepSeconds,
      midiToFrequency(midiNote),
      level,
      table,
      decaySeconds
    );
  });
}

/* Rendered once per page session. Every note fades to silence before the
   buffer ends and the first sample is silent, so the loop joins without a
   click. */
function renderMusicBuffer(context) {
  const stepSeconds = 60 / MUSIC_TEMPO_BPM / MUSIC_STEPS_PER_BEAT;
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(
    1,
    Math.round(MELODY_STEPS.length * stepSeconds * sampleRate),
    sampleRate
  );
  const samples = buffer.getChannelData(0);
  const melodyTable = buildWavetable(triangleWave);
  const bassTable = buildWavetable(bassWave);

  addVoice(samples, sampleRate, MELODY_STEPS, stepSeconds, MELODY_NOTE_STEPS,
    MELODY_LEVEL, melodyTable, MELODY_DECAY_SECONDS);
  addVoice(samples, sampleRate, BASS_STEPS, stepSeconds, BASS_NOTE_STEPS,
    BASS_LEVEL, bassTable, BASS_DECAY_SECONDS);

  return buffer;
}

/* Short original figures. Round start rises, a hit is a single quick drop, and
   game over falls away, so the three are told apart by shape rather than by
   volume. Times are offsets from the moment the effect is played. */
const ROUND_START_TONES = [
  { at: 0, duration: 0.09, from: 587.33, level: START_EFFECT_LEVEL },
  { at: 0.08, duration: 0.16, from: 880, level: START_EFFECT_LEVEL },
];
const HIT_TONES = [{ at: 0, duration: 0.11, from: 880, to: 330, level: HIT_EFFECT_LEVEL }];
const GAME_OVER_TONES = [
  { at: 0, duration: 0.16, from: 440, level: GAME_OVER_EFFECT_LEVEL },
  { at: 0.15, duration: 0.16, from: 369.99, level: GAME_OVER_EFFECT_LEVEL },
  { at: 0.3, duration: 0.4, from: 293.66, level: GAME_OVER_EFFECT_LEVEL },
];

function findAudioContextConstructor() {
  return globalThis.AudioContext || globalThis.webkitAudioContext || null;
}

/**
 * Creates the audio controller. No audio resource is created here.
 *
 * @param {{createContext?: (() => Object)|null}} [dependencies]
 */
export function createAudioController({ createContext = defaultContextFactory() } = {}) {
  let context = null;
  let masterGain = null;
  let musicGain = null;
  let musicBuffer = null;
  let musicSource = null;
  let enabled = false;
  let disposed = false;
  /* Held here as a percentage so a volume chosen before any audio exists is
     not lost: it is applied to the gain node the moment one is built. */
  let musicVolume = DEFAULT_MUSIC_VOLUME;
  /* Set when the context turns out to be unusable, so a browser that offers
     the constructor but cannot actually play is not asked twice. */
  let unusable = false;
  const effectNodes = new Set();

  function isSupported() {
    return !disposed && !unusable && createContext !== null;
  }

  /* Returns a usable context, or null. Only ever called from a user gesture
     the first time, which is what satisfies the autoplay policy. */
  function ensureContext() {
    if (!enabled || !isSupported()) {
      return null;
    }

    if (context === null) {
      try {
        context = createContext();
        masterGain = context.createGain();
        masterGain.connect(context.destination);
        musicGain = context.createGain();
        musicGain.gain.value = musicGainValue();
        musicGain.connect(masterGain);
      } catch (error) {
        context = null;
        masterGain = null;
        musicGain = null;
        unusable = true;
        return null;
      }
    }

    if (context.state === "suspended") {
      /* Resuming can be refused either way round: a rejected promise when the
         browser withholds permission, or a synchronous throw when the context
         has already closed. Audio simply stays silent; the round is unaffected
         either way. */
      try {
        Promise.resolve(context.resume()).catch(() => {});
      } catch (error) {
        /* Nothing further to try. */
      }
    }

    return context;
  }

  /* Full volume is the level the music was already mixed and tested at, so the
     control only ever attenuates from MUSIC_LEVEL and can never push the mix
     louder than it was measured to be safe at. */
  function musicGainValue() {
    return MUSIC_LEVEL * (musicVolume / MAX_MUSIC_VOLUME);
  }

  function releaseEffect(entry) {
    if (!effectNodes.delete(entry)) {
      return;
    }

    try {
      entry.oscillator.stop();
    } catch (error) {
      /* Already stopped, or the context has gone away. */
    }

    try {
      entry.oscillator.disconnect();
      entry.gain.disconnect();
    } catch (error) {
      /* Nothing left to disconnect. */
    }
  }

  function playTone(tone, startAt) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const entry = { oscillator, gain };
    const begin = startAt + tone.at;
    const end = begin + tone.duration;

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(tone.from, begin);
    if (tone.to) {
      oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
    }

    gain.gain.setValueAtTime(0, begin);
    gain.gain.linearRampToValueAtTime(tone.level, begin + NOTE_ATTACK_SECONDS);
    gain.gain.linearRampToValueAtTime(0, end);

    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.onended = () => releaseEffect(entry);
    oscillator.start(begin);
    oscillator.stop(end + EFFECT_TAIL_SECONDS);

    effectNodes.add(entry);
  }

  function playEffect(tones) {
    if (ensureContext() === null) {
      return;
    }

    try {
      const startAt = context.currentTime;
      for (const tone of tones) {
        playTone(tone, startAt);
      }
    } catch (error) {
      /* A closed or failing context must not interrupt the round. */
    }
  }

  function stopRoundMusic() {
    if (musicSource === null) {
      return;
    }

    const source = musicSource;
    /* Cleared first so anything reacting to the stop cannot see a source that
       is on its way out, and so no second loop can be created in between. */
    musicSource = null;
    source.onended = null;

    try {
      source.stop();
    } catch (error) {
      /* Already stopped. */
    }

    try {
      source.disconnect();
    } catch (error) {
      /* Already disconnected. */
    }
  }

  return {
    isSupported,

    /**
     * Sets the background-music volume as a whole percentage. Effects keep
     * their own level: this is a music control, not a master one.
     *
     * @param {number} volume 0 to 100; anything else is ignored
     */
    setMusicVolume(volume) {
      if (
        !Number.isFinite(volume) ||
        volume < MIN_MUSIC_VOLUME ||
        volume > MAX_MUSIC_VOLUME
      ) {
        return;
      }

      musicVolume = volume;

      /* Applied to the existing node, so the loop keeps playing rather than
         restarting at the new level. */
      if (musicGain !== null) {
        try {
          musicGain.gain.value = musicGainValue();
        } catch (error) {
          /* A closed context. The value is kept for the next one. */
        }
      }
    },

    /**
     * Turns sound on or off. Turning it off silences the music at once and
     * suppresses every later effect; it changes nothing else.
     */
    setEnabled(nextEnabled) {
      enabled = nextEnabled === true;

      if (!enabled) {
        stopRoundMusic();
      }
    },

    /**
     * Starts the background loop, or does nothing if it is already playing.
     * This is also how a paused loop is resumed, so no path through the game
     * can leave two loops running at once.
     */
    startRoundMusic() {
      if (musicSource !== null || ensureContext() === null) {
        return;
      }

      try {
        if (musicBuffer === null) {
          musicBuffer = renderMusicBuffer(context);
        }

        const source = context.createBufferSource();
        source.buffer = musicBuffer;
        source.loop = true;
        source.connect(musicGain);
        source.start();
        musicSource = source;
      } catch (error) {
        stopRoundMusic();
      }
    },

    /** Silences the background loop. Safe to call when nothing is playing. */
    stopRoundMusic,

    playRoundStart() {
      playEffect(ROUND_START_TONES);
    },

    playHit() {
      playEffect(HIT_TONES);
    },

    playGameOver() {
      playEffect(GAME_OVER_TONES);
    },

    /** Releases every audio resource. Nothing plays after this. */
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      enabled = false;
      stopRoundMusic();

      for (const entry of [...effectNodes]) {
        releaseEffect(entry);
      }

      const closing = context;
      context = null;
      masterGain = null;
      musicGain = null;
      musicBuffer = null;

      if (closing === null) {
        return;
      }

      try {
        Promise.resolve(closing.close()).catch(() => {});
      } catch (error) {
        /* Already closed. */
      }
    },
  };
}

function defaultContextFactory() {
  const AudioContextConstructor = findAudioContextConstructor();
  return AudioContextConstructor === null ? null : () => new AudioContextConstructor();
}
