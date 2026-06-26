@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  python "%~dp0watch_snapshot_upload.py" --config "%~dp0config.json" --snapshot "%~dp0local_guosen_snapshot.json"
) else (
  py -3 "%~dp0watch_snapshot_upload.py" --config "%~dp0config.json" --snapshot "%~dp0local_guosen_snapshot.json"
)
pause
