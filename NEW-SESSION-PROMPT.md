# Prompt for New Session: Anava Infrastructure Deployer - Trial-First Redesign

## Context
You are working on the Anava Infrastructure Deployer project, which is an Electron-based installer for deploying Anava's AI-powered camera analytics system. The codebase already contains complex logic for GCP deployment, camera discovery, and ACAP management that was difficult to implement and must be preserved.

## Your Task
Implement a trial-first installer redesign based on the attached PRD (PRD-Trial-First-Installer.md). This is NOT a rewrite - you must modify the existing codebase to add new features while preserving all existing functionality.

## Key Requirements
1. **Preserve ALL existing code** for GCP deployment, camera discovery, and ACAP management
2. **Add automatic license key management** using Firestore and Cloud Functions
3. **Simplify the initial user flow** to get cameras working in under 10 minutes
4. **Implement audio talkdown** capabilities with MP3 playback
5. **Keep advanced features accessible** but not in the primary flow

## Implementation Priority
1. First, set up the Firebase backend for license key management
2. Remove the "magical" installer components while preserving their logic
3. Create the new simplified camera setup flow
4. Add audio playback and speaker configuration
5. Implement the detection testing feature

## Critical Files to Modify (NOT replace)
- `src/renderer/App.tsx` - Update routing only
- `src/renderer/components/NavigationSidebar.tsx` - Add new menu items
- `src/main/services/fastStartService.ts` - Remove magical UI logic but keep camera logic
- `src/main/services/cameraConfigurationService.ts` - Add speaker support

## New Files to Create
- `src/main/services/licenseKeyService.ts`
- `src/renderer/pages/CameraSetupPage.tsx`
- `src/renderer/pages/SpeakerConfigPage.tsx`
- `src/renderer/pages/DetectionTestPage.tsx`
- `src/renderer/components/AudioPlayer.tsx`
- `src/renderer/components/EULADialog.tsx`
- `firebase/functions/src/assignAxisKey.ts`

## Important Context from Original Developer
- The network scanning and camera discovery logic was extremely difficult to get working correctly - DO NOT modify these core algorithms
- The ACAP deployment process has many edge cases handled - preserve all error handling
- The GCP deployment flow must remain fully functional as the "advanced" path
- License keys are generated manually through Axis's system and provided as a bulk list

## Testing Requirements
- Ensure existing GCP deployment still works
- Test with cameras that have different credentials
- Verify audio playback works on both Windows and Mac
- Confirm license key assignment is atomic (no duplicates)

## Success Criteria
1. New user can go from download to working camera in < 10 minutes
2. No regression in existing features
3. Audio talkdown demonstrates value immediately
4. Clear upgrade path from trial (AI Studio) to production (Vertex AI)

## Reference the PRD
The complete Product Requirements Document is in `PRD-Trial-First-Installer.md`. Follow it closely but ask questions if anything is unclear. The PRD contains:
- Detailed UI/UX specifications
- Backend architecture for license management
- VAPIX commands for new features
- Error handling requirements
- Phased development approach

Remember: This is an enhancement to make the product more accessible to trial users while maintaining all enterprise capabilities. The existing complex logic for GCP deployment, camera discovery, and ACAP management represents months of work and must be preserved.