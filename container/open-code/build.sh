#!/bin/bash
# Build the Nagi agent container image (Open Code variant)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

IMAGE_NAME="nagi-agent-opencode"
TAG="${1:-latest}"
CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-docker}"

echo "Building Nagi agent container image (Open Code)..."
echo "Image: ${IMAGE_NAME}:${TAG}"

${CONTAINER_RUNTIME} build -f container/open-code/Dockerfile -t "${IMAGE_NAME}:${TAG}" .

echo ""
echo "Build complete!"
echo "Image: ${IMAGE_NAME}:${TAG}"
echo ""
echo "To use this image, set CONTAINER_IMAGE=nagi-agent-opencode:latest in .env"
echo "or configure container.image in nagi config."
