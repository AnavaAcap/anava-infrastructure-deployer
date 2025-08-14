#!/usr/bin/env node

/**
 * Standalone Vision Architect Test Runner
 * Tests the AI's ability to generate vision systems from natural language
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');

// Test scenarios
const TEST_SCENARIOS = [
  // Basic Security 
  {
    category: 'Security',
    input: 'Detect people entering the building',
    expectedFeatures: ['entrance', 'human detection', 'counting']
  },
  {
    category: 'Security',
    input: 'Alert when someone is in the parking lot after hours',
    expectedFeatures: ['time-based', 'human detection', 'area monitoring']
  },
  
  // Retail
  {
    category: 'Retail',
    input: 'Count customers entering my store and track busy times',
    expectedFeatures: ['counting', 'traffic analytics', 'patterns']
  },
  {
    category: 'Retail',
    input: 'Know when people are waiting in line too long',
    expectedFeatures: ['queue', 'wait time', 'threshold']
  },
  
  // Safety
  {
    category: 'Safety',
    input: 'Make sure workers wear hard hats in construction zone',
    expectedFeatures: ['PPE detection', 'compliance', 'zone']
  },
  {
    category: 'Safety', 
    input: 'Detect if someone falls down',
    expectedFeatures: ['fall detection', 'emergency', 'alert']
  },
  
  // Vehicles
  {
    category: 'Vehicles',
    input: 'Monitor delivery trucks at loading dock',
    expectedFeatures: ['vehicle', 'dock', 'dwell time']
  },
  {
    category: 'Vehicles',
    input: 'Alert when cars park in no-parking zones',
    expectedFeatures: ['parking violation', 'zone', 'vehicle']
  },
  
  // Complex
  {
    category: 'Complex',
    input: 'Detect suspicious behavior like checking door handles',
    expectedFeatures: ['loitering', 'pattern', 'suspicious']
  },
  {
    category: 'Complex',
    input: 'Monitor crowd density and alert if too many people',
    expectedFeatures: ['crowd', 'density', 'occupancy']
  }
];

// Vision Architect System Prompt (simplified version)
const SYSTEM_PROMPT = `You are the Anava Vision Architect, an AI system that converts natural language requests into comprehensive vision intelligence systems.

You must generate a JSON response with this exact structure:
{
  "systemOverview": "Brief description of the complete vision system",
  "axisScenarios": [
    {
      "name": "Short Name",
      "description": "What this scenario detects",
      "type": "motion|fence|crosslinecount|occupancy",
      "triggers": {
        "type": "includeArea|fence|countingLine",
        "vertices": [[-0.9,-0.9],[-0.9,0.9],[0.9,0.9],[0.9,-0.9]]
      },
      "objectClassifications": [
        {"type": "human", "selected": true},
        {"type": "vehicle", "selected": false}
      ],
      "filters": {
        "timeInArea": 3,
        "minimumSize": {"width": 10, "height": 10}
      }
    }
  ],
  "skills": [
    {
      "name": "Skill Name",
      "triggerScenario": "Name of AOA scenario that triggers this",
      "aiPrompt": "What the AI should analyze",
      "outputFormat": "alert|report|dashboard",
      "schedule": "realtime|batch|periodic"
    }
  ],
  "securityProfiles": [
    {
      "name": "Profile Name",
      "description": "Security orchestration logic",
      "monitoringType": "continuous|scheduled|triggered",
      "escalationPath": ["step1", "step2"]
    }
  ],
  "systemJustification": "Why this configuration addresses the user's needs"
}

IMPORTANT RULES:
1. Scenario names must be 15 characters or less
2. Coordinates must be between -1 and 1
3. TimeInArea is in seconds
4. Every skill must reference a valid AOA scenario
5. Generate practical, implementable configurations`;

async function testVisionArchitect(apiKey) {
  console.log('🚀 Vision Architect Test Suite\n');
  console.log('='.repeat(60));
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const results = [];
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📋 Testing: "${scenario.input}"`);
    console.log(`   Category: ${scenario.category}`);
    
    const startTime = Date.now();
    
    try {
      // Generate vision system
      const prompt = `${SYSTEM_PROMPT}

User Request: "${scenario.input}"
Camera Context: General purpose security camera with full field of view
Domain: ${scenario.category}

Generate a complete vision intelligence system for this request. Return ONLY valid JSON.`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Clean response - remove markdown if present
      const jsonStr = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const system = JSON.parse(jsonStr);
      const generationTime = Date.now() - startTime;
      
      // Evaluate response
      const evaluation = evaluateResponse(system, scenario);
      
      results.push({
        scenario,
        system,
        evaluation,
        generationTime
      });
      
      // Print summary
      console.log(`   ⏱️  Time: ${generationTime}ms`);
      console.log(`   📊 Components: ${system.axisScenarios?.length || 0} AOA | ${system.skills?.length || 0} Skills`);
      console.log(`   📈 Score: ${evaluation.score}%`);
      
      if (evaluation.issues.length > 0) {
        console.log(`   ⚠️  Issues: ${evaluation.issues[0]}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        scenario,
        system: null,
        evaluation: { score: 0, issues: [error.message] },
        generationTime: Date.now() - startTime
      });
    }
    
    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate report
  generateReport(results);
  
  // Save results
  await saveResults(results);
}

function evaluateResponse(system, scenario) {
  const evaluation = {
    score: 0,
    issues: [],
    strengths: []
  };
  
  // Check structure (25%)
  if (system.systemOverview) evaluation.score += 10;
  if (system.axisScenarios?.length > 0) evaluation.score += 10;
  if (system.systemJustification) evaluation.score += 5;
  
  // Check relevance (25%)
  const systemText = JSON.stringify(system).toLowerCase();
  let relevantFeatures = 0;
  for (const feature of scenario.expectedFeatures) {
    if (systemText.includes(feature.toLowerCase())) {
      relevantFeatures++;
    }
  }
  evaluation.score += Math.round((relevantFeatures / scenario.expectedFeatures.length) * 25);
  
  // Check practicality (25%)
  let practicalScore = 25;
  
  // Check scenario names length
  system.axisScenarios?.forEach(s => {
    if (s.name?.length > 15) {
      evaluation.issues.push(`Scenario name too long: "${s.name}"`);
      practicalScore -= 5;
    }
  });
  
  // Check coordinates
  system.axisScenarios?.forEach(s => {
    if (s.triggers?.vertices) {
      const invalidCoords = s.triggers.vertices.some(v => 
        Math.abs(v[0]) > 1 || Math.abs(v[1]) > 1
      );
      if (invalidCoords) {
        evaluation.issues.push('Invalid coordinates (must be -1 to 1)');
        practicalScore -= 5;
      }
    }
  });
  
  evaluation.score += Math.max(0, practicalScore);
  
  // Check completeness (25%)
  if (system.skills?.length > 0) {
    evaluation.score += 15;
    evaluation.strengths.push('Includes AI skills');
  }
  if (system.securityProfiles?.length > 0) {
    evaluation.score += 10;
    evaluation.strengths.push('Includes security profiles');
  }
  
  return evaluation;
}

function generateReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST REPORT\n');
  
  // Calculate statistics
  const totalScore = results.reduce((sum, r) => sum + (r.evaluation?.score || 0), 0);
  const avgScore = Math.round(totalScore / results.length);
  const successCount = results.filter(r => r.system !== null).length;
  const successRate = Math.round((successCount / results.length) * 100);
  
  console.log('📈 OVERALL PERFORMANCE');
  console.log(`   Average Score: ${avgScore}%`);
  console.log(`   Success Rate: ${successRate}%`);
  console.log(`   Tests Passed: ${successCount}/${results.length}`);
  
  // By category
  console.log('\n📊 BY CATEGORY');
  const categories = {};
  results.forEach(r => {
    if (!categories[r.scenario.category]) {
      categories[r.scenario.category] = { total: 0, count: 0 };
    }
    categories[r.scenario.category].total += r.evaluation?.score || 0;
    categories[r.scenario.category].count++;
  });
  
  for (const [cat, stats] of Object.entries(categories)) {
    const avg = Math.round(stats.total / stats.count);
    console.log(`   ${cat}: ${avg}%`);
  }
  
  // Best and worst
  const sorted = [...results].sort((a, b) => 
    (b.evaluation?.score || 0) - (a.evaluation?.score || 0)
  );
  
  console.log('\n🏆 BEST RESULTS');
  sorted.slice(0, 3).forEach(r => {
    console.log(`   ${r.evaluation?.score}% - "${r.scenario.input}"`);
  });
  
  console.log('\n📉 NEEDS IMPROVEMENT');
  sorted.slice(-3).reverse().forEach(r => {
    console.log(`   ${r.evaluation?.score || 0}% - "${r.scenario.input}"`);
  });
}

async function saveResults(results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(__dirname, 'test-reports');
  const reportPath = path.join(reportDir, `vision-architect-${timestamp}.json`);
  
  await fs.mkdir(reportDir, { recursive: true });
  
  const report = {
    timestamp: new Date().toISOString(),
    results: results.map(r => ({
      input: r.scenario.input,
      category: r.scenario.category,
      score: r.evaluation?.score || 0,
      issues: r.evaluation?.issues || [],
      generationTime: r.generationTime,
      aoaScenarios: r.system?.axisScenarios?.length || 0,
      skills: r.system?.skills?.length || 0
    }))
  };
  
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved to: ${reportPath}`);
}

// Main execution
const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyD4TlgvKlDUZRn5nIuS6O-uMKKHEqu8qCQ';

if (!apiKey || apiKey === 'your-api-key') {
  console.error('❌ Please set GEMINI_API_KEY environment variable');
  process.exit(1);
}

testVisionArchitect(apiKey).catch(console.error);