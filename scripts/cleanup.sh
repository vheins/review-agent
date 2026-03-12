#!/bin/bash

echo "🧹 Cleaning up environment..."

# Kill processes by ports
PORTS=(3000 5173)
for port in "${PORTS[@]}"; do
    PID=$(lsof -ti :$port)
    if [ ! -z "$PID" ]; then
        echo "Killing processes on port $port (PID: $PID)"
        echo $PID | xargs kill -9 2>/dev/null
    fi
done

# Kill specific project processes
PROCESS_NAMES=("electron" "vite" "nest")
for name in "${PROCESS_NAMES[@]}"; do
    if pgrep -f "$name" > /dev/null; then
        echo "Cleaning up lingering $name processes..."
        pkill -9 -f "$name" 2>/dev/null
    fi
done

echo "✅ Environment clean."
