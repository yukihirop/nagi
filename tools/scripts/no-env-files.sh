#!/bin/bash
if git diff --cached --name-only | grep -qE '(^|/)\.env$'; then
  echo "ERROR: .env file staged for commit!"
  git diff --cached --name-only | grep -E '(^|/)\.env$'
  echo "Remove with: git reset HEAD <file>"
  exit 1
fi
