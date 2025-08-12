#!/usr/bin/env node

const axios = require('axios');
const https = require('https');

// Test configuration
const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';
const APP_NAME = 'BatonAnalytic';

async function checkApplicationStatus() {
    try {
        console.log('========== CHECKING APPLICATION STATUS ==========');
        console.log(`Camera: ${CAMERA_IP}`);
        console.log(`Application: ${APP_NAME}`);
        
        // Use the list.cgi endpoint to get all applications and their status
        // This endpoint needs digest auth - first request without auth to get challenge
        const url = `https://${CAMERA_IP}/axis-cgi/applications/list.cgi`;
        console.log(`\nCalling: ${url}`);
        
        // First try without auth to potentially get digest challenge
        let response;
        try {
            response = await axios.get(url, {
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                }),
                timeout: 5000,
                validateStatus: () => true // Accept any status
            });
        } catch (e) {
            // If complete failure, try with basic auth
            response = await axios.get(url, {
                auth: {
                    username: USERNAME,
                    password: PASSWORD
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                }),
                timeout: 5000
            });
        }
        
        // If we got 401, try with basic auth
        if (response.status === 401) {
            console.log('Got 401, trying with basic auth...');
            response = await axios.get(url, {
                auth: {
                    username: USERNAME,
                    password: PASSWORD
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                }),
                timeout: 5000
            });
        }
        
        console.log('\n========== RAW RESPONSE ==========');
        console.log(response.data);
        
        // Parse the XML response to find our app
        const appData = response.data;
        
        // Look for BatonAnalytic in the response
        const appRegex = new RegExp(`<application[^>]*Name="${APP_NAME}"[^>]*>`, 'i');
        const match = appData.match(appRegex);
        
        if (match) {
            console.log('\n========== APPLICATION FOUND ==========');
            console.log(match[0]);
            
            // Extract status - look for Status="Running" or Status="Stopped"
            const statusMatch = match[0].match(/Status="([^"]+)"/);
            if (statusMatch) {
                const status = statusMatch[1];
                console.log(`\nApplication Status: ${status}`);
                
                if (status === 'Running') {
                    console.log('✅ Application is RUNNING');
                    return true;
                } else if (status === 'Stopped') {
                    console.log('⚠️ Application is STOPPED');
                    return false;
                } else {
                    console.log(`❓ Unknown status: ${status}`);
                    return false;
                }
            }
            
            // Also check license status
            const licenseMatch = match[0].match(/License="([^"]+)"/);
            if (licenseMatch) {
                console.log(`License Status: ${licenseMatch[1]}`);
            }
        } else {
            console.log('❌ Application not found in list');
            return false;
        }
        
    } catch (error) {
        console.error('\n========== ERROR ==========');
        console.error('Error checking application status:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return false;
    }
}

async function startApplication() {
    try {
        console.log('\n========== STARTING APPLICATION ==========');
        
        const url = `https://${CAMERA_IP}/axis-cgi/applications/control.cgi?action=start&package=${APP_NAME}`;
        console.log(`Calling: ${url}`);
        
        const response = await axios.get(url, {
            auth: {
                username: USERNAME,
                password: PASSWORD
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            }),
            timeout: 5000
        });
        
        console.log('Response:', response.data);
        
        if (response.data.includes('OK') || response.data.includes('ok')) {
            console.log('✅ Start command successful');
            return true;
        } else {
            console.log('❌ Unexpected response');
            return false;
        }
        
    } catch (error) {
        console.error('Error starting application:', error.message);
        return false;
    }
}

async function stopApplication() {
    try {
        console.log('\n========== STOPPING APPLICATION ==========');
        
        const url = `https://${CAMERA_IP}/axis-cgi/applications/control.cgi?action=stop&package=${APP_NAME}`;
        console.log(`Calling: ${url}`);
        
        const response = await axios.get(url, {
            auth: {
                username: USERNAME,
                password: PASSWORD
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            }),
            timeout: 5000
        });
        
        console.log('Response:', response.data);
        
        if (response.data.includes('OK') || response.data.includes('ok')) {
            console.log('✅ Stop command successful');
            return true;
        } else {
            console.log('❌ Unexpected response');
            return false;
        }
        
    } catch (error) {
        console.error('Error stopping application:', error.message);
        return false;
    }
}

async function waitForAppReady(maxAttempts = 10, delayMs = 3000) {
    console.log('\n========== WAITING FOR APP TO BE READY ==========');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`\nAttempt ${attempt}/${maxAttempts}...`);
        
        const isRunning = await checkApplicationStatus();
        
        if (isRunning) {
            console.log('✅ Application is ready!');
            return true;
        }
        
        if (attempt < maxAttempts) {
            console.log(`Waiting ${delayMs}ms before next check...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    console.log('❌ Application did not become ready in time');
    return false;
}

// Main test sequence
async function main() {
    console.log('AXIS Camera Application Status Test');
    console.log('====================================\n');
    
    // First check current status
    console.log('1. Checking current status...');
    const initialStatus = await checkApplicationStatus();
    
    // Test stop/start cycle
    if (initialStatus) {
        console.log('\n2. Testing STOP command...');
        await stopApplication();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await checkApplicationStatus();
        
        console.log('\n3. Testing START command...');
        await startApplication();
        await waitForAppReady(5, 2000);
    } else {
        console.log('\n2. App is stopped, testing START command...');
        await startApplication();
        await waitForAppReady(5, 2000);
    }
    
    console.log('\n========== TEST COMPLETE ==========');
}

// Run the test
main().catch(console.error);