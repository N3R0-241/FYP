#!/bin/sh
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 serve.py
fi
if command -v python >/dev/null 2>&1; then
  exec python serve.py
fi
echo "Python 3 is not installed. Install it from https://www.python.org/downloads/ and run this again."
exit 1
