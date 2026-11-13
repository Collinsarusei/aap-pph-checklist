@echo off
cd /d "%~dp0"
call pm2 stop aph-pph-forms
call pm2 save --force
call pm2 status
pause
