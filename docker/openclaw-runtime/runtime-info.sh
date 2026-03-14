#!/bin/sh
set -eu

echo "Lobster Park OpenClaw Runtime"
echo "Flavor: ${LOBSTER_OPENCLAW_RUNTIME_FLAVOR:-unknown}"
echo "Approved plugins:"
cat "${LOBSTER_OPENCLAW_APPROVED_PLUGINS_FILE:-/opt/lobster-park/openclaw-runtime/approved-plugins.txt}"
