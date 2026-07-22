"""Sound and music volume, including the browser that offers audio and then
refuses to provide it.

Sound is feedback and never information, so every one of these states has to
leave the game completely playable.
"""

import time

from support import game

NAME = "audio"
DESCRIPTION = "sound control, music volume, and unavailable audio"

# Counts what the game asks the audio system for, so duplicated music loops or
# leaked contexts show up as a number rather than as a guess.
SPY = """
(() => {
  window.__audio = {contexts: 0, sources: 0, started: 0, stopped: 0};
  const Real = window.AudioContext || window.webkitAudioContext;
  if (!Real) { return; }
  class Counted extends Real {
    constructor(...args) {
      super(...args);
      window.__audio.contexts += 1;
    }
    createBufferSource() {
      window.__audio.sources += 1;
      const node = super.createBufferSource();
      const start = node.start.bind(node);
      const stop = node.stop.bind(node);
      node.start = (...a) => { window.__audio.started += 1; return start(...a); };
      node.stop = (...a) => { window.__audio.stopped += 1; return stop(...a); };
      return node;
    }
  }
  window.AudioContext = Counted;
  window.webkitAudioContext = Counted;
})();
"""

NO_AUDIO = """
(() => {
  delete window.AudioContext;
  delete window.webkitAudioContext;
})();
"""

REFUSING_AUDIO = """
(() => {
  const Refuse = function () { throw new DOMException('refused', 'NotAllowedError'); };
  window.AudioContext = Refuse;
  window.webkitAudioContext = Refuse;
})();
"""


def run(browser, url, results):
    browser.before_load(game.FAST_CLOCK)
    browser.before_load(SPY)
    browser.viewport(1280, 800)
    browser.navigate(url)
    game.clear_storage(browser)
    browser.navigate(url)

    results.check("sound is offered", browser.eval(
        "document.querySelector('#sound').disabled"), False)
    results.check("sound starts on", browser.eval(
        "document.querySelector('#sound').checked"), True)
    results.check("the volume slider is offered", browser.eval(
        "document.querySelector('#music-volume').disabled"), False)
    results.check("volume starts at full", browser.eval(
        "document.querySelector('#music-volume').value"), "100")
    results.check("the reading matches the slider", browser.eval(
        "document.querySelector('#music-volume-value').textContent.trim()"), "100%")

    results.check("nothing is played before a deliberate action",
                  browser.eval("window.__audio.contexts"), 0)

    game.start_round(browser)
    results.at_least("starting a round starts audio",
                     browser.eval("window.__audio.contexts"), 1)

    contexts_after_start = browser.eval("window.__audio.contexts")
    for _ in range(5):
        browser.eval("document.querySelector('#restart-game').click()")
        time.sleep(0.15)
    results.check("restarting repeatedly does not open another audio context",
                  browser.eval("window.__audio.contexts"), contexts_after_start)

    started = browser.eval("window.__audio.started")
    stopped = browser.eval("window.__audio.stopped")
    results.ok("every music loop that started has been stopped again",
               started - stopped <= 1)

    # Volume
    for value in ("0", "35", "100"):
        browser.eval("""
          (() => {{
            const slider = document.querySelector('#music-volume');
            slider.value = '{}';
            slider.dispatchEvent(new Event('input', {{bubbles: true}}));
            slider.dispatchEvent(new Event('change', {{bubbles: true}}));
          }})()
        """.format(value))
        time.sleep(0.15)
        results.check("volume {} is shown".format(value), browser.eval(
            "document.querySelector('#music-volume-value').textContent.trim()"),
            "{}%".format(value))

    results.check("the slider covers nothing but 0 to 100",
                  browser.eval("""
                    (() => {
                      const slider = document.querySelector('#music-volume');
                      return [slider.min, slider.max, slider.step];
                    })()
                  """), ["0", "100", "5"])

    browser.navigate(url)
    results.check("the chosen volume is remembered", browser.eval(
        "document.querySelector('#music-volume').value"), "100")

    # Turning sound off must not stop the game working.
    browser.eval("document.querySelector('#sound').click()")
    time.sleep(0.2)
    results.check("sound can be turned off", browser.eval(
        "document.querySelector('#sound').checked"), False)
    game.start_round(browser)
    results.check("and the round still runs",
                  game.control_state(browser)["holesEnabled"], 9)
    results.check("and the status still says what is happening",
                  game.control_state(browser)["status"],
                  "Hit each mole before it disappears.")

    # A browser with no audio at all.
    browser.before_load(NO_AUDIO)
    browser.navigate(url)
    results.check("with no audio the sound control is disabled",
                  browser.eval("document.querySelector('#sound').disabled"), True)
    results.check("and the volume slider is disabled",
                  browser.eval("document.querySelector('#music-volume').disabled"), True)
    game.start_round(browser)
    results.check("and the game is still fully playable",
                  game.control_state(browser)["holesEnabled"], 9)

    # A browser that offers audio and then refuses it.
    browser.before_load(REFUSING_AUDIO)
    browser.navigate(url)
    game.start_round(browser)
    results.check("a refusing browser leaves the game playable",
                  game.control_state(browser)["holesEnabled"], 9)
    results.check("and the sound control stops claiming to work",
                  browser.eval("document.querySelector('#sound').disabled"), True)
