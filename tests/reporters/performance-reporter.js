/**
 * Custom Jest Reporter for Performance Metrics
 * Tracks test execution times and memory usage
 */

class PerformanceReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus().length,
        memory: require('os').totalmem()
      },
      testSuites: [],
      summary: {
        totalDuration: 0,
        avgTestDuration: 0,
        slowestTests: [],
        memoryUsage: {}
      }
    };
  }

  onTestResult(test, testResult) {
    const suite = {
      name: test.path.replace(process.cwd(), ''),
      duration: testResult.perfStats.end - testResult.perfStats.start,
      tests: []
    };

    testResult.testResults.forEach(result => {
      suite.tests.push({
        title: result.title,
        fullName: result.fullName,
        duration: result.duration || 0,
        status: result.status,
        memoryUsage: process.memoryUsage()
      });
    });

    this.results.testSuites.push(suite);
  }

  onRunComplete(contexts, results) {
    // Calculate summary statistics
    let totalDuration = 0;
    let allTests = [];

    this.results.testSuites.forEach(suite => {
      totalDuration += suite.duration;
      allTests = allTests.concat(suite.tests);
    });

    this.results.summary.totalDuration = totalDuration;
    this.results.summary.avgTestDuration = allTests.length > 0 
      ? totalDuration / allTests.length 
      : 0;

    // Find slowest tests
    this.results.summary.slowestTests = allTests
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(test => ({
        name: test.fullName,
        duration: test.duration,
        suite: this.results.testSuites.find(s => 
          s.tests.some(t => t.fullName === test.fullName)
        )?.name
      }));

    // Memory usage summary
    const memUsage = process.memoryUsage();
    this.results.summary.memoryUsage = {
      rss: this.formatBytes(memUsage.rss),
      heapTotal: this.formatBytes(memUsage.heapTotal),
      heapUsed: this.formatBytes(memUsage.heapUsed),
      external: this.formatBytes(memUsage.external)
    };

    // Identify performance regressions
    this.results.regressions = this.identifyRegressions();

    // Write results to file
    if (this._options.outputPath) {
      const fs = require('fs');
      const path = require('path');
      const outputPath = path.resolve(this._options.outputPath);
      
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
      
      // Also write a markdown report
      const mdPath = outputPath.replace('.json', '.md');
      fs.writeFileSync(mdPath, this.generateMarkdownReport());
    }

    // Console output for CI
    this.printSummary();
  }

  identifyRegressions() {
    const regressions = [];
    
    // Thresholds for different test types
    const thresholds = {
      unit: 100,        // 100ms for unit tests
      integration: 5000, // 5s for integration tests
      e2e: 30000        // 30s for e2e tests
    };

    this.results.testSuites.forEach(suite => {
      const testType = this.getTestType(suite.name);
      const threshold = thresholds[testType] || thresholds.unit;

      suite.tests.forEach(test => {
        if (test.duration > threshold && test.status === 'passed') {
          regressions.push({
            test: test.fullName,
            duration: test.duration,
            threshold: threshold,
            excess: test.duration - threshold,
            type: testType
          });
        }
      });
    });

    return regressions;
  }

  getTestType(suiteName) {
    if (suiteName.includes('/unit/')) return 'unit';
    if (suiteName.includes('/integration/')) return 'integration';
    if (suiteName.includes('/e2e/')) return 'e2e';
    return 'unit';
  }

  generateMarkdownReport() {
    let report = '# Performance Test Report\n\n';
    report += `**Date**: ${this.results.timestamp}\n`;
    report += `**Platform**: ${this.results.environment.platform} (${this.results.environment.arch})\n`;
    report += `**Node Version**: ${this.results.environment.node}\n`;
    report += `**CPUs**: ${this.results.environment.cpus}\n\n`;

    report += '## Summary\n\n';
    report += `- **Total Duration**: ${this.formatDuration(this.results.summary.totalDuration)}\n`;
    report += `- **Average Test Duration**: ${this.formatDuration(this.results.summary.avgTestDuration)}\n`;
    report += `- **Memory Usage**: ${this.results.summary.memoryUsage.heapUsed} / ${this.results.summary.memoryUsage.heapTotal}\n\n`;

    if (this.results.summary.slowestTests.length > 0) {
      report += '## Slowest Tests\n\n';
      report += '| Test | Duration | Suite |\n';
      report += '|------|----------|-------|\n';
      this.results.summary.slowestTests.forEach(test => {
        report += `| ${test.name} | ${this.formatDuration(test.duration)} | ${test.suite} |\n`;
      });
      report += '\n';
    }

    if (this.results.regressions && this.results.regressions.length > 0) {
      report += '## ⚠️ Performance Regressions\n\n';
      report += 'The following tests exceeded their performance thresholds:\n\n';
      report += '| Test | Duration | Threshold | Excess |\n';
      report += '|------|----------|-----------|--------|\n';
      this.results.regressions.forEach(reg => {
        report += `| ${reg.test} | ${this.formatDuration(reg.duration)} | ${this.formatDuration(reg.threshold)} | +${this.formatDuration(reg.excess)} |\n`;
      });
      report += '\n';
    }

    return report;
  }

  printSummary() {
    console.log('\n📊 Performance Summary');
    console.log('═══════════════════════════════════════════');
    console.log(`Total Duration: ${this.formatDuration(this.results.summary.totalDuration)}`);
    console.log(`Average Test: ${this.formatDuration(this.results.summary.avgTestDuration)}`);
    console.log(`Memory Used: ${this.results.summary.memoryUsage.heapUsed}`);
    
    if (this.results.regressions && this.results.regressions.length > 0) {
      console.log('\n⚠️  Performance Regressions Detected:');
      this.results.regressions.forEach(reg => {
        console.log(`  - ${reg.test}: ${this.formatDuration(reg.duration)} (threshold: ${this.formatDuration(reg.threshold)})`);
      });
    }
    
    console.log('\n🐌 Slowest Tests:');
    this.results.summary.slowestTests.slice(0, 5).forEach((test, i) => {
      console.log(`  ${i + 1}. ${test.name}: ${this.formatDuration(test.duration)}`);
    });
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }

  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

module.exports = PerformanceReporter;