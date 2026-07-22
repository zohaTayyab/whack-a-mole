#!/usr/bin/env python3
"""Runs the test suites for the game.

    python3 tests/run.py              every suite
    python3 tests/run.py theme audio  only the named suites
    python3 tests/run.py --list       what is available

Needs Python 3 and a Chrome or Chromium install for the browser suites, and any
engine that can run ES modules for the module suite. Neither is downloaded and
nothing is installed: set CHROME or JS_ENGINE to point at an executable
elsewhere. A suite whose runtime is missing is reported as skipped, never as
passed.
"""

import argparse
import importlib
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from support import browser as browser_support          # noqa: E402
from support.expect import Results                      # noqa: E402
from support.server import StaticServer                 # noqa: E402

BROWSER_SUITES = [
    "structure", "lifecycle", "scoring", "difficulty",
    "persistence", "audio", "theme", "hammer",
    "responsive", "edge_cases",
]

MODULE_SUITE = os.path.join(HERE, "modules", "contracts.mjs")

CANDIDATE_ENGINES = (
    "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc",
    "node", "deno", "jsc", "d8",
)


def find_engine():
    override = os.environ.get("JS_ENGINE")
    if override:
        return override if os.path.exists(override) or shutil.which(override) else None
    for candidate in CANDIDATE_ENGINES:
        if os.path.exists(candidate):
            return candidate
        found = shutil.which(candidate)
        if found:
            return found
    return None


def run_module_suite():
    results = Results("modules")
    engine = find_engine()
    if not engine:
        results.skip("no JavaScript engine found; set JS_ENGINE to run the module suite")
        return results

    command = [engine, MODULE_SUITE]
    if os.path.basename(engine) in ("jsc", "d8"):
        command = [engine, "-m", MODULE_SUITE]
    if os.path.basename(engine) == "deno":
        command = [engine, "run", "--allow-read", MODULE_SUITE]

    completed = subprocess.run(command, cwd=PROJECT, capture_output=True, text=True)
    output = (completed.stdout or "") + (completed.stderr or "")
    summary = next((line for line in output.splitlines() if " passed, " in line), None)
    if summary:
        passed, failed = summary.split(" passed, ")
        results.passed = int(passed.strip())
        failed_count = int(failed.split(" ")[0])
        if failed_count:
            for line in output.splitlines():
                if line.strip().startswith("FAIL"):
                    results.failures.append(line.strip()[6:])
            while len(results.failures) < failed_count:
                results.failures.append("(failure detail not captured)")
    else:
        results.failures.append("the module suite produced no summary:\n{}".format(output[:800]))
    return results


def run_browser_suite(name, url):
    module = importlib.import_module("suites.{}".format(name))
    results = Results(getattr(module, "NAME", name))
    if not browser_support.available():
        results.skip("no Chrome or Chromium found; set CHROME to run the browser suites")
        return results
    instance = browser_support.Browser()
    try:
        module.run(instance, url, results)
    except Exception as error:                               # noqa: BLE001
        results.failures.append("the suite stopped early: {}: {}".format(
            type(error).__name__, error))
    finally:
        instance.close()
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("suites", nargs="*", help="suites to run; default is all")
    parser.add_argument("--list", action="store_true", help="list the suites and exit")
    arguments = parser.parse_args()

    available = ["modules"] + BROWSER_SUITES
    if arguments.list:
        for name in available:
            print("  {}".format(name))
        return 0

    wanted = arguments.suites or available
    unknown = [name for name in wanted if name not in available]
    if unknown:
        print("unknown suite(s): {}".format(", ".join(unknown)))
        print("available: {}".format(", ".join(available)))
        return 2

    started = time.time()
    reports = []

    with StaticServer(PROJECT) as server:
        for name in wanted:
            print("\n{}".format(name))
            results = run_module_suite() if name == "modules" else run_browser_suite(
                name, server.url)
            reports.append(results)
            if results.skips:
                for reason in results.skips:
                    print("  SKIPPED  {}".format(reason))
            else:
                print("  {} passed, {} failed".format(results.passed, results.failed))
            for failure in results.failures:
                print("  FAIL  {}".format(failure))

    total_passed = sum(report.passed for report in reports)
    total_failed = sum(report.failed for report in reports)
    skipped = [report.name for report in reports if report.skips]

    print("\n" + "=" * 60)
    for report in reports:
        state = "SKIPPED" if report.skips else ("FAILED" if report.failed else "passed")
        print("  {:<14} {:>5} passed  {:>3} failed   {}".format(
            report.name, report.passed, report.failed, state))
    print("=" * 60)
    print("{} passed, {} failed, {} suite(s) skipped, in {:.1f}s".format(
        total_passed, total_failed, len(skipped), time.time() - started))
    if skipped:
        print("skipped: {} - these were not run and must not be reported as passing".format(
            ", ".join(skipped)))

    return 1 if total_failed else 0


if __name__ == "__main__":
    sys.exit(main())
