# Performance Test Report

**Date**: 2025-08-11T22:09:18.745Z
**Platform**: darwin (arm64)
**Node Version**: v20.19.2
**CPUs**: 14

## Summary

- **Total Duration**: 8.57s
- **Average Test Duration**: 571.4666666666667ms
- **Memory Usage**: 29.62 MB / 32.89 MB

## Slowest Tests

| Test | Duration | Suite |
|------|----------|-------|
| DeploymentEngine resumeDeployment should throw error if deployment not found | 25ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine Constructor and Initialization should initialize with correct dependencies | 4ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine startDeployment should start a new deployment with valid config | 2ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine startDeployment should initialize deployers before starting deployment | 2ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine startDeployment should emit progress events during deployment | 2ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine Service Account Propagation Handling should handle IAM propagation delays correctly | 2ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine Constructor and Initialization should initialize deployers when OAuth client is available | 1ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine Constructor and Initialization should handle missing OAuth client gracefully | 1ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine startDeployment should reset pause state when starting new deployment | 1ms | /tests/unit/services/deploymentEngine.test.ts |
| DeploymentEngine resumeDeployment should resume an existing deployment | 1ms | /tests/unit/services/deploymentEngine.test.ts |

