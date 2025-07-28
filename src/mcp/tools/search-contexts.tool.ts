/**
 * Search Contexts MCP Tool (US-4532)
 * Provides advanced search capabilities to AI assistants
 */

import { z } from 'zod';
import { SearchService, SearchQuery, SearchOptions, SearchFacets } from '../../core/services/search.service.js';
import { ContextFilters, ContextType } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

// Input validation schemas
export const SearchContextsInputSchema = z.object({
  query: z.string().min(1).max(500),
  filters: z.object({
    type: z.nativeEnum(ContextType).optional(),
    tags: z.array(z.string()).optional(),
    dateRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }).optional(),
    userId: z.string().optional(),
  }).optional(),
  facets: z.object({
    types: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    dateRanges: z.array(z.object({
      name: z.string(),
      start: z.string().datetime(),
      end: z.string().datetime(),
    })).optional(),
    tokenRanges: z.array(z.object({
      name: z.string(),
      min: z.number(),
      max: z.number(),
    })).optional(),
    users: z.array(z.string()).optional(),
  }).optional(),
  options: z.object({
    fuzzyMatch: z.boolean().optional(),
    semanticSearch: z.boolean().optional(),
    highlightMatches: z.boolean().optional(),
    sortBy: z.enum(['relevance', 'date', 'title', 'tokenCount']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.number().min(1).max(100).optional(),
    offset: z.number().min(0).optional(),
    includeArchived: z.boolean().optional(),
  }).optional(),
});

export const QuickSearchInputSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().min(1).max(20).optional(),
});

export const GetSuggestionsInputSchema = z.object({
  partialQuery: z.string().min(1).max(50),
  limit: z.number().min(1).max(10).optional(),
});

// Output schemas
export const SearchContextsOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    context: z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      type: z.string(),
      tags: z.array(z.string()),
      createdAt: z.string(),
      updatedAt: z.string(),
      userId: z.string(),
      tokenCount: z.number().optional(),
    }),
    score: z.number(),
    highlights: z.array(z.object({
      field: z.string(),
      fragments: z.array(z.string()),
      positions: z.array(z.number()),
    })),
    matchedFields: z.array(z.string()),
    explanation: z.string().optional(),
  })).optional(),
  totalCount: z.number().optional(),
  facets: z.array(z.object({
    field: z.string(),
    values: z.array(z.object({
      value: z.string(),
      count: z.number(),
      selected: z.boolean(),
    })),
  })).optional(),
  executionTime: z.number().optional(),
  suggestions: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export const QuickSearchOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    score: z.number(),
    snippet: z.string(),
  })).optional(),
  error: z.string().optional(),
});

export const GetSuggestionsOutputSchema = z.object({
  success: z.boolean(),
  suggestions: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export class SearchContextsTool {
  private searchService: SearchService;

  constructor(searchService: SearchService) {
    this.searchService = searchService;
  }

  /**
   * MCP Tool: Full-featured context search
   */
  async searchContexts(input: unknown): Promise<unknown> {
    try {
      const validatedInput = SearchContextsInputSchema.parse(input);
      logger.info('Performing context search:', {
        query: validatedInput.query,
        hasFilters: !!validatedInput.filters,
        hasFacets: !!validatedInput.facets,
        options: validatedInput.options,
      });

      // Convert input to SearchQuery
      const searchQuery: SearchQuery = {
        query: validatedInput.query,
        filters: this.convertFilters(validatedInput.filters),
        facets: this.convertFacets(validatedInput.facets),
        options: this.convertOptions(validatedInput.options),
      };

      const searchResponse = await this.searchService.search(searchQuery);

      const result = {
        success: true,
        results: searchResponse.results.map(result => ({
          context: {
            id: result.context.id,
            title: result.context.title,
            content: result.context.content,
            type: result.context.type,
            tags: result.context.tags,
            createdAt: result.context.createdAt.toISOString(),
            updatedAt: result.context.updatedAt.toISOString(),
            userId: result.context.userId,
            tokenCount: result.context.metadata?.tokenCount,
          },
          score: result.score,
          highlights: result.highlights,
          matchedFields: result.matchedFields,
          explanation: result.explanation,
        })),
        totalCount: searchResponse.totalCount,
        facets: searchResponse.facets,
        executionTime: searchResponse.executionTime,
        suggestions: searchResponse.suggestions,
      };

      logger.info(`Search completed: ${result.results.length}/${result.totalCount} results in ${result.executionTime}ms`);
      return SearchContextsOutputSchema.parse(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Context search failed:', error);
      
      return SearchContextsOutputSchema.parse({
        success: false,
        error: `Search failed: ${errorMessage}`,
      });
    }
  }

  /**
   * MCP Tool: Quick search for fast results
   */
  async quickSearch(input: unknown): Promise<unknown> {
    try {
      const validatedInput = QuickSearchInputSchema.parse(input);
      logger.info('Performing quick search:', { query: validatedInput.query });

      const searchQuery: SearchQuery = {
        query: validatedInput.query,
        options: {
          fuzzyMatch: true,
          semanticSearch: false,
          highlightMatches: false,
          sortBy: 'relevance',
          sortOrder: 'desc',
          limit: validatedInput.limit || 10,
          offset: 0,
        },
      };

      const searchResponse = await this.searchService.search(searchQuery);

      const result = {
        success: true,
        results: searchResponse.results.map(result => ({
          id: result.context.id,
          title: result.context.title,
          type: result.context.type,
          score: result.score,
          snippet: this.createSnippet(result.context.content, validatedInput.query),
        })),
      };

      logger.info(`Quick search completed: ${result.results.length} results`);
      return QuickSearchOutputSchema.parse(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Quick search failed:', error);
      
      return QuickSearchOutputSchema.parse({
        success: false,
        error: `Quick search failed: ${errorMessage}`,
      });
    }
  }

  /**
   * MCP Tool: Get search suggestions
   */
  async getSuggestions(input: unknown): Promise<unknown> {
    try {
      const validatedInput = GetSuggestionsInputSchema.parse(input);
      logger.info('Getting search suggestions:', { query: validatedInput.partialQuery });

      const suggestions = await this.searchService.getSuggestions(
        validatedInput.partialQuery,
        validatedInput.limit || 5
      );

      const result = {
        success: true,
        suggestions,
      };

      logger.info(`Suggestions retrieved: ${suggestions.length} items`);
      return GetSuggestionsOutputSchema.parse(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Get suggestions failed:', error);
      
      return GetSuggestionsOutputSchema.parse({
        success: false,
        error: `Failed to get suggestions: ${errorMessage}`,
      });
    }
  }

  /**
   * MCP Tool: Get search statistics
   */
  async getSearchStats(): Promise<unknown> {
    try {
      logger.info('Getting search statistics');

      const stats = this.searchService.getSearchStats();

      const result = {
        success: true,
        stats: {
          indexSize: stats.indexSize,
          lastIndexUpdate: stats.lastIndexUpdate.toISOString(),
          isIndexing: stats.isIndexing,
          totalTokens: stats.totalTokens,
          avgTokensPerContext: Math.round(stats.avgTokensPerContext),
        },
      };

      logger.info('Search statistics retrieved');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Get search stats failed:', error);
      
      return {
        success: false,
        error: `Failed to get search statistics: ${errorMessage}`,
      };
    }
  }

  /**
   * MCP Tool: Rebuild search index
   */
  async rebuildSearchIndex(): Promise<unknown> {
    try {
      logger.info('Rebuilding search index');

      await this.searchService.buildIndex();

      const result = {
        success: true,
        message: 'Search index rebuilt successfully',
      };

      logger.info('Search index rebuild completed');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Index rebuild failed:', error);
      
      return {
        success: false,
        error: `Failed to rebuild search index: ${errorMessage}`,
      };
    }
  }

  /**
   * Convert input filters to internal format
   */
  private convertFilters(filters?: any): ContextFilters | undefined {
    if (!filters) return undefined;

    return {
      type: filters.type,
      tags: filters.tags,
      dateRange: filters.dateRange ? {
        start: new Date(filters.dateRange.start),
        end: new Date(filters.dateRange.end),
      } : undefined,
      userId: filters.userId,
    };
  }

  /**
   * Convert input facets to internal format
   */
  private convertFacets(facets?: any): SearchFacets | undefined {
    if (!facets) return undefined;

    return {
      types: facets.types,
      tags: facets.tags,
      dateRanges: facets.dateRanges?.map((range: any) => ({
        name: range.name,
        start: new Date(range.start),
        end: new Date(range.end),
      })),
      tokenRanges: facets.tokenRanges,
      users: facets.users,
    };
  }

  /**
   * Convert input options to internal format
   */
  private convertOptions(options?: any): SearchOptions | undefined {
    if (!options) return undefined;

    return {
      fuzzyMatch: options.fuzzyMatch ?? true,
      semanticSearch: options.semanticSearch ?? false,
      highlightMatches: options.highlightMatches ?? true,
      sortBy: options.sortBy || 'relevance',
      sortOrder: options.sortOrder || 'desc',
      limit: options.limit || 20,
      offset: options.offset || 0,
      includeArchived: options.includeArchived ?? false,
    };
  }

  /**
   * Create content snippet for quick search results
   */
  private createSnippet(content: string, query: string, maxLength: number = 150): string {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Find the first occurrence of the query term
    const index = contentLower.indexOf(queryLower);
    
    if (index === -1) {
      // If query not found, return beginning of content
      return content.length > maxLength 
        ? content.substring(0, maxLength) + '...'
        : content;
    }
    
    // Create snippet around the found term
    const start = Math.max(0, index - maxLength / 2);
    const end = Math.min(content.length, start + maxLength);
    
    let snippet = content.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }
}

/**
 * Factory function to create search contexts tool
 */
export function createSearchContextsTool(searchService: SearchService): SearchContextsTool {
  return new SearchContextsTool(searchService);
}