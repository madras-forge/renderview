#!/usr/bin/env bash
set -euo pipefail
: "${GOOGLE_CLOUD_PROJECT:?Set GOOGLE_CLOUD_PROJECT to your Google Cloud project ID}"
REGION="${REGION:-asia-south1}"
RUNTIME_ACCOUNT="renderview-runtime@${GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com"
command -v gcloud >/dev/null || { echo 'Install Google Cloud CLI or use Cloud Shell. See docs/GOOGLE_CLOUD_SETUP.md.'; exit 1; }
# Create the runtime service account in the setup guide. It needs no project roles.
gcloud run deploy renderview \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --region "$REGION" \
  --source . \
  --service-account "$RUNTIME_ACCOUNT" \
  --execution-environment gen2 \
  --port 8080 \
  --cpu 1 \
  --memory 2Gi \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 60 \
  --no-allow-unauthenticated
