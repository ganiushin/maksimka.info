#!/usr/bin/env python3
"""Local preview server for the resume: python3 serve.py [port]

Unlike `python3 -m http.server`, it tells the browser not to cache anything,
so edits to the JSON, styles and script show up on a plain reload.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
ROOT = Path(__file__).resolve().parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = partial(NoCacheHandler, directory=str(ROOT))
    print(f"Резюме: http://127.0.0.1:{PORT}/")
    ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
