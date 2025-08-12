# Performance Test Report

**Date**: 2025-08-12T00:38:55.200Z
**Platform**: darwin (arm64)
**Node Version**: v20.19.2
**CPUs**: 14

## Summary

- **Total Duration**: 522ms
- **Average Test Duration**: 6.6923076923076925ms
- **Memory Usage**: 109.27 MB / 135.23 MB

## Slowest Tests

| Test | Duration | Suite |
|------|----------|-------|
| 7. Error Recovery and Timeouts should handle ETIMEDOUT errors | 7ms | /src/__tests__/regression-tests-fixed.spec.ts |
| Critical Regression Tests v0.9.178 MAC Address Flow should pass MAC through scanner results | 2ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 1. Camera Setup State Persistence should save state to localStorage on changes | 1ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 1. Camera Setup State Persistence should clear state when "Start Fresh Setup" is clicked | 1ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 4. Camera Detection with POST Requests should correctly identify .121 as a SPEAKER when auth fails | 1ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 UI Component Integration should mark auth-failed devices as not accessible | 1ms | /src/__tests__/regression-tests.spec.ts |
| Edge Cases and Error Handling should handle devices that require POST but fail to provide data | 1ms | /src/__tests__/regression-tests.spec.ts |
| 1. Camera Setup State Persistence should persist camera setup state to localStorage | 1ms | /src/__tests__/regression-tests-fixed.spec.ts |
| 2. Speaker Configuration Completion should mark Step 4 as completed when speaker config finishes | 1ms | /src/__tests__/regression-tests-fixed.spec.ts |
| 3. AI Vision Audio Playback Support should support legacy MP3 format audio | 1ms | /src/__tests__/regression-tests-fixed.spec.ts |

