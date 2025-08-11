; Custom NSIS Script for Anava Installer
; Fixes critical Windows installer issues

!macro customHeader
  ; Enable detailed logging for debugging
  LogSet on
  SetDetailsPrint textonly
  
  ; Set compression to prevent corruption
  SetCompressor /SOLID lzma
  SetCompressorDictSize 64
  
  ; Unicode support
  Unicode true
!macroend

!macro preInit
  ; Set registry key for proper app identification
  SetRegView 64
  
  ; Check for corrupted downloads
  CRCCheck force
  
  ; Initialize installer variables
  Var /GLOBAL EXISTING_INSTALLATION_PATH
  Var /GLOBAL FORCE_UNINSTALL
!macroend

!macro customInit
  ; Check if application is running and kill it
  nsExec::ExecToLog 'taskkill /F /IM "Anava Installer.exe" /T'
  Pop $0
  
  ; Wait for process to fully terminate
  Sleep 2000
  
  ; Check for existing installation
  ReadRegStr $EXISTING_INSTALLATION_PATH HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  
  ${If} $EXISTING_INSTALLATION_PATH != ""
    ; Found existing installation
    DetailPrint "Found existing installation at: $EXISTING_INSTALLATION_PATH"
    
    ; Try to run uninstaller silently
    ${If} ${FileExists} "$EXISTING_INSTALLATION_PATH\Uninstall Anava Installer.exe"
      DetailPrint "Running uninstaller..."
      
      ; First try silent uninstall
      nsExec::ExecToLog '"$EXISTING_INSTALLATION_PATH\Uninstall Anava Installer.exe" /S _?=$EXISTING_INSTALLATION_PATH'
      Pop $0
      
      ; Wait for uninstall to complete
      Sleep 3000
      
      ; If uninstaller failed, force remove files
      ${If} $0 != 0
        DetailPrint "Silent uninstall failed, forcing cleanup..."
        Call ForceCleanup
      ${EndIf}
    ${Else}
      ; No uninstaller found, force cleanup
      DetailPrint "No uninstaller found, forcing cleanup..."
      Call ForceCleanup
    ${EndIf}
  ${EndIf}
  
  ; Clear any remaining registry entries
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  DeleteRegKey HKLM "Software\Anava\Anava Installer"
  DeleteRegKey HKCU "Software\Anava\Anava Installer"
!macroend

!macro customInstall
  ; Ensure installation directory exists and has proper permissions
  CreateDirectory "$INSTDIR"
  
  ; Set proper permissions for installation directory
  nsExec::ExecToLog 'icacls "$INSTDIR" /grant Everyone:F /T'
  Pop $0
  
  ; Register application in Windows
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayName" "Anava Installer"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString" '"$INSTDIR\Uninstall Anava Installer.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayIcon" "$INSTDIR\Anava Installer.exe,0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "Publisher" "Anava Inc."
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "NoRepair" 1
  
  ; Create proper Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\Anava"
  CreateShortcut "$SMPROGRAMS\Anava\Anava Installer.lnk" "$INSTDIR\Anava Installer.exe" "" "$INSTDIR\Anava Installer.exe" 0
  CreateShortcut "$SMPROGRAMS\Anava\Uninstall Anava Installer.lnk" "$INSTDIR\Uninstall Anava Installer.exe" "" "$INSTDIR\Uninstall Anava Installer.exe" 0
  
  ; Create desktop shortcut with proper path
  CreateShortcut "$DESKTOP\Anava Installer.lnk" "$INSTDIR\Anava Installer.exe" "" "$INSTDIR\Anava Installer.exe" 0
  
  ; Verify executable exists
  ${If} ${FileExists} "$INSTDIR\Anava Installer.exe"
    DetailPrint "Installation verified: Anava Installer.exe exists"
  ${Else}
    MessageBox MB_OK|MB_ICONEXCLAMATION "Warning: Anava Installer.exe was not found in installation directory!"
  ${EndIf}
  
  ; Set file associations
  WriteRegStr HKCR ".anava" "" "AnavaConfiguration"
  WriteRegStr HKCR "AnavaConfiguration" "" "Anava Configuration File"
  WriteRegStr HKCR "AnavaConfiguration\DefaultIcon" "" "$INSTDIR\Anava Installer.exe,0"
  WriteRegStr HKCR "AnavaConfiguration\shell\open\command" "" '"$INSTDIR\Anava Installer.exe" "%1"'
!macroend

!macro customUnInit
  ; Set registry view
  SetRegView 64
  
  ; Kill running processes
  nsExec::ExecToLog 'taskkill /F /IM "Anava Installer.exe" /T'
  Pop $0
  
  Sleep 1000
!macroend

!macro customUnInstall
  ; Remove all shortcuts
  Delete "$DESKTOP\Anava Installer.lnk"
  Delete "$SMPROGRAMS\Anava\Anava Installer.lnk"
  Delete "$SMPROGRAMS\Anava\Uninstall Anava Installer.lnk"
  RMDir "$SMPROGRAMS\Anava"
  
  ; Remove registry entries
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  DeleteRegKey HKLM "Software\Anava"
  DeleteRegKey HKCU "Software\Anava"
  DeleteRegKey HKCR ".anava"
  DeleteRegKey HKCR "AnavaConfiguration"
  
  ; Force remove installation directory
  RMDir /r /REBOOTOK "$INSTDIR"
  
  ; Remove app data if exists
  RMDir /r "$APPDATA\anava-installer"
  RMDir /r "$LOCALAPPDATA\anava-installer"
  
  ; Clean up any remaining files in temp
  RMDir /r "$TEMP\anava-installer"
!macroend

; Helper function to force cleanup of existing installation
Function ForceCleanup
  ; Kill any running processes
  nsExec::ExecToLog 'taskkill /F /IM "Anava Installer.exe" /T'
  Pop $0
  
  Sleep 1000
  
  ; Try to delete installation directory
  ${If} $EXISTING_INSTALLATION_PATH != ""
    DetailPrint "Removing directory: $EXISTING_INSTALLATION_PATH"
    
    ; First try normal removal
    RMDir /r "$EXISTING_INSTALLATION_PATH"
    
    ; If that fails, schedule for deletion on reboot
    ${If} ${FileExists} "$EXISTING_INSTALLATION_PATH"
      DetailPrint "Scheduling directory removal on reboot..."
      RMDir /r /REBOOTOK "$EXISTING_INSTALLATION_PATH"
      
      ; Also try using cmd to force delete
      nsExec::ExecToLog 'cmd /c rd /s /q "$EXISTING_INSTALLATION_PATH"'
      Pop $0
    ${EndIf}
  ${EndIf}
  
  ; Clean up shortcuts
  Delete "$DESKTOP\Anava Installer.lnk"
  Delete "$SMPROGRAMS\Anava\Anava Installer.lnk"
  Delete "$SMPROGRAMS\Anava\Uninstall Anava Installer.lnk"
  RMDir "$SMPROGRAMS\Anava"
  
  ; Clean up app data
  RMDir /r "$APPDATA\anava-installer"
  RMDir /r "$LOCALAPPDATA\anava-installer"
FunctionEnd

; Custom page to show when installation fails
!macro customAbort
  MessageBox MB_OK|MB_ICONEXCLAMATION "Installation was cancelled or failed. If you continue to experience issues, please try:$\n$\n1. Running the installer as Administrator$\n2. Temporarily disabling antivirus software$\n3. Downloading a fresh copy of the installer$\n4. Contacting support at support@anava.ai"
!macroend