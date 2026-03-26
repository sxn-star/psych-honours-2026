#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env}"
OUT_FILE="$ROOT_DIR/config.local.js"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found at $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

required_vars=(
  APPWRITE_ENDPOINT
  APPWRITE_PROJECT_ID
  APPWRITE_BUCKET_ID
  APPWRITE_DATABASE_ID
  APPWRITE_COLLECTION_ID
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: missing required variable '$var' in $ENV_FILE" >&2
    exit 1
  fi
done

cat > "$OUT_FILE" <<EOF
// Auto-generated from .env by scripts/generate-config.sh
// Do not commit this file.
window.APP_CONFIG = {
  endpoint: "${APPWRITE_ENDPOINT}",
  projectId: "${APPWRITE_PROJECT_ID}",
  bucketId: "${APPWRITE_BUCKET_ID}",
  databaseId: "${APPWRITE_DATABASE_ID}",
  collectionId: "${APPWRITE_COLLECTION_ID}"
};
EOF

echo "Generated $OUT_FILE from $ENV_FILE"
