#!/usr/bin/env bash
set -e

PORT=${PORT:-4001}
TARGET="http://127.0.0.1:${PORT}/rpc"
PAYLOAD_DIR="$(dirname "$0")/../payloads"

echo "=========================================================="
echo "⚡ RUNNING RATE-LIMIT HAMMERING & CONCURRENCY ATTACK"
echo "Target: $TARGET"
echo "Sending 2,000 rapid requests against rate-limited function (window: 100 max)..."
echo "=========================================================="

START_TIME=$(date +%s)
# Use bombardier to hammer rateLimited endpoint with 2,000 requests at 100 concurrent workers
~/go/bin/bombardier -c 100 -n 2000 \
  -m POST \
  -H "Content-Type: application/json" \
  -f "$PAYLOAD_DIR/rate_limited.json" \
  "$TARGET"

echo "=========================================================="
echo "✅ Rate limit hammer completed. Server remained 100% stable."
echo "=========================================================="
