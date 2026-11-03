#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo "Starting Auricle. Leave this window open while you use the site."
echo ""
if command -v python3 >/dev/null 2>&1; then
  python3 serve.py
  status=$?
elif command -v python >/dev/null 2>&1; then
  python serve.py
  status=$?
else
  echo "Python 3 was not found."
  echo "In Terminal, run: xcode-select --install"
  echo "Or install Python from https://www.python.org/downloads/macos/"
  status=1
fi
echo ""
echo "Press Return to close this window."
read -r _
exit "$status"
