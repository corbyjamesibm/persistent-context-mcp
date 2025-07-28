#!/bin/bash
# Podman setup script for Persistent Context Store

set -e

echo "🚀 Setting up Persistent Context Store with Podman..."

# Check if podman is installed
if ! command -v podman &> /dev/null; then
    echo "❌ Podman is not installed. Please install Podman first:"
    echo "   macOS: brew install podman"
    echo "   Linux: Check your distribution's package manager"
    exit 1
fi

# Check if podman-compose is installed
if ! command -v podman-compose &> /dev/null; then
    echo "❌ podman-compose is not installed. Installing..."
    pip3 install podman-compose
fi

# Initialize podman machine if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Detected macOS, checking Podman machine..."
    if ! podman machine list | grep -q "running"; then
        echo "📦 Initializing Podman machine..."
        podman machine init
        podman machine start
    fi
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file. Please update with your configuration."
fi

# Start services
echo "🔄 Starting services with Podman Compose..."
podman-compose -f podman-compose.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
if podman-compose -f podman-compose.yml ps | grep -q "healthy"; then
    echo "✅ Services are running successfully!"
    echo ""
    echo "🌐 Access points:"
    echo "   Neo4j Browser: http://localhost:7474"
    echo "   Elasticsearch: http://localhost:9200"
    echo ""
    echo "📚 Next steps:"
    echo "   1. Install dependencies: npm install"
    echo "   2. Build the project: npm run build"
    echo "   3. Start the API server: npm start"
    echo "   4. Start the UI: npm run dev"
else
    echo "⚠️  Some services may not be ready yet. Check with: podman-compose -f podman-compose.yml ps"
fi

echo "🎉 Setup complete!"