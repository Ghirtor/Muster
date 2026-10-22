; Puts the bundled `flotilla` CLI (bin\) on the user's PATH on install and takes it off on uninstall,
; then tells running programs the environment changed (WM_SETTINGCHANGE to every top-level window).

!macro FLOTILLA_PATH ACTION
  Push $0
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\installer\path.ps1" ${ACTION} "$INSTDIR\bin"'
  Pop $0
  Pop $0
  SendMessage 0xFFFF 0x1A 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro FLOTILLA_PATH add
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro FLOTILLA_PATH remove
!macroend
