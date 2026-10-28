@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 goto use_py
where python >nul 2>&1
if %errorlevel%==0 goto use_python
echo Python not found. Install Python or open index.html through VS Code Live Server.
pause
exit /b 1

:use_py
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"
echo Game URL: http://localhost:8000
echo Press Ctrl+C to stop the server.
py -m http.server 8000
goto end

:use_python
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"
echo Game URL: http://localhost:8000
echo Press Ctrl+C to stop the server.
python -m http.server 8000

:end
pause
