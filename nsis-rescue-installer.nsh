; NSIS Rescue Installer Configuration
; This configuration allows installation even if previous uninstall fails
; Addresses issues from broken NSIS installers in earlier versions

!macro customInit
  ; Check for existing installation
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{${UNINSTALL_APP_KEY}}" "UninstallString"
  ${If} $0 != ""
    ; Found existing installation
    MessageBox MB_YESNO|MB_ICONQUESTION "A previous version of ${PRODUCT_NAME} was detected. The installer will attempt to upgrade it. Continue?" IDYES continueInstall
    Quit
    
    continueInstall:
    ; Try to run uninstaller but don't fail if it doesn't work
    ${If} ${FileExists} "$INSTDIR\Uninstall.exe"
      DetailPrint "Attempting to uninstall previous version..."
      ; Run uninstaller silently, wait for completion, but continue regardless of result
      ExecWait '"$INSTDIR\Uninstall.exe" /S _?=$INSTDIR' $1
      
      ${If} $1 != 0
        DetailPrint "Previous uninstall did not complete successfully (error code: $1)"
        DetailPrint "Performing rescue installation..."
        
        ; Clean up what we can manually
        Call RescueCleanup
      ${Else}
        DetailPrint "Previous version uninstalled successfully"
      ${EndIf}
      
      ; Small delay to ensure processes are released
      Sleep 2000
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  ; Force overwrite all files
  SetOverwrite on
  
  ; Ensure we can write to installation directory
  ${If} ${FileExists} "$INSTDIR"
    ; Try to clean any locked files
    Call CleanLockedFiles
  ${EndIf}
!macroend

; Rescue cleanup function - best effort removal of problematic files
Function RescueCleanup
  DetailPrint "Performing rescue cleanup..."
  
  ; Kill any running instances
  nsExec::ExecToLog 'taskkill /F /IM "Anava Installer.exe" /T'
  Pop $0
  
  ; Wait a moment for processes to terminate
  Sleep 1000
  
  ; Try to remove old uninstaller variations
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$INSTDIR\uninst.exe"
  Delete "$INSTDIR\unins000.exe"
  
  ; Clean up old shortcuts
  Delete "$DESKTOP\Anava Vision.lnk"
  Delete "$DESKTOP\Anava Installer.lnk"
  Delete "$SMPROGRAMS\Anava Vision\*.lnk"
  RMDir "$SMPROGRAMS\Anava Vision"
  Delete "$SMPROGRAMS\Anava Installer\*.lnk"
  RMDir "$SMPROGRAMS\Anava Installer"
  
  ; Clean registry entries that might cause issues
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{${UNINSTALL_APP_KEY}}"
  DeleteRegKey HKCU "Software\Anava\Installer"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{${UNINSTALL_APP_KEY}}"
  
  ; Try to remove installation directory files (best effort)
  ; But keep user data in AppData
  ${If} ${FileExists} "$INSTDIR\resources"
    RMDir /r "$INSTDIR\resources"
  ${EndIf}
  
  ${If} ${FileExists} "$INSTDIR\locales"
    RMDir /r "$INSTDIR\locales"
  ${EndIf}
  
  ; Remove any .dll and .exe files from install dir
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.exe"
  Delete "$INSTDIR\*.pak"
  Delete "$INSTDIR\*.dat"
  Delete "$INSTDIR\*.bin"
  
  DetailPrint "Rescue cleanup completed"
FunctionEnd

; Function to clean locked files
Function CleanLockedFiles
  ; Use Windows MoveFileEx to schedule deletion on reboot if files are locked
  System::Call 'kernel32::MoveFileEx(t "$INSTDIR\Anava Installer.exe", i 0, i 0x4) i.r0'
  
  ; Try to unlock common locked files
  ${If} ${FileExists} "$INSTDIR\chrome_crashpad_handler.exe"
    nsExec::ExecToLog 'taskkill /F /IM "chrome_crashpad_handler.exe" /T'
    Pop $0
    Delete "$INSTDIR\chrome_crashpad_handler.exe"
  ${EndIf}
  
  ${If} ${FileExists} "$INSTDIR\resources\app.asar"
    ; Electron files often get locked
    System::Call 'kernel32::MoveFileEx(t "$INSTDIR\resources\app.asar", i 0, i 0x4) i.r0'
  ${EndIf}
FunctionEnd

; Custom uninstaller that's more robust
!macro customUnInstall
  ; Kill any running processes first
  nsExec::ExecToLog 'taskkill /F /IM "Anava Installer.exe" /T'
  Pop $0
  
  Sleep 1000
  
  ; Clean up everything we can
  Delete "$DESKTOP\Anava Vision.lnk"
  Delete "$DESKTOP\Anava Installer.lnk"
  
  ; Remove start menu items
  Delete "$SMPROGRAMS\Anava Vision\*.lnk"
  RMDir "$SMPROGRAMS\Anava Vision"
  Delete "$SMPROGRAMS\Anava Installer\*.lnk"
  RMDir "$SMPROGRAMS\Anava Installer"
  
  ; Clean registry
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\{${UNINSTALL_APP_KEY}}"
  DeleteRegKey HKCU "Software\Anava"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{${UNINSTALL_APP_KEY}}"
  
  ; Remove firewall rules
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Anava Installer"'
  Pop $0
  
  ; Schedule deletion of locked files on reboot if needed
  ${If} ${FileExists} "$INSTDIR"
    System::Call 'kernel32::MoveFileEx(t "$INSTDIR", i 0, i 0x4) i.r0'
  ${EndIf}
!macroend