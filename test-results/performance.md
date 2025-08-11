# Performance Test Report

**Date**: 2025-08-11T22:49:17.188Z
**Platform**: darwin (arm64)
**Node Version**: v20.19.2
**CPUs**: 14

## Summary

- **Total Duration**: 20.12s
- **Average Test Duration**: 670.6666666666666ms
- **Memory Usage**: 30.28 MB / 34.39 MB

## Slowest Tests

| Test | Duration | Suite |
|------|----------|-------|
| CameraConfigurationService Scene Description API should get scene description successfully | 42ms | /tests/unit/services/camera/cameraConfigurationService.test.ts |
| DeploymentEngine resumeDeployment should throw error if deployment not found | 33ms | /tests/unit/services/deploymentEngine.test.ts |
| CameraConfigurationService Configuration Push should handle configuration push errors | 12ms | /tests/unit/services/camera/cameraConfigurationService.test.ts |
| DeploymentEngine startDeployment should emit progress events during deployment | 11ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine Event Emissions should emit correct events during deployment lifecycle | 11ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine Constructor and Initialization should initialize with correct dependencies | 6ms | /tests/unit/services/deploymentEngine.test.ts |
| CameraConfigurationService HTTPS Basic Authentication should handle auth failures | 5ms | /tests/unit/services/camera/cameraConfigurationService.test.ts |
| CameraConfigurationService Error Recovery should handle concurrent requests | 5ms | /tests/unit/services/camera/cameraConfigurationService.test.ts |
| DeploymentEngine Constructor and Initialization should initialize deployers when OAuth client is available | 4ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine startDeployment should start a new deployment with valid config | 4ms | /tests/unit/services/deploymentEngine.test.ts |

