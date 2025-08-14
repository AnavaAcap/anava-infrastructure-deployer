/**
 * Vision Architect System Test Suite
 * Tests various user inputs and evaluates AI response quality
 */

import { VisionArchitect } from '../main/services/vision/visionArchitect';
// import { logger } from '../main/utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

// Test scenarios representing different user intents and complexity levels
const TEST_SCENARIOS = [
  // Basic Security Scenarios
  {
    category: 'Basic Security',
    input: 'Detect people entering the building',
    expectedFeatures: ['entrance monitoring', 'human detection', 'directional counting']
  },
  {
    category: 'Basic Security',
    input: 'Alert when someone is in the parking lot after hours',
    expectedFeatures: ['time-based alerts', 'human detection', 'area monitoring']
  },
  
  // Retail Analytics
  {
    category: 'Retail',
    input: 'Count how many customers enter my store and track busy times',
    expectedFeatures: ['customer counting', 'traffic analytics', 'time patterns']
  },
  {
    category: 'Retail',
    input: 'Know when people are waiting in line too long',
    expectedFeatures: ['queue detection', 'wait time analysis', 'threshold alerts']
  },
  
  // Safety & Compliance
  {
    category: 'Safety',
    input: 'Make sure workers are wearing hard hats in the construction zone',
    expectedFeatures: ['PPE detection', 'safety compliance', 'zone monitoring']
  },
  {
    category: 'Safety',
    input: 'Detect if someone falls down and needs help',
    expectedFeatures: ['fall detection', 'emergency response', 'immediate alerts']
  },
  
  // Vehicle Management
  {
    category: 'Vehicles',
    input: 'Monitor delivery trucks at the loading dock',
    expectedFeatures: ['vehicle detection', 'dock monitoring', 'dwell time']
  },
  {
    category: 'Vehicles',
    input: 'Alert when cars park in no-parking zones',
    expectedFeatures: ['parking violation', 'zone enforcement', 'vehicle detection']
  },
  
  // Complex Behavioral Scenarios
  {
    category: 'Complex',
    input: 'Detect suspicious behavior like someone checking door handles in the parking lot',
    expectedFeatures: ['loitering detection', 'pattern analysis', 'suspicious activity']
  },
  {
    category: 'Complex',
    input: 'Monitor crowd density and alert if too many people gather',
    expectedFeatures: ['crowd detection', 'density analysis', 'occupancy limits']
  },
  
  // Ambiguous Requests
  {
    category: 'Ambiguous',
    input: 'I want to know what\'s happening',
    expectedFeatures: ['general monitoring', 'activity detection', 'event logging']
  },
  {
    category: 'Ambiguous',
    input: 'Keep my property safe',
    expectedFeatures: ['perimeter protection', 'intrusion detection', 'security monitoring']
  },
  
  // Edge Cases
  {
    category: 'Edge Case',
    input: 'Watch for kids playing near the pool when no adults are around',
    expectedFeatures: ['child detection', 'adult supervision', 'safety zones']
  },
  {
    category: 'Edge Case',
    input: 'Tell me when the garbage truck arrives',
    expectedFeatures: ['specific vehicle detection', 'scheduled events', 'arrival notification']
  }
];

interface TestResult {
  scenario: typeof TEST_SCENARIOS[0];
  response: any;
  evaluation: {
    aoaScenarioCount: number;
    skillCount: number;
    securityProfileCount: number;
    hasSystemOverview: boolean;
    hasJustification: boolean;
    relevanceScore: number; // 0-100
    completenessScore: number; // 0-100
    practicalityScore: number; // 0-100
    overallScore: number; // 0-100
    issues: string[];
    strengths: string[];
  };
  generationTime: number;
}

class VisionArchitectTester {
  private architect: VisionArchitect;
  private results: TestResult[] = [];
  // private geminiApiKey: string;

  constructor(geminiApiKey: string) {
    // this.geminiApiKey = geminiApiKey;
    this.architect = new VisionArchitect(geminiApiKey);
  }

  /**
   * Run all test scenarios
   */
  async runAllTests(): Promise<void> {
    console.log('\n🚀 Starting Vision Architect Test Suite\n');
    console.log('=' .repeat(80));

    for (const scenario of TEST_SCENARIOS) {
      await this.testScenario(scenario);
      // Small delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await this.generateReport();
  }

  /**
   * Test a single scenario
   */
  async testScenario(scenario: typeof TEST_SCENARIOS[0]): Promise<void> {
    console.log(`\n📋 Testing: "${scenario.input}"`);
    console.log(`   Category: ${scenario.category}`);
    
    const startTime = Date.now();
    
    try {
      // Generate vision system
      const response = await this.architect.generateVisionSystem({
        userGoal: scenario.input,
        imageDescription: 'General purpose camera with full field of view',
        domain: scenario.category.toLowerCase().replace(' ', '_')
      });

      const generationTime = Date.now() - startTime;
      
      // Evaluate the response
      const evaluation = this.evaluateResponse(response, scenario);
      
      // Store result
      const result: TestResult = {
        scenario,
        response,
        evaluation,
        generationTime
      };
      
      this.results.push(result);
      
      // Print summary
      this.printScenarioSummary(result);
      
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      
      this.results.push({
        scenario,
        response: null,
        evaluation: {
          aoaScenarioCount: 0,
          skillCount: 0,
          securityProfileCount: 0,
          hasSystemOverview: false,
          hasJustification: false,
          relevanceScore: 0,
          completenessScore: 0,
          practicalityScore: 0,
          overallScore: 0,
          issues: [`Generation failed: ${error.message}`],
          strengths: []
        },
        generationTime: Date.now() - startTime
      });
    }
  }

  /**
   * Evaluate the quality of an AI response
   */
  private evaluateResponse(response: any, scenario: typeof TEST_SCENARIOS[0]): TestResult['evaluation'] {
    const evaluation: TestResult['evaluation'] = {
      aoaScenarioCount: 0,
      skillCount: 0,
      securityProfileCount: 0,
      hasSystemOverview: false,
      hasJustification: false,
      relevanceScore: 0,
      completenessScore: 0,
      practicalityScore: 0,
      overallScore: 0,
      issues: [],
      strengths: []
    };

    if (!response || !response.generatedSystem) {
      evaluation.issues.push('No system generated');
      return evaluation;
    }

    const system = response.generatedSystem;

    // Count components
    evaluation.aoaScenarioCount = system.axisScenarios?.length || 0;
    evaluation.skillCount = system.skills?.length || 0;
    evaluation.securityProfileCount = system.securityProfiles?.length || 0;
    evaluation.hasSystemOverview = !!system.systemOverview;
    evaluation.hasJustification = !!system.systemJustification;

    // Evaluate relevance
    evaluation.relevanceScore = this.calculateRelevanceScore(system, scenario);

    // Evaluate completeness
    evaluation.completenessScore = this.calculateCompletenessScore(system);

    // Evaluate practicality
    evaluation.practicalityScore = this.calculatePracticalityScore(system);

    // Calculate overall score
    evaluation.overallScore = Math.round(
      (evaluation.relevanceScore + evaluation.completenessScore + evaluation.practicalityScore) / 3
    );

    // Identify strengths and issues
    this.identifyStrengthsAndIssues(system, scenario, evaluation);

    return evaluation;
  }

  /**
   * Calculate how relevant the response is to the user's request
   */
  private calculateRelevanceScore(system: any, scenario: typeof TEST_SCENARIOS[0]): number {
    let score = 0;
    let maxScore = 0;

    // Check if expected features are addressed
    for (const feature of scenario.expectedFeatures) {
      maxScore += 100;
      
      // Check in system overview
      if (system.systemOverview?.toLowerCase().includes(feature.toLowerCase())) {
        score += 30;
      }
      
      // Check in AOA scenarios
      const aoaHasFeature = system.axisScenarios?.some((s: any) => 
        s.name?.toLowerCase().includes(feature.toLowerCase()) ||
        s.description?.toLowerCase().includes(feature.toLowerCase())
      );
      if (aoaHasFeature) score += 40;
      
      // Check in skills
      const skillHasFeature = system.skills?.some((s: any) => 
        s.name?.toLowerCase().includes(feature.toLowerCase()) ||
        s.aiPrompt?.toLowerCase().includes(feature.toLowerCase())
      );
      if (skillHasFeature) score += 30;
    }

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  /**
   * Calculate how complete the response is
   */
  private calculateCompletenessScore(system: any): number {
    let score = 0;
    
    // Has system overview (20%)
    if (system.systemOverview) score += 20;
    
    // Has AOA scenarios (25%)
    if (system.axisScenarios?.length > 0) {
      score += Math.min(25, system.axisScenarios.length * 8);
    }
    
    // Has skills (25%)
    if (system.skills?.length > 0) {
      score += Math.min(25, system.skills.length * 8);
    }
    
    // Has security profiles (15%)
    if (system.securityProfiles?.length > 0) {
      score += 15;
    }
    
    // Has justification (15%)
    if (system.systemJustification) score += 15;
    
    return Math.min(100, score);
  }

  /**
   * Calculate how practical/implementable the response is
   */
  private calculatePracticalityScore(system: any): number {
    let score = 100; // Start with perfect score and deduct for issues
    
    // Check AOA scenarios for practicality
    system.axisScenarios?.forEach((scenario: any) => {
      // Scenario name too long
      if (scenario.name?.length > 15) {
        score -= 5;
      }
      
      // Missing required fields
      if (!scenario.triggers || scenario.triggers.length === 0) {
        score -= 10;
      }
      
      // Invalid coordinates
      if (scenario.triggers?.some((t: any) => 
        t.vertices?.some((v: any) => 
          Math.abs(v[0]) > 1 || Math.abs(v[1]) > 1
        )
      )) {
        score -= 10;
      }
    });
    
    // Check skills for practicality
    system.skills?.forEach((skill: any) => {
      // Overly complex prompts
      if (skill.aiPrompt?.length > 500) {
        score -= 5;
      }
      
      // Missing trigger scenario
      if (!skill.triggerScenario) {
        score -= 10;
      }
    });
    
    return Math.max(0, score);
  }

  /**
   * Identify strengths and issues in the response
   */
  private identifyStrengthsAndIssues(
    system: any, 
    scenario: typeof TEST_SCENARIOS[0], 
    evaluation: TestResult['evaluation']
  ): void {
    // Strengths
    if (evaluation.aoaScenarioCount > 0) {
      evaluation.strengths.push(`Created ${evaluation.aoaScenarioCount} AOA scenario(s)`);
    }
    
    if (evaluation.skillCount > 0) {
      evaluation.strengths.push(`Defined ${evaluation.skillCount} AI skill(s)`);
    }
    
    if (evaluation.relevanceScore > 80) {
      evaluation.strengths.push('Highly relevant to user request');
    }
    
    if (system.systemJustification) {
      evaluation.strengths.push('Includes clear justification');
    }
    
    // Issues
    if (evaluation.aoaScenarioCount === 0) {
      evaluation.issues.push('No chipset-level detection scenarios');
    }
    
    if (evaluation.skillCount === 0 && scenario.category === 'Complex') {
      evaluation.issues.push('Complex scenario but no AI skills defined');
    }
    
    if (evaluation.relevanceScore < 50) {
      evaluation.issues.push('Low relevance to user request');
    }
    
    // Check for overly long scenario names
    const longNames = system.axisScenarios?.filter((s: any) => s.name?.length > 15);
    if (longNames?.length > 0) {
      evaluation.issues.push(`${longNames.length} scenario name(s) too long (>15 chars)`);
    }
    
    // Check for missing time filters in loitering scenarios
    const loiteringScenarios = system.axisScenarios?.filter((s: any) => 
      s.name?.toLowerCase().includes('loiter') || 
      s.description?.toLowerCase().includes('loiter')
    );
    
    loiteringScenarios?.forEach((s: any) => {
      if (!s.filters?.timeInArea) {
        evaluation.issues.push(`Loitering scenario "${s.name}" missing time filter`);
      }
    });
  }

  /**
   * Print summary for a single scenario test
   */
  private printScenarioSummary(result: TestResult): void {
    const evalResult = result.evaluation;
    
    console.log(`   ⏱️  Generation time: ${result.generationTime}ms`);
    console.log(`   📊 Components: ${evalResult.aoaScenarioCount} AOA | ${evalResult.skillCount} Skills | ${evalResult.securityProfileCount} Profiles`);
    console.log(`   📈 Scores: Relevance ${evalResult.relevanceScore}% | Complete ${evalResult.completenessScore}% | Practical ${evalResult.practicalityScore}%`);
    console.log(`   ⭐ Overall Score: ${evalResult.overallScore}%`);
    
    if (evalResult.strengths.length > 0) {
      console.log(`   ✅ Strengths: ${evalResult.strengths[0]}`);
    }
    
    if (evalResult.issues.length > 0) {
      console.log(`   ⚠️  Issues: ${evalResult.issues[0]}`);
    }
  }

  /**
   * Generate comprehensive test report
   */
  async generateReport(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 VISION ARCHITECT TEST REPORT\n');
    
    // Calculate aggregate statistics
    const stats = this.calculateStatistics();
    
    // Overall Performance
    console.log('📈 OVERALL PERFORMANCE');
    console.log(`   Average Score: ${stats.averageScore}%`);
    console.log(`   Success Rate: ${stats.successRate}%`);
    console.log(`   Average Generation Time: ${stats.avgGenerationTime}ms`);
    
    // By Category
    console.log('\n📊 PERFORMANCE BY CATEGORY');
    for (const [category, catStats] of Object.entries(stats.byCategory)) {
      const categoryStats = catStats as any;
      console.log(`   ${category}: ${categoryStats.averageScore}% (${categoryStats.count} tests)`);
    }
    
    // Component Usage
    console.log('\n🔧 COMPONENT USAGE');
    console.log(`   Average AOA Scenarios: ${stats.avgAOAScenarios}`);
    console.log(`   Average Skills: ${stats.avgSkills}`);
    console.log(`   Average Security Profiles: ${stats.avgProfiles}`);
    
    // Top Issues
    console.log('\n⚠️  TOP ISSUES');
    const issueFrequency = this.getIssueFrequency();
    Object.entries(issueFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([issue, count]) => {
        console.log(`   - ${issue} (${count} occurrences)`);
      });
    
    // Best and Worst Performers
    const sorted = [...this.results].sort((a, b) => 
      b.evaluation.overallScore - a.evaluation.overallScore
    );
    
    console.log('\n🏆 BEST PERFORMING SCENARIOS');
    sorted.slice(0, 3).forEach(result => {
      console.log(`   ${result.evaluation.overallScore}% - "${result.scenario.input}"`);
    });
    
    console.log('\n📉 NEEDS IMPROVEMENT');
    sorted.slice(-3).reverse().forEach(result => {
      console.log(`   ${result.evaluation.overallScore}% - "${result.scenario.input}"`);
    });
    
    // Save detailed report
    await this.saveDetailedReport(stats);
  }

  /**
   * Calculate aggregate statistics
   */
  private calculateStatistics(): any {
    const stats: any = {
      totalTests: this.results.length,
      successRate: 0,
      averageScore: 0,
      avgGenerationTime: 0,
      avgAOAScenarios: 0,
      avgSkills: 0,
      avgProfiles: 0,
      byCategory: {}
    };

    let successCount = 0;
    let totalScore = 0;
    let totalTime = 0;
    let totalAOA = 0;
    let totalSkills = 0;
    let totalProfiles = 0;

    // Group by category
    const categoryGroups: Record<string, TestResult[]> = {};
    
    for (const result of this.results) {
      // Overall stats
      if (result.response) successCount++;
      totalScore += result.evaluation.overallScore;
      totalTime += result.generationTime;
      totalAOA += result.evaluation.aoaScenarioCount;
      totalSkills += result.evaluation.skillCount;
      totalProfiles += result.evaluation.securityProfileCount;
      
      // Category stats
      const category = result.scenario.category;
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(result);
    }

    // Calculate averages
    stats.successRate = Math.round((successCount / this.results.length) * 100);
    stats.averageScore = Math.round(totalScore / this.results.length);
    stats.avgGenerationTime = Math.round(totalTime / this.results.length);
    stats.avgAOAScenarios = (totalAOA / this.results.length).toFixed(1);
    stats.avgSkills = (totalSkills / this.results.length).toFixed(1);
    stats.avgProfiles = (totalProfiles / this.results.length).toFixed(1);

    // Calculate category stats
    for (const [category, results] of Object.entries(categoryGroups)) {
      const categoryScore = results.reduce((sum, r) => sum + r.evaluation.overallScore, 0);
      stats.byCategory[category] = {
        count: results.length,
        averageScore: Math.round(categoryScore / results.length)
      };
    }

    return stats;
  }

  /**
   * Get frequency of issues across all tests
   */
  private getIssueFrequency(): Record<string, number> {
    const frequency: Record<string, number> = {};
    
    for (const result of this.results) {
      for (const issue of result.evaluation.issues) {
        // Normalize similar issues
        const normalized = issue
          .replace(/\d+/g, 'N')  // Replace numbers with N
          .replace(/"[^"]+"/g, '"X"');  // Replace quoted strings with "X"
        
        frequency[normalized] = (frequency[normalized] || 0) + 1;
      }
    }
    
    return frequency;
  }

  /**
   * Save detailed report to file
   */
  private async saveDetailedReport(stats: any): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(
      '/Users/ryanwager/anava-infrastructure-deployer',
      'test-reports',
      `vision-architect-report-${timestamp}.json`
    );

    const detailedReport = {
      timestamp: new Date().toISOString(),
      statistics: stats,
      scenarios: this.results.map(r => ({
        input: r.scenario.input,
        category: r.scenario.category,
        evaluation: r.evaluation,
        generationTime: r.generationTime,
        response: r.response ? {
          systemOverview: r.response.generatedSystem?.systemOverview,
          aoaScenarioCount: r.response.generatedSystem?.axisScenarios?.length || 0,
          skillCount: r.response.generatedSystem?.skills?.length || 0,
          // Include first AOA scenario as example
          exampleAOAScenario: r.response.generatedSystem?.axisScenarios?.[0],
          // Include first skill as example
          exampleSkill: r.response.generatedSystem?.skills?.[0]
        } : null
      }))
    };

    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    
    // Save report
    await fs.writeFile(reportPath, JSON.stringify(detailedReport, null, 2));
    
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  }
}

/**
 * Collaborate with Gemini to analyze and improve the system
 */
async function collaborateWithGemini(apiKey: string, results: TestResult[]): Promise<string> {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const analysisPrompt = `
You are an AI systems architect reviewing the Vision Architect system's performance.

The Vision Architect is designed to convert natural language requests into comprehensive vision intelligence systems that include:
1. AOA Scenarios - Chipset-level object detection (motion, counting, zones)
2. Skills - AI-powered analysis triggered by AOA events
3. Security Profiles - Orchestration and continuous monitoring

Here are the test results from various user inputs:

${results.map(r => `
Input: "${r.scenario.input}"
Category: ${r.scenario.category}
Scores: Relevance ${r.evaluation.relevanceScore}%, Completeness ${r.evaluation.completenessScore}%, Practicality ${r.evaluation.practicalityScore}%
Issues: ${r.evaluation.issues.join(', ') || 'None'}
Strengths: ${r.evaluation.strengths.join(', ') || 'None'}
`).join('\n---\n')}

Please analyze these results and provide:

1. **Overall Assessment**: How well is the Vision Architect performing its intended function?

2. **Pattern Analysis**: What patterns do you see in successful vs unsuccessful generations?

3. **System Prompt Improvements**: Specific suggestions to improve the Vision Architect's system prompt to:
   - Better understand ambiguous requests
   - Generate more practical AOA configurations
   - Create more relevant AI skills
   - Avoid common issues like long scenario names

4. **Feature Recommendations**: What new capabilities or improvements would make the system more valuable?

5. **Priority Fixes**: Top 3 most important improvements to make immediately

Please be specific and actionable in your recommendations.
`;

  const result = await model.generateContent(analysisPrompt);
  return result.response.text();
}

/**
 * Main test execution
 */
async function main() {
  // Check for API key
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  
  if (!geminiApiKey) {
    console.error('❌ GEMINI_API_KEY environment variable not set');
    console.log('Set it with: export GEMINI_API_KEY="your-api-key"');
    process.exit(1);
  }

  try {
    // Run tests
    const tester = new VisionArchitectTester(geminiApiKey);
    await tester.runAllTests();
    
    // Collaborate with Gemini for analysis
    console.log('\n🤖 Collaborating with Gemini for system analysis...\n');
    const analysis = await collaborateWithGemini(geminiApiKey, tester['results']);
    
    console.log('='.repeat(80));
    console.log('\n📝 GEMINI ANALYSIS & RECOMMENDATIONS\n');
    console.log(analysis);
    
    // Save analysis
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const analysisPath = path.join(
      '/Users/ryanwager/anava-infrastructure-deployer',
      'test-reports',
      `vision-architect-analysis-${timestamp}.md`
    );
    
    await fs.mkdir(path.dirname(analysisPath), { recursive: true });
    await fs.writeFile(analysisPath, `# Vision Architect Analysis\n\n${analysis}`);
    
    console.log(`\n💾 Analysis saved to: ${analysisPath}`);
    
  } catch (error: any) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { VisionArchitectTester, TEST_SCENARIOS };