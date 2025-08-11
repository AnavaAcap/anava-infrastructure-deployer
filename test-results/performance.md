# Performance Test Report

**Date**: 2025-08-11T21:07:48.981Z
**Platform**: darwin (arm64)
**Node Version**: v20.19.2
**CPUs**: 14

## Summary

- **Total Duration**: 5.14s
- **Average Test Duration**: 270.36842105263156ms
- **Memory Usage**: 1.72 GB / 1.77 GB

## Slowest Tests

| Test | Duration | Suite |
|------|----------|-------|
| Camera Setup Workflow Integration Tests 1. Complete Camera Setup Flow should complete full setup flow from credentials to completion | 1ms | /src/__tests__/integration-tests.spec.ts |
| Camera Setup Workflow Integration Tests 2. Camera Detection and Configuration should push configuration to camera via VAPIX | 1ms | /src/__tests__/integration-tests.spec.ts |
| Camera Setup Workflow Integration Tests 3. Speaker Configuration should mark step 4 as completed after speaker configuration | 1ms | /src/__tests__/integration-tests.spec.ts |
| Camera Setup Workflow Integration Tests 4. License Activation should not use hardcoded MAC address | 1ms | /src/__tests__/integration-tests.spec.ts |
| Camera Setup Workflow Integration Tests 7. State Management and Persistence should clean up state on "Start Fresh Setup" | 1ms | /src/__tests__/integration-tests.spec.ts |
| Camera Setup Workflow Integration Tests 1. Complete Camera Setup Flow should persist state between page refreshes | 0ms | /src/__tests__/integration-tests.spec.ts |
| Camera Setup Workflow Integration Tests 1. Complete Camera Setup Flow should handle network scan with multiple network interfaces | 0ms | /src/__tests__/integration-tests.spec.ts |
| Camera Setup Workflow Integration Tests 2. Camera Detection and Configuration should properly detect Axis cameras using POST method | 0ms | /src/__tests__/integration-tests.spec.ts |
| Camera Setup Workflow Integration Tests 3. Speaker Configuration should identify speakers by audio endpoint | 0ms | /src/__tests__/integration-tests.spec.ts |
| Camera Setup Workflow Integration Tests 3. Speaker Configuration should store discovered speakers for later configuration | 0ms | /src/__tests__/integration-tests.spec.ts |

