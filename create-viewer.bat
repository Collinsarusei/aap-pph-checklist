@echo off
rem Creates a STAFF VIEWER account (or resets its password).
rem Viewers can sign in, search patients and open/download filled forms. They cannot edit or delete.
rem Double-click this file, or run:  create-viewer.bat <username> <password>
cd /d "%~dp0"
echo.
echo  APH/PPH Forms - create staff viewer account
echo  -------------------------------------------
echo.
node create-admin.js --viewer %*
echo.
pause
