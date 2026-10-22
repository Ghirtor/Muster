@echo off
rem The installed `muster` CLI: the bundled cli.js, run with the machine's node (>= 22).
node "%~dp0..\server\cli.js" %*
exit /b %ERRORLEVEL%
