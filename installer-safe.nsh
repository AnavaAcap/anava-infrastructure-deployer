; Safe NSIS configuration for Anava Installer
; Removes all potentially malicious patterns that trigger antivirus detection

!macro customHeader
  ; Basic branding only
  BrandingText "Anava Vision Installer"
!macroend

!macro customInstall
  ; Simple, safe installation
  ; No process killing, no registry manipulation, no system modifications
  
  ; Create application shortcuts safely
  CreateShortCut "$DESKTOP\Anava Vision.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  CreateShortCut "$SMPROGRAMS\Anava Vision.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!macroend

!macro customUnInstall
  ; Clean uninstall without aggressive tactics
  
  ; Remove shortcuts
  Delete "$DESKTOP\Anava Vision.lnk"
  Delete "$SMPROGRAMS\Anava Vision.lnk"
  
  ; Standard cleanup
  RMDir /r "$APPDATA\anava-installer"
  RMDir /r "$LOCALAPPDATA\anava-installer"
!macroend

; Use standard NSIS behavior for everything else
; No custom overrides, no forced operations