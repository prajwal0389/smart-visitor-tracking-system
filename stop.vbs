Set oShell = CreateObject("WScript.Shell")
oShell.Run "taskkill /F /T /FI ""WINDOWTITLE eq VMS_Backend*""", 0, True
oShell.Run "taskkill /F /T /FI ""WINDOWTITLE eq VMS_Frontend*""", 0, True
