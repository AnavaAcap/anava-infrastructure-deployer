; Safe NSIS Configuration for Anava Installer
; Minimal customization to avoid antivirus false positives

!macro customInit
  ; Simple check for running instance without aggressive killing
  ${If} ${FileExists} "$INSTDIR\Anava Installer.exe"
    MessageBox MB_YESNO|MB_ICONQUESTION "A previous version of ${PRODUCT_NAME} was detected. Continue with upgrade?" IDYES +2
    Quit
  ${EndIf}
!macroend

!macro customInstall
  ; Let electron-builder handle the installation
  ; No custom process killing or system manipulation
!macroend

!macro customUnInstall  
  ; Clean uninstall without aggressive tactics
  ; Let electron-builder handle the standard uninstallation
!macroend

; No PowerShell commands
; No taskkill commands
; No registry manipulation beyond standard uninstall keys
; No Windows Defender exceptions
; No file system tunneling workarounds
; No forced overwrites