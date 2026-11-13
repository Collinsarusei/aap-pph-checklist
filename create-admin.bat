@echo off
rem Creates an admin account for /admin (or resets its password).
rem Double-click this file, or run:  create-admin.bat <username> <password>
cd /d "%~dp0"
echo.
echo  APH/PPH Forms - create admin account
echo  ------------------------------------
echo.
node create-admin.js %*
echo.
pause
