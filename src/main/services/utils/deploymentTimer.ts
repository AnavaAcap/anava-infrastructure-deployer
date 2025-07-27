export class DeploymentTimer {
  private stepTimings: Map<string, { startTime: number; endTime?: number; success?: boolean }> = new Map();
  private overallStartTime: number;

  constructor() {
    this.overallStartTime = Date.now();
  }

  startStep(stepName: string): void {
    this.stepTimings.set(stepName, { startTime: Date.now() });
  }

  endStep(stepName: string, success: boolean = true): void {
    const timing = this.stepTimings.get(stepName);
    if (timing) {
      timing.endTime = Date.now();
      timing.success = success;
    }
  }

  getStepDuration(stepName: string): number | null {
    const timing = this.stepTimings.get(stepName);
    if (!timing || !timing.endTime) return null;
    return timing.endTime - timing.startTime;
  }

  getOverallDuration(): number {
    return Date.now() - this.overallStartTime;
  }

  getSummary(): string {
    const lines: string[] = ['Deployment Timing Summary:'];
    lines.push(`Total duration: ${this.formatDuration(this.getOverallDuration())}`);
    lines.push('');
    lines.push('Step timings:');
    
    for (const [stepName, timing] of this.stepTimings) {
      const duration = timing.endTime ? timing.endTime - timing.startTime : null;
      const status = timing.success === false ? ' ❌' : (timing.endTime ? ' ✅' : ' ⏳');
      
      if (duration !== null) {
        lines.push(`  ${stepName}${status}: ${this.formatDuration(duration)}`);
      } else {
        lines.push(`  ${stepName}${status}: In progress...`);
      }
    }
    
    return lines.join('\n');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}