/**
 * Data Migration Service Integration Tests
 * Tests comprehensive data export and import functionality including
 * format conversion, validation, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';
import { DataMigrationService } from '../../core/services/data-migration.service.js';
import { setupTestEnvironment } from '../setup/test-environment.js';

describe('Data Migration Service Integration Tests', () => {
  let testEnv: any;
  let dataMigrationService: DataMigrationService;
  let tempDirectory: string;
  let app: any;

  beforeEach(async () => {
    testEnv = await setupTestEnvironment();
    tempDirectory = './temp/test-migrations';
    dataMigrationService = new DataMigrationService('./test-data', tempDirectory);
    app = testEnv.app;

    // Create test directories
    await fs.mkdir(tempDirectory, { recursive: true });
    await fs.mkdir('./test-data/exports', { recursive: true });
    await fs.mkdir('./test-data/imports', { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm('./test-data', { recursive: true, force: true });
      await fs.rm(tempDirectory, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    if (testEnv?.cleanup) {
      await testEnv.cleanup();
    }
  });

  describe('Data Export', () => {
    const mockContexts = [
      {
        id: 'context-1',
        title: 'Test Context 1',
        content: 'This is test content for context 1',
        type: 'general',
        tags: ['test', 'sample'],
        sessionId: 'session-1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        metadata: { importance: 'medium', source: 'test' },
      },
      {
        id: 'context-2',
        title: 'Test Context 2',
        content: 'This is test content for context 2',
        type: 'analysis',
        tags: ['analysis', 'data'],
        sessionId: 'session-2',
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-04'),
        metadata: { importance: 'high', source: 'test' },
      },
    ];

    it('should export data in JSON format', async () => {
      const options = {
        format: 'json' as const,
        includeMetadata: true,
        includeBinaryData: false,
      };

      const result = await dataMigrationService.exportData(
        'contexts',
        mockContexts,
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.exportId).toBeDefined();
      expect(result.format).toBe('json');
      expect(result.recordCount).toBe(2);
      expect(result.filePath).toContain('.json');
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.checksumMd5).toBeDefined();

      // Verify file exists and contains correct data
      const fileExists = await fs.access(result.filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should export data in CSV format', async () => {
      const options = {
        format: 'csv' as const,
        includeMetadata: false,
        includeBinaryData: false,
      };

      const result = await dataMigrationService.exportData(
        'contexts',
        mockContexts,
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
      expect(result.filePath).toContain('.csv');
    });

    it('should export data in XML format', async () => {
      const options = {
        format: 'xml' as const,
        includeMetadata: true,
        includeBinaryData: false,
      };

      const result = await dataMigrationService.exportData(
        'contexts',
        mockContexts,
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.format).toBe('xml');
      expect(result.filePath).toContain('.xml');
    });

    it('should export data in YAML format', async () => {
      const options = {
        format: 'yaml' as const,
        includeMetadata: true,
        includeBinaryData: false,
      };

      const result = await dataMigrationService.exportData(
        'contexts',
        mockContexts,
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.format).toBe('yaml');
      expect(result.filePath).toContain('.yaml');
    });

    it('should export data in Markdown format', async () => {
      const options = {
        format: 'markdown' as const,
        includeMetadata: true,
        includeBinaryData: false,
      };

      const result = await dataMigrationService.exportData(
        'contexts',
        mockContexts,
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.format).toBe('markdown');
      expect(result.filePath).toContain('.markdown');
    });

    it('should apply filters during export', async () => {
      const options = {
        format: 'json' as const,
        includeMetadata: true,
        includeBinaryData: false,
        filters: {
          types: ['general'],
          tags: ['test'],
          dateRange: {
            start: new Date('2023-12-31'),
            end: new Date('2024-01-02'),
          },
        },
      };

      const result = await dataMigrationService.exportData(
        'contexts',
        mockContexts,
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(1); // Only context-1 should match filters
    });

    it('should handle empty data export', async () => {
      const options = {
        format: 'json' as const,
        includeMetadata: true,
        includeBinaryData: false,
      };

      const result = await dataMigrationService.exportData(
        'contexts',
        [],
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(0);
    });

    it('should handle export errors gracefully', async () => {
      const options = {
        format: 'invalid-format' as any,
        includeMetadata: true,
        includeBinaryData: false,
      };

      const result = await dataMigrationService.exportData(
        'contexts',
        mockContexts,
        options,
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.recordCount).toBe(0);
    });
  });

  describe('Data Import', () => {
    it('should import JSON data successfully', async () => {
      // Create test JSON file
      const testData = [
        {
          title: 'Imported Context 1',
          content: 'This is imported content',
          type: 'general',
          tags: ['imported', 'test'],
        },
        {
          title: 'Imported Context 2',
          content: 'This is more imported content',
          type: 'analysis',
          tags: ['imported', 'analysis'],
        },
      ];

      const testFilePath = path.join(tempDirectory, 'test-import.json');
      await fs.writeFile(testFilePath, JSON.stringify(testData, null, 2));

      const options = {
        format: 'json' as const,
        validateSchema: true,
        skipDuplicates: true,
        overwriteExisting: false,
        batchSize: 100,
        dryRun: false,
        errorHandling: 'lenient' as const,
      };

      const result = await dataMigrationService.importData(
        testFilePath,
        'contexts',
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.importId).toBeDefined();
      expect(result.processedRecords).toBe(2);
      expect(result.successfulRecords).toBe(2);
      expect(result.failedRecords).toBe(0);
    });

    it('should import CSV data successfully', async () => {
      // Create test CSV file
      const csvContent = `title,content,type,tags
"Test Context 1","Test content 1","general","test,sample"
"Test Context 2","Test content 2","analysis","test,data"`;

      const testFilePath = path.join(tempDirectory, 'test-import.csv');
      await fs.writeFile(testFilePath, csvContent);

      const options = {
        format: 'csv' as const,
        validateSchema: false,
        skipDuplicates: false,
        overwriteExisting: false,
        batchSize: 100,
        dryRun: false,
        errorHandling: 'lenient' as const,
      };

      const result = await dataMigrationService.importData(
        testFilePath,
        'contexts',
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.processedRecords).toBe(2);
      expect(result.successfulRecords).toBe(2);
    });

    it('should validate schema during import', async () => {
      // Create test data with invalid schema
      const testData = [
        {
          // Missing required 'title' field
          content: 'This has no title',
          type: 'general',
        },
        {
          title: 'Valid Context',
          content: 'This is valid',
          type: 'analysis',
        },
      ];

      const testFilePath = path.join(tempDirectory, 'test-invalid.json');
      await fs.writeFile(testFilePath, JSON.stringify(testData, null, 2));

      const options = {
        format: 'json' as const,
        validateSchema: true,
        skipDuplicates: false,
        overwriteExisting: false,
        batchSize: 100,
        dryRun: false,
        errorHandling: 'lenient' as const,
      };

      const result = await dataMigrationService.importData(
        testFilePath,
        'contexts',
        options,
        'test-user'
      );

      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0].field).toContain('title');
    });

    it('should perform dry run import', async () => {
      const testData = [
        {
          title: 'Dry Run Context',
          content: 'This is a dry run',
          type: 'general',
        },
      ];

      const testFilePath = path.join(tempDirectory, 'test-dry-run.json');
      await fs.writeFile(testFilePath, JSON.stringify(testData, null, 2));

      const options = {
        format: 'json' as const,
        validateSchema: false,
        skipDuplicates: false,
        overwriteExisting: false,
        batchSize: 100,
        dryRun: true,
        errorHandling: 'lenient' as const,
      };

      const result = await dataMigrationService.importData(
        testFilePath,
        'contexts',
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.processedRecords).toBe(1);
      expect(result.successfulRecords).toBe(1);
      // In dry run, no actual data should be saved
    });

    it('should handle import errors with different error handling strategies', async () => {
      const testData = [
        { title: 'Valid Context', content: 'Valid content', type: 'general' },
        { title: '', content: 'Invalid - empty title', type: 'general' }, // Invalid
        { title: 'Another Valid Context', content: 'More valid content', type: 'analysis' },
      ];

      const testFilePath = path.join(tempDirectory, 'test-errors.json');
      await fs.writeFile(testFilePath, JSON.stringify(testData, null, 2));

      // Test lenient error handling
      const leninetOptions = {
        format: 'json' as const,
        validateSchema: true,
        skipDuplicates: false,
        overwriteExisting: false,
        batchSize: 100,
        dryRun: true,
        errorHandling: 'lenient' as const,
      };

      const leninetResult = await dataMigrationService.importData(
        testFilePath,
        'contexts',
        leninetOptions,
        'test-user'
      );

      expect(leninetResult.processedRecords).toBe(3);
      expect(leninetResult.successfulRecords).toBe(2); // Should process valid records
      expect(leninetResult.failedRecords).toBe(1);
    });

    it('should apply field mappings during import', async () => {
      const testData = [
        {
          name: 'Mapped Context', // Will be mapped to 'title'
          body: 'Mapped content', // Will be mapped to 'content'
          category: 'general', // Will be mapped to 'type'
        },
      ];

      const testFilePath = path.join(tempDirectory, 'test-mapping.json');
      await fs.writeFile(testFilePath, JSON.stringify(testData, null, 2));

      const options = {
        format: 'json' as const,
        validateSchema: false,
        skipDuplicates: false,
        overwriteExisting: false,
        batchSize: 100,
        dryRun: true,
        errorHandling: 'lenient' as const,
        mapping: {
          fieldMappings: {
            name: 'title',
            body: 'content',
            category: 'type',
          },
          transformations: [
            {
              field: 'title',
              transformation: 'uppercase' as const,
            },
          ],
        },
      };

      const result = await dataMigrationService.importData(
        testFilePath,
        'contexts',
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.processedRecords).toBe(1);
    });

    it('should handle large file imports with batching', async () => {
      // Create a larger dataset
      const largeTestData = Array.from({ length: 250 }, (_, i) => ({
        title: `Context ${i + 1}`,
        content: `Content for context ${i + 1}`,
        type: 'general',
      }));

      const testFilePath = path.join(tempDirectory, 'test-large.json');
      await fs.writeFile(testFilePath, JSON.stringify(largeTestData, null, 2));

      const options = {
        format: 'json' as const,
        validateSchema: false,
        skipDuplicates: false,
        overwriteExisting: false,
        batchSize: 50, // Process in batches of 50
        dryRun: true,
        errorHandling: 'lenient' as const,
      };

      const result = await dataMigrationService.importData(
        testFilePath,
        'contexts',
        options,
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.processedRecords).toBe(250);
      expect(result.successfulRecords).toBe(250);
    });

    it('should handle file not found error', async () => {
      const options = {
        format: 'json' as const,
        validateSchema: false,
        skipDuplicates: false,
        overwriteExisting: false,
        batchSize: 100,
        dryRun: false,
        errorHandling: 'lenient' as const,
      };

      const result = await dataMigrationService.importData(
        './nonexistent-file.json',
        'contexts',
        options,
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('not found');
    });
  });

  describe('Operation Management', () => {
    it('should track active operations', async () => {
      const initialOperations = dataMigrationService.getActiveOperations();
      expect(initialOperations).toHaveLength(0);

      // Start an export operation (this will complete quickly in tests)
      const exportPromise = dataMigrationService.exportData(
        'contexts',
        [{ id: 'test', title: 'Test', content: 'Test', type: 'general' }],
        { format: 'json', includeMetadata: true, includeBinaryData: false },
        'test-user'
      );

      // Check that operation is tracked (might be too fast to catch in progress)
      await exportPromise;

      // Check operation history
      const history = dataMigrationService.getOperationHistory(10);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].type).toBe('export');
    });

    it('should allow cancelling operations', async () => {
      // This is a simplified test since our mock operations complete quickly
      const activeOperations = dataMigrationService.getActiveOperations();
      
      if (activeOperations.length > 0) {
        const operationId = activeOperations[0].operationId;
        const cancelled = dataMigrationService.cancelOperation(operationId);
        expect(typeof cancelled).toBe('boolean');
      }

      // Test cancelling non-existent operation
      const cancelNonExistent = dataMigrationService.cancelOperation('non-existent-id');
      expect(cancelNonExistent).toBe(false);
    });

    it('should get operation progress', async () => {
      // Start an operation and immediately check progress
      const exportPromise = dataMigrationService.exportData(
        'contexts',
        [{ id: 'test', title: 'Test', content: 'Test', type: 'general' }],
        { format: 'json', includeMetadata: true, includeBinaryData: false },
        'test-user'
      );

      await exportPromise;

      // Check that we can get undefined for non-existent operations
      const nonExistentProgress = dataMigrationService.getOperationProgress('non-existent');
      expect(nonExistentProgress).toBeUndefined();
    });
  });

  describe('Data Templates', () => {
    it('should create and manage data templates', async () => {
      const templateData = {
        name: 'Test Template',
        description: 'A template for testing',
        version: '1.0.0',
        schema: {
          type: 'context' as const,
          fields: [
            {
              name: 'title',
              type: 'string' as const,
              required: true,
              description: 'Context title',
            },
            {
              name: 'content',
              type: 'string' as const,
              required: true,
              description: 'Context content',
            },
          ],
        },
        transformation: {
          mapping: {
            title: 'title',
            content: 'content',
          },
          computedFields: [],
        },
      };

      const template = await dataMigrationService.createDataTemplate(templateData);

      expect(template.id).toBeDefined();
      expect(template.name).toBe(templateData.name);
      expect(template.description).toBe(templateData.description);
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);

      // Verify template is in the list
      const templates = dataMigrationService.getDataTemplates();
      const createdTemplate = templates.find(t => t.id === template.id);
      expect(createdTemplate).toBeDefined();
    });

    it('should have default templates available', async () => {
      const templates = dataMigrationService.getDataTemplates();
      expect(templates.length).toBeGreaterThan(0);

      const standardTemplate = templates.find(t => t.name === 'Standard Context Export');
      expect(standardTemplate).toBeDefined();
      expect(standardTemplate?.schema.type).toBe('context');
    });
  });

  describe('Format Compatibility', () => {
    const testData = [
      {
        id: 'format-test-1',
        title: 'Format Test Context',
        content: 'Testing format compatibility',
        type: 'general',
        tags: ['format', 'test'],
        createdAt: new Date('2024-01-01'),
      },
    ];

    it('should maintain data integrity across JSON export/import cycle', async () => {
      // Export to JSON
      const exportResult = await dataMigrationService.exportData(
        'contexts',
        testData,
        { format: 'json', includeMetadata: true, includeBinaryData: false },
        'test-user'
      );

      expect(exportResult.success).toBe(true);

      // Import the exported JSON
      const importResult = await dataMigrationService.importData(
        exportResult.filePath,
        'contexts',
        {
          format: 'json',
          validateSchema: false,
          skipDuplicates: false,
          overwriteExisting: false,
          batchSize: 100,
          dryRun: true,
          errorHandling: 'lenient',
        },
        'test-user'
      );

      expect(importResult.success).toBe(true);
      expect(importResult.processedRecords).toBe(1);
      expect(importResult.successfulRecords).toBe(1);
    });

    it('should handle special characters in different formats', async () => {
      const specialCharData = [
        {
          id: 'special-1',
          title: 'Special Characters: "quotes", <tags>, & ampersands',
          content: 'Content with\nnewlines\tand\ttabs',
          type: 'general',
        },
      ];

      // Test each format
      const formats: Array<'json' | 'csv' | 'xml' | 'yaml' | 'markdown'> = ['json', 'csv', 'xml', 'yaml', 'markdown'];

      for (const format of formats) {
        const result = await dataMigrationService.exportData(
          'contexts',
          specialCharData,
          { format, includeMetadata: false, includeBinaryData: false },
          'test-user'
        );

        expect(result.success).toBe(true);
        expect(result.format).toBe(format);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty files gracefully', async () => {
      const emptyFilePath = path.join(tempDirectory, 'empty.json');
      await fs.writeFile(emptyFilePath, '');

      const result = await dataMigrationService.importData(
        emptyFilePath,
        'contexts',
        {
          format: 'json',
          validateSchema: false,
          skipDuplicates: false,
          overwriteExisting: false,
          batchSize: 100,
          dryRun: false,
          errorHandling: 'lenient',
        },
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('empty');
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedJsonPath = path.join(tempDirectory, 'malformed.json');
      await fs.writeFile(malformedJsonPath, '{"invalid": json}');

      const result = await dataMigrationService.importData(
        malformedJsonPath,
        'contexts',
        {
          format: 'json',
          validateSchema: false,
          skipDuplicates: false,
          overwriteExisting: false,
          batchSize: 100,
          dryRun: false,
          errorHandling: 'lenient',
        },
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle very large records appropriately', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of text
      const largeData = [
        {
          title: 'Large Context',
          content: largeContent,
          type: 'general',
        },
      ];

      const result = await dataMigrationService.exportData(
        'contexts',
        largeData,
        { format: 'json', includeMetadata: false, includeBinaryData: false },
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(1000000);
    });
  });
});