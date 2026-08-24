@echo off
rem Dev-server launcher that works even when the parent process has a stale
rem PATH (pre-dating the Node.js install). Safe to delete once every tool
rem sees Node on PATH; then .claude/launch.json can just run "npm run dev".
set "PATH=C:\Program Files\nodejs;%PATH%"
rem Honor a harness-assigned port (autoPort) so multiple sessions can run side by side.
if defined PORT (
  "C:\Program Files\nodejs\node.exe" "%~dp0node_modules\vite\bin\vite.js" --port %PORT% --strictPort %*
) else (
  "C:\Program Files\nodejs\node.exe" "%~dp0node_modules\vite\bin\vite.js" %*
)
