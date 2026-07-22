"""Assertions and result collection.

Deliberately small: a check records what was expected, what was found, and
whether they matched. A suite that cannot run at all is recorded as skipped
rather than passed, so an unavailable browser never reads as a green result.
"""


class Skipped(Exception):
    """Raised by a suite that cannot run in this environment."""


class Results:
    def __init__(self, name):
        self.name = name
        self.passed = 0
        self.failures = []
        self.skips = []

    def check(self, label, actual, expected):
        """Passes when actual equals expected."""
        if actual == expected:
            self.passed += 1
            return True
        self.failures.append(
            "{}\n      expected: {!r}\n      actual:   {!r}".format(label, expected, actual)
        )
        return False

    def ok(self, label, condition):
        """Passes when the condition is true."""
        return self.check(label, bool(condition), True)

    def at_least(self, label, actual, minimum):
        """Passes when a measured value meets a floor, reporting the value either way."""
        if isinstance(actual, (int, float)) and actual >= minimum:
            self.passed += 1
            return True
        self.failures.append(
            "{}\n      expected: at least {!r}\n      actual:   {!r}".format(
                label, minimum, actual
            )
        )
        return False

    def skip(self, reason):
        self.skips.append(reason)

    @property
    def failed(self):
        return len(self.failures)
