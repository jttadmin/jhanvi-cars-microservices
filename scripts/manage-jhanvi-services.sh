#!/usr/bin/env bash

set -u

PROJECT_ROOT="${HOME}/jhanvi-dev"

SERVICES=(
  "auth-service"
  "user-service"
  "driver-service"
  "booking-service"
  "vehicle-service"
  "payment-service"
  "notification-service"
  "api-gateway"
)

NGINX_SERVICE="nginx"

declare -A PORTS=(
  [auth-service]=3001
  [user-service]=3002
  [driver-service]=3003
  [booking-service]=3004
  [vehicle-service]=3005
  [payment-service]=3006
  [notification-service]=3007
  [api-gateway]=3000
)

usage() {
  cat <<EOF

Jhanvi Cars Service Manager

Usage:
  $0 start
  $0 stop
  $0 restart
  $0 status
  $0 health
  $0 build
  $0 enable
  $0 help

Commands:
  start    Start all services in dependency order
  stop     Stop Nginx and services cleanly
  restart  Restart the complete stack
  status   Show systemd status
  health   Check service and Nginx health endpoints
  build    Install dependencies and build all Node services
  enable   Enable all services to start automatically on boot
  help     Show this help

EOF
  exit 1
}

daemon_reload() {
  echo
  echo "===== SYSTEMD DAEMON RELOAD ====="
  sudo systemctl daemon-reload
}

enable_all() {
  echo
  echo "===== ENABLE SERVICES ====="

  local failed=0

  for service in "${SERVICES[@]}"; do
    if sudo systemctl enable "${service}.service"; then
      echo "ENABLED: ${service}"
    else
      echo "FAILED: ${service}"
      failed=1
    fi
  done

  if sudo systemctl enable "${NGINX_SERVICE}.service"; then
    echo "ENABLED: ${NGINX_SERVICE}"
  else
    echo "FAILED: ${NGINX_SERVICE}"
    failed=1
  fi

  return "$failed"
}

build_service() {
  local service="$1"
  local dir="${PROJECT_ROOT}/backend/${service}"

  if [[ ! -d "$dir" ]]; then
    echo "ERROR: ${service} source directory does not exist:"
    echo "       ${dir}"
    return 1
  fi

  echo
  echo "===== BUILD ${service} ====="

  cd "$dir" || return 1

  if [[ -f package-lock.json ]]; then
    npm ci || return 1
  else
    npm install || return 1
  fi

  npm run build
}

build_all() {
  local failed=0

  for service in "${SERVICES[@]}"; do
    build_service "$service" || failed=1
  done

  return "$failed"
}

start_all() {
  echo
  echo "===== START JHANVI CARS STACK ====="

  daemon_reload

  local failed=0

  echo
  echo "--- Starting backend services ---"

  for service in \
    auth-service \
    user-service \
    driver-service \
    booking-service \
    vehicle-service \
    payment-service \
    notification-service
  do
    echo "Starting ${service}..."

    if sudo systemctl start "${service}.service"; then
      echo "OK: ${service}"
    else
      echo "FAILED: ${service}"
      failed=1
    fi
  done

  echo
  echo "--- Starting API Gateway ---"

  if sudo systemctl start api-gateway.service; then
    echo "OK: api-gateway"
  else
    echo "FAILED: api-gateway"
    failed=1
  fi

  echo
  echo "--- Validating Nginx configuration ---"

  if sudo nginx -t; then
    echo "OK: nginx configuration"
  else
    echo "FAILED: nginx configuration"
    return 1
  fi

  echo
  echo "--- Starting Nginx ---"

  if sudo systemctl start nginx.service; then
    echo "OK: nginx"
  else
    echo "FAILED: nginx"
    failed=1
  fi

  return "$failed"
}

stop_all() {
  echo
  echo "===== STOP JHANVI CARS STACK ====="

  local failed=0

  echo
  echo "--- Stopping Nginx ---"

  sudo systemctl stop nginx.service || failed=1

  echo
  echo "--- Stopping API Gateway ---"

  sudo systemctl stop api-gateway.service || failed=1

  echo
  echo "--- Stopping backend services ---"

  for service in \
    notification-service \
    payment-service \
    vehicle-service \
    booking-service \
    driver-service \
    user-service \
    auth-service
  do
    echo "Stopping ${service}..."
    sudo systemctl stop "${service}.service" || failed=1
  done

  return "$failed"
}

restart_all() {
  echo
  echo "===== RESTART JHANVI CARS STACK ====="

  stop_all || true

  sleep 2

  start_all
}

status_all() {
  printf "\n%-25s %-12s %-12s\n" "SERVICE" "ACTIVE" "ENABLED"
  printf "%-25s %-12s %-12s\n" "-------" "------" "-------"

  for service in "${SERVICES[@]}"; do
    active=$(systemctl is-active "${service}.service" 2>/dev/null || true)
    enabled=$(systemctl is-enabled "${service}.service" 2>/dev/null || true)

    printf "%-25s %-12s %-12s\n" \
      "$service" \
      "$active" \
      "$enabled"
  done

  active=$(systemctl is-active nginx.service 2>/dev/null || true)
  enabled=$(systemctl is-enabled nginx.service 2>/dev/null || true)

  printf "%-25s %-12s %-12s\n" \
    "nginx" \
    "$active" \
    "$enabled"
}

check_health() {
  local name="$1"
  local url="$2"

  local code

  code=$(curl -sS \
    -o /dev/null \
    --connect-timeout 2 \
    --max-time 5 \
    -w "%{http_code}" \
    "$url" 2>/dev/null || echo "000")

  if [[ "$code" == "200" ]]; then
    printf "%-25s %-10s %-10s\n" "$name" "UP" "$code"
    return 0
  else
    printf "%-25s %-10s %-10s\n" "$name" "DOWN" "$code"
    return 1
  fi
}

health_all() {
  echo
  echo "===== SERVICE HEALTH ====="

  printf "\n%-25s %-10s %-10s\n" "SERVICE" "STATUS" "HTTP"
  printf "%-25s %-10s %-10s\n" "-------" "------" "----"

  local failed=0

  for service in \
    auth-service \
    user-service \
    driver-service \
    booking-service \
    vehicle-service \
    payment-service \
    notification-service
  do
    local port="${PORTS[$service]}"

    if ! systemctl is-active --quiet "${service}.service"; then
      printf "%-25s %-10s %-10s\n" \
        "$service" \
        "STOPPED" \
        "000"
      failed=1
      continue
    fi

    check_health \
      "$service" \
      "http://127.0.0.1:${port}/health" || failed=1
  done

  if systemctl is-active --quiet api-gateway.service; then
    check_health \
      "api-gateway" \
      "http://127.0.0.1:3000/health" || failed=1
  else
    printf "%-25s %-10s %-10s\n" \
      "api-gateway" \
      "STOPPED" \
      "000"
    failed=1
  fi

  echo
  echo "===== NGINX / API HEALTH ====="

  if systemctl is-active --quiet nginx.service; then
    check_health \
      "nginx -> gateway" \
      "http://127.0.0.1/api/health" || failed=1
  else
    printf "%-25s %-10s %-10s\n" \
      "nginx -> gateway" \
      "STOPPED" \
      "000"
    failed=1
  fi

  return "$failed"
}

case "${1:-}" in

  build)
    build_all
    ;;

  start)
    start_all
    ;;

  stop)
    stop_all
    ;;

  restart)
    restart_all
    ;;

  status)
    status_all
    ;;

  health)
    health_all
    ;;

  enable)
    daemon_reload
    enable_all
    ;;

  help)
    usage
    ;;

  *)
    usage
    ;;

esac
