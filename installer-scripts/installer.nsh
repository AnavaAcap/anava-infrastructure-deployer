; Custom NSIS Script for Anava Installer
; Fixes: Missing shortcuts, uninstallation failures, NSIS integrity checks
; Compatible with Electron v37.2.6 and electron-builder

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinVer.nsh"
!include "x64.nsh"

; Version and metadata
!define PRODUCT_NAME "Anava Installer"
!define PRODUCT_VERSION "0.9.178"
!define PRODUCT_PUBLISHER "Anava AI Inc."
!define PRODUCT_WEB_SITE "https://anava.ai"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"
!define PRODUCT_GUID "{6B3E5A7C-9D4F-4E2A-8C1B-F9E8D3A2C5B7}"

; Custom defines for shortcut management
!define SHORTCUT_NAME "Anava Installer.lnk"
!define START_MENU_FOLDER "Anava AI"

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_NAME}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${PRODUCT_NAME}"

; Custom macros for safe operations
!macro SafeRMDir PATH
  ${If} ${FileExists} "${PATH}"
    RMDir "${PATH}"
  ${EndIf}
!macroend

!macro SafeDelete PATH
  ${If} ${FileExists} "${PATH}"
    Delete "${PATH}"
  ${EndIf}
!macroend

!macro VerifyInstallation
  ; Verify critical files exist
  ${IfNot} ${FileExists} "$INSTDIR\${PRODUCT_NAME}.exe"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Installation verification failed: Main executable not found!"
    Abort
  ${EndIf}
  
  ; Verify shortcuts were created
  ${IfNot} ${FileExists} "$DESKTOP\${SHORTCUT_NAME}"
    ; Attempt to create desktop shortcut again
    CreateShortcut "$DESKTOP\${SHORTCUT_NAME}" "$INSTDIR\${PRODUCT_NAME}.exe" "" "$INSTDIR\${PRODUCT_NAME}.exe" 0
  ${EndIf}
  
  ${IfNot} ${FileExists} "$SMPROGRAMS\${START_MENU_FOLDER}\${SHORTCUT_NAME}"
    ; Attempt to create start menu shortcut again
    CreateDirectory "$SMPROGRAMS\${START_MENU_FOLDER}"
    CreateShortcut "$SMPROGRAMS\${START_MENU_FOLDER}\${SHORTCUT_NAME}" "$INSTDIR\${PRODUCT_NAME}.exe" "" "$INSTDIR\${PRODUCT_NAME}.exe" 0
  ${EndIf}
!macroend

!macro CheckAndFixRegistry
  ; Ensure uninstall registry keys are correct
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_NAME}.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1
  
  ; Calculate and store installation size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
!macroend

; Custom function to ensure shortcuts exist
Function EnsureShortcuts
  ; Create desktop shortcut with error checking
  ClearErrors
  CreateShortcut "$DESKTOP\${SHORTCUT_NAME}" "$INSTDIR\${PRODUCT_NAME}.exe" "" "$INSTDIR\${PRODUCT_NAME}.exe" 0
  ${If} ${Errors}
    DetailPrint "Warning: Could not create desktop shortcut"
    ; Try alternative location
    CreateShortcut "$USERPROFILE\Desktop\${SHORTCUT_NAME}" "$INSTDIR\${PRODUCT_NAME}.exe" "" "$INSTDIR\${PRODUCT_NAME}.exe" 0
  ${EndIf}
  
  ; Create start menu shortcuts with error checking
  ClearErrors
  CreateDirectory "$SMPROGRAMS\${START_MENU_FOLDER}"
  ${If} ${Errors}
    DetailPrint "Warning: Could not create start menu folder"
  ${Else}
    CreateShortcut "$SMPROGRAMS\${START_MENU_FOLDER}\${SHORTCUT_NAME}" "$INSTDIR\${PRODUCT_NAME}.exe" "" "$INSTDIR\${PRODUCT_NAME}.exe" 0
    CreateShortcut "$SMPROGRAMS\${START_MENU_FOLDER}\Uninstall ${PRODUCT_NAME}.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
  ${EndIf}
  
  ; Also create shortcuts in common locations for all users
  SetShellVarContext all
  CreateDirectory "$SMPROGRAMS\${START_MENU_FOLDER}"
  CreateShortcut "$SMPROGRAMS\${START_MENU_FOLDER}\${SHORTCUT_NAME}" "$INSTDIR\${PRODUCT_NAME}.exe" "" "$INSTDIR\${PRODUCT_NAME}.exe" 0
  SetShellVarContext current
FunctionEnd

; Custom function for safe uninstallation
Function un.SafeCleanup
  ; Kill any running instances
  nsExec::ExecToLog 'taskkill /F /IM "${PRODUCT_NAME}.exe" /T'
  Sleep 1000
  
  ; Remove shortcuts with verification
  SetShellVarContext all
  !insertmacro SafeDelete "$SMPROGRAMS\${START_MENU_FOLDER}\${SHORTCUT_NAME}"
  !insertmacro SafeDelete "$SMPROGRAMS\${START_MENU_FOLDER}\Uninstall ${PRODUCT_NAME}.lnk"
  !insertmacro SafeRMDir "$SMPROGRAMS\${START_MENU_FOLDER}"
  SetShellVarContext current
  
  !insertmacro SafeDelete "$SMPROGRAMS\${START_MENU_FOLDER}\${SHORTCUT_NAME}"
  !insertmacro SafeDelete "$SMPROGRAMS\${START_MENU_FOLDER}\Uninstall ${PRODUCT_NAME}.lnk"
  !insertmacro SafeRMDir "$SMPROGRAMS\${START_MENU_FOLDER}"
  
  !insertmacro SafeDelete "$DESKTOP\${SHORTCUT_NAME}"
  !insertmacro SafeDelete "$USERPROFILE\Desktop\${SHORTCUT_NAME}"
  
  ; Clean registry with verification
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}"
  DeleteRegKey HKCU "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}"
  
  ; Remove application data if requested
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to remove application data and settings?" IDNO skip_appdata
    RMDir /r "$APPDATA\${PRODUCT_NAME}"
    RMDir /r "$LOCALAPPDATA\${PRODUCT_NAME}"
  skip_appdata:
FunctionEnd

; Override installation directory page
Function .onVerifyInstDir
  ; Ensure installation directory is valid
  ${If} ${FileExists} "$INSTDIR"
    ${If} ${FileExists} "$INSTDIR\${PRODUCT_NAME}.exe"
      MessageBox MB_YESNO|MB_ICONQUESTION "An existing installation was detected. Do you want to upgrade?" IDYES proceed
      Abort
      proceed:
    ${EndIf}
  ${EndIf}
FunctionEnd

; Post-installation verification
Function .onInstSuccess
  ; Verify installation integrity
  !insertmacro VerifyInstallation
  !insertmacro CheckAndFixRegistry
  
  ; Create backup of uninstaller
  CopyFiles "$INSTDIR\Uninstall.exe" "$INSTDIR\Uninstall.exe.backup"
  
  ; Log successful installation
  FileOpen $0 "$INSTDIR\install.log" w
  FileWrite $0 "Installation completed successfully$\r$\n"
  FileWrite $0 "Version: ${PRODUCT_VERSION}$\r$\n"
  FileWrite $0 "Date: $\r$\n"
  FileClose $0
FunctionEnd

; Custom installation section
Section "!${PRODUCT_NAME}" SEC_MAIN
  SetOutPath "$INSTDIR"
  SetOverwrite on
  
  ; Ensure shortcuts are created
  Call EnsureShortcuts
  
  ; Write uninstaller with verification
  ClearErrors
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to create uninstaller!"
    Abort
  ${EndIf}
  
  ; Set file attributes for protection
  SetFileAttributes "$INSTDIR\${PRODUCT_NAME}.exe" READONLY
  SetFileAttributes "$INSTDIR\Uninstall.exe" NORMAL
SectionEnd

; Custom uninstallation section
Section "Uninstall"
  ; Ensure clean uninstallation
  Call un.SafeCleanup
  
  ; Remove installation directory with retry logic
  ${ForEach} $R0 1 5 + 1
    ClearErrors
    RMDir /r "$INSTDIR"
    ${IfNot} ${Errors}
      ${ExitFor}
    ${EndIf}
    Sleep 1000
  ${Next}
  
  ; Final cleanup verification
  ${If} ${FileExists} "$INSTDIR"
    MessageBox MB_OK|MB_ICONINFORMATION "Some files could not be removed. Please delete $INSTDIR manually."
  ${EndIf}
SectionEnd

; Integrity check functions
Function IntegrityCheck
  ; Calculate CRC32 of main executable
  CrcCheck::GenCRC "$INSTDIR\${PRODUCT_NAME}.exe"
  Pop $0
  
  ; Store CRC in registry for future verification
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "MainExeCRC" "$0"
  
  ; Verify all critical files exist
  ${IfNot} ${FileExists} "$INSTDIR\${PRODUCT_NAME}.exe"
    MessageBox MB_OK|MB_ICONSTOP "Integrity check failed: Main executable missing!"
    Abort
  ${EndIf}
  
  ${IfNot} ${FileExists} "$INSTDIR\Uninstall.exe"
    MessageBox MB_OK|MB_ICONSTOP "Integrity check failed: Uninstaller missing!"
    Abort
  ${EndIf}
FunctionEnd

; Initialize installation
Function .onInit
  ; Check for admin rights
  UserInfo::GetAccountType
  Pop $0
  ${If} $0 != "admin"
    MessageBox MB_YESNO|MB_ICONQUESTION "Administrative privileges are recommended for installation. Continue anyway?" IDYES proceed
    Abort
    proceed:
  ${EndIf}
  
  ; Check for running instances
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ${PRODUCT_NAME}.exe"'
  Pop $0
  Pop $1
  ${If} $1 != ""
    ${If} $1 != "INFO: No tasks are running which match the specified criteria."
      MessageBox MB_YESNO|MB_ICONQUESTION "${PRODUCT_NAME} is currently running. Close it and continue?" IDYES kill_process
      Abort
      kill_process:
      nsExec::ExecToLog 'taskkill /F /IM "${PRODUCT_NAME}.exe" /T'
      Sleep 2000
    ${EndIf}
  ${EndIf}
  
  ; Set installation directory based on architecture
  ${If} ${RunningX64}
    StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}"
  ${Else}
    StrCpy $INSTDIR "$PROGRAMFILES\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}"
  ${EndIf}
FunctionEnd

; Initialize uninstallation
Function un.onInit
  ; Confirm uninstallation
  MessageBox MB_YESNO|MB_ICONQUESTION "Are you sure you want to uninstall ${PRODUCT_NAME}?" IDYES proceed
  Abort
  proceed:
  
  ; Check for admin rights
  UserInfo::GetAccountType
  Pop $0
  ${If} $0 != "admin"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Administrative privileges are required for uninstallation!"
    Abort
  ${EndIf}
FunctionEnd

; Post-uninstallation cleanup
Function un.onUninstSuccess
  MessageBox MB_OK|MB_ICONINFORMATION "${PRODUCT_NAME} has been successfully uninstalled."
  
  ; Clean up any remaining registry entries
  DeleteRegKey HKLM "Software\Classes\Applications\${PRODUCT_NAME}.exe"
  DeleteRegKey HKCU "Software\Classes\Applications\${PRODUCT_NAME}.exe"
FunctionEnd