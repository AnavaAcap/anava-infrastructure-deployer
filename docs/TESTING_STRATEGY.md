# Testing Strategy and Maintenance Guide

## Overview

This document outlines the comprehensive testing strategy for the Anava Infrastructure Deployer, an enterprise-class Electron application that deploys cloud infrastructure and configures Axis cameras. Our testing approach emphasizes security, regression prevention, and performance optimization.

## Testing Architecture

### Test Pyramid

```
         /\
        /E2E\        <- End-to-end tests (5%)
       /------\
      /Integra-\     <- Integration tests (20%)
     /  tion    \
    /------------\
   / Security &  \   <- Security & Performance (25%)
  /  Performance  \
 /----------------\
/   Unit Tests     \ <- Unit tests (50%)
--------------------
```

### Test Categories

#### 1. Unit Tests (`tests/unit/`)
- **Purpose**: Test individual functions and classes in isolation
- **Coverage Target**: 80% line coverage, 85% for critical services
- **Key Areas**:
  - DeploymentEngine orchestration logic
  - Camera configuration services
  - Authentication and authorization
  - Error handling and recovery
- **Run**: `npm run test:unit`

#### 2. Integration Tests (`tests/integration/`)
- **Purpose**: Test component interactions and external service integrations
- **Coverage Target**: Critical user paths and API integrations
- **Key Areas**:
  - Cloud deployment workflows
  - Service account propagation
  - API Gateway configuration
  - Firestore operations
- **Run**: `npm run test:integration`

#### 3. Security Tests (`tests/security/`)
- **Purpose**: Identify vulnerabilities and ensure compliance
- **Key Areas**:
  - Dependency vulnerability scanning
  - SAST (Static Application Security Testing)
  - OWASP Top 10 compliance
  - Secret detection
  - Input validation
- **Run**: `npm run test:security`

#### 4. Regression Tests (`tests/regression/`)
- **Purpose**: Prevent reintroduction of fixed bugs
- **Based On**: Issues documented in CLAUDE.md
- **Key Issues Covered**:
  - Cloud Functions v2 compute service account permissions
  - IAM eventual consistency handling
  - API Gateway OpenAPI spec replacement
  - License activation ThreadPool errors
  - Firestore permission issues (v0.9.169)
- **Run**: `npm run test:regression`

#### 5. Performance Tests (`tests/performance/`)
- **Purpose**: Ensure operations meet performance requirements
- **Benchmarks**:
  - Camera discovery: < 5s for 100 IPs
  - Configuration push: < 150ms for 5 cameras (parallel)
  - License activation: < 500ms per license
  - Memory usage: < 500MB for deployment cycle
- **Run**: `npm run test:performance`

#### 6. E2E Tests (`tests/e2e/`)
- **Purpose**: Validate complete user workflows
- **Scenarios**:
  - Complete GCP infrastructure deployment
  - Camera discovery and configuration
  - License activation flow
- **Run**: `npm run test:e2e`

## CI/CD Integration

### GitHub Actions Workflows

#### Primary Test Workflow (`.github/workflows/test.yml`)
Triggered on:
- Push to master/main/develop
- Pull requests
- Daily security scans (2 AM UTC)

**Jobs**:
1. **Unit Tests**: Runs on matrix of OS (Ubuntu, macOS, Windows) and Node versions (18, 20)
2. **Integration Tests**: Runs after unit tests pass
3. **Security Scan**: npm audit + Snyk + custom security tests
4. **SAST Scan**: CodeQL + Semgrep analysis
5. **Regression Tests**: Ensures known issues stay fixed
6. **Performance Tests**: Benchmarks on master branch only
7. **E2E Tests**: Full workflow validation (master/main only)

### Test Execution

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:security      # Security scanning
npm run test:regression    # Regression tests
npm run test:performance   # Performance benchmarks
npm run test:e2e           # End-to-end tests

# Development helpers
npm run test:watch         # Watch mode for TDD
npm run test:coverage      # Generate coverage report
npm run test:ci            # CI-optimized test run

# Security commands
npm run security:audit     # Run npm audit
npm run security:scan      # Full security scan
```

## Critical Areas Requiring Testing

### 1. Cloud Functions v2 Deployment
**Issue**: Compute service account permissions
**Tests Required**:
- Verify compute SA gets `roles/artifactregistry.admin`
- Verify gcf-artifacts repository access
- Test function deployment with proper permissions

### 2. IAM Propagation
**Issue**: 2-20 second global propagation delay
**Tests Required**:
- Service account creation with polling verification
- Exponential backoff implementation
- Global propagation delay handling

### 3. API Gateway Configuration
**Issue**: OpenAPI spec placeholder replacement
**Tests Required**:
- Global regex replacement verification
- JWT audience field replacement
- Service account configuration

### 4. License Activation
**Issue**: ThreadPool errors and retry logic
**Tests Required**:
- Retry on ThreadPool errors
- Initial delay after ACAP deployment
- Axis SDK integration

### 5. Firestore Permissions
**Issue**: 403 errors on write operations
**Tests Required**:
- Service account roles/datastore.owner assignment
- Token refresh for new permissions

## Performance Benchmarks

### Key Metrics

| Operation | Target | Threshold | Action |
|-----------|--------|-----------|--------|
| Network Scan (100 IPs) | < 3s | 5s | Optimize parallelization |
| Camera Auth | < 50ms/camera | 100ms | Check connection pooling |
| Config Push (5 cameras) | < 100ms | 150ms | Ensure parallel execution |
| License Activation | < 300ms | 500ms | Cache SDK resources |
| Deployment (full) | < 5min | 10min | Optimize critical path |
| Memory Usage | < 300MB | 500MB | Check for leaks |

### Performance Monitoring

The custom performance reporter (`tests/reporters/performance-reporter.js`) tracks:
- Test execution times
- Memory usage patterns
- CPU utilization
- Performance regressions

Reports are generated in:
- JSON format: `test-results/performance.json`
- Markdown format: `test-results/performance.md`

## Security Testing Strategy

### Automated Scans

1. **Dependency Scanning**
   - npm audit (daily)
   - Snyk vulnerability scanning
   - License compliance checks

2. **Static Analysis (SAST)**
   - CodeQL for security vulnerabilities
   - Semgrep for pattern matching
   - Custom rules for sensitive data

3. **Security Patterns**
   - No hardcoded secrets
   - Input validation
   - Secure protocols (HTTPS)
   - Proper error handling

### OWASP Top 10 Coverage

- [x] Injection attacks (SQL, Command)
- [x] Broken authentication
- [x] Sensitive data exposure
- [x] XML external entities (XXE)
- [x] Broken access control
- [x] Security misconfiguration
- [x] Cross-site scripting (XSS)
- [x] Insecure deserialization
- [x] Using components with vulnerabilities
- [x] Insufficient logging & monitoring

## Test Data Management

### Test Fixtures
Located in `tests/fixtures/`:
- Mock GCP credentials
- Sample camera configurations
- Test license keys
- Mock API responses

### Environment Variables
Test environment configured via `.env.test`:
```bash
NODE_ENV=test
TEST_PROJECT_ID=test-project
TEST_REGION=us-central1
```

## Maintenance Guidelines

### Adding New Tests

1. **Identify Test Category**
   - Unit: Isolated function/class testing
   - Integration: Multi-component interaction
   - Security: Vulnerability or compliance
   - Regression: Specific bug fix
   - Performance: Speed/resource usage

2. **Follow Naming Conventions**
   - Unit: `[component].test.ts`
   - Integration: `[workflow].test.ts`
   - Security: `[vulnerability].test.ts`
   - Regression: `issue-[number].test.ts`

3. **Update Coverage Thresholds**
   - Critical services: 90% coverage
   - UI components: 70% coverage
   - Utilities: 80% coverage

### Handling Test Failures

1. **Immediate Actions**
   - Check CI logs for details
   - Verify environment setup
   - Check for flaky test patterns

2. **Security Test Failures**
   - Critical/High vulnerabilities: Block merge
   - Medium vulnerabilities: Create issue
   - Low vulnerabilities: Track in backlog

3. **Performance Regressions**
   - > 10% degradation: Investigate immediately
   - > 20% degradation: Block release
   - Create benchmark comparison

### Test Review Checklist

- [ ] Tests cover happy path and error cases
- [ ] Mocks are properly cleaned up
- [ ] No hardcoded values or credentials
- [ ] Async operations properly handled
- [ ] Test names clearly describe behavior
- [ ] Performance impact considered
- [ ] Security implications reviewed

## Debugging Test Issues

### Common Problems and Solutions

1. **Timeout Errors**
   - Increase timeout: `jest.setTimeout(30000)`
   - Check for missing async/await
   - Verify mock implementations

2. **Memory Leaks**
   - Use `--detectLeaks` flag
   - Check for event listener cleanup
   - Verify mock restoration

3. **Flaky Tests**
   - Add retry logic for network operations
   - Use deterministic test data
   - Mock time-dependent operations

4. **Coverage Gaps**
   - Run `npm run test:coverage`
   - Check coverage/lcov-report/index.html
   - Focus on untested branches

## Release Testing Protocol

### Pre-Release Checklist

1. **Automated Tests**
   - [ ] All unit tests passing
   - [ ] Integration tests passing
   - [ ] No critical security vulnerabilities
   - [ ] Performance benchmarks met
   - [ ] Regression tests passing

2. **Manual Testing**
   - [ ] Fresh installation on all platforms
   - [ ] Upgrade from previous version
   - [ ] Camera discovery and configuration
   - [ ] License activation
   - [ ] Complete deployment cycle

3. **Security Review**
   - [ ] Dependency audit clean
   - [ ] SAST scan results reviewed
   - [ ] Secrets scanning passed
   - [ ] Permissions properly scoped

### Post-Release Monitoring

- Monitor error rates in production
- Track performance metrics
- Review customer-reported issues
- Update regression tests for any bugs found

## Continuous Improvement

### Monthly Reviews
- Analyze test failure patterns
- Update flaky test list
- Review coverage metrics
- Update performance baselines

### Quarterly Updates
- Reassess testing strategy
- Update security patterns
- Review and update dependencies
- Performance benchmark calibration

### Annual Assessment
- Complete testing strategy review
- Tool and framework evaluation
- Team training needs assessment
- Testing ROI analysis

## Contact and Support

For questions about testing:
- Review this guide first
- Check existing test examples
- Consult CLAUDE.md for known issues
- Create an issue with `testing` label

## Appendix: Testing Commands Quick Reference

```bash
# Development
npm test                    # Run all tests
npm run test:watch         # TDD mode
npm run test:coverage      # Coverage report

# CI/CD
npm run test:ci            # Optimized for CI
npm run test:unit -- --ci  # Unit tests in CI mode

# Specific suites
npm run test:security      # Security tests
npm run test:regression    # Regression suite
npm run test:performance   # Performance benchmarks

# Debugging
npm test -- --verbose      # Verbose output
npm test -- --detectLeaks  # Memory leak detection
npm test -- --runInBand    # Serial execution

# Coverage
npm run test:coverage -- --watchAll  # Coverage in watch mode
open coverage/lcov-report/index.html # View HTML report
```