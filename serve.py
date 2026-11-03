#!/usr/bin/env python3
"""Serve Auricle on this computer.

Run this file and leave the window open. Running it again reopens the page
instead of failing when the server is already up.
"""

import os
import socket
import sys
import threading
import urllib.request
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT = 5173


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".wasm": "application/wasm",
        ".html": "text/html",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # A cached copy of an older page is what makes the second visit look broken.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def can_connect(port):
    try:
        with socket.create_connection((HOST, port), timeout=0.4):
            return True
    except OSError:
        return False


def is_auricle(port):
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port}/", timeout=1) as response:
            body = response.read(8000).decode("utf-8", "replace")
        return "Auricle" in body
    except Exception:
        return False


def first_free_port(start):
    port = start
    while port < start + 20:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((HOST, port))
            except OSError:
                port += 1
                continue
            return port
    return None


def main():
    if can_connect(PORT) and is_auricle(PORT):
        url = f"http://{HOST}:{PORT}/"
        print(f"Auricle is already running.\nOpen {url}")
        print("Leave the first server window open. This window can be closed.")
        webbrowser.open(url)
        return 0

    port = PORT if not can_connect(PORT) else first_free_port(PORT + 1)
    if port is None:
        print("Could not find a free port. Close the old server window and try again.")
        return 1

    url = f"http://{HOST}:{port}/"
    server = ThreadingHTTPServer((HOST, port), Handler)
    print(f"Auricle is running at {url}")
    print("Keep this window open while you use the site.")
    print("Press Ctrl+C here when you want to stop it.")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
