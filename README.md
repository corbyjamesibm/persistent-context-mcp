# Persistent Context Store

A sophisticated context management system for AI conversations using Neo4j graph database and IBM Carbon Design System. This system enables persistent storage, intelligent retrieval, and visualization of conversation contexts to maintain continuity across AI sessions.

## 🚀 Features

- **📊 Graph-Based Storage**: Neo4j database for complex relationship modeling
- **🎨 Modern UI**: IBM Carbon Design System with AI-enhanced components  
- **🔍 Advanced Search**: Full-text and semantic search capabilities
- **📝 Template Management**: Extract and reuse successful prompt patterns
- **🤖 MCP Integration**: Model Context Protocol server for AI assistant integration
- **📈 Analytics**: Usage metrics and conversation pattern analysis
- **🔄 BMad Workflow**: Multi-agent collaboration support

## 📋 Project Structure

```
persistent-context-store/
├── src/
│   ├── core/                    # Core business logic
│   │   ├── storage/            # Neo4j storage implementation
│   │   ├── retrieval/          # Context retrieval logic
│   │   └── validation/         # Data validation
│   ├── api/                    # Express.js API server
│   │   ├── routes/             # API route handlers
│   │   ├── middleware/         # Express middleware
│   │   └── types/              # API type definitions
│   ├── ui/                     # React frontend
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page components
│   │   ├── hooks/              # Custom React hooks
│   │   └── styles/             # SCSS stylesheets
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Utility functions
│   └── tests/                  # Test files
├── docs/                       # Documentation
├── config/                     # Configuration files
├── scripts/                    # Build and deployment scripts
└── examples/                   # Usage examples
```

## 🛠️ Technology Stack

### Backend
- **Node.js** with TypeScript
- **Neo4j** graph database
- **Express.js** API server
- **Elasticsearch** for search functionality
- **Winston** for logging

### Frontend  
- **React 18** with TypeScript
- **IBM Carbon Design System**
- **D3.js** for graph visualization
- **Vite** for development and building

### Development
- **ESLint** for code linting
- **Jest** for testing
- **Docker** for containerization

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Neo4j >= 5.0.0
- Elasticsearch >= 8.0.0 (optional, for advanced search)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/digital-design-team/persistent-context-store.git
   cd persistent-context-store
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Neo4j and other configuration
   ```

4. **Start Neo4j database**
   ```bash
   # Using Docker
   docker run -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/password neo4j:5.15
   ```

5. **Run the development servers**
   ```bash
   # Start the API server
   npm run dev

   # In another terminal, start the UI development server
   npm run dev:ui
   ```

6. **Access the application**
   - UI: http://localhost:3000
   - API: http://localhost:3001/api/v1

## 📚 API Documentation

### Core Endpoints

#### Contexts
- `GET /api/v1/contexts` - List all contexts
- `POST /api/v1/contexts` - Create new context
- `GET /api/v1/contexts/:id` - Get specific context
- `PUT /api/v1/contexts/:id` - Update context
- `DELETE /api/v1/contexts/:id` - Delete context

#### Templates
- `GET /api/v1/templates` - List templates
- `POST /api/v1/templates` - Create template
- `POST /api/v1/templates/extract` - Extract template from context

#### Search
- `GET /api/v1/search?q=query` - Full-text search
- `POST /api/v1/search/semantic` - Semantic search
- `GET /api/v1/relationships/:id` - Get context relationships

### MCP Server Integration

The persistent context store implements the Model Context Protocol (MCP) for AI assistant integration:

```typescript
// Available MCP tools
- save_context(data: ContextData): Promise<string>
- load_context(id: string): Promise<ContextData>
- search_contexts(query: string): Promise<ContextData[]>
- list_contexts(filters?: ContextFilters): Promise<ContextData[]>
```

## 🎨 UI Components

Built with IBM Carbon Design System:

### Core Components
- **ContextCard**: Display context summaries with AI enhancements
- **GraphVisualization**: Interactive D3.js knowledge graph
- **TemplateLibrary**: Browse and apply prompt templates
- **SearchInterface**: Advanced search with filters
- **AnalyticsDashboard**: Usage metrics and insights

### AI-Enhanced Features
- Gradient borders for AI-generated content
- Smart context suggestions
- Pattern recognition insights
- Contextual recommendations

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run type checking
npm run typecheck

# Run linting
npm run lint
```

## 📦 Building for Production

```bash
# Build both API and UI
npm run build

# Start production server
npm start
```

## 🐳 Docker Deployment

```bash
# Build Docker image
docker build -t persistent-context-store .

# Run with docker-compose
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Use IBM Carbon Design System components
- Write comprehensive tests
- Follow semantic commit conventions
- Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Issues**: [GitHub Issues](https://github.com/digital-design-team/persistent-context-store/issues)
- **Documentation**: [Project Wiki](https://github.com/digital-design-team/persistent-context-store/wiki)
- **Team**: Digital Design Team

## 🗺️ Roadmap

### Phase 1: Core Context Management (Weeks 1-4)
- ✅ Neo4j storage implementation
- ✅ Basic UI with Carbon components
- ✅ MCP server integration
- ⏳ Context CRUD operations

### Phase 2: Template & Search (Weeks 5-8)
- ⏳ Template extraction and management
- ⏳ Full-text search with Elasticsearch
- ⏳ Advanced filtering and sorting
- ⏳ Template library interface

### Phase 3: Advanced Features (Weeks 9-12)
- ⏳ Semantic search and recommendations
- ⏳ Knowledge graph visualization
- ⏳ BMad agent workflow integration
- ⏳ Analytics dashboard

### Phase 4: Intelligence & Optimization (Weeks 13-16)
- ⏳ Pattern recognition ML models
- ⏳ Predictive context suggestions
- ⏳ Performance optimization
- ⏳ Advanced analytics

---

Built with ❤️ by the Digital Design Team