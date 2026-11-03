@echo off
cd /d "%~dp0"
where py >nul 2>&1 && py -3 serve.py && goto :done
where python >nul 2>&1 && python serve.py && goto :done
where python3 >nul 2>&1 && python3 serve.py && goto :done
echo Python 3 is not installed. Install it from https://www.python.org/downloads/ and run this again.
pause
:done
