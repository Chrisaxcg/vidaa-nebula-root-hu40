"""Serve the Cobalt smoke test to one TV for a bounded period."""

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", required=True)
    parser.add_argument("--tv", required=True)
    parser.add_argument("--port", type=int, default=18771)
    parser.add_argument("--seconds", type=int, default=120)
    options = parser.parse_args()
    page = Path(__file__).with_name("test.html").read_bytes()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            if self.client_address[0] != options.tv:
                self.send_error(403)
                return
            target = urlsplit(self.path)
            if target.path == "/test.html":
                print("TV requested test.html", flush=True)
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(page)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(page)
            elif target.path == "/report":
                try:
                    caps = json.loads(parse_qs(target.query)["caps"][0])
                    if not isinstance(caps, dict) or not all(type(v) is bool for v in caps.values()):
                        raise ValueError("expected boolean capability flags")
                except (ValueError, KeyError, IndexError):
                    self.send_error(400)
                    return
                print("Cobalt capabilities", json.dumps(caps, sort_keys=True), flush=True)
                self.send_response(204)
                self.end_headers()
            else:
                self.send_error(404)

    with HTTPServer((options.bind, options.port), Handler) as server:
        print(f"Probe listening on {options.bind}:{options.port}", flush=True)
        server.timeout = 2
        deadline = time.monotonic() + options.seconds
        while time.monotonic() < deadline:
            server.handle_request()


if __name__ == "__main__":
    main()
