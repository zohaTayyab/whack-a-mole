/* Module-level checks that need no browser.

   Each module is given its dependencies by the test, so the timing, the
   storage, and the clock are all deterministic and nothing here depends on a
   real round elapsing. Run through the runner, or directly with any engine
   that loads ES modules. */

import {
  DEFAULT_DIFFICULTY,
  DEFAULT_MUSIC_VOLUME,
  DIFFICULTY_PROFILES,
  HOLE_COUNT,
  MAX_MUSIC_VOLUME,
  MIN_MUSIC_VOLUME,
  ROUND_DURATION_SECONDS,
  difficultyProfile,
  resolveDifficulty,
  supportedDifficulties,
} from "../../scripts/config.js";
import { createBestScoreStore } from "../../scripts/best-score-store.js";
import { createPreferencesStore } from "../../scripts/preferences-store.js";
import { createRoundTimer } from "../../scripts/round-timer.js";
import { createMoleCycle } from "../../scripts/mole-cycle.js";

/* Engines differ on how a script prints: some define console, the smaller
   shells only define print. */
const say =
  typeof console !== "undefined" && typeof console.log === "function"
    ? (line) => console.log(line)
    : (line) => print(line);

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (same) {
    passed += 1;
  } else {
    failures.push(
      `${label}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`
    );
  }
}

function ok(label, condition) {
  check(label, condition === true, true);
}

/* A storage double that can be told to fail, so the "storage stops answering"
   path is exercised rather than assumed. */
function fakeStorage({ initial = null, failReads = false, failWrites = false } = {}) {
  let value = initial;
  return {
    getItem() {
      if (failReads) { throw new Error("denied"); }
      return value;
    },
    setItem(key, next) {
      if (failWrites) { throw new Error("quota"); }
      value = next;
    },
    read: () => value,
  };
}

/* --- configuration --- */

check("nine holes", HOLE_COUNT, 9);
check("sixty second round", ROUND_DURATION_SECONDS, 60);
check("volume defaults to full", DEFAULT_MUSIC_VOLUME, 100);
check("volume range", [MIN_MUSIC_VOLUME, MAX_MUSIC_VOLUME], [0, 100]);
check("normal is the default difficulty", DEFAULT_DIFFICULTY, "normal");
check("three difficulties", supportedDifficulties(), ["easy", "normal", "hard"]);
ok("the profiles are frozen", Object.isFrozen(DIFFICULTY_PROFILES));
ok("each profile is frozen", Object.values(DIFFICULTY_PROFILES).every(Object.isFrozen));

for (const value of ["", "EASY", "Normal", null, undefined, 0, 1, [], {}, "hardest"]) {
  check(`unrecognised difficulty ${JSON.stringify(value)} falls back`,
    resolveDifficulty(value), "normal");
}
for (const level of ["easy", "normal", "hard"]) {
  check(`${level} is kept as given`, resolveDifficulty(level), level);
  check(`${level} resolves to its own profile`,
    difficultyProfile(level), DIFFICULTY_PROFILES[level]);
}
check("an unknown difficulty still yields a usable profile",
  difficultyProfile("nonsense"), DIFFICULTY_PROFILES.normal);

for (const [level, profile] of Object.entries(DIFFICULTY_PROFILES)) {
  ok(`${level}: the visible window is a real range`,
    profile.visibleMaxMs > profile.visibleMinMs);
  ok(`${level}: the gap is a real range`, profile.gapMaxMs > profile.gapMinMs);
  ok(`${level}: a mole is visible for longer than the gap before it`,
    profile.visibleMinMs > profile.gapMinMs);
  ok(`${level}: the gap is long enough to notice`, profile.gapMinMs >= 250);
}
ok("easy allows more reaction time than hard",
  DIFFICULTY_PROFILES.easy.visibleMinMs > DIFFICULTY_PROFILES.hard.visibleMinMs);

/* --- best scores --- */

{
  const storage = fakeStorage();
  const store = createBestScoreStore({ storage });
  check("no record to begin with", store.readBestScore("normal"), 0);
  ok("a first score is a record", store.recordBestScore("normal", 5));
  check("and is remembered", store.readBestScore("normal"), 5);
  ok("a lower score is not a record", store.recordBestScore("normal", 4) === false);
  check("and does not replace it", store.readBestScore("normal"), 5);
  ok("an equal score is not a record", store.recordBestScore("normal", 5) === false);
  ok("a higher score is a record", store.recordBestScore("normal", 9));
  check("and replaces it", store.readBestScore("normal"), 9);
  check("another difficulty is unaffected", store.readBestScore("hard"), 0);
  store.recordBestScore("hard", 3);
  check("each difficulty keeps its own", [store.readBestScore("normal"), store.readBestScore("hard")], [9, 3]);
  check("an unknown difficulty is treated as the default",
    store.readBestScore("nonsense"), 9);
}

for (const corrupt of ["", "not json", "[]", "null", "true", '{"normal":"nine"}',
  '{"normal":-1}', '{"normal":null}', '{"normal":{"deep":1}}']) {
  const store = createBestScoreStore({ storage: fakeStorage({ initial: corrupt }) });
  check(`corrupt best scores ${JSON.stringify(corrupt.slice(0, 16))} read as none`,
    store.readBestScore("normal"), 0);
}

{
  const store = createBestScoreStore({ storage: fakeStorage({ failReads: true }) });
  check("unreadable storage reads as no record", store.readBestScore("normal"), 0);
  ok("and a record can still be set for the session",
    store.recordBestScore("normal", 7));
  check("and read back", store.readBestScore("normal"), 7);
}

{
  const store = createBestScoreStore({ storage: fakeStorage({ failWrites: true }) });
  ok("a failed write still counts as a record for the session",
    store.recordBestScore("normal", 7));
  check("and the score is kept in memory", store.readBestScore("normal"), 7);
}

{
  const store = createBestScoreStore({ storage: null });
  check("no storage at all reads as no record", store.readBestScore("normal"), 0);
  ok("and recording does not throw", store.recordBestScore("normal", 2));
}

/* --- preferences --- */

{
  const storage = fakeStorage();
  const preferences = createPreferencesStore({ storage });
  check("no theme chosen to begin with", preferences.readTheme(), null);
  check("volume defaults to full", preferences.readMusicVolume(), 100);
  preferences.recordTheme("dark");
  check("a chosen theme is kept", preferences.readTheme(), "dark");
  preferences.recordMusicVolume(40);
  check("a chosen volume is kept", preferences.readMusicVolume(), 40);
  ok("both are written to storage", /dark/.test(storage.read()) && /40/.test(storage.read()));
}

for (const invalid of ["purple", "", null, undefined, 0, {}, []]) {
  const preferences = createPreferencesStore({ storage: fakeStorage() });
  preferences.recordTheme(invalid);
  check(`an invalid theme ${JSON.stringify(invalid)} is not stored`,
    preferences.readTheme(), null);
}

for (const invalid of [-1, 101, 1000, "loud", null, undefined, {}, NaN]) {
  const preferences = createPreferencesStore({ storage: fakeStorage() });
  preferences.recordMusicVolume(invalid);
  check(`an invalid volume ${JSON.stringify(invalid)} leaves the default`,
    preferences.readMusicVolume(), 100);
}

for (const corrupt of ["{", "[]", "null", '{"theme":"purple"}', '{"musicVolume":900}',
  '{"musicVolume":"loud"}']) {
  const preferences = createPreferencesStore({ storage: fakeStorage({ initial: corrupt }) });
  check(`corrupt settings ${JSON.stringify(corrupt.slice(0, 16))}: no theme`,
    preferences.readTheme(), null);
  check(`corrupt settings ${JSON.stringify(corrupt.slice(0, 16))}: full volume`,
    preferences.readMusicVolume(), 100);
}

/* --- round timer --- */

{
  let clock = 0;
  const scheduled = [];
  const timer = createRoundTimer({
    now: () => clock,
    schedule: (callback, delayMs) => {
      scheduled.push({ callback, delayMs });
      return scheduled.length;
    },
    cancel: (handle) => { scheduled[handle - 1] = null; },
  });

  const ticks = [];
  let completed = 0;
  timer.start({
    onTick: (remaining) => ticks.push(remaining),
    onComplete: () => { completed += 1; },
  });

  /* Starting emits no tick of its own: the markup already shows the full
     round, so the first tick the timer reports is the first second lost. */
  check("starting reports nothing on its own", ticks.length, 0);
  ok("but a tick is scheduled", scheduled.length === 1);

  clock += 1000;
  scheduled[scheduled.length - 1].callback();
  check("the first tick is one second in", ticks[ticks.length - 1], 59);

  clock += 59000;
  while (completed === 0 && scheduled.filter(Boolean).length) {
    const next = scheduled.filter(Boolean).pop();
    scheduled[scheduled.indexOf(next)] = null;
    next.callback();
  }
  check("the round completes once", completed, 1);
  check("and finishes at zero", ticks[ticks.length - 1], 0);
}

{
  let clock = 0;
  const scheduled = [];
  const timer = createRoundTimer({
    now: () => clock,
    schedule: (callback) => { scheduled.push(callback); return scheduled.length; },
    cancel: () => {},
  });
  const ticks = [];
  timer.start({ onTick: (r) => ticks.push(r), onComplete: () => {} });
  clock += 5000;
  scheduled[scheduled.length - 1]();
  const atPause = ticks[ticks.length - 1];
  timer.pause();
  clock += 30000;
  timer.resume();
  clock += 1000;
  scheduled[scheduled.length - 1]();
  ok("pausing holds the remaining time",
    ticks[ticks.length - 1] === atPause - 1);
}

/* --- mole cycle --- */

{
  /* The cycle schedules with the global timer, so the test provides one it can
     drive by hand. */
  const pending = [];
  globalThis.setTimeout = (callback, delayMs) => {
    pending.push({ callback, delayMs });
    return pending.length;
  };
  globalThis.clearTimeout = (handle) => { pending[handle - 1] = null; };

  const shown = [];
  const hidden = [];
  const cycle = createMoleCycle({
    showMole: (index) => shown.push(index),
    hideMole: (index) => hidden.push(index),
  });

  cycle.start(DIFFICULTY_PROFILES.normal);
  let guard = 0;
  while (shown.length < 12 && guard < 200) {
    const next = pending.filter(Boolean).pop();
    if (!next) { break; }
    pending[pending.indexOf(next)] = null;
    next.callback();
    guard += 1;
  }

  ok("moles appear", shown.length > 0);
  ok("every hole index is in range", shown.every((i) => i >= 0 && i < HOLE_COUNT));
  ok("the same hole is never used twice in a row",
    shown.every((index, i) => i === 0 || index !== shown[i - 1]));
  ok("moles are taken away again", hidden.length > 0);

  cycle.stop();
  const afterStop = shown.length;
  pending.filter(Boolean).forEach((entry) => entry.callback());
  check("stopping the cycle stops new moles", shown.length, afterStop);
}

/* --- report --- */

say(`${passed} passed, ${failures.length} failed`);
for (const failure of failures) {
  say(`  FAIL  ${failure}`);
}
if (failures.length > 0) {
  throw new Error(`${failures.length} module checks failed`);
}
