for svc in auth-service user-service driver-service booking-service vehicle-service payment-service; do
  echo "===== $svc ====="
  sudo systemctl is-active "$svc"
done

echo
echo "===== HEALTH CHECKS ====="

for port in 3001 3002 3003 3004 3005 3006; do
  echo -n "Port $port: "
  curl -sS --max-time 5 "http://localhost:$port/health"
  echo
done
