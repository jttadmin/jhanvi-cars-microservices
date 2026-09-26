#!/usr/bin/env bash

set -euo pipefail

DB_NAME="jhanvi_cars"

echo "========================================"
echo " Jhanvi Cars - Smoke Record Cleanup"
echo "========================================"
echo

echo "Finding smoke-test users..."

sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

CREATE TEMP TABLE smoke_users AS
SELECT id
FROM auth_schema.users
WHERE email LIKE 'smoke-%@example.com';

SELECT
    'Smoke users found' AS check_name,
    COUNT(*) AS count
FROM smoke_users;

DELETE FROM user_schema.user_profiles
WHERE user_id IN (
    SELECT id
    FROM smoke_users
);

SELECT
    'User profiles deleted' AS check_name,
    COUNT(*) AS count
FROM user_schema.user_profiles
WHERE user_id IN (
    SELECT id
    FROM smoke_users
);

DELETE FROM auth_schema.users
WHERE id IN (
    SELECT id
    FROM smoke_users
);

SELECT
    'Auth users remaining' AS check_name,
    COUNT(*) AS count
FROM auth_schema.users
WHERE email LIKE 'smoke-%@example.com';

DROP TABLE smoke_users;

COMMIT;
SQL

echo
echo "Smoke-record cleanup completed."
