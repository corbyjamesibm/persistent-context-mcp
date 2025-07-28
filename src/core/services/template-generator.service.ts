/**
 * Template Generation Service (US-4530)
 * Analyzes successful contexts and generates reusable templates
 */

import { EventEmitter } from 'events';
import { Neo4jContextStore } from '../storage/neo4j-store.js';
import { Context, ContextTemplate, CreateTemplateRequest } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

export interface AnalysisMetrics {
  tokenEfficiency: number;
  resolutionTime: number;
  userSatisfaction: number;
  reusabilityScore: number;
  complexityLevel: 'simple' | 'moderate' | 'complex';
}

export interface TemplateCandidate {
  contextId: string;
  title: string;
  type: string;
  successMetrics: AnalysisMetrics;
  extractedPatterns: string[];
  suggestedVariables: VariableDefinition[];
  confidence: number;
}

export interface VariableDefinition {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'choice';
  description: string;
  placeholder?: string;
  required: boolean;
  defaultValue?: any;
  choices?: string[];
}

export interface GeneratedTemplate {
  id: string;
  title: string;
  description: string;
  type: string;
  contentTemplate: string;
  variables: VariableDefinition[];
  tags: string[];
  metadata: {
    sourceContexts: string[];
    generatedAt: Date;
    version: string;
    confidence: number;
    usageCount: number;
  };
}

export class TemplateGeneratorService extends EventEmitter {
  private contextStore: Neo4jContextStore;
  private generatedTemplates: Map<string, GeneratedTemplate> = new Map();

  constructor(contextStore: Neo4jContextStore) {
    super();
    this.contextStore = contextStore;
  }

  /**
   * Analyze contexts and identify template candidates
   */
  async identifyTemplateCandidates(
    filters: {
      minSuccessScore?: number;
      contextTypes?: string[];
      timeRange?: { start: Date; end: Date };
      tags?: string[];
    } = {}
  ): Promise<TemplateCandidate[]> {
    try {
      logger.info('Starting template candidate identification');
      
      // Get contexts based on filters
      const contexts = await this.getFilteredContexts(filters);
      const candidates: TemplateCandidate[] = [];

      for (const context of contexts) {
        const metrics = await this.analyzeContextSuccess(context);
        
        if (this.isViableCandidate(metrics, filters.minSuccessScore || 0.7)) {
          const patterns = this.extractPatterns(context);
          const variables = this.identifyVariables(context, patterns);
          
          candidates.push({
            contextId: context.id,
            title: context.title,
            type: context.type,
            successMetrics: metrics,
            extractedPatterns: patterns,
            suggestedVariables: variables,
            confidence: this.calculateConfidence(metrics, patterns, variables),
          });
        }
      }

      // Sort by confidence score
      candidates.sort((a, b) => b.confidence - a.confidence);
      
      logger.info(`Identified ${candidates.length} template candidates`);
      this.emit('candidatesIdentified', { count: candidates.length, candidates });
      
      return candidates;
    } catch (error) {
      logger.error('Failed to identify template candidates:', error);
      throw error;
    }
  }

  /**
   * Generate template from candidate contexts
   */
  async generateTemplate(
    candidateIds: string[],
    templateConfig: {
      title: string;
      description: string;
      type: string;
      customVariables?: VariableDefinition[];
    }
  ): Promise<GeneratedTemplate> {
    try {
      logger.info(`Generating template from ${candidateIds.length} candidates`);
      
      const candidates = await this.getCandidateDetails(candidateIds);
      const mergedContent = await this.mergeContextPatterns(candidates);
      
      // Extract and merge variables
      const allVariables = this.mergeVariableDefinitions(candidates, templateConfig.customVariables);
      
      // Generate template content with placeholder variables
      const contentTemplate = this.generateTemplateContent(mergedContent, allVariables);
      
      const template: GeneratedTemplate = {
        id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: templateConfig.title,
        description: templateConfig.description,
        type: templateConfig.type,
        contentTemplate,
        variables: allVariables,
        tags: this.generateTemplateTags(candidates),
        metadata: {
          sourceContexts: candidateIds,
          generatedAt: new Date(),
          version: '1.0.0',
          confidence: this.calculateAverageConfidence(candidates),
          usageCount: 0,
        },
      };

      // Store the template
      await this.saveTemplate(template);
      this.generatedTemplates.set(template.id, template);
      
      logger.info(`Template generated successfully: ${template.id}`);
      this.emit('templateGenerated', { templateId: template.id, sourceCount: candidateIds.length });
      
      return template;
    } catch (error) {
      logger.error('Failed to generate template:', error);
      throw error;
    }
  }

  /**
   * Apply template to create new context
   */
  async applyTemplate(
    templateId: string,
    variableValues: Record<string, any>,
    contextConfig: {
      title: string;
      sessionId: string;
      tags?: string[];
    }
  ): Promise<string> {
    try {
      const template = this.generatedTemplates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Validate variable values
      this.validateVariableValues(template.variables, variableValues);
      
      // Generate context content from template
      const contextContent = this.populateTemplate(template.contentTemplate, variableValues);
      
      // Create context request
      const createRequest: CreateTemplateRequest = {
        title: contextConfig.title,
        content: contextContent,
        type: template.type as any,
        sessionId: contextConfig.sessionId,
        tags: [...(contextConfig.tags || []), ...template.tags, 'from-template'],
        templateMetadata: {
          templateId: template.id,
          templateVersion: template.metadata.version,
          variableValues,
        },
      };

      // Save new context
      const contextId = await this.contextStore.saveContext(createRequest);
      
      // Update template usage count
      template.metadata.usageCount++;
      await this.updateTemplate(template);
      
      logger.info(`Template applied successfully: template=${templateId}, context=${contextId}`);
      this.emit('templateApplied', { templateId, contextId, variableCount: Object.keys(variableValues).length });
      
      return contextId;
    } catch (error) {
      logger.error(`Failed to apply template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Get all available templates
   */
  async getAvailableTemplates(filters?: {
    type?: string;
    tags?: string[];
    minConfidence?: number;
  }): Promise<GeneratedTemplate[]> {
    let templates = Array.from(this.generatedTemplates.values());
    
    if (filters) {
      templates = templates.filter(template => {
        if (filters.type && template.type !== filters.type) return false;
        if (filters.minConfidence && template.metadata.confidence < filters.minConfidence) return false;
        if (filters.tags && !filters.tags.some(tag => template.tags.includes(tag))) return false;
        return true;
      });
    }
    
    // Sort by confidence and usage
    templates.sort((a, b) => {
      const aScore = a.metadata.confidence + (a.metadata.usageCount * 0.1);
      const bScore = b.metadata.confidence + (b.metadata.usageCount * 0.1);
      return bScore - aScore;
    });
    
    return templates;
  }

  /**
   * Analyze context for success metrics
   */
  private async analyzeContextSuccess(context: Context): Promise<AnalysisMetrics> {
    // This would integrate with actual metrics if available
    // For now, using heuristics based on context properties
    
    const tokenEfficiency = Math.min(1.0, 1000 / Math.max(context.metadata?.tokenCount || 1000, 1));
    const resolutionTime = 0.8; // Would calculate based on actual resolution time
    const userSatisfaction = context.tags.includes('successful') ? 0.9 : 0.7;
    const reusabilityScore = this.calculateReusabilityScore(context);
    
    return {
      tokenEfficiency,
      resolutionTime,
      userSatisfaction,
      reusabilityScore,
      complexityLevel: this.assessComplexity(context),
    };
  }

  /**
   * Extract common patterns from context content
   */
  private extractPatterns(context: Context): string[] {
    const patterns: string[] = [];
    const content = context.content;
    
    // Extract common workflow patterns
    const workflowPatterns = [
      /(?:step|phase|stage)\s*\d+[:\-\s](.{10,100})/gi,
      /(?:first|then|next|finally)[,\s]+(.{10,100})/gi,
      /(?:problem|issue|challenge)[:\-\s]+(.{10,100})/gi,
      /(?:solution|approach|method)[:\-\s]+(.{10,100})/gi,
    ];
    
    workflowPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        patterns.push(...matches.slice(0, 3)); // Limit to 3 matches per pattern
      }
    });
    
    return patterns;
  }

  /**
   * Identify potential template variables
   */
  private identifyVariables(context: Context, patterns: string[]): VariableDefinition[] {
    const variables: VariableDefinition[] = [];
    const content = context.content;
    
    // Common variable patterns
    const variablePatterns = [
      { regex: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, type: 'text', description: 'Name or title' },
      { regex: /\b(\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4})\b/g, type: 'date', description: 'Date' },
      { regex: /\b(\d+(?:\.\d+)?)\b/g, type: 'number', description: 'Numeric value' },
      { regex: /\b(https?:\/\/[^\s]+)\b/g, type: 'text', description: 'URL or link' },
    ];
    
    variablePatterns.forEach((pattern, index) => {
      const matches = content.match(pattern.regex);
      if (matches && matches.length > 1) {
        variables.push({
          name: `variable_${index + 1}`,
          type: pattern.type as any,
          description: pattern.description,
          placeholder: matches[0],
          required: true,
        });
      }
    });
    
    return variables.slice(0, 10); // Limit to 10 variables
  }

  /**
   * Calculate reusability score based on context characteristics
   */
  private calculateReusabilityScore(context: Context): number {
    let score = 0.5; // Base score
    
    // Higher score for structured content
    if (context.content.includes('1.') || context.content.includes('Step')) score += 0.2;
    
    // Higher score for problem-solution patterns
    if (context.content.includes('problem') && context.content.includes('solution')) score += 0.2;
    
    // Higher score for tagged contexts
    if (context.tags.length > 2) score += 0.1;
    
    return Math.min(1.0, score);
  }

  /**
   * Assess context complexity level
   */
  private assessComplexity(context: Context): 'simple' | 'moderate' | 'complex' {
    const tokenCount = context.metadata?.tokenCount || 0;
    const sentenceCount = (context.content.match(/[.!?]+/g) || []).length;
    
    if (tokenCount < 500 && sentenceCount < 10) return 'simple';
    if (tokenCount < 1500 && sentenceCount < 30) return 'moderate';
    return 'complex';
  }

  /**
   * Check if context is viable template candidate
   */
  private isViableCandidate(metrics: AnalysisMetrics, minScore: number): boolean {
    const overallScore = (
      metrics.tokenEfficiency * 0.3 +
      metrics.resolutionTime * 0.2 +
      metrics.userSatisfaction * 0.3 +
      metrics.reusabilityScore * 0.2
    );
    
    return overallScore >= minScore;
  }

  /**
   * Calculate confidence score for template candidate
   */
  private calculateConfidence(
    metrics: AnalysisMetrics,
    patterns: string[],
    variables: VariableDefinition[]
  ): number {
    const metricsScore = (metrics.tokenEfficiency + metrics.userSatisfaction + metrics.reusabilityScore) / 3;
    const patternsScore = Math.min(1.0, patterns.length / 5);
    const variablesScore = Math.min(1.0, variables.length / 8);
    
    return (metricsScore * 0.5 + patternsScore * 0.3 + variablesScore * 0.2);
  }

  /**
   * Get filtered contexts based on criteria
   */
  private async getFilteredContexts(filters: any): Promise<Context[]> {
    // This would use the context store's search functionality
    // For now, returning a simplified implementation
    return this.contextStore.searchContexts('', filters);
  }

  /**
   * Helper methods (simplified implementations)
   */
  private async getCandidateDetails(candidateIds: string[]): Promise<TemplateCandidate[]> {
    // Would fetch full candidate details
    return [];
  }

  private async mergeContextPatterns(candidates: TemplateCandidate[]): Promise<string> {
    // Would analyze and merge common patterns
    return "Template content placeholder";
  }

  private mergeVariableDefinitions(
    candidates: TemplateCandidate[],
    custom?: VariableDefinition[]
  ): VariableDefinition[] {
    // Would merge and deduplicate variables
    return custom || [];
  }

  private generateTemplateContent(content: string, variables: VariableDefinition[]): string {
    // Would replace identified patterns with variable placeholders
    return content;
  }

  private generateTemplateTags(candidates: TemplateCandidate[]): string[] {
    return ['generated', 'template'];
  }

  private calculateAverageConfidence(candidates: TemplateCandidate[]): number {
    return candidates.reduce((sum, c) => sum + c.confidence, 0) / candidates.length;
  }

  private async saveTemplate(template: GeneratedTemplate): Promise<void> {
    // Would save to database
    logger.info(`Template saved: ${template.id}`);
  }

  private async updateTemplate(template: GeneratedTemplate): Promise<void> {
    // Would update template in database
    logger.info(`Template updated: ${template.id}`);
  }

  private validateVariableValues(variables: VariableDefinition[], values: Record<string, any>): void {
    for (const variable of variables) {
      if (variable.required && !values[variable.name]) {
        throw new Error(`Required variable missing: ${variable.name}`);
      }
    }
  }

  private populateTemplate(template: string, values: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }
    return result;
  }
}

/**
 * Factory function to create template generator service
 */
export function createTemplateGeneratorService(contextStore: Neo4jContextStore): TemplateGeneratorService {
  return new TemplateGeneratorService(contextStore);
}