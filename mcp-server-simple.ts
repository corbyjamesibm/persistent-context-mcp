#!/usr/bin/env tsx
/**
 * Simplified MCP Server for Persistent Context Store
 * Provides basic context management capabilities
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// In-memory store for testing
const contexts = new Map<string, any>();
let contextCounter = 0;

// Tool definitions
const TOOLS = [
  {
    name: 'store_context',
    description: 'Store a new context with metadata',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The context content to store',
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata for the context',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
            source: { type: 'string' },
            importance: { type: 'string' },
          },
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'retrieve_context',
    description: 'Retrieve a stored context by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the context to retrieve',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_contexts',
    description: 'List all stored contexts',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of contexts to return',
          default: 10,
        },
      },
    },
  },
  {
    name: 'search_contexts',
    description: 'Search contexts by content or metadata',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
      },
      required: ['query'],
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'persistent-context-store',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'store_context': {
        const id = `ctx_${++contextCounter}`;
        const context = {
          id,
          content: args.content,
          metadata: args.metadata || {},
          createdAt: new Date().toISOString(),
        };
        contexts.set(id, context);
        return {
          content: [
            {
              type: 'text',
              text: `Context stored successfully with ID: ${id}`,
            },
          ],
        };
      }

      case 'retrieve_context': {
        const context = contexts.get(args.id);
        if (!context) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Context not found: ${args.id}`
          );
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(context, null, 2),
            },
          ],
        };
      }

      case 'list_contexts': {
        const limit = args.limit || 10;
        const allContexts = Array.from(contexts.values())
          .slice(0, limit)
          .map(ctx => ({
            id: ctx.id,
            createdAt: ctx.createdAt,
            tags: ctx.metadata?.tags || [],
          }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(allContexts, null, 2),
            },
          ],
        };
      }

      case 'search_contexts': {
        const query = args.query.toLowerCase();
        const results = Array.from(contexts.values())
          .filter(ctx => {
            const contentMatch = ctx.content.toLowerCase().includes(query);
            const tagMatch = args.tags 
              ? args.tags.some((tag: string) => ctx.metadata?.tags?.includes(tag))
              : true;
            return contentMatch && tagMatch;
          })
          .map(ctx => ({
            id: ctx.id,
            excerpt: ctx.content.substring(0, 100) + '...',
            tags: ctx.metadata?.tags || [],
          }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error}`
    );
  }
});

// Main function
async function main() {
  console.error('Starting Persistent Context Store MCP Server (simplified)...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('MCP Server running (in-memory storage)');
}

// Error handling
process.on('SIGINT', async () => {
  console.error('Shutting down...');
  await server.close();
  process.exit(0);
});

// Start server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});