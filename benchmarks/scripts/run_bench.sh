#!/usr/bin/env bash
set -e

PORT=${PORT:-4001}
TARGET="http://127.0.0.1:${PORT}/rpc"
DURATION=${DURATION:-"5s"}
CONNECTIONS=${CONNECTIONS:-100}
PAYLOAD_DIR="$(dirname "$0")/../payloads"

echo "=========================================================="
echo "📊 CRPC-GO BENCHMARK RUNNER"
echo "Target: $TARGET | Duration: $DURATION | Concurrency: $CONNECTIONS"
echo "=========================================================="

run_test() {
  local name=$1
  local payload_file=$2
  local auth_header=$3

  echo ""
  echo ">>> Scenario: $name"
  if [ -n "$auth_header" ]; then
    oha -n 10000 -c "$CONNECTIONS" -m POST \
      -H "Content-Type: application/json" \
      -H "Authorization: $auth_header" \
      -D "$payload_file" \
      "$TARGET"
  else
    oha -n 10000 -c "$CONNECTIONS" -m POST \
      -H "Content-Type: application/json" \
      -D "$payload_file" \
      "$TARGET"
  fi
}

# 1. Ping
run_test "1. Raw Ping Baseline" "$PAYLOAD_DIR/ping.json" ""

# 2. Login
run_test "2. Authentication Login (JWT + Credentials)" "$PAYLOAD_DIR/login.json" ""

# 3. Create Item
run_test "3. CRUD Create Item (Authenticated + Validation)" "$PAYLOAD_DIR/create.json" "Bearer secret_token_123"

# 4. Get Item
run_test "4. CRUD Get Item (Lookup by ID)" "$PAYLOAD_DIR/get.json" ""

# 5. List Items
run_test "5. CRUD List Items (JSON v2 array serialization)" "$PAYLOAD_DIR/list.json" ""

echo ""
echo "=========================================================="
echo "✅ All benchmark scenarios executed successfully!"
echo "=========================================================="
