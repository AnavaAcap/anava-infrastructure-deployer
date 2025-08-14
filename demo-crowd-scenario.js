#!/usr/bin/env node

/**
 * Demo: Crowd Detection Scenario for AOA
 * "3 or more people standing in front of the door for more than 5 seconds"
 */

console.log('=============================================================');
console.log('     AOA Natural Language Scenario Generation Demo');
console.log('=============================================================\n');

console.log('📝 YOUR REQUEST:');
console.log('   "3 or more people standing in front of the door for more than 5 seconds"\n');

console.log('🤖 AI PROCESSING...');
console.log('   Analyzing: "3 or more people" → Occupancy detection with threshold\n');
console.log('   Analyzing: "standing" → Stationary behavior (not just passing by)\n');
console.log('   Analyzing: "for more than 5 seconds" → Time in area filter\n');
console.log('   Analyzing: "front of the door" → Specific zone monitoring\n');

console.log('✅ GENERATED AOA CONFIGURATION:');
console.log('--------------------------------');
const aoaConfig = {
  name: "Crowd at Door",
  type: "occupancy",           // Best for counting people in an area
  area: [                       // Door area (normalized coordinates)
    [-0.5, 0.3],
    [-0.5, 0.9],
    [0.5, 0.9],
    [0.5, 0.3]
  ],
  objectTypes: {
    humans: true,               // Detecting people
    vehicles: false
  },
  filters: {
    timeInArea: 5               // Must stay for 5+ seconds
  },
  occupancyThreshold: 3,        // Trigger when 3+ people
  enabled: true
};

console.log(JSON.stringify(aoaConfig, null, 2));

console.log('\n📡 ACAP INTEGRATION:');
console.log('--------------------');
console.log('After creating the AOA scenario, the system sends:');
console.log('\nPOST /local/BatonAnalytic/baton_analytic.cgi?command=generateFromDescription');
console.log('Content-Type: application/json\n');
const acapPayload = {
  trigger: "Crowd at Door",
  description: "3 or more people standing in front of the door for more than 5 seconds"
};
console.log(JSON.stringify(acapPayload, null, 2));

console.log('\n🎯 HOW IT WORKS:');
console.log('-----------------');
console.log('1. AOA monitors the door area using computer vision');
console.log('2. Counts the number of people in the defined zone');
console.log('3. Starts a timer when 3+ people are detected');
console.log('4. If they remain for 5+ seconds → TRIGGER!');
console.log('5. ACAP receives the trigger and can:');
console.log('   • Send security alert');
console.log('   • Start video recording');
console.log('   • Play audio warning: "Please maintain social distance"');
console.log('   • Log event to cloud');
console.log('   • Send mobile notification');

console.log('\n📊 SCENARIO DETAILS:');
console.log('--------------------');
console.log('Type:        Occupancy (best for counting people in areas)');
console.log('Objects:     Humans only');
console.log('Threshold:   3 people minimum');
console.log('Duration:    5 seconds minimum');
console.log('Area:        Front door zone (customizable)');
console.log('Status:      Enabled and running');

console.log('\n🔍 ALTERNATIVE INTERPRETATIONS:');
console.log('--------------------------------');
console.log('The AI considered but rejected:');
console.log('❌ Motion detection - Would trigger on any movement');
console.log('❌ Crossline counting - Only counts crossing, not lingering');
console.log('❌ Fence detection - For perimeter breaches, not crowds');
console.log('✅ Occupancy with threshold - Perfect for crowd detection!');

console.log('\n💡 SIMILAR SCENARIOS YOU COULD CREATE:');
console.log('---------------------------------------');
console.log('• "Someone loitering for 30 seconds" → Motion + timeInArea');
console.log('• "Cars parking illegally" → Vehicle detection + timeInArea');
console.log('• "People running" → Motion + shortLivedLimit (1-2s)');
console.log('• "Queue forming at entrance" → Occupancy + line shape');
console.log('• "Delivery truck at dock" → Vehicle (truck) + timeInArea');

console.log('\n🚀 READY TO DEPLOY!');
console.log('-------------------');
console.log('This configuration would be sent to camera at 192.168.50.156');
console.log('The camera would immediately start monitoring for crowds at the door.');
console.log('\n=============================================================\n');