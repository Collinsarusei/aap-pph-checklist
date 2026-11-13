@echo off
cd /d "%~dp0"
set PSQL=psql
where psql >nul 2>nul || set "PSQL=C:\Program Files\PostgreSQL8in\psql.exe"
echo Creating database maternity_forms (enter the postgres password when asked)...
"%PSQL%" -U postgres -h localhost -c "CREATE DATABASE maternity_forms;"
echo.
echo Creating tables (uses DATABASE_URL from .env)...
call npm run setup
echo.
echo Done. Next: create-admin.bat, then pm2-start.bat
pause
