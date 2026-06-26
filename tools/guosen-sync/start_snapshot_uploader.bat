@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%~dp0watch_snapshot_upload.py" --config "%~dp0config.json" --snapshot "%~dp0local_guosen_snapshot.json"
) else (
  python "%~dp0watch_snapshot_upload.py" --config "%~dp0config.json" --snapshot "%~dp0local_guosen_snapshot.json"
)
pause
