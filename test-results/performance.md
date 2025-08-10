# Performance Test Report

**Date**: 2025-08-10T03:17:37.153Z
**Platform**: darwin (arm64)
**Node Version**: v20.19.2
**CPUs**: 14

## Summary

- **Total Duration**: 41.25s
- **Average Test Duration**: 841.7551020408164ms
- **Memory Usage**: 30.19 MB / 31.89 MB

## Slowest Tests

| Test | Duration | Suite |
|------|----------|-------|
| Performance and Memory Tests - Electron v37 Memory Management should not leak memory when creating/destroying windows | 1.01s | /tests/electron-v37/performance-memory.test.ts |
| Performance and Memory Tests - Electron v37 Resource Usage should maintain reasonable CPU usage | 1.01s | /tests/electron-v37/performance-memory.test.ts |
| Critical Workflow Integration Tests - Electron v37 Error Handling and Recovery should handle network failures gracefully | 1.01s | /tests/electron-v37/critical-workflows.test.ts |
| Critical Workflow Integration Tests - Electron v37 GCP Deployment should create GCP project and enable APIs | 393ms | /tests/electron-v37/critical-workflows.test.ts |
| Performance and Memory Tests - Electron v37 Caching and Optimization should debounce frequent operations | 312ms | /tests/electron-v37/performance-memory.test.ts |
| Critical Workflow Integration Tests - Electron v37 GCP Deployment should deploy Cloud Functions successfully | 274ms | /tests/electron-v37/critical-workflows.test.ts |
| Performance and Memory Tests - Electron v37 Caching and Optimization should batch database operations | 102ms | /tests/electron-v37/performance-memory.test.ts |
| Performance and Memory Tests - Electron v37 Performance Benchmarks should handle camera discovery efficiently | 100ms | /tests/electron-v37/performance-memory.test.ts |
| Critical Workflow Integration Tests - Electron v37 GCP Deployment should create API Gateway with proper configuration | 67ms | /tests/electron-v37/critical-workflows.test.ts |
| Critical Workflow Integration Tests - Electron v37 Camera Discovery and Configuration should configure camera with VAPIX | 49ms | /tests/electron-v37/critical-workflows.test.ts |

## ⚠️ Performance Regressions

The following tests exceeded their performance thresholds:

| Test | Duration | Threshold | Excess |
|------|----------|-----------|--------|
| Performance and Memory Tests - Electron v37 Memory Management should not leak memory when creating/destroying windows | 1.01s | 100ms | +914ms |
| Performance and Memory Tests - Electron v37 Resource Usage should maintain reasonable CPU usage | 1.01s | 100ms | +909ms |
| Performance and Memory Tests - Electron v37 Caching and Optimization should debounce frequent operations | 312ms | 100ms | +212ms |
| Performance and Memory Tests - Electron v37 Caching and Optimization should batch database operations | 102ms | 100ms | +2ms |
| Critical Workflow Integration Tests - Electron v37 GCP Deployment should deploy Cloud Functions successfully | 274ms | 100ms | +174ms |
| Critical Workflow Integration Tests - Electron v37 Error Handling and Recovery should handle network failures gracefully | 1.01s | 100ms | +906ms |

