#!/usr/bin/env bash

# add_vehicle.sh
# Usage: ./add_vehicle.sh MAKE MODEL YEAR

API_URL="http://localhost:3000/api/vehicles"

# --- Validate input ---
if [ $# -lt 3 ]; then
  echo "Usage: $0 MAKE MODEL YEAR"
  echo "Example: $0 Toyota Supra 2020"
  exit 1
fi

MAKE="$1"
MODEL="$2"
YEAR="$3"

# --- Build JSON payload ---
read -r -d '' payload <<EOF
{
  "make":  "$MAKE",
  "model": "$MODEL",
  "year":  $YEAR
}
EOF

# --- Invoke curl, capture body & HTTP code ---
response=$(curl.exe -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$payload")

# split response into body & status
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# --- Check curl exit status ---
curl_exit=$?
if [ $curl_exit -ne 0 ]; then
  echo "Error: curl failed with exit code $curl_exit"
  exit $curl_exit
fi

# --- Evaluate HTTP status ---
if [[ "$http_code" =~ ^2[0-9]{2}$ ]]; then
  echo
  echo "✅ Vehicle added successfully!"
  echo "Response: $body"
  echo "View all vehicles at: http://localhost:3000/api/vehicles"
  exit 0
else
  echo
  echo "❌ API error (HTTP $http_code):"
  echo "$body"
  exit 1
fi
