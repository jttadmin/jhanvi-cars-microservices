#!/bin/bash

BASE_URL="http://localhost:3003"
DRIVER_ID="smoke-test-driver"

echo "======================================"
echo " Driver Service Smoke Test"
echo "======================================"

echo
echo "1. Health check"
curl -s "$BASE_URL/health"
echo

echo
echo "2. Create driver"
curl -s -X POST "$BASE_URL/drivers" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "'"$DRIVER_ID"'",
    "name": "Smoke Test Driver",
    "email": "smoke-test@example.com",
    "phone": "9876543212",
    "licenseNumber": "SMOKE123456",
    "vehicleNumber": "SMOKE1234",
    "isAvailable": true
  }'
echo

echo
echo "3. Get driver"
curl -s "$BASE_URL/drivers/$DRIVER_ID"
echo

echo
echo "4. Update driver"
curl -s -X PUT "$BASE_URL/drivers/$DRIVER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smoke Test Driver Updated",
    "email": "smoke-test@example.com",
    "phone": "9876543213",
    "licenseNumber": "SMOKE123456",
    "vehicleNumber": "SMOKE1234",
    "isAvailable": false
  }'
echo

echo
echo "5. Update availability"
curl -s -X PATCH "$BASE_URL/drivers/$DRIVER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "isAvailable": true
  }'
echo

echo
echo "6. Get all drivers"
curl -s "$BASE_URL/drivers"
echo

echo
echo "7. Test validation"
curl -s -X PATCH "$BASE_URL/drivers/$DRIVER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "isAvailable": "invalid"
  }'
echo

echo
echo "======================================"
echo " Smoke Test Complete"
echo "======================================"
