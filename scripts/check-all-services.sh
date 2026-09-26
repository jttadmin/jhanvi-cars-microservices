#!/bin/bash

# ============================================================
# Jhanvi Cars - Complete Microservices Health Check
# ============================================================

set +e

echo
echo "============================================================"
echo "          JHANVI CARS MICROSERVICES HEALTH CHECK"
echo "============================================================"
echo

PASS=0
FAIL=0

check_service() {
    local NAME="$1"
    local PORT="$2"

    echo "------------------------------------------------------------"
    echo "Service : $NAME"
    echo "Port    : $PORT"
    echo "------------------------------------------------------------"

    # Check systemd
    if sudo systemctl is-active --quiet "$NAME"; then
        echo "systemd : ACTIVE"
        ((PASS++))
    else
        echo "systemd : FAILED"
        ((FAIL++))
    fi

    # Check health endpoint
    RESPONSE=$(curl -sS --max-time 5 "http://localhost:$PORT/health" 2>/dev/null)
    CURL_STATUS=$?

    if [ $CURL_STATUS -eq 0 ] && [ -n "$RESPONSE" ]; then
        echo "health  : OK"
        echo "response: $RESPONSE"
        ((PASS++))
    else
        echo "health  : FAILED"
        echo "response: Service did not respond"
        ((FAIL++))
    fi

    echo
}

# ------------------------------------------------------------
# Application services
# ------------------------------------------------------------

check_service "auth-service"         3001
check_service "user-service"         3002
check_service "driver-service"       3003
check_service "booking-service"       3004
check_service "vehicle-service"       3005
check_service "payment-service"       3006
check_service "notification-service"  3007

# ------------------------------------------------------------
# PostgreSQL connectivity
# ------------------------------------------------------------

echo "============================================================"
echo "                 POSTGRESQL CHECK"
echo "============================================================"
echo

echo "Auth Database:"
AUTH_DB=$(psql "postgresql://auth_user:Devops%40123@localhost:5432/jhanvi_cars" \
    -tAc "SELECT current_user || ' -> ' || current_database();" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$AUTH_DB" ]; then
    echo "  PASS: $AUTH_DB"
    ((PASS++))
else
    echo "  FAIL: Auth database connection"
    ((FAIL++))
fi

echo

echo "User Database:"
USER_DB=$(psql "postgresql://user_user:Devops%40123@localhost:5432/jhanvi_cars" \
    -tAc "SELECT current_user || ' -> ' || current_database();" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$USER_DB" ]; then
    echo "  PASS: $USER_DB"
    ((PASS++))
else
    echo "  FAIL: User database connection"
    ((FAIL++))
fi

# ------------------------------------------------------------
# PostgreSQL schemas
# ------------------------------------------------------------

echo
echo "PostgreSQL Schemas:"

EXPECTED_SCHEMAS=(
    "auth_schema"
    "user_schema"
    "driver_schema"
    "booking_schema"
    "vehicle_schema"
    "payment_schema"
    "notification_schema"
)

for SCHEMA in "${EXPECTED_SCHEMAS[@]}"; do

    EXISTS=$(sudo -u postgres psql -d jhanvi_cars -tAc \
        "SELECT EXISTS (
            SELECT 1
            FROM information_schema.schemata
            WHERE schema_name='$SCHEMA'
        );" 2>/dev/null)

    if [ "$EXISTS" = "t" ]; then
        echo "  PASS: $SCHEMA"
        ((PASS++))
    else
        echo "  FAIL: $SCHEMA"
        ((FAIL++))
    fi

done

# ------------------------------------------------------------
# Final summary
# ------------------------------------------------------------

echo
echo "============================================================"
echo "                       SUMMARY"
echo "============================================================"

echo
echo "PASS : $PASS"
echo "FAIL : $FAIL"

echo

if [ "$FAIL" -eq 0 ]; then
    echo "============================================================"
    echo "              ALL CHECKS PASSED"
    echo "============================================================"
    echo
    echo "Jhanvi Cars microservices platform is healthy."
    echo
    exit 0
else
    echo "============================================================"
    echo "              SOME CHECKS FAILED"
    echo "============================================================"
    echo
    echo "Review the FAILED checks above."
    echo
    exit 1
fi
