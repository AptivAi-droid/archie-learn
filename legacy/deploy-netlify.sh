#!/bin/bash
# Archie Learn - One-click deploy to Netlify
# Run: bash deploy.sh

echo "🚀 Deploying Archie Learn..."

# Build the frontend
echo "📦 Building frontend..."
npm run build

# Deploy to Netlify (will prompt for login if needed)
echo "🌐 Deploying to Netlify..."
npx netlify deploy --prod --dir=dist --functions=netlify/functions

echo ""
echo "✅ Done! Don't forget to set your environment variable:"
echo "   Go to Netlify Dashboard > Site Settings > Environment Variables"
echo "   Add: ANTHROPIC_API_KEY = your-api-key"
echo ""
