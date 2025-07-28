#!/bin/bash
# Local development setup without containers
# Starts Neo4j and Elasticsearch locally (assuming they're installed)

set -e

echo "🔧 Starting local development environment..."

# Function to check if a service is running
check_service() {
    local service=$1
    local port=$2
    local name=$3
    
    if curl -s "http://localhost:$port" > /dev/null 2>&1; then
        echo "✅ $name is running on port $port"
        return 0
    else
        echo "❌ $name is not running on port $port"
        return 1
    fi
}

# Check for Neo4j
echo "🔍 Checking for Neo4j..."
if check_service "neo4j" 7474 "Neo4j"; then
    echo "   Neo4j Browser: http://localhost:7474"
else
    echo "📦 Neo4j not detected. Please install and start Neo4j:"
    echo "   macOS: brew install neo4j && brew services start neo4j"
    echo "   Linux: Check your distribution's package manager"
    echo "   Manual: Download from https://neo4j.com/download/"
fi

# Check for Elasticsearch (optional)
echo "🔍 Checking for Elasticsearch..."
if check_service "elasticsearch" 9200 "Elasticsearch"; then
    echo "   Elasticsearch API: http://localhost:9200"
else
    echo "⚠️  Elasticsearch not detected (optional for advanced search)"
    echo "   macOS: brew install elasticsearch && brew services start elasticsearch"
    echo "   Linux: Check your distribution's package manager"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    # Update for local development
    sed -i.bak 's|bolt://neo4j:7687|bolt://localhost:7687|' .env
    sed -i.bak 's|http://elasticsearch:9200|http://localhost:9200|' .env
    rm .env.bak 2>/dev/null || true
    echo "✅ Created .env file configured for local development"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

echo ""
echo "🚀 Local development setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Start the API server: npm start"
echo "   2. In another terminal, start the UI: npm run dev"
echo "   3. Access the app at: http://localhost:3000"
echo ""
echo "🔗 Service URLs:"
echo "   • API Server: http://localhost:3001"
echo "   • Neo4j Browser: http://localhost:7474"
echo "   • Elasticsearch: http://localhost:9200 (if running)"