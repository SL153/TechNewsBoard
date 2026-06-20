#!/bin/sh
set -e

# Start the bundled Redis — loopback only (never exposed), RDB snapshots to /data.
redis-server \
  --bind 127.0.0.1 \
  --port 6379 \
  --save 60 1 \
  --appendonly no \
  --dir /data \
  --dbfilename dump.rdb \
  --pidfile /tmp/redis.pid \
  --logfile "" \
  --daemonize yes

# Wait until Redis accepts commands before starting the app.
echo "[entrypoint] waiting for redis..."
i=0
while [ "$i" -lt 50 ]; do
  if redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
    echo "[entrypoint] redis ready"
    break
  fi
  i=$((i + 1))
  sleep 0.1
done

# Hand off to the Next.js standalone server (PID becomes node).
exec node server.js
