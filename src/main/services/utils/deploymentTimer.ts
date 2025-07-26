export interface StepTiming {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
}

export class DeploymentTimer {
  private startTime: number;
  private endTime?: number;
  private stepTimings: Map<string, StepTiming> = new Map();
  
  constructor() {
    this.startTime = Date.now();
  }
  
  startStep(stepName: string): void {
    this.stepTimings.set(stepName, {
      name: stepName,
      startTime: Date.now(),
      status: 'running'
    });
  }
  
  endStep(stepName: string, success: boolean = true): void {
    const step = this.stepTimings.get(stepName);
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = success ? 'completed' : 'failed';
    }
  }
  
  endDeployment(): void {
    this.endTime = Date.now();
  }
  
  getTotalDuration(): number {
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }
  
  getStepDuration(stepName: string): number | undefined {
    return this.stepTimings.get(stepName)?.duration;
  }
  
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }
  
  getSummary(): string {
    const lines: string[] = [];
    lines.push('\n📊 Deployment Timing Summary');
    lines.push('===========================');
    
    // Step timings
    this.stepTimings.forEach((step) => {
      const duration = step.duration 
        ? this.formatDuration(step.duration)
        : 'In progress...';
      const status = step.status === 'completed' ? '✅' : 
                    step.status === 'failed' ? '❌' : '⏳';
      lines.push(`${status} ${step.name}: ${duration}`);
    });
    
    // Total time
    lines.push('---------------------------');
    lines.push(`⏱️  Total time: ${this.formatDuration(this.getTotalDuration())}`);
    
    // Performance comparison
    const totalMinutes = this.getTotalDuration() / 60000;
    if (totalMinutes < 15) {
      lines.push('🚀 Excellent performance! (Target: <15 min)');
    } else if (totalMinutes < 20) {
      lines.push('✨ Good performance (Target: <15 min)');
    } else {
      lines.push('⚠️  Performance needs optimization (Target: <15 min)');
    }
    
    return lines.join('\n');
  }
  
  getDetailedReport(): object {
    const steps = Array.from(this.stepTimings.values()).map(step => ({
      name: step.name,
      duration: step.duration ? this.formatDuration(step.duration) : 'N/A',
      durationMs: step.duration || 0,
      status: step.status
    }));
    
    return {
      totalDuration: this.formatDuration(this.getTotalDuration()),
      totalDurationMs: this.getTotalDuration(),
      startTime: new Date(this.startTime).toISOString(),
      endTime: this.endTime ? new Date(this.endTime).toISOString() : 'In progress',
      steps,
      performance: {
        targetMinutes: 15,
        actualMinutes: Math.round(this.getTotalDuration() / 60000 * 10) / 10,
        withinTarget: this.getTotalDuration() < 15 * 60000
      }
    };
  }
}