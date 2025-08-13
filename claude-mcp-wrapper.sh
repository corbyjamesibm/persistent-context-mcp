#!/bin/bash
# Wrapper script for Claude Desktop MCP server

export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="neo4j123"
export NODE_ENV="production"
export LOG_LEVEL="error"

cd /Users/corbyjames/cpmcp/apptio-target-process-mcp/persistent-context-store
exec node dist/mcp-server.js