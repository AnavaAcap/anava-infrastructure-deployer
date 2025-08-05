#!/bin/bash

# Camera details
CAMERA_IP="192.168.50.156"
USERNAME="anava"
PASSWORD="baton"
APPLICATION="BatonAnalytic"
LICENSE_KEY="TEST"

echo "=== Testing various license endpoints ==="
echo ""

# Test different actions on license.cgi
echo "1. Testing license.cgi with action=list..."
curl -s --digest -u "$USERNAME:$PASSWORD" \
  "http://$CAMERA_IP/axis-cgi/applications/license.cgi?action=list" \
  2>&1
echo ""
echo ""

echo "2. Testing license.cgi with action=get..."
curl -s --digest -u "$USERNAME:$PASSWORD" \
  "http://$CAMERA_IP/axis-cgi/applications/license.cgi?action=get&package=$APPLICATION" \
  2>&1
echo ""
echo ""

echo "3. Testing license.cgi without parameters (help)..."
curl -s --digest -u "$USERNAME:$PASSWORD" \
  "http://$CAMERA_IP/axis-cgi/applications/license.cgi" \
  2>&1
echo ""
echo ""

echo "4. Testing control.cgi with remove action first (might need to remove existing license)..."
curl -s --digest -u "$USERNAME:$PASSWORD" \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=removelicense&ApplicationName=$APPLICATION" \
  "http://$CAMERA_IP/axis-cgi/applications/control.cgi" \
  2>&1
echo ""
echo ""

echo "5. Checking BatonAnalytic's own license endpoint..."
curl -s --digest -u "$USERNAME:$PASSWORD" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"command": "getLicenseInfo"}' \
  "http://$CAMERA_IP/local/BatonAnalytic/baton_analytic.cgi" \
  2>&1
echo ""