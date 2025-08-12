# Performance Test Report

**Date**: 2025-08-12T01:54:30.633Z
**Platform**: darwin (arm64)
**Node Version**: v20.19.2
**CPUs**: 14

## Summary

- **Total Duration**: 516ms
- **Average Test Duration**: 6.615384615384615ms
- **Memory Usage**: 108.81 MB / 134.98 MB

## Slowest Tests

| Test | Duration | Suite |
|------|----------|-------|
| 7. Error Recovery and Timeouts should handle ETIMEDOUT errors | 7ms | /src/__tests__/regression-tests-fixed.spec.ts |
| Windows Installer Configuration NSIS Script Validation should use dynamic GUID variable | 3ms | /src/__tests__/windows-installer-regression.spec.ts |
| Critical Regression Tests v0.9.178 1. Camera Setup State Persistence should handle corrupted localStorage data gracefully | 2ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 MAC Address Flow should pass MAC through scanner results | 2ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 1. Camera Setup State Persistence should save state to localStorage on changes | 1ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 1. Camera Setup State Persistence should restore state from localStorage on component mount | 1ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 2. Speaker Configuration Completion should save speaker configuration to localStorage | 1ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 3. AI Vision Audio Playback should construct valid WAV header for PCM data | 1ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 4. Camera Detection with POST Requests should correctly identify .121 as a SPEAKER when auth fails | 1ms | /src/__tests__/regression-tests.spec.ts |
| Critical Regression Tests v0.9.178 License Activation should pass MAC address to activateLicenseKey | 1ms | /src/__tests__/regression-tests.spec.ts |

