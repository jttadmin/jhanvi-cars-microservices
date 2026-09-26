#!/usr/bin/env bash

set -euo pipefail

BASE_URL="http://localhost:3005"

echo
echo "=========================================="
echo " Vehicle Service Smoke Test"
echo "=========================================="

echo
echo "1. Health check"

curl -fsS \
  "$BASE_URL/health"

echo

echo
echo "2. Create vehicle"

CREATE_RESPONSE=$(
  curl -fsS \
    -X POST \
    "$BASE_URL/vehicles" \
    -H "Content-Type: application/json" \
    -d '{
      "driverId": "driver-001",
      "registrationNumber": "SMOKE1234",
      "make": "Toyota",
      "model": "Innova",
      "year": 2025,
      "type": "MUV"
    }'
)

echo "$CREATE_RESPONSE"

VEHICLE_ID=$(
  printf '%s' "$CREATE_RESPONSE" |
  sed -n 's/.*"id":"\([^"]*\)".*/\1/p'
)

if [ -z "$VEHICLE_ID" ]; then
  echo "ERROR: Could not get vehicle ID"
  exit 1
fi

echo
echo "3. Get vehicle"

curl -fsS \
  "$BASE_URL/vehicles/$VEHICLE_ID"

echo

echo
echo "4. Update vehicle"

curl -fsS \
  -X PUT \
  "$BASE_URL/vehicles/$VEHICLE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver-001",
    "registrationNumber": "SMOKE1234",
    "make": "Toyota",
    "model": "Innova Crysta",
    "year": 2025,
    "type": "MUV"
  }'

echo

echo
echo "5. Update status"

curl -fsS \
  -X PATCH \
  "$BASE_URL/vehicles/$VEHICLE_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_USE"
  }'

echo

echo
echo "6. Get all vehicles"

curl -fsS \
  "$BASE_URL/vehicles"

echo

echo
echo "7. Test validation"

curl -s \
  -o /tmp/vehicle-validation.json \
  -w "HTTP %{http_code}\n" \
  -X PATCH \
  "$BASE_URL/vehicles/$VEHICLE_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "WRONG"
  }'

cat /tmp/vehicle-validation.json

echo

echo
echo "8. Test duplicate registration number"

curl -s \
  -o /tmp/vehicle-duplicate.json \
  -w "HTTP %{http_code}\n" \
  -X POST \
  "$BASE_URL/vehicles" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "driver-001",
    "registrationNumber": "SMOKE1234",
    "make": "Honda",
    "model": "City",
    "year": 2025,
    "type": "SEDAN"
  }'

cat /tmp/vehicle-duplicate.json

echo

echo
echo "9. Cleanup smoke-test vehicle"

sudo -u postgres psql \
  -d jhanvi_cars \
  -c "DELETE FROM vehicle_schema.vehicles WHERE id = '$VEHICLE_ID';" \
  >/dev/null

echo "Deleted smoke-test vehicle:"
echo "$VEHICLE_ID"

echo
echo "=========================================="
echo " Smoke Test Complete"
echo "=========================================="
