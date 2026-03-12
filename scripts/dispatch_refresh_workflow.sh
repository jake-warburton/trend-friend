#!/usr/bin/env bash

set -euo pipefail

REPO_OWNER="${GITHUB_REPOSITORY_OWNER:-jake-warburton}"
REPO_NAME="${GITHUB_REPOSITORY_NAME:-trend-friend}"
WORKFLOW_FILE="${GITHUB_WORKFLOW_FILE:-refresh-data.yml}"
REF_NAME="${GITHUB_WORKFLOW_REF:-main}"

if [[ -z "${GITHUB_WORKFLOW_TOKEN:-}" ]]; then
  echo "Missing required env var: GITHUB_WORKFLOW_TOKEN" >&2
  exit 1
fi

curl --fail-with-body \
  --request POST \
  --url "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches" \
  --header "Accept: application/vnd.github+json" \
  --header "Authorization: Bearer ${GITHUB_WORKFLOW_TOKEN}" \
  --header "X-GitHub-Api-Version: 2022-11-28" \
  --data "{\"ref\":\"${REF_NAME}\"}"
