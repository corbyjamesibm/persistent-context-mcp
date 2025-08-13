# Publishing Persistent Context MCP

## ✅ Current Status
- Package prepared and committed locally
- SSH authentication to GitHub confirmed (user: corbyjamesibm)
- Ready to create repository and publish

## 📋 Steps to Complete

### 1. Create GitHub Repository

Since you have SSH access configured, you have two options:

#### Option A: Via GitHub Web Interface
1. Go to https://github.com/new
2. Repository name: `persistent-context-mcp`
3. Description: "AI memory management and context persistence system with MCP server for Claude Desktop"
4. Make it **Public**
5. Don't initialize with README (we already have one)
6. Click "Create repository"

#### Option B: Via GitHub CLI (if you set up a token)
```bash
# Set GitHub token (get from https://github.com/settings/tokens)
export GH_TOKEN=your-github-token

# Create repository
gh repo create corbyjames/persistent-context-mcp --public \
  --description "AI memory management and context persistence system with MCP server for Claude Desktop"
```

### 2. Push to GitHub

After creating the repository, push your code:

```bash
# The remote is already set up for SSH
cd /Users/corbyjames/cpmcp/apptio-target-process-mcp/persistent-context-store

# Push to GitHub
git push -u origin main
```

### 3. Add Repository Topics (Optional)

On GitHub, add topics to help discovery:
- mcp
- claude
- ai
- neo4j
- context-management
- knowledge-graph

### 4. Publish to npm

```bash
# Make sure you're logged in to npm
npm login
# Username: corbyjames (or your npm username)
# Password: your-npm-password
# Email: your-email

# Build the package first
npm run build

# Publish to npm registry
npm publish --access public
```

### 5. Verify Installation

Test that the package works:

```bash
# Test global installation
npm install -g @corbyjames/persistent-context-mcp

# Verify CLI works
persistent-context --version
persistent-context --help

# Test npx
npx @corbyjames/persistent-context-mcp init
```

### 6. Update Claude Desktop Configuration

Test the Claude Desktop integration:

```bash
# Run the setup command
persistent-context claude-setup

# Or manually add to ~/Library/Application Support/Claude/claude_desktop_config.json:
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

## 📦 Package Information

- **npm Package**: `@corbyjames/persistent-context-mcp`
- **Version**: 1.0.0
- **GitHub**: `https://github.com/corbyjames/persistent-context-mcp`
- **CLI Commands**: `persistent-context` or `pcmcp`

## 🎯 Quick Test Commands

After publishing, users can:

```bash
# Quick start with npx (no install needed)
npx @corbyjames/persistent-context-mcp init

# Or install globally
npm install -g @corbyjames/persistent-context-mcp
persistent-context init --claude
persistent-context neo4j start
persistent-context start --ui
```

## 📝 Notes

- The package includes Neo4j as a dependency
- Docker/Podman configurations are included
- Environment variables are used for configuration
- The `.env.example` file provides a template
- Secrets should be stored in a secure vault for production use

## 🔒 Security Reminders

1. Change default Neo4j password
2. Use proper secret management (AWS Secrets Manager, Azure Key Vault, etc.)
3. Enable TLS/SSL in production
4. Implement authentication for the web UI
5. Review and update security groups/firewall rules