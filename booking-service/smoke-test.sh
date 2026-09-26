#!/usr/bin/env bash

set -euo pipefail

BASE_URL="http://localhost:3004"

echo
echo "=========================================="
echo " Booking Service Smoke Test"
echo "=========================================="

echo
echo "1. Health check"

curl -fsS \
  "$BASE_URL/health"

echo

echo
echo "2. Create booking"

CREATE_RESPONSE=$(
  curl -fsS \
    -X POST \
    "$BASE_URL/bookings" \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "user-smoke-001",
      "driverId": "driver-001",
      "pickupLocation": "MG Road, Bengaluru",
      "dropoffLocation": "Kempegowda International Airport",
      "scheduledAt": "2030-01-01T10:00:00+05:30",
      "fare": 850
    }'
)

echo "$CREATE_RESPONSE"

BOOKING_ID=$(
  printf '%s' "$CREATE_RESPONSE" |
  sed -n 's/.*"id":"\([^"]*\)".*/\1/p'
)

if [ -z "$BOOKING_ID" ]; then
  echo "ERROR: Could not get booking ID"
  exit 1
fi

echo
echo "3. Get booking"

curl -fsS \
  "$BASE_URL/bookings/$BOOKING_ID"

echo

echo
echo "4. Update booking"

curl -fsS \
  -X PUT \
  "$BASE_URL/bookings/$BOOKING_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-smoke-001",
    "driverId": "driver-001",
    "pickupLocation": "Indiranagar, Bengaluru",
    "dropoffLocation": "Kempegowda International Airport",
    "scheduledAt": "2030-01-01T11:00:00+05:30",
    "fare": 900
  }'

echo

echo
echo "5. Update status"

curl -fsS \
  -X PATCH \
  "$BASE_URL/bookings/$BOOKING_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CONFIRMED"
  }'

echo

echo
echo "6. Get all bookings"

curl -fsS \
  "$BASE_URL/bookings"

echo

echo
echo "7. Test validation"

curl -s \
  -o /tmp/booking-validation.json \
  -w "HTTP %{http_code}\n" \
  -X PATCH \
  "$BASE_URL/bookings/$BOOKING_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "WRONG"
  }'

cat /tmp/booking-validation.json

echo

echo
echo "8. Cleanup smoke-test booking"

sudo -u postgres psql \
  -d jhanvi_cars \
  -c "DELETE FROM booking_schema.bookings WHERE id = '$BOOKING_ID';" \
  >/dev/null

echo "Deleted smoke-test booking:"
echo "$BOOKING_ID"

echo
echo "=========================================="
echo " Smoke Test Complete"
echo "=========================================="
