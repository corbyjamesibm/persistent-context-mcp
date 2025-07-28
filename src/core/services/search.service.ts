/**
 * Full-Text Context Search Service (US-4532)
 * Advanced search capabilities with fuzzy matching, semantic search, and faceted filtering
 */

import { EventEmitter } from 'events';
import { Neo4jContextStore } from '../storage/neo4j-store.js';
import { Context, ContextFilters } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

export interface SearchQuery {
  query: string;
  filters?: ContextFilters;
  facets?: SearchFacets;
  options?: SearchOptions;
}

export interface SearchFacets {
  types?: string[];
  tags?: string[];
  dateRanges?: DateRange[];
  tokenRanges?: TokenRange[];
  users?: string[];
}

export interface SearchOptions {
  fuzzyMatch?: boolean;
  semanticSearch?: boolean;
  highlightMatches?: boolean;
  sortBy?: 'relevance' | 'date' | 'title' | 'tokenCount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}

export interface DateRange {
  name: string;
  start: Date;
  end: Date;
}

export interface TokenRange {
  name: string;
  min: number;
  max: number;
}

export interface SearchResult {
  context: Context;
  score: number;
  highlights: SearchHighlight[];
  matchedFields: string[];
  explanation?: string;
}

export interface SearchHighlight {
  field: string;
  fragments: string[];
  positions: number[];
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  facets: FacetResult[];
  query: SearchQuery;
  executionTime: number;
  suggestions?: string[];
}

export interface FacetResult {
  field: string;
  values: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

export interface SearchIndex {
  contextId: string;
  title: string;
  content: string;
  tokens: string[];
  embeddings?: number[];
  metadata: {
    type: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    tokenCount: number;
    userId: string;
  };
}

export class SearchService extends EventEmitter {
  private contextStore: Neo4jContextStore;
  private searchIndex: Map<string, SearchIndex> = new Map();
  private isIndexing = false;
  private lastIndexUpdate = new Date(0);

  // Search configuration
  private readonly FUZZY_THRESHOLD = 0.7;
  private readonly MAX_SUGGESTIONS = 5;
  private readonly HIGHLIGHT_FRAGMENT_SIZE = 150;
  private readonly INDEX_UPDATE_INTERVAL = 300000; // 5 minutes

  constructor(contextStore: Neo4jContextStore) {
    super();
    this.contextStore = contextStore;
    this.startIndexUpdateTimer();
  }

  /**
   * Perform full-text search across contexts
   */
  async search(searchQuery: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    try {
      logger.info('Performing search:', { query: searchQuery.query, filters: searchQuery.filters });
      
      // Ensure index is up to date
      await this.updateIndexIfNeeded();
      
      // Parse and normalize query
      const normalizedQuery = this.normalizeQuery(searchQuery.query);
      const searchTerms = this.extractSearchTerms(normalizedQuery);
      
      // Get candidate contexts
      let candidates = Array.from(this.searchIndex.values());
      
      // Apply filters
      candidates = this.applyFilters(candidates, searchQuery.filters);
      
      // Perform text matching
      const matchedResults = await this.performTextSearch(candidates, searchTerms, searchQuery.options);
      
      // Apply semantic search if enabled
      if (searchQuery.options?.semanticSearch) {
        matchedResults.forEach(result => {
          result.score += this.calculateSemanticScore(searchTerms, result.context);
        });
      }
      
      // Sort results
      const sortedResults = this.sortResults(matchedResults, searchQuery.options);
      
      // Apply pagination
      const paginatedResults = this.paginateResults(sortedResults, searchQuery.options);
      
      // Generate highlights
      const resultsWithHighlights = this.generateHighlights(paginatedResults, searchTerms, searchQuery.options);
      
      // Calculate facets
      const facets = this.calculateFacets(candidates, searchQuery.facets);
      
      // Generate suggestions
      const suggestions = this.generateSuggestions(searchQuery.query, candidates);
      
      const executionTime = Date.now() - startTime;
      
      const response: SearchResponse = {
        results: resultsWithHighlights,
        totalCount: sortedResults.length,
        facets,
        query: searchQuery,
        executionTime,
        suggestions,
      };
      
      logger.info(`Search completed: ${response.results.length}/${response.totalCount} results in ${executionTime}ms`);
      this.emit('searchCompleted', { query: searchQuery.query, resultCount: response.totalCount, executionTime });
      
      return response;
    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Build or rebuild the search index
   */
  async buildIndex(): Promise<void> {
    if (this.isIndexing) {
      logger.warn('Index building already in progress');
      return;
    }

    this.isIndexing = true;
    const startTime = Date.now();
    
    try {
      logger.info('Building search index...');
      this.emit('indexBuildStarted');
      
      // Clear existing index
      this.searchIndex.clear();
      
      // Get all contexts
      const contexts = await this.contextStore.searchContexts('', {});
      
      // Build index entries
      for (const context of contexts) {
        const indexEntry = await this.createIndexEntry(context);
        this.searchIndex.set(context.id, indexEntry);
      }
      
      this.lastIndexUpdate = new Date();
      const buildTime = Date.now() - startTime;
      
      logger.info(`Search index built: ${this.searchIndex.size} entries in ${buildTime}ms`);
      this.emit('indexBuildCompleted', { entryCount: this.searchIndex.size, buildTime });
    } catch (error) {
      logger.error('Failed to build search index:', error);
      this.emit('indexBuildFailed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Add or update context in search index
   */
  async indexContext(context: Context): Promise<void> {
    try {
      const indexEntry = await this.createIndexEntry(context);
      this.searchIndex.set(context.id, indexEntry);
      logger.debug(`Context indexed: ${context.id}`);
      this.emit('contextIndexed', { contextId: context.id });
    } catch (error) {
      logger.error(`Failed to index context ${context.id}:`, error);
      throw error;
    }
  }

  /**
   * Remove context from search index
   */
  removeFromIndex(contextId: string): void {
    if (this.searchIndex.delete(contextId)) {
      logger.debug(`Context removed from index: ${contextId}`);
      this.emit('contextDeindexed', { contextId });
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    if (partialQuery.length < 2) {
      return [];
    }

    const suggestions: string[] = [];
    const query = partialQuery.toLowerCase();
    
    // Get suggestions from context titles and tags
    for (const indexEntry of this.searchIndex.values()) {
      // Title suggestions
      if (indexEntry.title.toLowerCase().includes(query)) {
        suggestions.push(indexEntry.title);
      }
      
      // Tag suggestions
      for (const tag of indexEntry.metadata.tags) {
        if (tag.toLowerCase().includes(query) && !suggestions.includes(tag)) {
          suggestions.push(tag);
        }
      }
      
      if (suggestions.length >= limit) {
        break;
      }
    }
    
    return suggestions.slice(0, limit);
  }

  /**
   * Get search statistics
   */
  getSearchStats(): {
    indexSize: number;
    lastIndexUpdate: Date;
    isIndexing: boolean;
    totalTokens: number;
    avgTokensPerContext: number;
  } {
    const totalTokens = Array.from(this.searchIndex.values())
      .reduce((sum, entry) => sum + entry.metadata.tokenCount, 0);
    
    return {
      indexSize: this.searchIndex.size,
      lastIndexUpdate: this.lastIndexUpdate,
      isIndexing: this.isIndexing,
      totalTokens,
      avgTokensPerContext: this.searchIndex.size > 0 ? totalTokens / this.searchIndex.size : 0,
    };
  }

  /**
   * Create search index entry for a context
   */
  private async createIndexEntry(context: Context): Promise<SearchIndex> {
    const content = `${context.title} ${context.content}`;
    const tokens = this.tokenizeText(content);
    
    return {
      contextId: context.id,
      title: context.title,
      content: context.content,
      tokens,
      embeddings: await this.generateEmbeddings(content), // Would use actual embedding service
      metadata: {
        type: context.type,
        tags: context.tags,
        createdAt: context.createdAt,
        updatedAt: context.updatedAt,
        tokenCount: context.metadata?.tokenCount || tokens.length,
        userId: context.userId,
      },
    };
  }

  /**
   * Tokenize text for search indexing
   */
  private tokenizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2)
      .filter(token => !this.isStopWord(token));
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'will', 'would',
      'can', 'could', 'should', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those',
    ]);
    return stopWords.has(word);
  }

  /**
   * Normalize search query
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Extract search terms from query
   */
  private extractSearchTerms(query: string): string[] {
    // Handle quoted phrases
    const phrases: string[] = [];
    const quotedPhrases = query.match(/"([^"]+)"/g);
    if (quotedPhrases) {
      phrases.push(...quotedPhrases.map(p => p.replace(/"/g, '')));
      query = query.replace(/"([^"]+)"/g, '');
    }
    
    // Extract individual terms
    const terms = query.split(/\s+/).filter(term => term.length > 0);
    
    return [...phrases, ...terms];
  }

  /**
   * Apply filters to search candidates
   */
  private applyFilters(candidates: SearchIndex[], filters?: ContextFilters): SearchIndex[] {
    if (!filters) return candidates;

    return candidates.filter(candidate => {
      if (filters.type && candidate.metadata.type !== filters.type) return false;
      if (filters.tags && !filters.tags.some(tag => candidate.metadata.tags.includes(tag))) return false;
      if (filters.userId && candidate.metadata.userId !== filters.userId) return false;
      if (filters.dateRange) {
        const createdAt = candidate.metadata.createdAt;
        if (createdAt < filters.dateRange.start || createdAt > filters.dateRange.end) return false;
      }
      return true;
    });
  }

  /**
   * Perform text-based search
   */
  private async performTextSearch(
    candidates: SearchIndex[],
    searchTerms: string[],
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const candidate of candidates) {
      const score = this.calculateTextScore(candidate, searchTerms, options);
      if (score > 0) {
        results.push({
          context: await this.contextStore.getContext(candidate.contextId) as Context,
          score,
          highlights: [],
          matchedFields: this.getMatchedFields(candidate, searchTerms),
          explanation: `Text match score: ${score.toFixed(3)}`,
        });
      }
    }

    return results;
  }

  /**
   * Calculate text matching score
   */
  private calculateTextScore(candidate: SearchIndex, searchTerms: string[], options?: SearchOptions): number {
    let score = 0;
    const fuzzyMatch = options?.fuzzyMatch ?? true;

    for (const term of searchTerms) {
      // Title matching (higher weight)
      if (candidate.title.toLowerCase().includes(term)) {
        score += 3.0;
      } else if (fuzzyMatch && this.fuzzyMatch(candidate.title.toLowerCase(), term)) {
        score += 2.0;
      }

      // Content matching
      if (candidate.content.toLowerCase().includes(term)) {
        score += 1.0;
      } else if (fuzzyMatch && this.fuzzyMatch(candidate.content.toLowerCase(), term)) {
        score += 0.5;
      }

      // Tag matching
      for (const tag of candidate.metadata.tags) {
        if (tag.toLowerCase().includes(term)) {
          score += 2.0;
        } else if (fuzzyMatch && this.fuzzyMatch(tag.toLowerCase(), term)) {
          score += 1.0;
        }
      }

      // Token matching
      if (candidate.tokens.includes(term)) {
        score += 0.5;
      }
    }

    // Normalize by content length
    return score / Math.log(candidate.content.length + 1);
  }

  /**
   * Simple fuzzy matching
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    if (pattern.length === 0) return true;
    if (text.length === 0) return false;

    const distance = this.levenshteinDistance(text, pattern);
    const maxLength = Math.max(text.length, pattern.length);
    const similarity = 1 - (distance / maxLength);
    
    return similarity >= this.FUZZY_THRESHOLD;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator,
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate semantic similarity score (placeholder)
   */
  private calculateSemanticScore(searchTerms: string[], context: Context): number {
    // This would use actual semantic embeddings
    // For now, return a simple heuristic based on related terms
    let score = 0;
    const content = context.content.toLowerCase();
    
    for (const term of searchTerms) {
      // Simple semantic associations
      const associations = this.getSemanticAssociations(term);
      for (const association of associations) {
        if (content.includes(association)) {
          score += 0.2;
        }
      }
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Get semantic associations for a term (simplified)
   */
  private getSemanticAssociations(term: string): string[] {
    const associations: { [key: string]: string[] } = {
      'bug': ['error', 'issue', 'problem', 'defect', 'fix'],
      'feature': ['enhancement', 'functionality', 'capability', 'improvement'],
      'development': ['coding', 'programming', 'implementation', 'build'],
      'testing': ['validation', 'verification', 'quality', 'check'],
      'planning': ['strategy', 'roadmap', 'schedule', 'timeline'],
    };
    
    return associations[term] || [];
  }

  /**
   * Get matched fields for a candidate
   */
  private getMatchedFields(candidate: SearchIndex, searchTerms: string[]): string[] {
    const matchedFields: string[] = [];
    
    for (const term of searchTerms) {
      if (candidate.title.toLowerCase().includes(term)) {
        matchedFields.push('title');
      }
      if (candidate.content.toLowerCase().includes(term)) {
        matchedFields.push('content');
      }
      if (candidate.metadata.tags.some(tag => tag.toLowerCase().includes(term))) {
        matchedFields.push('tags');
      }
    }
    
    return [...new Set(matchedFields)];
  }

  /**
   * Sort search results
   */
  private sortResults(results: SearchResult[], options?: SearchOptions): SearchResult[] {
    const sortBy = options?.sortBy || 'relevance';
    const sortOrder = options?.sortOrder || 'desc';
    
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    
    return results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'relevance':
          comparison = a.score - b.score;
          break;
        case 'date':
          comparison = a.context.updatedAt.getTime() - b.context.updatedAt.getTime();
          break;
        case 'title':
          comparison = a.context.title.localeCompare(b.context.title);
          break;
        case 'tokenCount':
          comparison = (a.context.metadata?.tokenCount || 0) - (b.context.metadata?.tokenCount || 0);
          break;
      }
      
      return comparison * multiplier;
    });
  }

  /**
   * Apply pagination to results
   */
  private paginateResults(results: SearchResult[], options?: SearchOptions): SearchResult[] {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * Generate search highlights
   */
  private generateHighlights(results: SearchResult[], searchTerms: string[], options?: SearchOptions): SearchResult[] {
    if (!options?.highlightMatches) {
      return results;
    }

    return results.map(result => ({
      ...result,
      highlights: this.extractHighlights(result.context, searchTerms),
    }));
  }

  /**
   * Extract highlight fragments from context
   */
  private extractHighlights(context: Context, searchTerms: string[]): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    
    // Highlight in title
    const titleHighlights = this.findHighlightFragments(context.title, searchTerms);
    if (titleHighlights.fragments.length > 0) {
      highlights.push({
        field: 'title',
        fragments: titleHighlights.fragments,
        positions: titleHighlights.positions,
      });
    }
    
    // Highlight in content
    const contentHighlights = this.findHighlightFragments(context.content, searchTerms);
    if (contentHighlights.fragments.length > 0) {
      highlights.push({
        field: 'content',
        fragments: contentHighlights.fragments,
        positions: contentHighlights.positions,
      });
    }
    
    return highlights;
  }

  /**
   * Find highlight fragments in text
   */
  private findHighlightFragments(text: string, searchTerms: string[]): { fragments: string[]; positions: number[] } {
    const fragments: string[] = [];
    const positions: number[] = [];
    
    for (const term of searchTerms) {
      const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const start = Math.max(0, match.index - this.HIGHLIGHT_FRAGMENT_SIZE / 2);
        const end = Math.min(text.length, match.index + term.length + this.HIGHLIGHT_FRAGMENT_SIZE / 2);
        
        let fragment = text.substring(start, end);
        if (start > 0) fragment = '...' + fragment;
        if (end < text.length) fragment = fragment + '...';
        
        fragments.push(fragment);
        positions.push(match.index);
      }
    }
    
    return { fragments, positions };
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Calculate search facets
   */
  private calculateFacets(candidates: SearchIndex[], requestedFacets?: SearchFacets): FacetResult[] {
    const facets: FacetResult[] = [];
    
    // Type facet
    const typeCounts = new Map<string, number>();
    candidates.forEach(candidate => {
      const count = typeCounts.get(candidate.metadata.type) || 0;
      typeCounts.set(candidate.metadata.type, count + 1);
    });
    
    facets.push({
      field: 'type',
      values: Array.from(typeCounts.entries()).map(([value, count]) => ({
        value,
        count,
        selected: requestedFacets?.types?.includes(value) || false,
      })),
    });
    
    // Tag facet
    const tagCounts = new Map<string, number>();
    candidates.forEach(candidate => {
      candidate.metadata.tags.forEach(tag => {
        const count = tagCounts.get(tag) || 0;
        tagCounts.set(tag, count + 1);
      });
    });
    
    facets.push({
      field: 'tags',
      values: Array.from(tagCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([value, count]) => ({
          value,
          count,
          selected: requestedFacets?.tags?.includes(value) || false,
        })),
    });
    
    return facets;
  }

  /**
   * Generate search suggestions
   */
  private generateSuggestions(query: string, candidates: SearchIndex[]): string[] {
    if (query.length < 3) return [];
    
    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();
    
    // Find similar titles and tags
    candidates.forEach(candidate => {
      if (candidate.title.toLowerCase().includes(queryLower)) {
        suggestions.add(candidate.title);
      }
      
      candidate.metadata.tags.forEach(tag => {
        if (tag.toLowerCase().includes(queryLower)) {
          suggestions.add(tag);
        }
      });
    });
    
    return Array.from(suggestions).slice(0, this.MAX_SUGGESTIONS);
  }

  /**
   * Generate embeddings (placeholder)
   */
  private async generateEmbeddings(text: string): Promise<number[]> {
    // This would integrate with an actual embedding service
    // For now, return a simple hash-based vector
    const hash = this.simpleHash(text);
    return Array.from({ length: 100 }, (_, i) => Math.sin(hash + i) * 0.5);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Update search index if needed
   */
  private async updateIndexIfNeeded(): Promise<void> {
    const now = new Date();
    const timeSinceUpdate = now.getTime() - this.lastIndexUpdate.getTime();
    
    if (timeSinceUpdate > this.INDEX_UPDATE_INTERVAL || this.searchIndex.size === 0) {
      await this.buildIndex();
    }
  }

  /**
   * Start periodic index updates
   */
  private startIndexUpdateTimer(): void {
    setInterval(() => {
      if (!this.isIndexing) {
        this.updateIndexIfNeeded().catch(error => {
          logger.error('Periodic index update failed:', error);
        });
      }
    }, this.INDEX_UPDATE_INTERVAL);
  }
}

/**
 * Factory function to create search service
 */
export function createSearchService(contextStore: Neo4jContextStore): SearchService {
  return new SearchService(contextStore);
}