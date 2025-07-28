# Data Migration Guide

This guide covers the comprehensive data export and import functionality of the Persistent Context Store, including format conversion, validation, and migration strategies.

## Overview

The data migration system provides robust tools for:

- **Multi-format export/import** (JSON, CSV, XML, YAML, Markdown)
- **Schema validation** and data transformation
- **Batch processing** with progress tracking
- **Error handling** and recovery mechanisms
- **Template-based migrations** for reusable configurations
- **Compression and encryption** for secure transfers

## Quick Start

### Basic Export

```typescript
import { DataMigrationService } from './core/services/data-migration.service';

const migrationService = new DataMigrationService();

// Export contexts to JSON
const exportResult = await migrationService.exportData(
  'contexts',
  contextData,
  {
    format: 'json',
    includeMetadata: true,
    includeBinaryData: false,
  },
  'user123'
);

console.log('Export completed:', exportResult.exportId);
```

### Basic Import

```typescript
// Import from JSON file
const importResult = await migrationService.importData(
  './data/export.json',
  'contexts',
  {
    format: 'json',
    validateSchema: true,
    skipDuplicates: true,
    batchSize: 100,
    dryRun: false,
    errorHandling: 'lenient',
  },
  'user123'
);

console.log(`Imported ${importResult.successfulRecords} records`);
```

### Using the REST API

```bash
# Export data
curl -X POST http://localhost:3000/api/data-migration/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "dataType": "contexts",
    "options": {
      "format": "json",
      "includeMetadata": true,
      "filters": {
        "dateRange": {
          "start": "2024-01-01T00:00:00Z",
          "end": "2024-12-31T23:59:59Z"
        }
      }
    }
  }'

# Import data
curl -X POST http://localhost:3000/api/data-migration/import \
  -H "Authorization: Bearer your-token" \
  -F "file=@data.json" \
  -F 'dataType=contexts' \
  -F 'options={"format":"json","validateSchema":true}'
```

## Supported Formats

### JSON Export/Import

**Best for**: Complete data fidelity, programmatic processing

```typescript
const jsonOptions = {
  format: 'json',
  includeMetadata: true,
  includeBinaryData: false,
};

// Exported JSON structure
{
  "id": "context-123",
  "title": "Sample Context",
  "content": "Context content here",
  "type": "general",
  "tags": ["sample", "test"],
  "createdAt": "2024-01-01T00:00:00Z",
  "metadata": {
    "importance": "medium",
    "source": "api"
  }
}
```

### CSV Export/Import

**Best for**: Spreadsheet compatibility, data analysis

```typescript
const csvOptions = {
  format: 'csv',
  includeMetadata: false, // Flattens complex objects
  includeBinaryData: false,
};

// CSV output example:
// id,title,content,type,tags,createdAt
// "context-123","Sample Context","Context content","general","sample,test","2024-01-01T00:00:00Z"
```

### XML Export/Import

**Best for**: System integrations, enterprise applications

```typescript
const xmlOptions = {
  format: 'xml',
  includeMetadata: true,
  includeBinaryData: false,
};

// XML output example:
// <data>
//   <item>
//     <id>context-123</id>
//     <title>Sample Context</title>
//     <content>Context content here</content>
//   </item>
// </data>
```

### YAML Export/Import

**Best for**: Configuration files, human-readable data

```typescript
const yamlOptions = {
  format: 'yaml',
  includeMetadata: true,
  includeBinaryData: false,
};

// YAML output example:
// - id: context-123
//   title: "Sample Context"
//   content: "Context content here"
//   type: general
```

### Markdown Export

**Best for**: Documentation, readable exports

```typescript
const markdownOptions = {
  format: 'markdown',
  includeMetadata: true,
  includeBinaryData: false,
};

// Markdown output example:
// ## Item 1
// **id:** context-123
// **title:** Sample Context
// **content:** Context content here
```

## Advanced Features

### Filtering and Selection

```typescript
const filteredExport = await migrationService.exportData(
  'contexts',
  data,
  {
    format: 'json',
    includeMetadata: true,
    includeBinaryData: false,
    filters: {
      // Date range filtering
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      },
      // Type filtering
      types: ['general', 'analysis'],
      // Tag filtering
      tags: ['important', 'research'],
      // Session filtering
      sessionIds: ['session-1', 'session-2'],
      // Importance filtering
      importance: ['high', 'critical'],
    },
  },
  'user123'
);
```

### Compression and Encryption

```typescript
const secureExport = await migrationService.exportData(
  'contexts',
  data,
  {
    format: 'json',
    includeMetadata: true,
    includeBinaryData: true,
    // Compression options
    compression: 'gzip', // or 'brotli', 'none'
    // Encryption options
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      key: 'your-encryption-key',
    },
    // Large file splitting
    splitLargeFiles: {
      enabled: true,
      maxSizeBytes: 50 * 1024 * 1024, // 50MB chunks
    },
  },
  'user123'
);
```

### Field Mapping and Transformation

```typescript
const importWithMapping = await migrationService.importData(
  './data/legacy-export.csv',
  'contexts',
  {
    format: 'csv',
    validateSchema: true,
    skipDuplicates: true,
    batchSize: 100,
    dryRun: false,
    errorHandling: 'lenient',
    // Field mapping for legacy data
    mapping: {
      fieldMappings: {
        'legacy_title': 'title',
        'legacy_body': 'content',
        'legacy_category': 'type',
        'legacy_keywords': 'tags',
      },
      transformations: [
        {
          field: 'title',
          transformation: 'trim',
        },
        {
          field: 'type',
          transformation: 'lowercase',
        },
        {
          field: 'tags',
          transformation: 'custom',
          customFunction: 'splitAndTrim',
        },
      ],
    },
  },
  'user123'
);
```

### Schema Validation

```typescript
// Strict validation
const strictImport = await migrationService.importData(
  './data/import.json',
  'contexts',
  {
    format: 'json',
    validateSchema: true,
    skipDuplicates: true,
    batchSize: 50,
    dryRun: false,
    errorHandling: 'strict', // Fails on first error
  },
  'user123'
);

// Lenient validation with error collection
const leninetImport = await migrationService.importData(
  './data/import.json',
  'contexts',
  {
    format: 'json',
    validateSchema: true,
    skipDuplicates: true,
    batchSize: 100,
    dryRun: false,
    errorHandling: 'lenient', // Collects errors, continues processing
  },
  'user123'
);

console.log('Validation errors:', leninetImport.validationErrors);
console.log('Processing errors:', leninetImport.errors);
```

## Data Templates

### Creating Templates

```typescript
// Create a reusable template
const template = await migrationService.createDataTemplate({
  name: 'Standard Context Export',
  description: 'Standard format for exporting contexts with metadata',
  version: '1.0.0',
  schema: {
    type: 'context',
    fields: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Unique context identifier',
      },
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Context title',
      },
      {
        name: 'content',
        type: 'string',
        required: true,
        description: 'Context content',
      },
      {
        name: 'tags',
        type: 'array',
        required: false,
        description: 'Context tags',
      },
    ],
  },
  transformation: {
    mapping: {
      'id': 'id',
      'title': 'title',
      'content': 'content',
      'tags': 'tags',
    },
    computedFields: [
      {
        name: 'exportedAt',
        expression: 'new Date()',
        type: 'date',
      },
    ],
  },
});

console.log('Template created:', template.id);
```

### Using Templates

```typescript
// Get available templates
const templates = migrationService.getDataTemplates();
console.log('Available templates:', templates.map(t => t.name));

// Templates can be referenced in export/import operations
// (Implementation would use template configuration)
```

## Operation Management

### Progress Tracking

```typescript
// Start a long-running operation
const exportPromise = migrationService.exportData('contexts', largeDataset, options, 'user123');

// Get operation ID from the promise (implementation detail)
const operationId = 'operation-123';

// Check progress
const progress = migrationService.getOperationProgress(operationId);
if (progress) {
  console.log(`Progress: ${progress.progress}% - ${progress.currentStep}`);
  console.log(`Records: ${progress.currentRecord}/${progress.totalRecords}`);
  console.log(`Estimated completion: ${progress.estimatedCompletion}`);
}

// Get all active operations
const activeOps = migrationService.getActiveOperations();
console.log(`${activeOps.length} operations running`);
```

### Operation History

```typescript
// Get recent operations
const history = migrationService.getOperationHistory(20);

history.forEach(op => {
  console.log(`${op.type} operation ${op.operationId}:`);
  console.log(`  Status: ${op.status}`);
  console.log(`  Duration: ${op.startTime} - ${op.progress}%`);
  if (op.errors.length > 0) {
    console.log(`  Errors: ${op.errors.length}`);
  }
});
```

### Cancelling Operations

```typescript
// Cancel a running operation
const cancelled = migrationService.cancelOperation('operation-123');
if (cancelled) {
  console.log('Operation cancelled successfully');
} else {
  console.log('Operation could not be cancelled (not found or already completed)');
}
```

## REST API Reference

### Export Endpoints

```http
POST /api/data-migration/export
Content-Type: application/json
Authorization: Bearer <token>

{
  "dataType": "contexts|sessions|templates|all",
  "options": {
    "format": "json|csv|xml|yaml|markdown",
    "includeMetadata": true,
    "includeBinaryData": false,
    "compression": "gzip|brotli|none",
    "filters": {
      "dateRange": {
        "start": "2024-01-01T00:00:00Z",
        "end": "2024-12-31T23:59:59Z"
      },
      "types": ["general", "analysis"],
      "tags": ["important"],
      "sessionIds": ["session-1"],
      "importance": ["high"]
    }
  }
}
```

### Import Endpoints

```http
POST /api/data-migration/import
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <binary file data>
dataType: contexts|sessions|templates|auto-detect
options: {
  "format": "json|csv|xml|yaml|markdown",
  "validateSchema": true,
  "skipDuplicates": true,
  "batchSize": 100,
  "dryRun": false,
  "errorHandling": "strict|lenient|skip-errors"
}
```

### Progress and Management Endpoints

```http
# Get operation progress
GET /api/data-migration/operations/{operationId}/progress

# Get active operations
GET /api/data-migration/operations/active

# Get operation history
GET /api/data-migration/operations/history?limit=50

# Cancel operation
POST /api/data-migration/operations/{operationId}/cancel

# Validate file without importing
POST /api/data-migration/validate
Content-Type: multipart/form-data
```

### Template Endpoints

```http
# Create template
POST /api/data-migration/templates
Content-Type: application/json

# Get templates
GET /api/data-migration/templates

# Get specific template
GET /api/data-migration/templates/{templateId}
```

## Migration Strategies

### Full System Migration

```typescript
// Export everything
const fullExport = await migrationService.exportData(
  'all',
  allData,
  {
    format: 'json',
    includeMetadata: true,
    includeBinaryData: true,
    compression: 'gzip',
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      key: process.env.MIGRATION_KEY,
    },
  },
  'admin'
);

// Import to new system
const fullImport = await migrationService.importData(
  fullExport.filePath,
  'auto-detect',
  {
    format: 'json',
    validateSchema: true,
    skipDuplicates: false,
    overwriteExisting: true,
    batchSize: 50,
    dryRun: false,
    errorHandling: 'strict',
  },
  'admin'
);
```

### Incremental Migration

```typescript
// Export recent changes only
const incrementalExport = await migrationService.exportData(
  'contexts',
  recentContexts,
  {
    format: 'json',
    includeMetadata: true,
    includeBinaryData: false,
    filters: {
      dateRange: {
        start: lastMigrationDate,
        end: new Date(),
      },
    },
  },
  'system'
);

// Import with duplicate skipping
const incrementalImport = await migrationService.importData(
  incrementalExport.filePath,
  'contexts',
  {
    format: 'json',
    validateSchema: true,
    skipDuplicates: true, // Skip existing records
    overwriteExisting: false,
    batchSize: 100,
    dryRun: false,
    errorHandling: 'lenient',
  },
  'system'
);
```

### Legacy System Migration

```typescript
// Map legacy field names
const legacyMigration = await migrationService.importData(
  './legacy-export.csv',
  'contexts',
  {
    format: 'csv',
    validateSchema: true,
    skipDuplicates: true,
    batchSize: 25, // Smaller batches for legacy data
    dryRun: false,
    errorHandling: 'lenient',
    mapping: {
      fieldMappings: {
        'old_id': 'id',
        'old_name': 'title',
        'old_description': 'content',
        'old_type': 'type',
        'old_created': 'createdAt',
      },
      transformations: [
        {
          field: 'createdAt',
          transformation: 'custom',
          customFunction: 'parseOldDateFormat',
        },
        {
          field: 'type',
          transformation: 'lowercase',
        },
      ],
    },
  },
  'migration-admin'
);
```

## Best Practices

### Data Preparation

1. **Clean Data First**: Remove or fix invalid data before export
2. **Validate Schema**: Use schema validation to catch issues early
3. **Test with Small Datasets**: Always test migration logic with small samples
4. **Backup Original Data**: Keep backups of source data

```typescript
// Pre-migration validation
const validationResult = await migrationService.importData(
  './data-to-import.json',
  'contexts',
  { ...importOptions, dryRun: true },
  'validator'
);

if (validationResult.validationErrors.length > 0) {
  console.error('Validation failed:', validationResult.validationErrors);
  return;
}
```

### Performance Optimization

1. **Use Appropriate Batch Sizes**: Balance memory usage and performance
2. **Filter Data**: Export only what you need
3. **Compress Large Files**: Use compression for large datasets
4. **Monitor Progress**: Track long-running operations

```typescript
// Optimized for large datasets
const optimizedOptions = {
  format: 'json',
  includeMetadata: false, // Reduce file size
  includeBinaryData: false, // Skip binary data
  compression: 'gzip', // Compress output
  batchSize: 50, // Smaller batches for memory efficiency
  filters: {
    // Only export recent data
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
    },
  },
};
```

### Error Handling

1. **Use Lenient Mode**: For initial migrations, use lenient error handling
2. **Review Errors**: Always review import errors and validation issues
3. **Retry Failed Records**: Implement retry logic for failed imports
4. **Log Operations**: Keep detailed logs of migration operations

```typescript
// Comprehensive error handling
const migrationResult = await migrationService.importData(
  filePath,
  dataType,
  {
    ...options,
    errorHandling: 'lenient',
  },
  userId
);

// Review and handle errors
if (migrationResult.errors.length > 0) {
  console.log(`${migrationResult.errors.length} errors occurred:`);
  migrationResult.errors.forEach((error, index) => {
    console.log(`Record ${error.record}: ${error.error}`);
    
    // Log to file for later review
    logger.error('Migration error', {
      record: error.record,
      error: error.error,
      data: error.data,
    });
  });
}

// Handle validation errors
if (migrationResult.validationErrors.length > 0) {
  console.log('Validation issues found:');
  migrationResult.validationErrors.forEach(error => {
    console.log(`${error.field}: ${error.message}`);
  });
}
```

### Security Considerations

1. **Encrypt Sensitive Data**: Use encryption for exports containing sensitive information
2. **Validate Input**: Always validate imported data
3. **Access Control**: Restrict migration operations to authorized users
4. **Audit Trail**: Maintain audit logs of all migration operations

```typescript
// Secure migration
const secureMigration = {
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    key: process.env.MIGRATION_ENCRYPTION_KEY,
  },
  validateSchema: true,
  errorHandling: 'strict', // Fail on any security-related errors
};
```

## Troubleshooting

### Common Issues

#### Large File Imports Fail
- **Cause**: Memory limitations or file size restrictions
- **Solution**: Use smaller batch sizes, enable file splitting, or compress data

```typescript
const largeFileOptions = {
  batchSize: 25, // Smaller batches
  splitLargeFiles: {
    enabled: true,
    maxSizeBytes: 10 * 1024 * 1024, // 10MB chunks
  },
};
```

#### Schema Validation Errors
- **Cause**: Data doesn't match expected schema
- **Solution**: Review validation errors, fix data, or adjust mapping

```typescript
// Run validation only first
const validation = await migrationService.importData(
  filePath,
  dataType,
  { ...options, dryRun: true },
  userId
);

// Review and fix validation errors before actual import
```

#### Slow Import Performance
- **Cause**: Large batch sizes, complex transformations, or database bottlenecks
- **Solution**: Optimize batch size, simplify transformations, or use staging area

```typescript
const optimizedImport = {
  batchSize: 10, // Much smaller batches
  validateSchema: false, // Skip validation if data is pre-validated
  mapping: undefined, // Skip transformations if possible
};
```

### Debug Information

Enable detailed logging to troubleshoot issues:

```typescript
// Enable debug logging in service
process.env.LOG_LEVEL = 'debug';

// Monitor operation progress
const operationId = 'your-operation-id';
const checkProgress = setInterval(() => {
  const progress = migrationService.getOperationProgress(operationId);
  if (progress) {
    console.log(`${progress.currentStep}: ${progress.progress}%`);
    console.log(`Processed: ${progress.currentRecord}/${progress.totalRecords}`);
  } else {
    clearInterval(checkProgress);
  }
}, 5000);
```

## Migration Checklist

### Pre-Migration

- [ ] Backup source data
- [ ] Test migration with small sample
- [ ] Validate data schema
- [ ] Review and clean source data
- [ ] Plan for downtime if required
- [ ] Prepare rollback strategy

### During Migration

- [ ] Monitor operation progress
- [ ] Watch for errors and warnings  
- [ ] Verify intermediate results
- [ ] Maintain audit logs
- [ ] Monitor system resources

### Post-Migration

- [ ] Validate migrated data completeness
- [ ] Test application functionality
- [ ] Compare record counts
- [ ] Review error logs
- [ ] Update documentation
- [ ] Archive migration files

## Support

For additional help with data migration:

- Review the API documentation for detailed parameter information
- Check the integration tests for usage examples
- Monitor application logs for detailed error information
- Use dry run mode to validate operations before execution
- Contact the development team for complex migration scenarios