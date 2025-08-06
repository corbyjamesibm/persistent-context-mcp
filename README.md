# @corbyjames/persistent-context-mcp

[![npm version](https://badge.fury.io/js/@corbyjames%2Fpersistent-context-mcp.svg)](https://www.npmjs.com/package/@corbyjames/persistent-context-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@corbyjames/persistent-context-mcp.svg)](https://nodejs.org)

AI memory management and context persistence system with Model Context Protocol (MCP) server for Claude Desktop and other AI assistants.

## 🌟 Features

- **Persistent Context Storage**: Store and retrieve conversation contexts using Neo4j graph database
- **MCP Server Integration**: Full compatibility with Claude Desktop via Model Context Protocol
- **Web UI**: Interactive dashboard for managing contexts and visualizing relationships
- **Multi-Storage Support**: Neo4j for graph relationships, file system for backups
- **AI Integration**: Optional OpenAI/Anthropic API support for semantic search
- **Docker/Podman Support**: Containerized deployment options
- **CLI Tool**: Global command-line interface for easy management

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g @corbyjames/persistent-context-mcp

# Or using npx (no installation required)
npx @corbyjames/persistent-context-mcp init
```

### Initialize Configuration

```bash
# Interactive setup
persistent-context init

# With Claude Desktop integration
persistent-context init --claude

# With Docker configuration
persistent-context init --docker
```

### Start Services

```bash
# Start Neo4j database
persistent-context neo4j start

# Start MCP server
persistent-context start

# Start with UI
persistent-context start --ui

# Or run as daemon
persistent-context start --daemon
```

## 🔧 Claude Desktop Integration

### Automatic Setup

```bash
persistent-context claude-setup
```

This will automatically configure Claude Desktop to use the MCP server.

### Manual Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "persistent-context": {
      "command": "persistent-context",
      "args": ["start"],
      "env": {
        "PORT": "3000"
      }
    }
  }
}
```

**Note**: Restart Claude Desktop after configuration.

## 🐳 Docker/Podman Deployment

### Using Docker

```bash
# Generate docker-compose.yml
persistent-context container docker

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Using Podman

```bash
# Generate podman-compose.yml
persistent-context container podman

# Start services
podman-compose up -d

# View logs
podman-compose logs -f
```

### Pre-built Docker Image

```bash
docker run -d \
  --name persistent-context \
  -p 3000:3000 \
  -p 5173:5173 \
  -e NEO4J_URI=bolt://neo4j:7687 \
  -e NEO4J_USER=neo4j \
  -e NEO4J_PASSWORD=password \
  corbyjames/persistent-context-mcp:latest
```

## 📁 Configuration

### Environment Variables

Create a `.env` file in your project directory:

```env
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Data Storage
DATA_DIR=~/.persistent-context
BACKUP_DIR=~/.persistent-context/backups

# Optional: AI Integration
OPENAI_API_KEY=your-api-key

# Security - Store in secure vault for production
SECRETS_PATH=~/.persistent-context/secrets
```

### Secrets Management

For production deployments, we recommend storing secrets using:

- **AWS Secrets Manager**
  ```bash
  aws secretsmanager create-secret \
    --name persistent-context/neo4j \
    --secret-string '{"password":"secure-password"}'
  ```

- **Azure Key Vault**
  ```bash
  az keyvault secret set \
    --vault-name mykeyvault \
    --name neo4j-password \
    --value "secure-password"
  ```

- **HashiCorp Vault**
  ```bash
  vault kv put secret/persistent-context \
    neo4j_password="secure-password"
  ```

- **Kubernetes Secrets**
  ```bash
  kubectl create secret generic persistent-context \
    --from-literal=neo4j-password=secure-password
  ```

## 🖥️ CLI Commands

### Core Commands

```bash
# Initialize configuration
persistent-context init [options]
  --claude    Setup for Claude Desktop
  --docker    Generate Docker config
  --podman    Generate Podman config

# Start MCP server
persistent-context start [options]
  -d, --daemon    Run as daemon
  --ui            Also start the UI

# Start web UI
persistent-context ui [options]
  -p, --port    UI port (default: 5173)

# Manage Neo4j
persistent-context neo4j <action>
  start    Start Neo4j container
  stop     Stop Neo4j container
  status   Check Neo4j status

# Setup Claude Desktop
persistent-context claude-setup

# Generate container config
persistent-context container <runtime>
  docker    Generate docker-compose.yml
  podman    Generate podman-compose.yml
```

### Short Alias

You can also use the short alias `pcmcp`:

```bash
pcmcp init
pcmcp start
pcmcp ui
```

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Claude Desktop │────▶│  MCP Server  │────▶│    Neo4j    │
└─────────────────┘     └──────────────┘     └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Web UI     │
                        └──────────────┘
```

### Components

- **MCP Server**: Implements Model Context Protocol for AI assistants
- **Neo4j Database**: Stores contexts as a knowledge graph
- **Web UI**: React-based dashboard for visualization
- **CLI Tool**: Command-line interface for management

## 🔌 MCP Tools Available

When integrated with Claude Desktop, the following tools are available:

### save_context
Save a new context to the persistent store.

```typescript
{
  title: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, any>;
}
```

### search_contexts
Search for contexts using semantic or keyword search.

```typescript
{
  query: string;
  limit?: number;
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}
```

### generate_template
Generate a context template for specific use cases.

```typescript
{
  type: 'technical' | 'business' | 'analysis' | 'planning';
  domain?: string;
  includeExamples?: boolean;
}
```

## 📊 Web UI Features

Access the web UI at `http://localhost:5173` (when running with `--ui` flag):

- **Dashboard**: Overview of stored contexts and statistics
- **Context Browser**: Search and browse all contexts
- **Graph Visualization**: Interactive knowledge graph
- **Templates**: Pre-built context templates
- **Analytics**: Usage patterns and insights
- **Settings**: Configuration management

## 🔒 Security Considerations

1. **Default Credentials**: Change default Neo4j password immediately
2. **Network Security**: Use TLS/SSL in production
3. **Access Control**: Implement authentication for web UI
4. **Data Encryption**: Enable encryption at rest for Neo4j
5. **Secrets Management**: Use proper secret vaults in production

## 🧪 Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

## 📦 Building from Source

```bash
# Clone repository
git clone https://github.com/corbyjames/persistent-context-mcp.git
cd persistent-context-mcp

# Install dependencies
npm install

# Build project
npm run build

# Run locally
npm start
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for Claude and MCP protocol
- [Neo4j](https://neo4j.com) for the graph database
- [IBM TargetProcess](https://www.targetprocess.com) for project management inspiration
- Open source community for various dependencies

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/corbyjames/persistent-context-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/corbyjames/persistent-context-mcp/discussions)
- **Email**: corby.james@example.com

## 🗺️ Roadmap

- [ ] Multi-user support with authentication
- [ ] Cloud deployment templates (AWS, Azure, GCP)
- [ ] Additional AI model integrations
- [ ] Export/Import functionality
- [ ] Context versioning and history
- [ ] Collaborative context editing
- [ ] Mobile app support

---

Made with ❤️ by Corby James