const { CameraConfigurationService } = require('./dist/main/services/camera/cameraConfigurationService');

// Test the complete implementation
async function testImplementation() {
  console.log('Testing complete license activation implementation...\n');
  
  const service = new CameraConfigurationService();
  
  try {
    await service.activateLicenseKey(
      '192.168.50.156',
      'anava', 
      'baton',
      '2Z7YMSDTTF44N5JAX422',
      'BatonAnalytic'
    );
    
    console.log('\nLicense activation completed');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Monkey patch to use hardcoded XML for testing
const CameraConfigurationService = require('./dist/main/services/camera/cameraConfigurationService').CameraConfigurationService;
const originalGetLicenseXML = CameraConfigurationService.prototype.getLicenseXMLFromAxis;

CameraConfigurationService.prototype.getLicenseXMLFromAxis = async function(deviceId, licenseCode) {
  console.log('[TEST] Using hardcoded XML for testing');
  
  // Return the known working XML
  return `<LicenseKey>
    <Info></Info>
    <FormatVersion>1</FormatVersion>
    <ApplicationID>415129</ApplicationID>
    <MinimumMajorVersion>-1</MinimumMajorVersion>
    <MinimumMinorVersion>-1</MinimumMinorVersion>
    <MaximumMajorVersion>-1</MaximumMajorVersion>
    <MaximumMinorVersion>-1</MaximumMinorVersion>
    <ExpirationDate>2025-09-04</ExpirationDate>
    <DeviceID>B8A44F45D624</DeviceID>
    <SignatureKeyID>1</SignatureKeyID>
    <Signature>CUGfNg4Rq6gd+/IJK/KIIPvbv2ElovWG9XE+Tys1K6tG7J1sP8IsUDmBO5wI3F3hq2esWJIL7KLIrSTuwExAf2bLDy6Z4rnLavsQPauLsuQhVNQkF7cRBQDdbfgK9dgo0ZYecHzIHmRdh/2XrFO28JRn5s6VXhO7L4FaWL1IHNs=</Signature>
</LicenseKey>`;
};

testImplementation();