@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo Assemblies of God, Wli - Offline Church Manager
echo ================================================
echo Installing required packages. Internet is needed for this step.
call npm install
if errorlevel 1 goto failed
echo Building Windows installer...
call npm run dist
if errorlevel 1 goto failed
echo.
echo Build complete. Check the release folder for the installer.
pause
exit /b 0
:failed
echo.
echo BUILD FAILED. Read the error above, then try again.
pause
exit /b 1
