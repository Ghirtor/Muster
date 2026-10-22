@echo off
rem Sets the next release's version on the checked-out branch: version <x.y.z> <FEAT-n>.
rem Writes it into tauri.conf.json and package.json, commits and pushes the branch;
rem scripts/version.mjs does the work.
node "%~dp0scripts\version.mjs" %*
exit /b %ERRORLEVEL%
