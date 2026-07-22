"""A local static server for the game under test.

Modules are only loaded over HTTP, so the tests cannot open the page from the
file system. Binds to an unused port on the loopback interface, which keeps
several test runs from colliding and keeps the server off the network.
"""

import functools
import http.server
import threading


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        """Silence the per-request logging; the suites report their own results."""


class StaticServer:
    def __init__(self, directory):
        handler = functools.partial(QuietHandler, directory=str(directory))
        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    @property
    def url(self):
        return "http://127.0.0.1:{}/index.html".format(self.port)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc_info):
        self.httpd.shutdown()
        self.httpd.server_close()
        return False
