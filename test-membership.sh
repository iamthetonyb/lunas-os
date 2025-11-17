#!/bin/bash

# Get a valid user ID and org ID from the database
USER_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM users LIMIT 1" | tr -d ' ')
ORG_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM orgs LIMIT 1" | tr -d ' ')

echo "Testing with User ID: $USER_ID"
echo "Testing with Org ID: $ORG_ID"

# Get auth cookie
COOKIE=$(curl -s -c - http://localhost:4010/api/auth/session | grep next-auth | awk '{print $6"="$7}')

echo "Auth cookie: $COOKIE"

# Make the POST request
curl -v -X POST http://localhost:4010/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: $COOKIE" \
  -d "{\"userId\":\"$USER_ID\",\"orgId\":\"$ORG_ID\",\"role\":\"contractor\"}"
