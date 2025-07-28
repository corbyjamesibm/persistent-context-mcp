/**
 * Context entity type definitions for the persistent context store
 */

export interface Context {
  id: string;
  title: string;
  content: string;
  type: ContextType;
  status: ContextStatus;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  tags: string[];
  metadata: ContextMetadata;
  relationships: ContextRelationship[];
}

export enum ContextType {
  PLANNING = 'planning',
  ANALYSIS = 'analysis',
  DEVELOPMENT = 'development',
  BMAD_WORKFLOW = 'bmad_workflow',
  GENERAL = 'general'
}

export enum ContextStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DRAFT = 'draft'
}

export interface ContextMetadata {
  tokenCount: number;
  quality: number;
  interactions: number;
  templateCount: number;
  lastAccessed: Date;
  aiGenerated: boolean;
  source?: string;
  importance?: 'low' | 'medium' | 'high';
}

export interface ContextRelationship {
  id: string;
  type: RelationshipType;
  targetContextId: string;
  strength: number;
  metadata?: Record<string, any>;
}

export enum RelationshipType {
  RELATES_TO = 'relates_to',
  FOLLOWS = 'follows',
  INFLUENCES = 'influences',
  CONTAINS = 'contains',
  DERIVED_FROM = 'derived_from'
}

export interface CreateContextRequest {
  title: string;
  content: string;
  type: ContextType;
  tags?: string[];
  metadata?: Partial<ContextMetadata>;
}

export interface UpdateContextRequest {
  title?: string;
  content?: string;
  type?: ContextType;
  status?: ContextStatus;
  tags?: string[];
  metadata?: Partial<ContextMetadata>;
}

export interface ContextFilters {
  type?: ContextType;
  status?: ContextStatus;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  userId?: string;
}