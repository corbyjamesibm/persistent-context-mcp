/**
 * Generate Template MCP Tool (US-4530)
 * Provides AI assistants with template generation capabilities
 */

import { z } from 'zod';
import { TemplateGeneratorService, VariableDefinition } from '../../core/services/template-generator.service.js';
import { logger } from '../../utils/logger.js';

// Input validation schemas
export const GenerateTemplateInputSchema = z.object({
  candidateContextIds: z.array(z.string().min(1)).min(1).max(10),
  templateConfig: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(10).max(1000),
    type: z.enum(['general', 'planning', 'analysis', 'development', 'bmad_workflow']),
    customVariables: z.array(z.object({
      name: z.string().min(1).max(50),
      type: z.enum(['text', 'number', 'date', 'boolean', 'choice']),
      description: z.string().min(1).max(200),
      placeholder: z.string().optional(),
      required: z.boolean(),
      defaultValue: z.any().optional(),
      choices: z.array(z.string()).optional(),
    })).optional(),
  }),
});

export const ApplyTemplateInputSchema = z.object({
  templateId: z.string().min(1),
  variableValues: z.record(z.string(), z.any()),
  contextConfig: z.object({
    title: z.string().min(1).max(200),
    sessionId: z.string().min(1).max(100),
    tags: z.array(z.string()).optional(),
  }),
});

export const IdentifyCandidatesInputSchema = z.object({
  filters: z.object({
    minSuccessScore: z.number().min(0).max(1).optional(),
    contextTypes: z.array(z.string()).optional(),
    timeRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }).optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

// Output schemas
export const GenerateTemplateOutputSchema = z.object({
  success: z.boolean(),
  templateId: z.string().optional(),
  template: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    type: z.string(),
    variableCount: z.number(),
    confidence: z.number(),
    sourceContextCount: z.number(),
  }).optional(),
  error: z.string().optional(),
});

export const ApplyTemplateOutputSchema = z.object({
  success: z.boolean(),
  contextId: z.string().optional(),
  contextTitle: z.string().optional(),
  error: z.string().optional(),
});

export const IdentifyCandidatesOutputSchema = z.object({
  success: z.boolean(),
  candidates: z.array(z.object({
    contextId: z.string(),
    title: z.string(),
    type: z.string(),
    confidence: z.number(),
    successMetrics: z.object({
      tokenEfficiency: z.number(),
      resolutionTime: z.number(),
      userSatisfaction: z.number(),
      reusabilityScore: z.number(),
      complexityLevel: z.enum(['simple', 'moderate', 'complex']),
    }),
    patternCount: z.number(),
    variableCount: z.number(),
  })).optional(),
  error: z.string().optional(),
});

export class GenerateTemplateTool {
  private templateGenerator: TemplateGeneratorService;

  constructor(templateGenerator: TemplateGeneratorService) {
    this.templateGenerator = templateGenerator;
  }

  /**
   * MCP Tool: Identify Template Candidates
   */
  async identifyTemplateCandidates(input: unknown): Promise<unknown> {
    try {
      const validatedInput = IdentifyCandidatesInputSchema.parse(input);
      logger.info('Identifying template candidates with filters:', validatedInput.filters);

      const filters = validatedInput.filters || {};
      
      // Convert timeRange strings to dates if provided
      const processedFilters: {
        minSuccessScore?: number;
        contextTypes?: string[];
        timeRange?: { start: Date; end: Date };
        tags?: string[];
      } = {
        minSuccessScore: filters.minSuccessScore,
        contextTypes: filters.contextTypes,
        tags: filters.tags,
        ...(filters.timeRange && {
          timeRange: {
            start: new Date(filters.timeRange.start),
            end: new Date(filters.timeRange.end),
          }
        })
      };

      const candidates = await this.templateGenerator.identifyTemplateCandidates(
        processedFilters
      );

      const result = {
        success: true,
        candidates: candidates.map(candidate => ({
          contextId: candidate.contextId,
          title: candidate.title,
          type: candidate.type,
          confidence: candidate.confidence,
          successMetrics: candidate.successMetrics,
          patternCount: candidate.extractedPatterns.length,
          variableCount: candidate.suggestedVariables.length,
        })),
      };

      logger.info(`Identified ${candidates.length} template candidates`);
      return IdentifyCandidatesOutputSchema.parse(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to identify template candidates:', error);
      
      return IdentifyCandidatesOutputSchema.parse({
        success: false,
        error: `Template candidate identification failed: ${errorMessage}`,
      });
    }
  }

  /**
   * MCP Tool: Generate Template from Candidates
   */
  async generateTemplate(input: unknown): Promise<unknown> {
    try {
      const validatedInput = GenerateTemplateInputSchema.parse(input);
      logger.info('Generating template from candidates:', {
        candidateCount: validatedInput.candidateContextIds.length,
        title: validatedInput.templateConfig.title,
        type: validatedInput.templateConfig.type,
      });

      const template = await this.templateGenerator.generateTemplate(
        validatedInput.candidateContextIds,
        validatedInput.templateConfig
      );

      const result = {
        success: true,
        templateId: template.id,
        template: {
          id: template.id,
          title: template.title,
          description: template.description,
          type: template.type,
          variableCount: template.variables.length,
          confidence: template.metadata.confidence,
          sourceContextCount: template.metadata.sourceContexts.length,
        },
      };

      logger.info(`Template generated successfully: ${template.id}`);
      return GenerateTemplateOutputSchema.parse(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate template:', error);
      
      return GenerateTemplateOutputSchema.parse({
        success: false,
        error: `Template generation failed: ${errorMessage}`,
      });
    }
  }

  /**
   * MCP Tool: Apply Template to Create Context
   */
  async applyTemplate(input: unknown): Promise<unknown> {
    try {
      const validatedInput = ApplyTemplateInputSchema.parse(input);
      logger.info('Applying template to create context:', {
        templateId: validatedInput.templateId,
        contextTitle: validatedInput.contextConfig.title,
        variableCount: Object.keys(validatedInput.variableValues).length,
      });

      const contextId = await this.templateGenerator.applyTemplate(
        validatedInput.templateId,
        validatedInput.variableValues,
        validatedInput.contextConfig
      );

      const result = {
        success: true,
        contextId,
        contextTitle: validatedInput.contextConfig.title,
      };

      logger.info(`Template applied successfully: context=${contextId}`);
      return ApplyTemplateOutputSchema.parse(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to apply template:', error);
      
      return ApplyTemplateOutputSchema.parse({
        success: false,
        error: `Template application failed: ${errorMessage}`,
      });
    }
  }

  /**
   * MCP Tool: Get Available Templates
   */
  async getAvailableTemplates(input?: unknown): Promise<unknown> {
    try {
      const filters = input as any || {};
      logger.info('Getting available templates with filters:', filters);

      const templates = await this.templateGenerator.getAvailableTemplates(filters);

      const result = {
        success: true,
        templates: templates.map(template => ({
          id: template.id,
          title: template.title,
          description: template.description,
          type: template.type,
          variableCount: template.variables.length,
          confidence: template.metadata.confidence,
          usageCount: template.metadata.usageCount,
          tags: template.tags,
          createdAt: template.metadata.generatedAt.toISOString(),
        })),
      };

      logger.info(`Retrieved ${templates.length} available templates`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get available templates:', error);
      
      return {
        success: false,
        error: `Failed to retrieve templates: ${errorMessage}`,
      };
    }
  }

  /**
   * MCP Tool: Get Template Details
   */
  async getTemplateDetails(input: unknown): Promise<unknown> {
    try {
      const { templateId } = z.object({ templateId: z.string() }).parse(input);
      logger.info('Getting template details:', templateId);

      const templates = await this.templateGenerator.getAvailableTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        return {
          success: false,
          error: `Template not found: ${templateId}`,
        };
      }

      const result = {
        success: true,
        template: {
          id: template.id,
          title: template.title,
          description: template.description,
          type: template.type,
          contentTemplate: template.contentTemplate,
          variables: template.variables,
          tags: template.tags,
          metadata: {
            sourceContexts: template.metadata.sourceContexts,
            generatedAt: template.metadata.generatedAt.toISOString(),
            version: template.metadata.version,
            confidence: template.metadata.confidence,
            usageCount: template.metadata.usageCount,
          },
        },
      };

      logger.info(`Template details retrieved: ${templateId}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get template details:', error);
      
      return {
        success: false,
        error: `Failed to retrieve template details: ${errorMessage}`,
      };
    }
  }
}

/**
 * Factory function to create generate template tool
 */
export function createGenerateTemplateTool(templateGenerator: TemplateGeneratorService): GenerateTemplateTool {
  return new GenerateTemplateTool(templateGenerator);
}