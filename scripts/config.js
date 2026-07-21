/* Named configuration values for the mole appearance cycle and the round. */

export const HOLE_COUNT = 9;

/* Length of one round, matching the value the interface starts from. The round
   is the same length at every difficulty. */
export const ROUND_DURATION_SECONDS = 60;

/* Music volume as a whole percentage. The default is full, because full means
   the level the music was already mixed and tested at rather than a louder
   one: the control attenuates from there. */
export const DEFAULT_MUSIC_VOLUME = 100;
export const MIN_MUSIC_VOLUME = 0;
export const MAX_MUSIC_VOLUME = 100;

/* Difficulty changes how long a mole stays visible, which is the reaction time
   the player actually has. The gap between appearances moves with it so the
   board never feels either empty or frantic, and every gap stays long enough
   to notice where the next mole is. Normal repeats the timing the game used
   before difficulty existed. All values are milliseconds. */
export const DIFFICULTY_PROFILES = Object.freeze({
  easy: Object.freeze({
    visibleMinMs: 1000,
    visibleMaxMs: 1700,
    gapMinMs: 400,
    gapMaxMs: 900,
  }),
  normal: Object.freeze({
    visibleMinMs: 650,
    visibleMaxMs: 1200,
    gapMinMs: 300,
    gapMaxMs: 800,
  }),
  hard: Object.freeze({
    visibleMinMs: 500,
    visibleMaxMs: 850,
    gapMinMs: 250,
    gapMaxMs: 650,
  }),
});

/* Matches the option selected in the markup, and the profile anything
   unrecognised falls back to. */
export const DEFAULT_DIFFICULTY = "normal";

const DIFFICULTY_VALUES = Object.freeze(Object.keys(DIFFICULTY_PROFILES));

/**
 * Reduces any value to a difficulty the game actually offers, so a stored,
 * stale, or tampered-with selection can never reach the rest of the game.
 *
 * @param {*} difficulty
 * @returns {string} one of the supported difficulty values
 */
export function resolveDifficulty(difficulty) {
  return DIFFICULTY_VALUES.includes(difficulty) ? difficulty : DEFAULT_DIFFICULTY;
}

/**
 * @param {*} difficulty
 * @returns {Object} the frozen timing profile for a supported difficulty, or
 *   the default profile for anything else
 */
export function difficultyProfile(difficulty) {
  return DIFFICULTY_PROFILES[resolveDifficulty(difficulty)];
}

export function supportedDifficulties() {
  return DIFFICULTY_VALUES;
}
