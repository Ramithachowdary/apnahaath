#!/usr/bin/env bash
# Deploy ApnaHaath to Cloud Run (asia-south1) using Catalyst trygcp.dev billing.
# Prerequisites: gcloud auth, project set, billing = Google Cloud Platform Trial Billing Account
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-asia-south1}"
SERVICE="${CLOUD_RUN_SERVICE:-apnahaath}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or run: gcloud config set project YOUR_PROJECT"
  exit 1
fi

echo "Deploying ${SERVICE} to ${REGION} (project=${PROJECT_ID})"
echo "min-instances=0 max-instances=1 (credit-safe)"

gcloud run deploy "${SERVICE}" \
  --source . \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --cpu=1 \
  --memory=512Mi \
  --port=8080 \
  --set-env-vars="NODE_ENV=production,TZ=Asia/Kolkata" \
  --quiet

URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT_ID}" --format='value(status.url)')"
echo ""
echo "Cloud Run URL: ${URL}"
echo "Health: ${URL}/api/health"
