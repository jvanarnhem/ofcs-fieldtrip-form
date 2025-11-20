#!/bin/bash
# Script to switch between production and development CLASP environments

if [ "$1" = "prod" ]; then
    echo "Switching to PRODUCTION environment..."
    cp .clasp.prod.json .clasp.json
    echo "✓ Now pointing to PRODUCTION Apps Script project"
    echo "⚠️  WARNING: clasp push will update the LIVE production app!"
elif [ "$1" = "dev" ]; then
    echo "Switching to DEVELOPMENT environment..."
    cp .clasp.dev.json .clasp.json
    echo "✓ Now pointing to DEVELOPMENT Apps Script project"
    echo "You can safely test with: clasp push"
else
    echo "Usage: ./switch-env.sh [prod|dev]"
    echo ""
    echo "Current environment:"
    if [ -f .clasp.json ]; then
        grep -o '"scriptId": "[^"]*"' .clasp.json
    else
        echo "No .clasp.json found"
    fi
    exit 1
fi
