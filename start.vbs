Set oShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)

oShell.CurrentDirectory = root & "\backend"
oShell.Run "cmd.exe /k title VMS_Backend && node src/index.js", 1, False

oShell.CurrentDirectory = root & "\frontend"
oShell.Run "cmd.exe /k title VMS_Frontend && npm.cmd start", 1, False
