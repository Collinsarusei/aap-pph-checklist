@echo off
cd /d "%~dp0"
echo Stopping the app...
call pm2 stop aph-pph-forms
echo Applying any database updates...
call npm run setup
echo Starting the app...
call pm2 restart aph-pph-forms --update-env
call pm2 save
call pm2 status
pause
