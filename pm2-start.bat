@echo off
cd /d "%~dp0"
echo Starting APH/PPH forms with PM2...
if not exist logs mkdir logs
call pm2 start ecosystem.config.js
call pm2 save
echo.
echo Registering PM2 to start when Windows boots...
call pm2-startup install
call pm2 save
echo.
call pm2 status
echo.
echo Open http://localhost:8080  (admin: http://localhost:8080/admin)
echo Logs: pm2 logs aph-pph-forms     Stop: pm2-stop.bat
pause
