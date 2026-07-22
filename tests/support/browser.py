"""A minimal Chrome DevTools Protocol client, with no third-party packages.

Speaks raw RFC 6455 over a socket, which is all that is needed to drive a
headless browser: navigate, evaluate, emulate a viewport, a colour scheme or a
motion preference, dispatch real input, read the accessibility tree, and
capture a screenshot.

The browser is located through the CHROME environment variable first, then the
usual install locations, so the suites run wherever Chrome or Chromium is
installed rather than only where they were written.
"""

import base64
import json
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request

CANDIDATE_BROWSERS = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
)

CANDIDATE_COMMANDS = (
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome",
)


class BrowserUnavailable(Exception):
    """No Chrome or Chromium could be found to run against."""


def find_browser():
    override = os.environ.get("CHROME")
    if override:
        if os.path.exists(override):
            return override
        raise BrowserUnavailable("CHROME is set to {!r}, which does not exist".format(override))

    for path in CANDIDATE_BROWSERS:
        if os.path.exists(path):
            return path

    for command in CANDIDATE_COMMANDS:
        found = shutil.which(command)
        if found:
            return found

    raise BrowserUnavailable(
        "no Chrome or Chromium found; set CHROME to the executable to run these tests"
    )


class WebSocket:
    def __init__(self, url, timeout=30):
        match = re.match(r"ws://([^:/]+):(\d+)(/.*)", url)
        host, port, path = match.group(1), int(match.group(2)), match.group(3)
        self.sock = socket.create_connection((host, port))
        self.sock.settimeout(timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(
            "GET {} HTTP/1.1\r\nHost: {}:{}\r\nUpgrade: websocket\r\n"
            "Connection: Upgrade\r\nSec-WebSocket-Key: {}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n".format(path, host, port, key).encode()
        )
        buffer = b""
        while b"\r\n\r\n" not in buffer:
            buffer += self.sock.recv(4096)
        if b"101" not in buffer.split(b"\r\n")[0]:
            raise RuntimeError("websocket handshake failed: {!r}".format(buffer[:200]))
        self.buffer = buffer.split(b"\r\n\r\n", 1)[1]

    def _read(self, count):
        while len(self.buffer) < count:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise RuntimeError("connection closed by the browser")
            self.buffer += chunk
        head, self.buffer = self.buffer[:count], self.buffer[count:]
        return head

    def send(self, text):
        payload = text.encode()
        length = len(payload)
        header = bytes([0x81])
        if length < 126:
            header += bytes([0x80 | length])
        elif length < 65536:
            header += bytes([0x80 | 126]) + struct.pack(">H", length)
        else:
            header += bytes([0x80 | 127]) + struct.pack(">Q", length)
        mask = os.urandom(4)
        masked = bytes(byte ^ mask[i % 4] for i, byte in enumerate(payload))
        self.sock.sendall(header + mask + masked)

    def recv(self):
        """Returns one complete message, reassembling continuation frames."""
        chunks = []
        while True:
            first, second = self._read(2)
            final, opcode = first & 0x80, first & 0x0F
            length = second & 0x7F
            if length == 126:
                length = struct.unpack(">H", self._read(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self._read(8))[0]
            data = self._read(length)
            if opcode == 0x9:                                   # ping
                self.sock.sendall(bytes([0x8A, 0x80]) + os.urandom(4))
                continue
            if opcode == 0x8:                                   # close
                raise RuntimeError("the browser closed the connection")
            chunks.append(data)
            if final:
                return b"".join(chunks).decode()

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


class Browser:
    """One headless browser with one page attached."""

    def __init__(self, port=0):
        executable = find_browser()
        self.profile = tempfile.mkdtemp(prefix="whack-a-mole-test-")
        port = port or self._free_port()
        self.process = subprocess.Popen(
            [executable, "--headless=new", "--disable-gpu", "--hide-scrollbars",
             "--remote-debugging-port={}".format(port),
             "--user-data-dir={}".format(self.profile),
             "--no-first-run", "--no-default-browser-check",
             "--disable-features=Translate", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        target = self._await_target(port)
        self.socket = WebSocket(target["webSocketDebuggerUrl"])
        self.message_id = 0

    @staticmethod
    def _free_port():
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            return probe.getsockname()[1]

    def _await_target(self, port):
        deadline = time.time() + 25
        while time.time() < deadline:
            try:
                listing = json.load(urllib.request.urlopen(
                    "http://127.0.0.1:{}/json/list".format(port), timeout=2))
                page = next((t for t in listing if t["type"] == "page"), None)
                if page:
                    return page
            except Exception:
                pass
            time.sleep(0.2)
        raise BrowserUnavailable("the browser did not expose a page to drive")

    def call(self, method, **params):
        self.message_id += 1
        message_id = self.message_id
        self.socket.send(json.dumps({"id": message_id, "method": method, "params": params}))
        while True:
            message = json.loads(self.socket.recv())
            if message.get("id") == message_id:
                if "error" in message:
                    raise RuntimeError("{}: {}".format(method, message["error"]))
                return message.get("result", {})

    # Page

    def navigate(self, url, settle=0.5):
        self.call("Page.enable")
        self.call("Page.navigate", url=url)
        deadline = time.time() + 20
        while time.time() < deadline:
            message = json.loads(self.socket.recv())
            if message.get("method") == "Page.loadEventFired":
                break
        time.sleep(settle)

    def before_load(self, source):
        """Runs a script in every new document, before the game's own modules."""
        self.call("Page.enable")
        self.call("Page.addScriptToEvaluateOnNewDocument", source=source)

    def eval(self, expression, await_promise=False):
        result = self.call("Runtime.evaluate", expression=expression,
                           returnByValue=True, awaitPromise=await_promise,
                           userGesture=True)
        if "exceptionDetails" in result:
            raise RuntimeError(result["exceptionDetails"].get("text", "evaluation failed"))
        return result["result"].get("value")

    # Emulation

    def viewport(self, width, height, mobile=False, touch=False):
        self.call("Emulation.setDeviceMetricsOverride", width=width, height=height,
                  deviceScaleFactor=1, mobile=mobile)
        # maxTouchPoints has to stay within 1 and 16 even when touch is being
        # turned off, so it is always sent as a valid count.
        self.call("Emulation.setTouchEmulationEnabled", enabled=touch, maxTouchPoints=5)

    def color_scheme(self, scheme):
        """Emulate light or dark. Apply before navigating: the theme is resolved
        once at load and pinned to the root element."""
        self.call("Emulation.setEmulatedMedia", media="",
                  features=[{"name": "prefers-color-scheme", "value": scheme}])

    def media_features(self, **features):
        self.call("Emulation.setEmulatedMedia", media="", features=[
            {"name": name.replace("_", "-"), "value": value}
            for name, value in features.items()
        ])

    # Input

    def click_point(self, x, y):
        for kind in ("mousePressed", "mouseReleased"):
            self.call("Input.dispatchMouseEvent", type=kind, x=x, y=y,
                      button="left", clickCount=1)

    def move_mouse(self, x, y):
        self.call("Input.dispatchMouseEvent", type="mouseMoved", x=x, y=y)

    def press_key(self, key, code=None, text=None):
        payload = {"key": key, "code": code or key, "windowsVirtualKeyCode": 0}
        if key == "Enter":
            payload.update(windowsVirtualKeyCode=13, text="\r")
        elif key == " ":
            payload.update(windowsVirtualKeyCode=32, text=" ", code="Space")
        elif key == "Tab":
            payload.update(windowsVirtualKeyCode=9)
        if text is not None:
            payload["text"] = text
        self.call("Input.dispatchKeyEvent", type="keyDown", **payload)
        self.call("Input.dispatchKeyEvent", type="keyUp", **payload)

    # Inspection

    def accessibility_tree(self):
        self.call("Accessibility.enable")
        return self.call("Accessibility.getFullAXTree")["nodes"]

    def live_regions(self):
        """Every node the accessibility tree exposes as an announcing region."""
        regions = []
        for node in self.accessibility_tree():
            for prop in node.get("properties", []):
                if prop["name"] == "live" and prop["value"].get("value") not in (None, "off"):
                    regions.append({
                        "role": node.get("role", {}).get("value"),
                        "live": prop["value"].get("value"),
                    })
        return regions

    def screenshot(self, path, full_page=True):
        result = self.call("Page.captureScreenshot", format="png",
                           captureBeyondViewport=full_page)
        with open(path, "wb") as handle:
            handle.write(base64.b64decode(result["data"]))

    def close(self):
        try:
            self.socket.close()
        finally:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            shutil.rmtree(self.profile, ignore_errors=True)

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.close()
        return False


def available():
    """Whether a browser can be found, without launching one."""
    try:
        find_browser()
        return True
    except BrowserUnavailable as error:
        print("  browser unavailable: {}".format(error), file=sys.stderr)
        return False
