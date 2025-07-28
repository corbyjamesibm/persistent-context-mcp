/**
 * Semantic Search Service
 * Provides advanced search capabilities including vector similarity search,
 * semantic understanding, and intelligent query processing
 */

import { Context } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

export interface SemanticSearchRequest {
  query: string;
  filters?: {
    type?: string;
    tags?: string[];
    importance?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    sessionId?: string;
    userId?: string;
  };
  options?: {
    limit?: number;
    offset?: number;
    threshold?: number; // Similarity threshold (0-1)
    includeEmbeddings?: boolean;
    hybridSearch?: boolean; // Combine vector and text search
    rerank?: boolean; // Re-rank results using advanced scoring
  };
}

export interface SemanticSearchResult {
  context: Context;
  score: number;
  semanticScore?: number;
  textScore?: number;
  explanation?: string;
  highlights?: {
    title?: string[];
    content?: string[];
  };
  relatedConcepts?: string[];
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  totalCount: number;
  executionTime: number;
  searchMetadata: {
    query: string;
    processedQuery: string;
    searchType: 'semantic' | 'hybrid' | 'text';
    conceptsExtracted: string[];
    queryEmbedding?: number[];
  };
  suggestions?: string[];
  facets?: Record<string, Record<string, number>>;
}

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  getEmbeddingDimensions(): number;
}

export interface QueryProcessor {
  processQuery(query: string): Promise<{
    processedQuery: string;
    concepts: string[];
    intent: string;
    entities: Array<{
      text: string;
      type: string;
      confidence: number;
    }>;
  }>;
}

export class SemanticSearchService {
  private embeddingProvider?: EmbeddingProvider;
  private queryProcessor?: QueryProcessor;
  private vectorIndex: Map<string, number[]> = new Map();
  private conceptGraph: Map<string, Set<string>> = new Map();

  constructor(
    embeddingProvider?: EmbeddingProvider,
    queryProcessor?: QueryProcessor
  ) {
    this.embeddingProvider = embeddingProvider;
    this.queryProcessor = queryProcessor;
    this.initializeConceptGraph();
  }

  /**
   * Perform semantic search with advanced capabilities
   */
  async search(
    request: SemanticSearchRequest,
    contexts: Context[]
  ): Promise<SemanticSearchResponse> {
    const startTime = Date.now();
    logger.info('Starting semantic search', { query: request.query });

    try {
      // Process the query to extract concepts and intent
      const queryData = await this.processSearchQuery(request.query);
      
      // Generate query embedding if semantic search is enabled
      const queryEmbedding = this.embeddingProvider
        ? await this.embeddingProvider.generateEmbedding(queryData.processedQuery)
        : undefined;

      // Filter contexts based on basic filters
      const filteredContexts = this.applyBasicFilters(contexts, request.filters);

      // Perform the search based on available capabilities
      let results: SemanticSearchResult[];
      let searchType: 'semantic' | 'hybrid' | 'text';

      if (queryEmbedding && request.options?.hybridSearch !== false) {
        // Hybrid search: combine semantic and text-based search
        results = await this.performHybridSearch(
          filteredContexts,
          request.query,
          queryData,
          queryEmbedding,
          request.options
        );
        searchType = 'hybrid';
      } else if (queryEmbedding) {
        // Pure semantic search using embeddings
        results = await this.performSemanticSearch(
          filteredContexts,
          queryEmbedding,
          request.options
        );
        searchType = 'semantic';
      } else {
        // Fallback to enhanced text search
        results = await this.performEnhancedTextSearch(
          filteredContexts,
          request.query,
          queryData,
          request.options
        );
        searchType = 'text';
      }

      // Re-rank results if requested
      if (request.options?.rerank && results.length > 1) {
        results = await this.rerankResults(results, request.query, queryData);
      }

      // Apply pagination
      const paginatedResults = this.applyPagination(results, request.options);

      // Generate suggestions and facets
      const suggestions = this.generateSearchSuggestions(request.query, queryData);
      const facets = this.generateFacets(filteredContexts);

      const executionTime = Date.now() - startTime;
      
      logger.info('Semantic search completed', {
        query: request.query,
        resultCount: paginatedResults.length,
        totalCount: results.length,
        executionTime,
        searchType,
      });

      return {
        results: paginatedResults,
        totalCount: results.length,
        executionTime,
        searchMetadata: {
          query: request.query,
          processedQuery: queryData.processedQuery,
          searchType,
          conceptsExtracted: queryData.concepts,
          queryEmbedding,
        },
        suggestions,
        facets,
      };
    } catch (error) {
      logger.error('Semantic search failed', error);
      throw new Error(`Semantic search failed: ${error.message}`);
    }
  }

  /**
   * Index a context for semantic search
   */
  async indexContext(context: Context): Promise<void> {
    try {
      if (!this.embeddingProvider) {
        logger.debug('No embedding provider available, skipping context indexing');
        return;
      }

      // Generate embedding for the context
      const text = this.prepareTextForEmbedding(context);
      const embedding = await this.embeddingProvider.generateEmbedding(text);
      
      // Store in vector index
      this.vectorIndex.set(context.id, embedding);
      
      // Extract and store concepts
      await this.extractAndStoreConcepts(context);
      
      logger.debug('Context indexed for semantic search', { contextId: context.id });
    } catch (error) {
      logger.error('Failed to index context', { contextId: context.id, error });
    }
  }

  /**
   * Batch index multiple contexts
   */
  async indexContextsBatch(contexts: Context[]): Promise<void> {
    try {
      if (!this.embeddingProvider || contexts.length === 0) {
        return;
      }

      logger.info('Starting batch context indexing', { count: contexts.length });

      // Prepare texts for batch embedding generation
      const texts = contexts.map(context => this.prepareTextForEmbedding(context));
      
      // Generate embeddings in batch
      const embeddings = await this.embeddingProvider.generateBatchEmbeddings(texts);
      
      // Store embeddings and extract concepts
      for (let i = 0; i < contexts.length; i++) {
        const context = contexts[i];
        const embedding = embeddings[i];
        
        this.vectorIndex.set(context.id, embedding);
        await this.extractAndStoreConcepts(context);
      }

      logger.info('Batch context indexing completed', { 
        indexed: contexts.length,
        totalVectors: this.vectorIndex.size 
      });
    } catch (error) {
      logger.error('Batch context indexing failed', error);
      throw error;
    }
  }

  /**
   * Remove context from search index
   */
  removeFromIndex(contextId: string): void {
    this.vectorIndex.delete(contextId);
    logger.debug('Context removed from search index', { contextId });
  }

  /**
   * Get search index statistics
   */
  getIndexStats(): {
    vectorCount: number;
    conceptCount: number;
    embeddingDimensions?: number;
  } {
    return {
      vectorCount: this.vectorIndex.size,
      conceptCount: this.conceptGraph.size,
      embeddingDimensions: this.embeddingProvider?.getEmbeddingDimensions(),
    };
  }

  /**
   * Process search query to extract concepts and intent
   */
  private async processSearchQuery(query: string): Promise<{
    processedQuery: string;
    concepts: string[];
    intent: string;
    entities: Array<{ text: string; type: string; confidence: number }>;
  }> {
    if (this.queryProcessor) {
      return await this.queryProcessor.processQuery(query);
    }

    // Fallback: basic query processing
    const processedQuery = query.toLowerCase().trim();
    const concepts = this.extractBasicConcepts(query);
    
    return {
      processedQuery,
      concepts,
      intent: 'search',
      entities: [],
    };
  }

  /**
   * Apply basic filters to contexts
   */
  private applyBasicFilters(contexts: Context[], filters?: SemanticSearchRequest['filters']): Context[] {
    if (!filters) return contexts;

    return contexts.filter(context => {
      // Type filter
      if (filters.type && context.type !== filters.type) {
        return false;
      }

      // Tags filter
      if (filters.tags?.length) {
        const hasMatchingTag = filters.tags.some(tag => 
          context.tags.some(contextTag => 
            contextTag.toLowerCase().includes(tag.toLowerCase())
          )
        );
        if (!hasMatchingTag) return false;
      }

      // Importance filter
      if (filters.importance?.length && context.metadata?.importance) {
        if (!filters.importance.includes(context.metadata.importance)) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange) {
        const contextDate = new Date(context.createdAt);
        if (contextDate < filters.dateRange.start || contextDate > filters.dateRange.end) {
          return false;
        }
      }

      // Session filter
      if (filters.sessionId && context.sessionId !== filters.sessionId) {
        return false;
      }

      // User filter
      if (filters.userId && context.userId !== filters.userId) {
        return false;
      }

      return true;
    });
  }

  /**
   * Perform hybrid search combining semantic and text-based approaches
   */
  private async performHybridSearch(
    contexts: Context[],
    originalQuery: string,
    queryData: any,
    queryEmbedding: number[],
    options?: SemanticSearchRequest['options']
  ): Promise<SemanticSearchResult[]> {
    // Get semantic results
    const semanticResults = await this.performSemanticSearch(contexts, queryEmbedding, options);
    
    // Get text-based results
    const textResults = await this.performEnhancedTextSearch(contexts, originalQuery, queryData, options);
    
    // Combine and deduplicate results
    const combinedResults = new Map<string, SemanticSearchResult>();
    
    // Add semantic results with weighted scores
    for (const result of semanticResults) {
      combinedResults.set(result.context.id, {
        ...result,
        semanticScore: result.score,
        score: result.score * 0.6, // Weight semantic score
      });
    }
    
    // Add or merge text results
    for (const result of textResults) {
      const existing = combinedResults.get(result.context.id);
      if (existing) {
        // Combine scores
        existing.textScore = result.score;
        existing.score = (existing.semanticScore || 0) * 0.6 + result.score * 0.4;
        existing.highlights = result.highlights;
      } else {
        combinedResults.set(result.context.id, {
          ...result,
          textScore: result.score,
          score: result.score * 0.4, // Weight text score lower when no semantic match
        });
      }
    }
    
    // Sort by combined score
    return Array.from(combinedResults.values())
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Perform pure semantic search using embeddings
   */
  private async performSemanticSearch(
    contexts: Context[],
    queryEmbedding: number[],
    options?: SemanticSearchRequest['options']
  ): Promise<SemanticSearchResult[]> {
    const results: SemanticSearchResult[] = [];
    const threshold = options?.threshold || 0.3;

    for (const context of contexts) {
      const contextEmbedding = this.vectorIndex.get(context.id);
      if (!contextEmbedding) continue;

      // Calculate cosine similarity
      const similarity = this.calculateCosineSimilarity(queryEmbedding, contextEmbedding);
      
      if (similarity >= threshold) {
        results.push({
          context,
          score: similarity,
          semanticScore: similarity,
          explanation: `Semantic similarity: ${Math.round(similarity * 100)}%`,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Perform enhanced text search with concept matching
   */
  private async performEnhancedTextSearch(
    contexts: Context[],
    query: string,
    queryData: any,
    options?: SemanticSearchRequest['options']
  ): Promise<SemanticSearchResult[]> {
    const results: SemanticSearchResult[] = [];
    const queryTerms = query.toLowerCase().split(/\s+/);
    const concepts = queryData.concepts;

    for (const context of contexts) {
      let score = 0;
      const highlights: { title?: string[]; content?: string[] } = {};

      // Text matching in title
      const titleMatches = this.findTextMatches(context.title, queryTerms);
      if (titleMatches.length > 0) {
        score += titleMatches.length * 3; // Higher weight for title matches
        highlights.title = titleMatches;
      }

      // Text matching in content
      const contentMatches = this.findTextMatches(context.content, queryTerms);
      if (contentMatches.length > 0) {
        score += contentMatches.length;
        highlights.content = contentMatches;
      }

      // Concept matching
      const conceptMatches = this.findConceptMatches(context, concepts);
      score += conceptMatches * 2;

      // Tag matching
      const tagMatches = this.findTagMatches(context.tags, queryTerms);
      score += tagMatches;

      if (score > 0) {
        results.push({
          context,
          score: this.normalizeTextScore(score),
          textScore: score,
          highlights: Object.keys(highlights).length > 0 ? highlights : undefined,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Re-rank results using advanced scoring
   */
  private async rerankResults(
    results: SemanticSearchResult[],
    query: string,
    queryData: any
  ): Promise<SemanticSearchResult[]> {
    return results.map(result => {
      let adjustedScore = result.score;

      // Boost recent content
      const daysSinceCreated = (Date.now() - result.context.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated < 7) {
        adjustedScore *= 1.2;
      } else if (daysSinceCreated < 30) {
        adjustedScore *= 1.1;
      }

      // Boost high importance content
      if (result.context.metadata?.importance === 'critical') {
        adjustedScore *= 1.3;
      } else if (result.context.metadata?.importance === 'high') {
        adjustedScore *= 1.2;
      }

      // Boost frequently accessed content
      if (result.context.metadata?.interactions && result.context.metadata.interactions > 10) {
        adjustedScore *= 1.1;
      }

      return { ...result, score: adjustedScore };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Apply pagination to results
   */
  private applyPagination(
    results: SemanticSearchResult[],
    options?: SemanticSearchRequest['options']
  ): SemanticSearchResult[] {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    return results.slice(offset, offset + limit);
  }

  /**
   * Generate search suggestions based on query and available data
   */
  private generateSearchSuggestions(query: string, queryData: any): string[] {
    const suggestions: string[] = [];
    
    // Add concept-based suggestions
    for (const concept of queryData.concepts) {
      const relatedConcepts = this.conceptGraph.get(concept);
      if (relatedConcepts) {
        relatedConcepts.forEach(related => {
          if (!suggestions.includes(related) && related !== concept) {
            suggestions.push(related);
          }
        });
      }
    }
    
    // Add query variations
    if (query.length > 3) {
      suggestions.push(`${query} examples`);
      suggestions.push(`${query} tutorial`);
      suggestions.push(`how to ${query}`);
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * Generate facets for result filtering
   */
  private generateFacets(contexts: Context[]): Record<string, Record<string, number>> {
    const facets: Record<string, Record<string, number>> = {
      type: {},
      importance: {},
      tags: {},
    };

    for (const context of contexts) {
      // Type facet
      facets.type[context.type] = (facets.type[context.type] || 0) + 1;
      
      // Importance facet
      if (context.metadata?.importance) {
        facets.importance[context.metadata.importance] = 
          (facets.importance[context.metadata.importance] || 0) + 1;
      }
      
      // Tags facet
      for (const tag of context.tags) {
        facets.tags[tag] = (facets.tags[tag] || 0) + 1;
      }
    }

    return facets;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match for similarity calculation');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Prepare text from context for embedding generation
   */
  private prepareTextForEmbedding(context: Context): string {
    const parts = [
      context.title,
      context.content,
      context.tags.join(' '),
    ];

    return parts.filter(Boolean).join(' ').slice(0, 8000); // Limit text length
  }

  /**
   * Extract and store concepts from context
   */
  private async extractAndStoreConcepts(context: Context): Promise<void> {
    // Extract concepts from context content
    const concepts = this.extractBasicConcepts(context.content);
    
    // Store concept relationships
    for (const concept of concepts) {
      if (!this.conceptGraph.has(concept)) {
        this.conceptGraph.set(concept, new Set());
      }
      
      // Add relationships to other concepts in the same context
      for (const otherConcept of concepts) {
        if (concept !== otherConcept) {
          this.conceptGraph.get(concept)!.add(otherConcept);
        }
      }
    }
  }

  /**
   * Extract basic concepts from text
   */
  private extractBasicConcepts(text: string): string[] {
    // Simple concept extraction - could be enhanced with NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Remove common stop words
    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time']);
    
    return [...new Set(words.filter(word => !stopWords.has(word)))];
  }

  /**
   * Find text matches and generate highlights
   */
  private findTextMatches(text: string, queryTerms: string[]): string[] {
    const highlights: string[] = [];
    const lowerText = text.toLowerCase();
    
    for (const term of queryTerms) {
      if (lowerText.includes(term)) {
        const regex = new RegExp(`(.{0,30})(${term})(.{0,30})`, 'gi');
        const match = regex.exec(text);
        if (match) {
          highlights.push(`${match[1]}<em>${match[2]}</em>${match[3]}`);
        }
      }
    }
    
    return highlights;
  }

  /**
   * Find concept matches in context
   */
  private findConceptMatches(context: Context, queryConcepts: string[]): number {
    const contextConcepts = this.extractBasicConcepts(context.content);
    let matches = 0;
    
    for (const queryConcept of queryConcepts) {
      if (contextConcepts.includes(queryConcept)) {
        matches++;
      }
      
      // Check for related concepts
      const relatedConcepts = this.conceptGraph.get(queryConcept);
      if (relatedConcepts) {
        for (const related of relatedConcepts) {
          if (contextConcepts.includes(related)) {
            matches += 0.5; // Partial match for related concepts
          }
        }
      }
    }
    
    return matches;
  }

  /**
   * Find tag matches
   */
  private findTagMatches(tags: string[], queryTerms: string[]): number {
    let matches = 0;
    
    for (const tag of tags) {
      const lowerTag = tag.toLowerCase();
      for (const term of queryTerms) {
        if (lowerTag.includes(term)) {
          matches++;
        }
      }
    }
    
    return matches;
  }

  /**
   * Normalize text-based scores
   */
  private normalizeTextScore(score: number): number {
    // Simple normalization - could be improved
    return Math.min(score / 10, 1);
  }

  /**
   * Initialize concept graph with common relationships
   */
  private initializeConceptGraph(): void {
    // Add some common concept relationships
    const conceptRelations = [
      ['python', 'programming', 'code', 'development'],
      ['javascript', 'programming', 'web', 'frontend'],
      ['database', 'data', 'storage', 'query'],
      ['ai', 'machine learning', 'neural network', 'algorithm'],
      ['api', 'endpoint', 'service', 'integration'],
    ];

    for (const group of conceptRelations) {
      for (const concept of group) {
        if (!this.conceptGraph.has(concept)) {
          this.conceptGraph.set(concept, new Set());
        }
        
        for (const related of group) {
          if (concept !== related) {
            this.conceptGraph.get(concept)!.add(related);
          }
        }
      }
    }

    logger.info('Concept graph initialized', { 
      conceptCount: this.conceptGraph.size 
    });
  }
}