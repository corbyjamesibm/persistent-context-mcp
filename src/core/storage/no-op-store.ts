/**
 * No-op Context Store for testing when Neo4j is unavailable
 */

import { logger } from '../../utils/logger.js';

export function createNoOpContextStore() {
  logger.warn('Using No-Op Context Store - data will not be persisted!');
  
  const contexts = new Map<string, any>();
  
  return {
    async connect() {
      logger.info('No-op store: Connected (no actual connection)');
    },
    
    async disconnect() {
      logger.info('No-op store: Disconnected');
    },
    
    async createContext(context: any) {
      contexts.set(context.id, context);
      return context;
    },
    
    async getContext(id: string) {
      return contexts.get(id) || null;
    },
    
    async updateContext(id: string, updates: any) {
      const existing = contexts.get(id);
      if (!existing) throw new Error('Context not found');
      const updated = { ...existing, ...updates };
      contexts.set(id, updated);
      return updated;
    },
    
    async deleteContext(id: string) {
      return contexts.delete(id);
    },
    
    async searchContexts(criteria: any) {
      return Array.from(contexts.values());
    },
    
    async getAllContexts() {
      return Array.from(contexts.values());
    },
    
    async clearAll() {
      contexts.clear();
    },
    
    async getContextByPath(path: string) {
      return Array.from(contexts.values()).find(c => c.path === path) || null;
    },
    
    async getContextsByOwner(ownerId: string) {
      return Array.from(contexts.values()).filter(c => c.ownerId === ownerId);
    },
    
    async getContextsByTags(tags: string[]) {
      return Array.from(contexts.values()).filter(c => 
        c.tags && tags.some(tag => c.tags.includes(tag))
      );
    },
    
    async createSnapshot(contextId: string) {
      const context = contexts.get(contextId);
      if (!context) throw new Error('Context not found');
      return { ...context, snapshotId: Date.now().toString() };
    },
    
    async getSnapshots(contextId: string) {
      return [];
    },
    
    async restoreSnapshot(contextId: string, snapshotId: string) {
      throw new Error('Snapshots not supported in no-op store');
    },
    
    async shareContext(contextId: string, userId: string, permissions: any) {
      return { contextId, userId, permissions };
    },
    
    async getSharedContexts(userId: string) {
      return [];
    },
    
    async archiveContext(contextId: string) {
      const context = contexts.get(contextId);
      if (!context) throw new Error('Context not found');
      context.archived = true;
      return context;
    },
    
    async restoreContext(contextId: string) {
      const context = contexts.get(contextId);
      if (!context) throw new Error('Context not found');
      context.archived = false;
      return context;
    },
    
    async getMetrics() {
      return {
        totalContexts: contexts.size,
        activeContexts: contexts.size,
        totalSize: 0,
        averageContextSize: 0,
      };
    },
    
    async exportContexts(contextIds: string[]) {
      return contextIds.map(id => contexts.get(id)).filter(Boolean);
    },
    
    async importContexts(data: any[]) {
      data.forEach(context => contexts.set(context.id, context));
      return data.length;
    },
    
    async getArchivedContexts() {
      return Array.from(contexts.values()).filter(c => c.archived);
    },
    
    async bulkUpdate(updates: any[]) {
      updates.forEach(({ id, ...data }) => {
        const existing = contexts.get(id);
        if (existing) {
          contexts.set(id, { ...existing, ...data });
        }
      });
      return updates.length;
    },
    
    async bulkDelete(ids: string[]) {
      let deleted = 0;
      ids.forEach(id => {
        if (contexts.delete(id)) deleted++;
      });
      return deleted;
    },
    
    async createBackup() {
      return {
        id: Date.now().toString(),
        timestamp: new Date(),
        size: contexts.size,
        path: '/tmp/no-op-backup',
      };
    },
    
    async restoreBackup(backupId: string) {
      throw new Error('Backup restore not supported in no-op store');
    },
    
    async getBackups() {
      return [];
    },
    
    async analyzePerformance() {
      return {
        readLatency: 0,
        writeLatency: 0,
        searchLatency: 0,
        totalOperations: 0,
      };
    },
    
    driver: null,
  };
}