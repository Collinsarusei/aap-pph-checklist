@echo off
cd /d "%~dp0"
call pm2 restart aph-pph-forms --update-env
call pm2 status
pause
