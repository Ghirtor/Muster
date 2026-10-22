@echo off
rem Sets the next release's version on dev: version <x.y.z> <FEAT-n>. Writes it into
rem tauri.conf.json and package.json, commits and pushes dev; scripts/version.mjs does the work.
node "%~dp0scripts\version.mjs" %*
exit /b %ERRORLEVEL%
