const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';

async function getDeviceInfo() {
  console.log('Getting device information...\n');
  
  // Get device ID (MAC address)
  const macCommand = `curl -s --digest -u "${username}:${password}" "http://${ip}/axis-cgi/param.cgi?action=list&group=Network.eth0" | grep -E "MACAddress|HWAddress"`;
  
  try {
    const { stdout: macOut } = await execPromise(macCommand);
    console.log('MAC Address info:');
    console.log(macOut);
  } catch (err) {
    console.log('MAC error:', err.message);
  }
  
  // Get application info
  const appCommand = `curl -s --digest -u "${username}:${password}" "http://${ip}/axis-cgi/applications/list.cgi" | grep -A10 -B10 BatonAnalytic`;
  
  try {
    const { stdout: appOut } = await execPromise(appCommand);
    console.log('\nApplication info:');
    console.log(appOut);
  } catch (err) {
    console.log('App error:', err.message);
  }
}

getDeviceInfo();