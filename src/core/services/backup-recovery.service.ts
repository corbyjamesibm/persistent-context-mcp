/**
 * Backup and Recovery Service for Production Deployment
 * Provides automated backup, recovery, and data integrity features
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Neo4jContextStore } from '../storage/neo4j-store.js';
import { logger } from '../../utils/logger.js';

export interface BackupConfig {
  backupDirectory: string;
  retentionDays: number;
  compressionEnabled: boolean;
  backupInterval: number; // milliseconds
  incrementalBackups: boolean;
  maxBackupSize: number; // bytes
  enableEncryption: boolean;
  encryptionKey?: string;
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  compressed: boolean;
  encrypted: boolean;
  contextCount: number;
  checksum: string;
  version: string;
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  filePath: string;
  size: number;
  duration: number;
  error?: string;
  metadata: BackupMetadata;
}

export interface RecoveryResult {
  success: boolean;
  restoredContexts: number;
  duration: number;
  error?: string;
  backupId: string;
}

export class BackupRecoveryService extends EventEmitter {
  private config: BackupConfig;
  private contextStore: Neo4jContextStore;
  private backupTimer: NodeJS.Timer | null = null;
  private isRunning = false;
  private lastBackupTime: Date | null = null;

  constructor(contextStore: Neo4jContextStore, config?: Partial<BackupConfig>) {
    super();
    
    this.contextStore = contextStore;
    this.config = {
      backupDirectory: './backups',
      retentionDays: 30,
      compressionEnabled: true,
      backupInterval: 24 * 60 * 60 * 1000, // 24 hours
      incrementalBackups: true,
      maxBackupSize: 1024 * 1024 * 1024, // 1GB
      enableEncryption: false,
      ...config,
    };
  }

  /**
   * Start automated backup service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Backup service is already running');
      return;
    }

    // Ensure backup directory exists
    await this.ensureBackupDirectory();

    this.isRunning = true;
    this.scheduleNextBackup();
    
    logger.info(`Backup service started with ${this.config.backupInterval}ms interval`);
    this.emit('started');
  }

  /**
   * Stop automated backup service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.backupTimer) {
      clearTimeout(this.backupTimer);
      this.backupTimer = null;
    }

    logger.info('Backup service stopped');
    this.emit('stopped');
  }

  /**
   * Create a manual backup
   */
  async createBackup(type: 'full' | 'incremental' = 'full'): Promise<BackupResult> {
    const startTime = Date.now();
    const backupId = this.generateBackupId();
    
    try {
      logger.info(`Starting ${type} backup: ${backupId}`);
      
      // Get data to backup
      const contexts = await this.getContextsForBackup(type);
      const contextCount = contexts.length;
      
      if (contextCount === 0 && type === 'incremental') {
        logger.info('No new contexts since last backup');
        return {
          success: true,
          backupId,
          filePath: '',
          size: 0,
          duration: Date.now() - startTime,
          metadata: {
            id: backupId,
            timestamp: new Date(),
            type,
            size: 0,
            compressed: false,
            encrypted: false,
            contextCount: 0,
            checksum: '',
            version: '1.0.0',
          },
        };
      }

      // Create backup data structure
      const backupData = {
        metadata: {
          id: backupId,
          timestamp: new Date(),
          type,
          version: '1.0.0',
          contextCount,
        },
        contexts,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      };

      // Serialize and save backup
      const filePath = await this.saveBackupData(backupId, backupData);
      const fileStats = await fs.stat(filePath);
      const checksum = await this.calculateChecksum(filePath);

      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        type,
        size: fileStats.size,
        compressed: this.config.compressionEnabled,
        encrypted: this.config.enableEncryption,
        contextCount,
        checksum,
        version: '1.0.0',
      };

      // Save metadata
      await this.saveBackupMetadata(backupId, metadata);
      
      // Update last backup time
      this.lastBackupTime = new Date();
      
      const duration = Date.now() - startTime;
      logger.info(`Backup completed: ${backupId} (${contextCount} contexts, ${fileStats.size} bytes, ${duration}ms)`);
      
      const result: BackupResult = {
        success: true,
        backupId,
        filePath,
        size: fileStats.size,
        duration,
        metadata,
      };

      this.emit('backupCompleted', result);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Backup failed: ${backupId}`, error);
      
      const result: BackupResult = {
        success: false,
        backupId,
        filePath: '',
        size: 0,
        duration,
        error: errorMessage,
        metadata: {
          id: backupId,
          timestamp: new Date(),
          type,
          size: 0,
          compressed: false,
          encrypted: false,
          contextCount: 0,
          checksum: '',
          version: '1.0.0',
        },
      };

      this.emit('backupFailed', { backupId, error: errorMessage });
      return result;
    }
  }

  /**
   * Restore from a backup
   */
  async restoreFromBackup(backupId: string, options?: {
    validateChecksum?: boolean;
    overwriteExisting?: boolean;
  }): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting restore from backup: ${backupId}`);
      
      // Load backup metadata
      const metadata = await this.loadBackupMetadata(backupId);
      if (!metadata) {
        throw new Error(`Backup metadata not found: ${backupId}`);
      }

      // Validate checksum if requested
      if (options?.validateChecksum !== false) {
        const isValid = await this.validateBackupChecksum(backupId, metadata.checksum);
        if (!isValid) {
          throw new Error(`Backup checksum validation failed: ${backupId}`);
        }
      }

      // Load backup data
      const backupData = await this.loadBackupData(backupId);
      if (!backupData || !backupData.contexts) {
        throw new Error(`Invalid backup data: ${backupId}`);
      }

      // Restore contexts
      let restoredCount = 0;
      for (const context of backupData.contexts) {
        try {
          // Check if context exists (if not overwriting)
          if (!options?.overwriteExisting) {
            const existingContext = await this.contextStore.getContext(context.id);
            if (existingContext) {
              logger.debug(`Skipping existing context: ${context.id}`);
              continue;
            }
          }

          // Restore context
          await this.contextStore.saveContext(context);
          restoredCount++;
          
        } catch (contextError) {
          logger.warn(`Failed to restore context ${context.id}:`, contextError);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Restore completed: ${backupId} (${restoredCount}/${backupData.contexts.length} contexts restored, ${duration}ms)`);
      
      const result: RecoveryResult = {
        success: true,
        restoredContexts: restoredCount,
        duration,
        backupId,
      };

      this.emit('restoreCompleted', result);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Restore failed: ${backupId}`, error);
      
      const result: RecoveryResult = {
        success: false,
        restoredContexts: 0,
        duration,
        error: errorMessage,
        backupId,
      };

      this.emit('restoreFailed', { backupId, error: errorMessage });
      return result;
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const backupDir = this.config.backupDirectory;
      const files = await fs.readdir(backupDir);
      const metadataFiles = files.filter(file => file.endsWith('.metadata.json'));
      
      const backups: BackupMetadata[] = [];
      for (const file of metadataFiles) {
        try {
          const backupId = file.replace('.metadata.json', '');
          const metadata = await this.loadBackupMetadata(backupId);
          if (metadata) {
            backups.push(metadata);
          }
        } catch (error) {
          logger.warn(`Failed to load backup metadata: ${file}`, error);
        }
      }

      // Sort by timestamp (newest first)
      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      logger.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<number> {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date(Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000));
      
      let deletedCount = 0;
      for (const backup of backups) {
        if (backup.timestamp < cutoffDate) {
          try {
            await this.deleteBackup(backup.id);
            deletedCount++;
            logger.info(`Deleted old backup: ${backup.id}`);
          } catch (error) {
            logger.warn(`Failed to delete old backup ${backup.id}:`, error);
          }
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old backups`);
        this.emit('cleanupCompleted', { deletedCount });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old backups:', error);
      return 0;
    }
  }

  /**
   * Validate backup integrity
   */
  async validateBackup(backupId: string): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check if metadata exists
      const metadata = await this.loadBackupMetadata(backupId);
      if (!metadata) {
        issues.push('Backup metadata not found');
        return { isValid: false, issues };
      }

      // Check if backup file exists
      const backupPath = await this.getBackupFilePath(backupId);
      try {
        await fs.access(backupPath);
      } catch {
        issues.push('Backup file not found');
      }

      // Validate checksum
      const isChecksumValid = await this.validateBackupChecksum(backupId, metadata.checksum);
      if (!isChecksumValid) {
        issues.push('Checksum validation failed');
      }

      // Try to load backup data
      try {
        const backupData = await this.loadBackupData(backupId);
        if (!backupData || !backupData.contexts) {
          issues.push('Invalid backup data structure');
        } else if (backupData.contexts.length !== metadata.contextCount) {
          issues.push(`Context count mismatch: expected ${metadata.contextCount}, found ${backupData.contexts.length}`);
        }
      } catch (error) {
        issues.push(`Failed to load backup data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return { isValid: issues.length === 0, issues };
    } catch (error) {
      issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, issues };
    }
  }

  /**
   * Get backup service status
   */
  getStatus(): {
    isRunning: boolean;
    lastBackupTime: Date | null;
    nextBackupTime: Date | null;
    backupDirectory: string;
    config: BackupConfig;
  } {
    const nextBackupTime = this.lastBackupTime ? 
      new Date(this.lastBackupTime.getTime() + this.config.backupInterval) : 
      new Date(Date.now() + this.config.backupInterval);

    return {
      isRunning: this.isRunning,
      lastBackupTime: this.lastBackupTime,
      nextBackupTime: this.isRunning ? nextBackupTime : null,
      backupDirectory: this.config.backupDirectory,
      config: this.config,
    };
  }

  // Private helper methods
  
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.backupDirectory, { recursive: true });
    } catch (error) {
      logger.error('Failed to create backup directory:', error);
      throw error;
    }
  }

  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `backup-${timestamp}-${random}`;
  }

  private async getContextsForBackup(type: 'full' | 'incremental'): Promise<any[]> {
    if (type === 'full' || !this.lastBackupTime) {
      // Get all contexts for full backup
      return await this.contextStore.searchContexts('');
    } else {
      // Get contexts modified since last backup for incremental
      // This would need to be implemented based on how contexts store modification timestamps
      return await this.contextStore.searchContexts(''); // Simplified for now
    }
  }

  private async saveBackupData(backupId: string, data: any): Promise<string> {
    const filePath = await this.getBackupFilePath(backupId);
    const jsonData = JSON.stringify(data, null, 2);

    if (this.config.compressionEnabled) {
      // Save compressed data
      const compressedPath = filePath + '.gz';
      await pipeline(
        require('stream').Readable.from([jsonData]),
        createGzip(),
        createWriteStream(compressedPath)
      );
      return compressedPath;
    } else {
      // Save uncompressed data
      await fs.writeFile(filePath, jsonData, 'utf8');
      return filePath;
    }
  }

  private async loadBackupData(backupId: string): Promise<any> {
    const filePath = await this.getBackupFilePath(backupId);
    const compressedPath = filePath + '.gz';

    try {
      // Try to load compressed version first
      await fs.access(compressedPath);
      const chunks: Buffer[] = [];
      await pipeline(
        createReadStream(compressedPath),
        createGunzip(),
        require('stream').Writable({
          write(chunk, encoding, callback) {
            chunks.push(chunk);
            callback();
          },
        })
      );
      const jsonData = Buffer.concat(chunks).toString('utf8');
      return JSON.parse(jsonData);
    } catch {
      // Fall back to uncompressed version
      const jsonData = await fs.readFile(filePath, 'utf8');
      return JSON.parse(jsonData);
    }
  }

  private async saveBackupMetadata(backupId: string, metadata: BackupMetadata): Promise<void> {
    const metadataPath = join(this.config.backupDirectory, `${backupId}.metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  private async loadBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const metadataPath = join(this.config.backupDirectory, `${backupId}.metadata.json`);
      const jsonData = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(jsonData);
      
      // Convert timestamp string back to Date object
      metadata.timestamp = new Date(metadata.timestamp);
      
      return metadata;
    } catch (error) {
      return null;
    }
  }

  private async getBackupFilePath(backupId: string): Promise<string> {
    return join(this.config.backupDirectory, `${backupId}.json`);
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async validateBackupChecksum(backupId: string, expectedChecksum: string): Promise<boolean> {
    try {
      const filePath = await this.getBackupFilePath(backupId);
      const compressedPath = filePath + '.gz';
      
      // Check which file exists
      let pathToCheck = filePath;
      try {
        await fs.access(compressedPath);
        pathToCheck = compressedPath;
      } catch {
        // Use uncompressed path
      }
      
      const actualChecksum = await this.calculateChecksum(pathToCheck);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      logger.error(`Failed to validate checksum for backup ${backupId}:`, error);
      return false;
    }
  }

  private async deleteBackup(backupId: string): Promise<void> {
    const filePath = await this.getBackupFilePath(backupId);
    const compressedPath = filePath + '.gz';
    const metadataPath = join(this.config.backupDirectory, `${backupId}.metadata.json`);

    // Delete backup files
    try {
      await fs.unlink(compressedPath);
    } catch {
      try {
        await fs.unlink(filePath);
      } catch {
        // File doesn't exist, ignore
      }
    }

    // Delete metadata
    try {
      await fs.unlink(metadataPath);
    } catch {
      // Metadata file doesn't exist, ignore
    }
  }

  private scheduleNextBackup(): void {
    if (!this.isRunning) {
      return;
    }

    this.backupTimer = setTimeout(async () => {
      try {
        await this.createBackup('full');
        await this.cleanupOldBackups();
      } catch (error) {
        logger.error('Scheduled backup failed:', error);
        this.emit('backupFailed', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
      
      this.scheduleNextBackup();
    }, this.config.backupInterval);
  }
}

/**
 * Factory function to create backup/recovery service
 */
export function createBackupRecoveryService(
  contextStore: Neo4jContextStore,
  config?: Partial<BackupConfig>
): BackupRecoveryService {
  return new BackupRecoveryService(contextStore, config);
}