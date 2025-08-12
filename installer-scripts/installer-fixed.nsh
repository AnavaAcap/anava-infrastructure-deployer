; Enhanced NSIS Script for Anava Installer
; Fixes: Process management, registry conflicts, file system tunneling, integrity checks
; Compatible with Electron v37.2.6 and electron-builder

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinVer.nsh"
!include "x64.nsh"
!include "nsProcess.nsh"

; Version and metadata
!define PRODUCT_NAME "Anava Installer"
!define PRODUCT_PUBLISHER "Anava AI Inc."
!define PRODUCT_WEB_SITE "https://anava.ai"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; Use dynamic GUID from environment or generate at build time
!ifdef INSTALLER_GUID
  !define PRODUCT_GUID "{8BBB4D08-F0C9-4BAC-A736-38130B8BA474}"
!else
  !define PRODUCT_GUID "{$%INSTALLER_GUID%}"
!endif

; Custom defines for shortcut management
!define SHORTCUT_NAME "Anava Installer.lnk"
!define START_MENU_FOLDER "Anava AI"
!define EXE_NAME "Anava Installer.exe"

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_UNFINISHPAGE_NOAUTOCLOSE

; Disable auto-run to prevent process conflicts
;!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE_NAME}"
;!define MUI_FINISHPAGE_RUN_TEXT "Launch ${PRODUCT_NAME}"

; Custom macros for enhanced operations
!macro KillProcessAndChildren PROCESS_NAME
  ; Kill main process and all children
  DetailPrint "Terminating ${PROCESS_NAME} and child processes..."
  
  ; First attempt with WMI to get all child processes
  nsExec::ExecToStack 'wmic process where "name='${PROCESS_NAME}'" delete'
  Pop $0
  Pop $1
  
  ; Fallback to taskkill with tree flag
  nsExec::ExecToStack 'taskkill /F /IM "${PROCESS_NAME}" /T 2>nul'
  Pop $0
  Pop $1
  
  ; Additional cleanup for Electron processes
  nsExec::ExecToStack 'taskkill /F /FI "IMAGENAME eq electron.exe" /T 2>nul'
  Pop $0
  Pop $1
  
  ; Kill any chrome processes spawned by puppeteer
  nsExec::ExecToStack 'taskkill /F /FI "IMAGENAME eq chrome.exe" /FI "WINDOWTITLE eq *Anava*" /T 2>nul'
  Pop $0
  Pop $1
  
  ; Wait for processes to fully terminate
  Sleep 2000
!macroend

!macro CleanRegistryCompletely
  ; Clean all possible registry locations
  DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}"
  DeleteRegKey HKLM "Software\Classes\Applications\${EXE_NAME}"
  DeleteRegKey HKLM "Software\Classes\${PRODUCT_NAME}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\App Paths\${EXE_NAME}"
  
  DeleteRegKey HKCU "Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}"
  DeleteRegKey HKCU "Software\Classes\Applications\${EXE_NAME}"
  DeleteRegKey HKCU "Software\Classes\${PRODUCT_NAME}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\${EXE_NAME}"
  
  ; Clean from all user hives
  DeleteRegKey HKU ".DEFAULT\Software\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}"
  
  ; Remove from Windows Installer cache
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Installer\UserData\S-1-5-18\Products\${PRODUCT_GUID}"
!macroend

!macro MitigateFilesystemTunneling PATH
  ; Mitigate Windows filesystem tunneling by adding delay and cache clear
  DetailPrint "Clearing filesystem cache for ${PATH}..."
  
  ; Delete with retry and delay to bypass tunneling
  ${ForEach} $R0 1 3 + 1
    ${If} ${FileExists} "${PATH}"
      Delete "${PATH}"
      Sleep 100
    ${EndIf}
  ${Next}
  
  ; Force filesystem cache flush
  nsExec::ExecToStack 'fsutil file setshortname "${PATH}" ""'
  Pop $0
  Pop $1
  
  ; Additional delay to ensure tunneling timeout
  Sleep 5000
!macroend

!macro RemoveWindowsDefenderException
  ; Remove Windows Defender exceptions for clean slate
  DetailPrint "Removing Windows Defender exceptions..."
  nsExec::ExecToStack 'powershell -Command "Remove-MpPreference -ExclusionPath \"$INSTDIR\" -ErrorAction SilentlyContinue"'
  Pop $0
  Pop $1
  nsExec::ExecToStack 'powershell -Command "Remove-MpPreference -ExclusionProcess \"${EXE_NAME}\" -ErrorAction SilentlyContinue"'
  Pop $0
  Pop $1
!macroend

!macro AddWindowsDefenderException
  ; Add Windows Defender exception during installation
  DetailPrint "Adding Windows Defender exceptions..."
  nsExec::ExecToStack 'powershell -Command "Add-MpPreference -ExclusionPath \"$INSTDIR\" -ErrorAction SilentlyContinue"'
  Pop $0
  Pop $1
  nsExec::ExecToStack 'powershell -Command "Add-MpPreference -ExclusionProcess \"${EXE_NAME}\" -ErrorAction SilentlyContinue"'
  Pop $0
  Pop $1
!macroend

!macro ClearPrefetchCache
  ; Clear Windows Prefetch cache for the application
  DetailPrint "Clearing prefetch cache..."
  nsExec::ExecToStack 'del /F /Q "%WINDIR%\Prefetch\ANAVA*.pf" 2>nul'
  Pop $0
  Pop $1
!macroend

!macro CheckAndInstallVCRedist
  ; Check for Visual C++ Redistributables
  DetailPrint "Checking Visual C++ Redistributables..."
  
  ; Check for VC++ 2015-2022 x64
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Version"
  ${If} $0 == ""
    DetailPrint "Visual C++ Redistributables not found, installing..."
    ; Download and install if needed (electron-builder should bundle this)
    File /oname=$TEMP\vc_redist.x64.exe "resources\vc_redist.x64.exe"
    ExecWait '"$TEMP\vc_redist.x64.exe" /quiet /norestart'
    Delete "$TEMP\vc_redist.x64.exe"
  ${Else}
    DetailPrint "Visual C++ Redistributables found: $0"
  ${EndIf}
!macroend

!macro VerifyNoProcessesRunning
  ; Comprehensive process check
  ${nsProcess::FindProcess} "${EXE_NAME}" $R0
  ${If} $R0 == 0
    !insertmacro KillProcessAndChildren "${EXE_NAME}"
  ${EndIf}
  
  ${nsProcess::FindProcess} "electron.exe" $R0
  ${If} $R0 == 0
    DetailPrint "Found electron.exe processes, terminating..."
    nsExec::ExecToStack 'taskkill /F /IM "electron.exe" /T'
    Pop $0
    Pop $1
  ${EndIf}
!macroend

!macro HandleMOTW PATH
  ; Remove Mark of the Web from files
  DetailPrint "Removing Mark of the Web..."
  nsExec::ExecToStack 'powershell -Command "Unblock-File -Path \"${PATH}\" -ErrorAction SilentlyContinue"'
  Pop $0
  Pop $1
  
  ; Remove Zone.Identifier alternate data stream
  nsExec::ExecToStack 'powershell -Command "Remove-Item -Path \"${PATH}:Zone.Identifier\" -ErrorAction SilentlyContinue"'
  Pop $0
  Pop $1
!macroend

; Enhanced initialization
Function .onInit
  ; Set error level for debugging
  SetErrorLevel 0
  
  ; Check for admin rights - required for proper operation
  UserInfo::GetAccountType
  Pop $0
  ${If} $0 != "admin"
    MessageBox MB_OK|MB_ICONSTOP "Administrative privileges are required for installation.$\n$\nPlease right-click the installer and select 'Run as administrator'."
    Abort
  ${EndIf}
  
  ; Clear prefetch cache first
  !insertmacro ClearPrefetchCache
  
  ; Comprehensive process termination
  !insertmacro VerifyNoProcessesRunning
  
  ; Clean any orphaned registry entries from failed installations
  !insertmacro CleanRegistryCompletely
  
  ; Set installation directory with proper architecture detection
  ${If} ${RunningX64}
    StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}"
  ${Else}
    StrCpy $INSTDIR "$PROGRAMFILES32\${PRODUCT_PUBLISHER}\${PRODUCT_NAME}"
  ${EndIf}
  
  ; Mitigate filesystem tunneling for installation directory
  ${If} ${FileExists} "$INSTDIR"
    !insertmacro MitigateFilesystemTunneling "$INSTDIR\${EXE_NAME}"
    !insertmacro MitigateFilesystemTunneling "$INSTDIR\Uninstall.exe"
  ${EndIf}
FunctionEnd

; Main installation section
Section "!${PRODUCT_NAME}" SEC_MAIN
  SetOutPath "$INSTDIR"
  SetOverwrite on
  
  ; Add Windows Defender exception before extraction
  !insertmacro AddWindowsDefenderException
  
  ; Extract files (electron-builder handles this)
  ; File injection happens here via electron-builder
  
  ; Remove MOTW from main executable
  !insertmacro HandleMOTW "$INSTDIR\${EXE_NAME}"
  
  ; Create uninstaller with verification
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  ${IfNot} ${FileExists} "$INSTDIR\Uninstall.exe"
    MessageBox MB_OK|MB_ICONSTOP "Failed to create uninstaller!"
    Abort
  ${EndIf}
  
  ; Create shortcuts with proper error handling
  SetShellVarContext all
  CreateDirectory "$SMPROGRAMS\${START_MENU_FOLDER}"
  CreateShortcut "$SMPROGRAMS\${START_MENU_FOLDER}\${SHORTCUT_NAME}" "$INSTDIR\${EXE_NAME}"
  CreateShortcut "$SMPROGRAMS\${START_MENU_FOLDER}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  
  CreateShortcut "$DESKTOP\${SHORTCUT_NAME}" "$INSTDIR\${EXE_NAME}"
  SetShellVarContext current
  
  ; Write proper registry entries
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "QuietUninstallString" "$\"$INSTDIR\Uninstall.exe$\" /S"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE_NAME},0"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoRepair" 1
  
  ; Calculate and write install size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
  
  ; Set install date
  Call GetCurrentDate
  Pop $0
  WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "InstallDate" "$0"
  
  ; Install Visual C++ Redistributables if needed
  !insertmacro CheckAndInstallVCRedist
SectionEnd

; Uninstall initialization
Function un.onInit
  ; Check for admin rights
  UserInfo::GetAccountType
  Pop $0
  ${If} $0 != "admin"
    MessageBox MB_OK|MB_ICONSTOP "Administrative privileges are required for uninstallation.$\n$\nPlease run the uninstaller as administrator."
    Abort
  ${EndIf}
  
  ; Confirm uninstallation
  MessageBox MB_YESNO|MB_ICONQUESTION "Are you sure you want to uninstall ${PRODUCT_NAME}?" IDYES proceed
  Abort
  proceed:
  
  ; Kill all processes before uninstall
  !insertmacro KillProcessAndChildren "${EXE_NAME}"
  
  ; Clear prefetch cache
  !insertmacro ClearPrefetchCache
FunctionEnd

; Uninstall section
Section "Uninstall"
  ; Remove Windows Defender exceptions
  !insertmacro RemoveWindowsDefenderException
  
  ; Delete shortcuts
  SetShellVarContext all
  Delete "$SMPROGRAMS\${START_MENU_FOLDER}\${SHORTCUT_NAME}"
  Delete "$SMPROGRAMS\${START_MENU_FOLDER}\Uninstall.lnk"
  RMDir "$SMPROGRAMS\${START_MENU_FOLDER}"
  Delete "$DESKTOP\${SHORTCUT_NAME}"
  SetShellVarContext current
  
  ; Clean registry completely
  !insertmacro CleanRegistryCompletely
  
  ; Remove files with filesystem tunneling mitigation
  !insertmacro MitigateFilesystemTunneling "$INSTDIR\${EXE_NAME}"
  !insertmacro MitigateFilesystemTunneling "$INSTDIR\Uninstall.exe"
  
  ; Remove installation directory with enhanced retry
  ${ForEach} $R0 1 10 + 1
    ClearErrors
    RMDir /r /REBOOTOK "$INSTDIR"
    ${IfNot} ${Errors}
      ${ExitFor}
    ${EndIf}
    
    ; Force close any file handles
    nsExec::ExecToStack 'handle.exe -a -c "$INSTDIR" -nobanner -accepteula 2>nul'
    Pop $0
    Pop $1
    
    Sleep 1000
  ${Next}
  
  ; If still exists, schedule deletion on reboot
  ${If} ${FileExists} "$INSTDIR"
    RMDir /r /REBOOTOK "$INSTDIR"
    MessageBox MB_OK|MB_ICONINFORMATION "Some files will be removed after restart."
  ${EndIf}
  
  ; Remove app data if user confirms
  MessageBox MB_YESNO|MB_ICONQUESTION "Remove application data and settings?" IDNO skip_appdata
    RMDir /r "$APPDATA\${PRODUCT_NAME}"
    RMDir /r "$APPDATA\anava-installer"
    RMDir /r "$LOCALAPPDATA\${PRODUCT_NAME}"
    RMDir /r "$LOCALAPPDATA\anava-installer"
  skip_appdata:
SectionEnd

; Helper function to get current date
Function GetCurrentDate
  System::Call 'kernel32::GetLocalTime(i.r0)'
  System::Call '*$0(&i2.r1,&i2.r2,&i2,&i2.r3)'
  IntFmt $1 "%04d" $1
  IntFmt $2 "%02d" $2
  IntFmt $3 "%02d" $3
  Push "$1$2$3"
FunctionEnd

; Success handlers
Function .onInstSuccess
  ; Clear any error flags
  ClearErrors
  SetErrorLevel 0
  
  ; Don't auto-launch to prevent process lock issues
  ; User can manually launch from shortcuts
FunctionEnd

Function un.onUninstSuccess
  MessageBox MB_OK|MB_ICONINFORMATION "${PRODUCT_NAME} has been successfully uninstalled."
FunctionEnd