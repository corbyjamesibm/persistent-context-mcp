#!/bin/bash
# Podman cleanup script for Persistent Context Store

set -e

echo "🧹 Cleaning up Persistent Context Store Podman resources..."

# Stop and remove containers
echo "🛑 Stopping containers..."
podman-compose -f podman-compose.yml down

# Remove volumes (optional - prompts user)
read -p "🗂️  Remove persistent data volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing volumes..."
    podman-compose -f podman-compose.yml down -v
    echo "✅ Volumes removed"
else
    echo "📦 Volumes preserved"
fi

# Remove images (optional - prompts user)
read -p "🖼️  Remove downloaded images? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing images..."
    podman rmi neo4j:5.15-community docker.elastic.co/elasticsearch/elasticsearch:8.11.0 2>/dev/null || true
    echo "✅ Images removed"
else
    echo "🖼️  Images preserved"
fi

echo "🎉 Cleanup complete!"