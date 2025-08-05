#!/bin/bash

# Camera details
CAMERA_IP="192.168.50.156"
USERNAME="anava"
PASSWORD="baton"
APPLICATION="BatonAnalytic"
LICENSE_KEY="TEST"

echo "=== Testing VAPIX License Key with curl ==="
echo "Camera: $CAMERA_IP"
echo "Application: $APPLICATION"
echo ""

# Test 1: Try the standard VAPIX control.cgi endpoint
echo "1. Testing control.cgi with license action..."
curl -v --digest -u "$USERNAME:$PASSWORD" \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=license&ApplicationName=$APPLICATION&LicenseKey=$LICENSE_KEY" \
  "http://$CAMERA_IP/axis-cgi/applications/control.cgi" \
  2>&1

echo ""
echo ""

# Test 2: Let's check if there's a dedicated license.cgi endpoint
echo "2. Checking if license.cgi exists..."
curl -v --digest -u "$USERNAME:$PASSWORD" \
  "http://$CAMERA_IP/axis-cgi/applications/license.cgi" \
  2>&1 | grep -E "(HTTP/|< )"

echo ""
echo ""

# Test 3: Try to get help/usage info from control.cgi
echo "3. Getting control.cgi usage info..."
curl --digest -u "$USERNAME:$PASSWORD" \
  "http://$CAMERA_IP/axis-cgi/applications/control.cgi" \
  2>&1