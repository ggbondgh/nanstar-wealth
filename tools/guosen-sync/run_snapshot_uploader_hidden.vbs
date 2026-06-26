Set shell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
command = "cmd /c cd /d """ & scriptDir & """ && (where python >nul 2>nul && python """ & scriptDir & "\watch_snapshot_upload.py"" --config """ & scriptDir & "\config.json"" --snapshot """ & scriptDir & "\local_guosen_snapshot.json"" || py -3 """ & scriptDir & "\watch_snapshot_upload.py"" --config """ & scriptDir & "\config.json"" --snapshot """ & scriptDir & "\local_guosen_snapshot.json"") >> """ & scriptDir & "\local_snapshot_uploader.log"" 2>&1"
shell.Run command, 0, False
