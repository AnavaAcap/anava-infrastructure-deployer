#!/usr/bin/env node

/**
 * Simulate the crowd detection scenario without needing the full build
 * Shows what the AI would generate and how it would be sent to ACAP
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Your scenario
const SCENARIO_DESCRIPTION = "3 or more people standing in front of the door for more than 5 seconds";
const SCENARIO_CONTEXT = "entrance door monitoring";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function simulateScenarioGeneration() {
  console.log('=== Simulating Crowd Detection Scenario Generation ===\n');
  console.log('📝 Your Request:');
  console.log(`   "${SCENARIO_DESCRIPTION}"`);
  console.log(`   Context: ${SCENARIO_CONTEXT}\n`);

  if (!GEMINI_API_KEY) {
    console.log('⚠️  No GEMINI_API_KEY found, showing expected output:\n');
    showExpectedOutput();
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
    You are configuring an Axis Object Analytics (AOA) system.
    
    Convert this request into an AOA scenario configuration:
    "${SCENARIO_DESCRIPTION}"
    Context: ${SCENARIO_CONTEXT}
    
    AOA supports:
    - Object types: humans, vehicles
    - Scenario types: motion, fence, crosslinecount, occupancy
    - Filters: timeInArea (seconds), minimumSize, maximumSize
    - For occupancy: occupancyThreshold (number of objects)
    
    For this request, you should use:
    - Type: occupancy (monitoring how many people are in an area)
    - Objects: humans only
    - Threshold: 3 people
    - TimeInArea: 5 seconds
    
    Respond with just the JSON configuration.
    `;

    console.log('🤖 Asking Gemini AI to generate configuration...\n');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ AI Generated Configuration:');
    console.log(text);
    
    // Try to parse and display nicely
    try {
      const config = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
      console.log('\n📊 Parsed Configuration:');
      console.log('   Name:', config.name || 'Crowd at Door');
      console.log('   Type:', config.type);
      console.log('   Detects:', config.objectTypes?.humans ? 'Humans' : 'Unknown');
      console.log('   Occupancy Threshold:', config.occupancyThreshold || 3, 'people');
      console.log('   Time in Area:', config.filters?.timeInArea || 5, 'seconds');
    } catch (e) {
      // Parsing failed, that's okay
    }

  } catch (error) {
    console.error('Error with Gemini:', error.message);
    showExpectedOutput();
  }

  console.log('\n📡 What would be sent to ACAP:');
  console.log('-----------------------------------');
  console.log('POST /local/BatonAnalytic/baton_analytic.cgi?command=generateFromDescription');
  console.log('Content-Type: application/json');
  console.log('Authorization: Digest ...\n');
  console.log(JSON.stringify({
    trigger: "Crowd at Door",  // The AOA scenario name
    description: SCENARIO_DESCRIPTION  // Your original request
  }, null, 2));

  console.log('\n🎯 Expected Behavior:');
  console.log('-----------------------------------');
  console.log('1. AOA creates an "occupancy" type scenario');
  console.log('2. Monitors the door area for human presence');
  console.log('3. Triggers when 3+ people detected');
  console.log('4. Only triggers if they stay for 5+ seconds');
  console.log('5. ACAP receives trigger and can:');
  console.log('   - Send an alert');
  console.log('   - Start recording');
  console.log('   - Play an audio message');
  console.log('   - Send notification to security');
}

function showExpectedOutput() {
  console.log('📋 Expected AOA Configuration:');
  console.log('-----------------------------------');
  const expectedConfig = {
    name: "Crowd at Door",
    type: "occupancy",
    area: [
      [-0.5, 0.3],  // Door area coordinates
      [-0.5, 0.9],
      [0.5, 0.9],
      [0.5, 0.3]
    ],
    objectTypes: {
      humans: true,
      vehicles: false
    },
    filters: {
      timeInArea: 5  // 5 seconds
    },
    occupancyThreshold: 3,  // 3 or more people
    explanation: "Occupancy scenario to detect 3+ people lingering at door for 5+ seconds",
    confidence: 0.95
  };
  
  console.log(JSON.stringify(expectedConfig, null, 2));
}

// Run simulation
simulateScenarioGeneration();