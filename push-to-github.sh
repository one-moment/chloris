#!/usr/bin/env bash
set -euo pipefail

repo_url="https://github.com/one-moment/mattermost.git"

if [ ! -d ".git" ]; then
  git init
fi

git branch -M main

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$repo_url"
else
  git remote add origin "$repo_url"
fi

git add .
git commit -m "Initial Mattermost project MVP" || true
git push -u origin main
