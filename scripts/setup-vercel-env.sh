#!/bin/bash

# Firebase Config
API_KEY="AIzaSyDBKX4m4uKzxVSNksJt3mH4Cw19A72h9ZQ"
AUTH_DOMAIN="kisanmitra-07.firebaseapp.com"
PROJECT_ID="kisanmitra-07"
STORAGE_BUCKET="kisanmitra-07.firebasestorage.app"
MESSAGING_SENDER_ID="721571700379"
APP_ID="1:721571700379:web:b7e64cfbb4ec4a77ba703e"
MEASUREMENT_ID="G-LG9568PYK0"

# Gemini Config (getting from .env if possible, otherwise skip)
GEMINI_KEY=$(grep GEMINI_API_KEY .env | cut -d'"' -f2)

vars=(
  "VITE_FIREBASE_API_KEY:$API_KEY"
  "VITE_FIREBASE_AUTH_DOMAIN:$AUTH_DOMAIN"
  "VITE_FIREBASE_PROJECT_ID:$PROJECT_ID"
  "VITE_FIREBASE_STORAGE_BUCKET:$STORAGE_BUCKET"
  "VITE_FIREBASE_MESSAGING_SENDER_ID:$MESSAGING_SENDER_ID"
  "VITE_FIREBASE_APP_ID:$APP_ID"
  "VITE_FIREBASE_MEASUREMENT_ID:$MEASUREMENT_ID"
)

if [ ! -z "$GEMINI_KEY" ]; then
  vars+=("GEMINI_API_KEY:$GEMINI_KEY")
  vars+=("VITE_GEMINI_API_KEY:$GEMINI_KEY")
fi

for pair in "${vars[@]}"; do
  name="${pair%%:*}"
  value="${pair#*:}"
  echo "Adding $name to Vercel..."
  echo -n "$value" | vercel env add "$name" production
  echo -n "$value" | vercel env add "$name" preview
  echo -n "$value" | vercel env add "$name" development
done

# Redploy to apply changes
echo "Redeploying to apply environment variables..."
vercel deploy --prod
