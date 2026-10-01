Set oShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)

oShell.Run "cscript.exe //nologo """ & root & "\stop.vbs"""", 0, True
WScript.Sleep 2000
oShell.Run "wscript.exe """ & root & "\start.vbs"""", 0, False
