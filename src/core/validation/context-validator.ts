/**
 * Context Data Validation Service (US-4527)
 * Implements JSON schema validation, corruption detection, and data repair
 */

import { z } from 'zod';
import { Context, CreateContextRequest, UpdateContextRequest, ContextType, ContextStatus } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

// Validation schemas
export const ContextMetadataSchema = z.object({
  tokenCount: z.number().int().min(0).max(1000000),
  quality: z.number().min(0).max(1),
  interactions: z.number().int().min(0),
  templateCount: z.number().int().min(0),
  lastAccessed: z.date(),
  aiGenerated: z.boolean(),
  source: z.string().max(100).optional(),
  importance: z.enum(['low', 'medium', 'high']).optional(),
});

export const CreateContextSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  content: z.string().min(1).max(100000),
  type: z.nativeEnum(ContextType),
  tags: z.array(z.string().max(50).trim()).max(20).default([]),
  metadata: ContextMetadataSchema.partial().optional(),
});

export const UpdateContextSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  content: z.string().min(1).max(100000).optional(),
  type: z.nativeEnum(ContextType).optional(),
  status: z.nativeEnum(ContextStatus).optional(),
  tags: z.array(z.string().max(50).trim()).max(20).optional(),
  metadata: ContextMetadataSchema.partial().optional(),
});

export const ContextSchema = z.object({
  id: z.string().regex(/^ctx_\d+_[a-z0-9]+$/),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
  type: z.nativeEnum(ContextType),
  status: z.nativeEnum(ContextStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string().min(1).max(100),
  tags: z.array(z.string().max(50)).max(20),
  metadata: ContextMetadataSchema,
  relationships: z.array(z.any()).default([]), // TODO: Define relationship schema
});

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  repairedData?: any;
  corruptionDetected: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestedFix?: string;
}

export interface ValidationOptions {
  allowPartialData: boolean;
  autoRepair: boolean;
  strictMode: boolean;
  createBackup: boolean;
}

export class ContextValidator {
  private defaultOptions: ValidationOptions = {
    allowPartialData: false,
    autoRepair: true,
    strictMode: false,
    createBackup: true,
  };

  /**
   * Validate context creation request
   */
  validateCreateRequest(data: unknown, options?: Partial<ValidationOptions>): ValidationResult {
    const opts = { ...this.defaultOptions, ...options };
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Schema validation
      const result = CreateContextSchema.safeParse(data);
      
      if (!result.success) {
        result.error.errors.forEach(error => {
          errors.push({
            field: error.path.join('.'),
            message: error.message,
            code: error.code,
            severity: 'error',
          });
        });
      }

      // Additional business logic validation
      if (result.success) {
        const validatedData = result.data;
        this.validateBusinessRules(validatedData, errors, warnings);
        
        // Corruption detection
        const corruptionCheck = this.detectCorruption(validatedData);
        
        // Auto-repair if enabled
        let repairedData = validatedData;
        if (opts.autoRepair && (errors.length > 0 || corruptionCheck.detected)) {
          repairedData = this.attemptRepair(validatedData, errors);
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings,
          repairedData: opts.autoRepair ? repairedData : undefined,
          corruptionDetected: corruptionCheck.detected,
        };
      }

      return {
        isValid: false,
        errors,
        warnings,
        corruptionDetected: false,
      };

    } catch (error) {
      logger.error('Validation error:', error);
      errors.push({
        field: 'general',
        message: 'Validation process failed',
        code: 'VALIDATION_ERROR',
        severity: 'error',
      });

      return {
        isValid: false,
        errors,
        warnings,
        corruptionDetected: true,
      };
    }
  }

  /**
   * Validate context update request
   */
  validateUpdateRequest(data: unknown, options?: Partial<ValidationOptions>): ValidationResult {
    const opts = { ...this.defaultOptions, ...options };
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const result = UpdateContextSchema.safeParse(data);
      
      if (!result.success) {
        result.error.errors.forEach(error => {
          errors.push({
            field: error.path.join('.'),
            message: error.message,
            code: error.code,
            severity: 'error',
          });
        });
      }

      if (result.success) {
        const validatedData = result.data;
        
        // Check if at least one field is being updated
        const hasUpdates = Object.keys(validatedData).length > 0;
        if (!hasUpdates) {
          warnings.push({
            field: 'general',
            message: 'No fields to update',
            suggestedFix: 'Provide at least one field to update',
          });
        }

        // Corruption detection
        const corruptionCheck = this.detectCorruption(validatedData);

        return {
          isValid: errors.length === 0,
          errors,
          warnings,
          repairedData: opts.autoRepair ? this.attemptRepair(validatedData, errors) : undefined,
          corruptionDetected: corruptionCheck.detected,
        };
      }

      return {
        isValid: false,
        errors,
        warnings,
        corruptionDetected: false,
      };

    } catch (error) {
      logger.error('Update validation error:', error);
      errors.push({
        field: 'general',
        message: 'Update validation process failed',
        code: 'VALIDATION_ERROR',
        severity: 'error',
      });

      return {
        isValid: false,
        errors,
        warnings,
        corruptionDetected: true,
      };
    }
  }

  /**
   * Validate complete context object (for stored data integrity)
   */
  validateContext(data: unknown, options?: Partial<ValidationOptions>): ValidationResult {
    const opts = { ...this.defaultOptions, ...options };
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const result = ContextSchema.safeParse(data);
      
      if (!result.success) {
        result.error.errors.forEach(error => {
          errors.push({
            field: error.path.join('.'),
            message: error.message,
            code: error.code,
            severity: 'error',
          });
        });
      }

      if (result.success) {
        const validatedData = result.data;
        
        // Data integrity checks
        this.validateDataIntegrity(validatedData, errors, warnings);
        
        // Corruption detection
        const corruptionCheck = this.detectCorruption(validatedData);

        return {
          isValid: errors.length === 0,
          errors,
          warnings,
          repairedData: opts.autoRepair ? this.attemptRepair(validatedData, errors) : undefined,
          corruptionDetected: corruptionCheck.detected,
        };
      }

      return {
        isValid: false,
        errors,
        warnings,
        corruptionDetected: false,
      };

    } catch (error) {
      logger.error('Context validation error:', error);
      errors.push({
        field: 'general',
        message: 'Context validation process failed',
        code: 'VALIDATION_ERROR',
        severity: 'error',
      });

      return {
        isValid: false,
        errors,
        warnings,
        corruptionDetected: true,
      };
    }
  }

  /**
   * Create backup of data before modifications
   */
  async createBackup(contextId: string, data: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup_${contextId}_${timestamp}`;
    
    try {
      // In a real implementation, this would save to a backup storage system
      // For now, we'll just log the backup creation
      logger.info(`Backup created: ${backupId}`, { contextId, dataKeys: Object.keys(data) });
      return backupId;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw new Error('Backup creation failed');
    }
  }

  /**
   * Validate business logic rules
   */
  private validateBusinessRules(data: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    // Content quality checks
    if (data.content && data.content.length < 10) {
      warnings.push({
        field: 'content',
        message: 'Content is very short, consider adding more detail',
        suggestedFix: 'Add more descriptive content',
      });
    }

    // Token count consistency
    if (data.metadata?.tokenCount && data.content) {
      const estimatedTokens = Math.ceil(data.content.length / 4);
      const difference = Math.abs(data.metadata.tokenCount - estimatedTokens);
      
      if (difference > estimatedTokens * 0.5) {
        warnings.push({
          field: 'metadata.tokenCount',
          message: 'Token count seems inconsistent with content length',
          suggestedFix: `Consider updating to approximately ${estimatedTokens} tokens`,
        });
      }
    }

    // Tag validation
    if (data.tags) {
      const duplicateTags = data.tags.filter((tag: string, index: number) => data.tags.indexOf(tag) !== index);
      if (duplicateTags.length > 0) {
        warnings.push({
          field: 'tags',
          message: 'Duplicate tags detected',
          suggestedFix: 'Remove duplicate tags',
        });
      }
    }
  }

  /**
   * Validate data integrity for stored contexts
   */
  private validateDataIntegrity(data: Context, errors: ValidationError[], warnings: ValidationWarning[]): void {
    // Date consistency checks
    if (data.createdAt > data.updatedAt) {
      errors.push({
        field: 'updatedAt',
        message: 'Updated date cannot be before created date',
        code: 'INVALID_DATE_SEQUENCE',
        severity: 'error',
      });
    }

    // Last accessed should not be in the future
    if (data.metadata.lastAccessed && data.metadata.lastAccessed > new Date()) {
      errors.push({
        field: 'metadata.lastAccessed',
        message: 'Last accessed date cannot be in the future',
        code: 'INVALID_FUTURE_DATE',
        severity: 'error',
      });
    }

    // Metadata consistency
    if (data.metadata.interactions !== undefined && data.metadata.interactions < 0) {
      errors.push({
        field: 'metadata.interactions',
        message: 'Interactions count cannot be negative',
        code: 'INVALID_NEGATIVE_VALUE',
        severity: 'error',
      });
    }
  }

  /**
   * Detect data corruption patterns
   */
  private detectCorruption(data: any): { detected: boolean; indicators: string[] } {
    const indicators: string[] = [];

    try {
      // Check for null/undefined in required fields
      if (typeof data !== 'object' || data === null) {
        indicators.push('Data is not an object');
      }

      // Check for string truncation patterns
      if (data.content && data.content.endsWith('...') && data.content.length > 1000) {
        indicators.push('Content appears to be truncated');
      }

      // Check for encoding issues
      if (data.title && /[\uFFFD\u0000-\u001F]/.test(data.title)) {
        indicators.push('Title contains invalid characters');
      }

      // Check for JSON parsing artifacts
      const jsonString = JSON.stringify(data);
      if (jsonString.includes('"[object Object]"') || jsonString.includes('undefined')) {
        indicators.push('Data contains serialization artifacts');
      }

      // Check for circular references (basic check)
      try {
        JSON.stringify(data);
      } catch (error) {
        if (error instanceof Error && error.message.includes('circular')) {
          indicators.push('Circular reference detected');
        }
      }

      return {
        detected: indicators.length > 0,
        indicators,
      };

    } catch (error) {
      return {
        detected: true,
        indicators: ['Corruption detection failed'],
      };
    }
  }

  /**
   * Attempt to repair minor data corruption
   */
  private attemptRepair(data: any, errors: ValidationError[]): any {
    const repairedData = JSON.parse(JSON.stringify(data)); // Deep clone

    try {
      // Fix common issues
      errors.forEach(error => {
        switch (error.code) {
          case 'invalid_string':
            if (error.field === 'title' && !repairedData.title) {
              repairedData.title = 'Untitled Context';
            }
            break;
          
          case 'too_big':
            if (error.field === 'content' && repairedData.content) {
              repairedData.content = repairedData.content.substring(0, 100000);
            }
            break;
          
          case 'invalid_type':
            if (error.field.includes('tokenCount') && typeof repairedData.metadata?.tokenCount === 'string') {
              repairedData.metadata.tokenCount = parseInt(repairedData.metadata.tokenCount) || 0;
            }
            break;
        }
      });

      // Clean up arrays
      if (Array.isArray(repairedData.tags)) {
        repairedData.tags = [...new Set(repairedData.tags.filter(Boolean))]; // Remove duplicates and falsy values
      }

      logger.info('Data repair attempted', { originalErrors: errors.length });
      return repairedData;

    } catch (error) {
      logger.error('Data repair failed:', error);
      return data; // Return original data if repair fails
    }
  }
}

/**
 * Factory function to create context validator
 */
export function createContextValidator(): ContextValidator {
  return new ContextValidator();
}