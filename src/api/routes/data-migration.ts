/**
 * Data Migration API Routes
 * Provides RESTful endpoints for data export and import functionality
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { DataMigrationService } from '../../core/services/data-migration.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './temp/uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.json', '.csv', '.xml', '.yaml', '.yml', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: JSON, CSV, XML, YAML, Markdown'));
    }
  }
});

const dataMigrationService = new DataMigrationService();

// Validation schemas
const ExportOptionsSchema = z.object({
  format: z.enum(['json', 'csv', 'xml', 'yaml', 'markdown']),
  includeMetadata: z.boolean().default(true),
  includeBinaryData: z.boolean().default(false),
  compression: z.enum(['gzip', 'brotli', 'none']).optional(),
  encryption: z.object({
    enabled: z.boolean(),
    algorithm: z.enum(['aes-256-gcm', 'aes-256-cbc']),
    key: z.string().optional(),
  }).optional(),
  filters: z.object({
    dateRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }).optional(),
    types: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    sessionIds: z.array(z.string()).optional(),
    importance: z.array(z.string()).optional(),
  }).optional(),
  splitLargeFiles: z.object({
    enabled: z.boolean(),
    maxSizeBytes: z.number().positive(),
  }).optional(),
});

const ImportOptionsSchema = z.object({
  format: z.enum(['json', 'csv', 'xml', 'yaml', 'markdown']),
  validateSchema: z.boolean().default(true),
  skipDuplicates: z.boolean().default(true),
  overwriteExisting: z.boolean().default(false),
  batchSize: z.number().min(1).max(1000).default(100),
  dryRun: z.boolean().default(false),
  mapping: z.object({
    fieldMappings: z.record(z.string()),
    transformations: z.array(z.object({
      field: z.string(),
      transformation: z.enum(['uppercase', 'lowercase', 'trim', 'custom']),
      customFunction: z.string().optional(),
    })),
  }).optional(),
  errorHandling: z.enum(['strict', 'lenient', 'skip-errors']).default('lenient'),
});

const DataTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  version: z.string().min(1).max(20),
  schema: z.object({
    type: z.enum(['context', 'session', 'template', 'mixed']),
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object']),
      required: z.boolean(),
      validation: z.string().optional(),
      description: z.string().optional(),
    })),
  }),
  transformation: z.object({
    mapping: z.record(z.string()),
    computedFields: z.array(z.object({
      name: z.string(),
      expression: z.string(),
      type: z.string(),
    })),
  }),
});

/**
 * Export data with comprehensive options
 */
router.post('/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { dataType, options } = req.body;
    const userId = req.user?.id || 'anonymous';

    // Validate input
    if (!['contexts', 'sessions', 'templates', 'all'].includes(dataType)) {
      return res.status(400).json({
        error: 'Invalid data type. Must be one of: contexts, sessions, templates, all'
      });
    }

    const validatedOptions = ExportOptionsSchema.parse(options);

    // Mock data for export (in production, this would fetch from storage)
    const mockData = await getMockDataForExport(dataType);

    const result = await dataMigrationService.exportData(
      dataType,
      mockData,
      validatedOptions,
      userId
    );

    res.json({
      success: result.success,
      exportId: result.exportId,
      downloadUrl: `/api/data-migration/download/${result.exportId}`,
      metadata: {
        recordCount: result.recordCount,
        fileSize: result.fileSize,
        format: result.format,
        duration: result.duration,
      },
      error: result.error,
    });
  } catch (error) {
    logger.error('Export failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      error: 'Export operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Import data from uploaded file
 */
router.post('/import', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { dataType, options } = req.body;
    const userId = req.user?.id || 'anonymous';

    // Validate input
    if (!['contexts', 'sessions', 'templates', 'auto-detect'].includes(dataType)) {
      return res.status(400).json({
        error: 'Invalid data type. Must be one of: contexts, sessions, templates, auto-detect'
      });
    }

    const validatedOptions = ImportOptionsSchema.parse(JSON.parse(options || '{}'));

    const result = await dataMigrationService.importData(
      req.file.path,
      dataType,
      validatedOptions,
      userId
    );

    res.json({
      success: result.success,
      importId: result.importId,
      summary: {
        processedRecords: result.processedRecords,
        successfulRecords: result.successfulRecords,
        failedRecords: result.failedRecords,
        skippedRecords: result.skippedRecords,
        duplicatesFound: result.duplicatesFound,
        duration: result.duration,
      },
      errors: result.errors.slice(0, 10), // Return first 10 errors
      validationErrors: result.validationErrors.slice(0, 10), // Return first 10 validation errors
      hasMoreErrors: result.errors.length > 10,
      hasMoreValidationErrors: result.validationErrors.length > 10,
    });
  } catch (error) {
    logger.error('Import failed', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      error: 'Import operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get progress of an active operation
 */
router.get('/operations/:operationId/progress', authenticate, async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const progress = dataMigrationService.getOperationProgress(operationId);

    if (!progress) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    res.json({
      success: true,
      progress: {
        operationId: progress.operationId,
        type: progress.type,
        status: progress.status,
        progress: progress.progress,
        currentStep: progress.currentStep,
        totalSteps: progress.totalSteps,
        currentRecord: progress.currentRecord,
        totalRecords: progress.totalRecords,
        startTime: progress.startTime,
        estimatedCompletion: progress.estimatedCompletion,
        errors: progress.errors,
      },
    });
  } catch (error) {
    logger.error('Failed to get operation progress', error);
    res.status(500).json({
      error: 'Failed to get operation progress',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get all active operations
 */
router.get('/operations/active', authenticate, async (req: Request, res: Response) => {
  try {
    const activeOperations = dataMigrationService.getActiveOperations();

    res.json({
      success: true,
      operations: activeOperations.map(op => ({
        operationId: op.operationId,
        type: op.type,
        status: op.status,
        progress: op.progress,
        currentStep: op.currentStep,
        startTime: op.startTime,
        totalRecords: op.totalRecords,
        currentRecord: op.currentRecord,
      })),
      totalCount: activeOperations.length,
    });
  } catch (error) {
    logger.error('Failed to get active operations', error);
    res.status(500).json({
      error: 'Failed to get active operations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get operation history
 */
router.get('/operations/history', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = dataMigrationService.getOperationHistory(limit);

    res.json({
      success: true,
      operations: history.map(op => ({
        operationId: op.operationId,
        type: op.type,
        status: op.status,
        progress: op.progress,
        startTime: op.startTime,
        totalRecords: op.totalRecords,
        errors: op.errors,
      })),
      totalCount: history.length,
    });
  } catch (error) {
    logger.error('Failed to get operation history', error);
    res.status(500).json({
      error: 'Failed to get operation history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Cancel an active operation
 */
router.post('/operations/:operationId/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const cancelled = dataMigrationService.cancelOperation(operationId);

    if (!cancelled) {
      return res.status(404).json({
        error: 'Operation not found or cannot be cancelled',
      });
    }

    res.json({
      success: true,
      message: `Operation ${operationId} cancelled successfully`,
    });
  } catch (error) {
    logger.error('Failed to cancel operation', error);
    res.status(500).json({
      error: 'Failed to cancel operation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create a data template
 */
router.post('/templates', authenticate, async (req: Request, res: Response) => {
  try {
    const validatedTemplate = DataTemplateSchema.parse(req.body);
    const template = await dataMigrationService.createDataTemplate(validatedTemplate);

    res.status(201).json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        version: template.version,
        type: template.schema.type,
        fieldCount: template.schema.fields.length,
        createdAt: template.createdAt,
      },
    });
  } catch (error) {
    logger.error('Failed to create data template', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      error: 'Failed to create data template',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get available data templates
 */
router.get('/templates', authenticate, async (req: Request, res: Response) => {
  try {
    const templates = dataMigrationService.getDataTemplates();

    res.json({
      success: true,
      templates: templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        version: template.version,
        type: template.schema.type,
        fieldCount: template.schema.fields.length,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      })),
      totalCount: templates.length,
    });
  } catch (error) {
    logger.error('Failed to get data templates', error);
    res.status(500).json({
      error: 'Failed to get data templates',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get a specific data template
 */
router.get('/templates/:templateId', authenticate, async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;
    const templates = dataMigrationService.getDataTemplates();
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    logger.error('Failed to get data template', error);
    res.status(500).json({
      error: 'Failed to get data template',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Download exported file
 */
router.get('/download/:exportId', authenticate, async (req: Request, res: Response) => {
  try {
    const { exportId } = req.params;
    
    // In production, this would retrieve the actual file path from the export record
    const mockFilePath = `./data/migrations/exports/mock_export_${exportId}.json`;
    
    // For now, return a mock response
    res.json({
      success: true,
      message: 'File download would be initiated here',
      exportId,
      note: 'In production, this would stream the actual file content',
    });
  } catch (error) {
    logger.error('Failed to download export file', error);
    res.status(500).json({
      error: 'Failed to download export file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Validate import file without importing
 */
router.post('/validate', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { dataType, options } = req.body;
    const validatedOptions = ImportOptionsSchema.parse(JSON.parse(options || '{}'));

    // Set dry run to true for validation
    validatedOptions.dryRun = true;

    const result = await dataMigrationService.importData(
      req.file.path,
      dataType,
      validatedOptions,
      'validator'
    );

    res.json({
      success: result.success,
      validation: {
        isValid: result.successfulRecords === result.processedRecords,
        recordCount: result.processedRecords,
        validRecords: result.successfulRecords,
        invalidRecords: result.failedRecords,
        duplicatesFound: result.duplicatesFound,
      },
      errors: result.errors.slice(0, 20), // Return first 20 errors for validation
      validationErrors: result.validationErrors.slice(0, 20),
      summary: `Validation completed: ${result.successfulRecords}/${result.processedRecords} records are valid`,
    });
  } catch (error) {
    logger.error('File validation failed', error);
    res.status(500).json({
      error: 'File validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Helper function to get mock data for export
 */
async function getMockDataForExport(dataType: string): Promise<unknown[]> {
  // In production, this would fetch real data from storage
  const mockContexts = [
    {
      id: 'context-1',
      title: 'Sample Context 1',
      content: 'This is sample content for context 1',
      type: 'general',
      tags: ['sample', 'test'],
      sessionId: 'session-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      metadata: { importance: 'medium' },
    },
    {
      id: 'context-2',
      title: 'Sample Context 2',
      content: 'This is sample content for context 2',
      type: 'analysis',
      tags: ['analysis', 'data'],
      sessionId: 'session-2',
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-04'),
      metadata: { importance: 'high' },
    },
  ];

  const mockSessions = [
    {
      sessionId: 'session-1',
      userId: 'user-1',
      lastActivity: new Date('2024-01-02'),
      contextCount: 1,
    },
    {
      sessionId: 'session-2',
      userId: 'user-2',
      lastActivity: new Date('2024-01-04'),
      contextCount: 1,
    },
  ];

  const mockTemplates = [
    {
      id: 'template-1',
      name: 'Sample Template',
      description: 'A sample template for testing',
      version: '1.0.0',
      type: 'general',
    },
  ];

  switch (dataType) {
    case 'contexts':
      return mockContexts;
    case 'sessions':
      return mockSessions;
    case 'templates':
      return mockTemplates;
    case 'all':
      return [...mockContexts, ...mockSessions, ...mockTemplates];
    default:
      return [];
  }
}

export default router;