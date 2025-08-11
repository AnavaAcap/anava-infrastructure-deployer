#!/bin/bash

echo "=== Checking Anava Debug Logs ==="
echo ""

# Check if debug logs directory exists
if [ -d ~/anava-debug-logs ]; then
    echo "Debug logs directory found at: ~/anava-debug-logs"
    echo ""
    
    # Find most recent log
    LATEST_LOG=$(ls -t ~/anava-debug-logs/*.log 2>/dev/null | head -1)
    
    if [ -n "$LATEST_LOG" ]; then
        echo "Most recent log: $LATEST_LOG"
        echo ""
        echo "=== Checking for deployment errors ==="
        echo ""
        
        # Look for errors
        grep -i "deploy\|error\|fail\|exception\|critical" "$LATEST_LOG" | tail -100
        
        echo ""
        echo "=== Last 50 lines of log ==="
        echo ""
        tail -50 "$LATEST_LOG"
    else
        echo "No log files found in ~/anava-debug-logs"
    fi
else
    echo "Debug logs directory not found at: ~/anava-debug-logs"
    echo "The app may not have run yet with the new logger."
fi

# Also check standard logs location
echo ""
echo "=== Checking standard logs location ==="
STANDARD_LOGS="$HOME/Library/Logs/anava-installer"
if [ -d "$STANDARD_LOGS" ]; then
    LATEST_STANDARD=$(ls -t "$STANDARD_LOGS"/*.log 2>/dev/null | head -1)
    if [ -n "$LATEST_STANDARD" ]; then
        echo "Most recent standard log: $LATEST_STANDARD"
        echo ""
        echo "=== Recent errors from standard log ==="
        grep -i "deploy\|error\|fail" "$LATEST_STANDARD" | tail -50
    fi
fi