/**
 * Real-time Collaboration Service
 * Provides multi-user session management, real-time updates, and collaborative features
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { Context } from '../../types/entities/context.js';
import { Session } from '../../types/entities/session.js';

export interface CollaborativeSession {
  id: string;
  name: string;
  ownerId: string;
  participants: Participant[];
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  settings: {
    maxParticipants: number;
    allowGuests: boolean;
    autoSave: boolean;
    conflictResolution: 'last-write-wins' | 'operational-transform' | 'manual';
  };
  metadata?: Record<string, unknown>;
}

export interface Participant {
  id: string;
  userId: string;
  displayName: string;
  role: 'owner' | 'editor' | 'viewer' | 'guest';
  status: 'online' | 'away' | 'offline';
  joinedAt: Date;
  lastSeen: Date;
  cursor?: {
    contextId?: string;
    position?: number;
    selection?: { start: number; end: number };
  };
  permissions: {
    canEdit: boolean;
    canComment: boolean;
    canInvite: boolean;
    canManageSettings: boolean;
  };
}

export interface CollaborationEvent {
  id: string;
  sessionId: string;
  userId: string;
  type: 'context-update' | 'cursor-move' | 'participant-join' | 'participant-leave' | 
        'comment-add' | 'comment-update' | 'comment-delete' | 'selection-change' |
        'typing-start' | 'typing-stop' | 'presence-update';
  data: Record<string, unknown>;
  timestamp: Date;
  version?: number;
}

export interface ContextEdit {
  id: string;
  contextId: string;
  userId: string;
  operation: 'insert' | 'delete' | 'replace' | 'move';
  position: number;
  content?: string;
  length?: number;
  timestamp: Date;
  applied: boolean;
}

export interface Comment {
  id: string;
  contextId: string;
  userId: string;
  content: string;
  position: number;
  thread?: Comment[];
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  mentions: string[];
  reactions: Array<{
    userId: string;
    type: string;
    timestamp: Date;
  }>;
}

export interface TypingIndicator {
  userId: string;
  contextId: string;
  timestamp: Date;
}

export class CollaborationService extends EventEmitter {
  private sessions: Map<string, CollaborativeSession> = new Map();
  private participants: Map<string, Participant> = new Map();
  private websockets: Map<string, WebSocket> = new Map();
  private contexts: Map<string, Context> = new Map();
  private pendingEdits: Map<string, ContextEdit[]> = new Map();
  private comments: Map<string, Comment[]> = new Map();
  private typingIndicators: Map<string, TypingIndicator[]> = new Map();
  private presenceHeartbeat: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.setupPresenceMonitoring();
    this.setupConflictResolution();
  }

  /**
   * Create a new collaborative session
   */
  async createSession(
    sessionData: Omit<CollaborativeSession, 'id' | 'participants' | 'isActive' | 'createdAt' | 'lastActivity'>
  ): Promise<CollaborativeSession> {
    const session: CollaborativeSession = {
      id: uuidv4(),
      ...sessionData,
      participants: [],
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    // Add owner as first participant
    const owner: Participant = {
      id: uuidv4(),
      userId: session.ownerId,
      displayName: 'Session Owner',
      role: 'owner',
      status: 'online',
      joinedAt: new Date(),
      lastSeen: new Date(),
      permissions: {
        canEdit: true,
        canComment: true,
        canInvite: true,
        canManageSettings: true,
      },
    };

    session.participants.push(owner);
    this.sessions.set(session.id, session);
    this.participants.set(owner.id, owner);

    logger.info('Collaborative session created', {
      sessionId: session.id,
      ownerId: session.ownerId,
      name: session.name,
    });

    this.emit('session-created', session);
    return session;
  }

  /**
   * Join an existing collaborative session
   */
  async joinSession(
    sessionId: string,
    userId: string,
    displayName: string,
    role: Participant['role'] = 'viewer'
  ): Promise<{ session: CollaborativeSession; participant: Participant }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.isActive) {
      throw new Error(`Session is not active: ${sessionId}`);
    }

    // Check if user is already in session
    const existingParticipant = session.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      existingParticipant.status = 'online';
      existingParticipant.lastSeen = new Date();
      
      logger.info('User rejoined session', {
        sessionId,
        userId,
        participantId: existingParticipant.id,
      });

      this.broadcastToSession(sessionId, {
        id: uuidv4(),
        sessionId,
        userId,
        type: 'participant-join',
        data: { participant: existingParticipant },
        timestamp: new Date(),
      }, userId);

      return { session, participant: existingParticipant };
    }

    // Check session capacity
    if (session.participants.length >= session.settings.maxParticipants) {
      throw new Error('Session is at maximum capacity');
    }

    // Check guest permissions
    if (role === 'guest' && !session.settings.allowGuests) {
      throw new Error('Guest access is not allowed in this session');
    }

    // Create new participant
    const participant: Participant = {
      id: uuidv4(),
      userId,
      displayName,
      role,
      status: 'online',
      joinedAt: new Date(),
      lastSeen: new Date(),
      permissions: this.getDefaultPermissions(role),
    };

    session.participants.push(participant);
    session.lastActivity = new Date();
    
    this.participants.set(participant.id, participant);

    logger.info('User joined session', {
      sessionId,
      userId,
      participantId: participant.id,
      role,
    });

    // Broadcast join event
    this.broadcastToSession(sessionId, {
      id: uuidv4(),
      sessionId,
      userId,
      type: 'participant-join',
      data: { participant },
      timestamp: new Date(),
    }, userId);

    this.emit('participant-joined', { session, participant });
    return { session, participant };
  }

  /**
   * Leave a collaborative session
   */
  async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const participantIndex = session.participants.findIndex(p => p.userId === userId);
    if (participantIndex === -1) {
      throw new Error(`User not in session: ${userId}`);
    }

    const participant = session.participants[participantIndex];
    participant.status = 'offline';
    participant.lastSeen = new Date();

    // Remove websocket connection
    const wsKey = `${sessionId}:${userId}`;
    const ws = this.websockets.get(wsKey);
    if (ws) {
      ws.close();
      this.websockets.delete(wsKey);
    }

    // Clear presence heartbeat
    const heartbeat = this.presenceHeartbeat.get(participant.id);
    if (heartbeat) {
      clearInterval(heartbeat);
      this.presenceHeartbeat.delete(participant.id);
    }

    session.lastActivity = new Date();

    logger.info('User left session', {
      sessionId,
      userId,
      participantId: participant.id,
    });

    // Broadcast leave event
    this.broadcastToSession(sessionId, {
      id: uuidv4(),
      sessionId,
      userId,
      type: 'participant-leave',
      data: { participant },
      timestamp: new Date(),
    }, userId);

    this.emit('participant-left', { session, participant });

    // If session owner left and there are other participants, transfer ownership
    if (participant.role === 'owner' && session.participants.length > 1) {
      this.transferOwnership(sessionId, participant.id);
    }
  }

  /**
   * Connect WebSocket for real-time communication
   */
  connectWebSocket(sessionId: string, userId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      ws.close(1008, 'Session not found');
      return;
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) {
      ws.close(1008, 'User not in session');
      return;
    }

    const wsKey = `${sessionId}:${userId}`;
    this.websockets.set(wsKey, ws);

    // Setup WebSocket event handlers
    ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString()) as CollaborationEvent;
        this.handleWebSocketMessage(sessionId, userId, event);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', error);
      }
    });

    ws.on('close', () => {
      this.websockets.delete(wsKey);
      logger.debug('WebSocket disconnected', { sessionId, userId });
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { sessionId, userId, error });
    });

    // Setup presence heartbeat
    this.setupPresenceHeartbeat(participant.id, ws);

    logger.info('WebSocket connected', { sessionId, userId });
  }

  /**
   * Update context with operational transformation
   */
  async updateContext(
    sessionId: string,
    userId: string,
    contextId: string,
    edit: Omit<ContextEdit, 'id' | 'userId' | 'timestamp' | 'applied'>
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant || !participant.permissions.canEdit) {
      throw new Error('User does not have edit permissions');
    }

    const contextEdit: ContextEdit = {
      id: uuidv4(),
      userId,
      timestamp: new Date(),
      applied: false,
      ...edit,
    };

    // Add to pending edits for operational transformation
    if (!this.pendingEdits.has(contextId)) {
      this.pendingEdits.set(contextId, []);
    }
    this.pendingEdits.get(contextId)!.push(contextEdit);

    // Apply operational transformation based on session settings
    await this.applyEdit(sessionId, contextEdit);

    // Broadcast update to all participants
    this.broadcastToSession(sessionId, {
      id: uuidv4(),
      sessionId,
      userId,
      type: 'context-update',
      data: { edit: contextEdit },
      timestamp: new Date(),
    }, userId);

    session.lastActivity = new Date();
  }

  /**
   * Add comment to context
   */
  async addComment(
    sessionId: string,
    userId: string,
    contextId: string,
    content: string,
    position: number,
    mentions: string[] = []
  ): Promise<Comment> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant || !participant.permissions.canComment) {
      throw new Error('User does not have comment permissions');
    }

    const comment: Comment = {
      id: uuidv4(),
      contextId,
      userId,
      content,
      position,
      mentions,
      resolved: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      reactions: [],
    };

    if (!this.comments.has(contextId)) {
      this.comments.set(contextId, []);
    }
    this.comments.get(contextId)!.push(comment);

    // Broadcast comment to all participants
    this.broadcastToSession(sessionId, {
      id: uuidv4(),
      sessionId,
      userId,
      type: 'comment-add',
      data: { comment },
      timestamp: new Date(),
    }, userId);

    logger.info('Comment added', {
      sessionId,
      userId,
      contextId,
      commentId: comment.id,
    });

    return comment;
  }

  /**
   * Update cursor position and selection
   */
  updateCursor(
    sessionId: string,
    userId: string,
    cursor: Participant['cursor']
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) return;

    participant.cursor = cursor;
    participant.lastSeen = new Date();

    // Broadcast cursor update
    this.broadcastToSession(sessionId, {
      id: uuidv4(),
      sessionId,
      userId,
      type: 'cursor-move',
      data: { cursor },
      timestamp: new Date(),
    }, userId);
  }

  /**
   * Update typing indicators
   */
  updateTypingIndicator(
    sessionId: string,
    userId: string,
    contextId: string,
    isTyping: boolean
  ): void {
    if (!this.typingIndicators.has(contextId)) {
      this.typingIndicators.set(contextId, []);
    }

    const indicators = this.typingIndicators.get(contextId)!;
    const existingIndex = indicators.findIndex(i => i.userId === userId);

    if (isTyping) {
      const indicator: TypingIndicator = {
        userId,
        contextId,
        timestamp: new Date(),
      };

      if (existingIndex >= 0) {
        indicators[existingIndex] = indicator;
      } else {
        indicators.push(indicator);
      }

      this.broadcastToSession(sessionId, {
        id: uuidv4(),
        sessionId,
        userId,
        type: 'typing-start',
        data: { contextId },
        timestamp: new Date(),
      }, userId);
    } else {
      if (existingIndex >= 0) {
        indicators.splice(existingIndex, 1);
      }

      this.broadcastToSession(sessionId, {
        id: uuidv4(),
        sessionId,
        userId,
        type: 'typing-stop',
        data: { contextId },
        timestamp: new Date(),
      }, userId);
    }
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): CollaborativeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active sessions for a user
   */
  getUserSessions(userId: string): CollaborativeSession[] {
    return Array.from(this.sessions.values()).filter(session =>
      session.isActive && session.participants.some(p => p.userId === userId)
    );
  }

  /**
   * Get comments for a context
   */
  getComments(contextId: string): Comment[] {
    return this.comments.get(contextId) || [];
  }

  /**
   * Get typing indicators for a context
   */
  getTypingIndicators(contextId: string): TypingIndicator[] {
    const indicators = this.typingIndicators.get(contextId) || [];
    
    // Filter out expired indicators (older than 5 seconds)
    const now = Date.now();
    return indicators.filter(indicator => 
      now - indicator.timestamp.getTime() < 5000
    );
  }

  /**
   * Private helper methods
   */

  private handleWebSocketMessage(sessionId: string, userId: string, event: CollaborationEvent): void {
    switch (event.type) {
      case 'cursor-move':
        this.updateCursor(sessionId, userId, event.data.cursor as Participant['cursor']);
        break;
      
      case 'typing-start':
        this.updateTypingIndicator(sessionId, userId, event.data.contextId as string, true);
        break;
      
      case 'typing-stop':
        this.updateTypingIndicator(sessionId, userId, event.data.contextId as string, false);
        break;
      
      case 'presence-update':
        this.updatePresence(sessionId, userId, event.data.status as Participant['status']);
        break;
      
      default:
        logger.warn('Unknown WebSocket event type', { type: event.type, sessionId, userId });
    }
  }

  private broadcastToSession(sessionId: string, event: CollaborationEvent, excludeUserId?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const participant of session.participants) {
      if (participant.userId === excludeUserId || participant.status === 'offline') {
        continue;
      }

      const wsKey = `${sessionId}:${participant.userId}`;
      const ws = this.websockets.get(wsKey);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(event));
        } catch (error) {
          logger.error('Failed to send WebSocket message', {
            sessionId,
            userId: participant.userId,
            error,
          });
        }
      }
    }
  }

  private async applyEdit(sessionId: string, edit: ContextEdit): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      // Apply operational transformation based on session settings
      switch (session.settings.conflictResolution) {
        case 'last-write-wins':
          await this.applyLastWriteWins(edit);
          break;
        
        case 'operational-transform':
          await this.applyOperationalTransform(edit);
          break;
        
        case 'manual':
          // Store for manual resolution
          break;
      }

      edit.applied = true;
    } catch (error) {
      logger.error('Failed to apply edit', { editId: edit.id, error });
    }
  }

  private async applyLastWriteWins(edit: ContextEdit): Promise<void> {
    // Simple last-write-wins implementation
    // In a real implementation, this would update the actual context storage
    logger.debug('Applied edit with last-write-wins', { editId: edit.id });
  }

  private async applyOperationalTransform(edit: ContextEdit): Promise<void> {
    // Simplified operational transformation
    // In a real implementation, this would implement proper OT algorithms
    const contextEdits = this.pendingEdits.get(edit.contextId) || [];
    
    // Transform edit against all concurrent edits
    for (const concurrentEdit of contextEdits) {
      if (concurrentEdit.id !== edit.id && concurrentEdit.timestamp < edit.timestamp) {
        this.transformEdit(edit, concurrentEdit);
      }
    }

    logger.debug('Applied edit with operational transform', { editId: edit.id });
  }

  private transformEdit(edit: ContextEdit, concurrentEdit: ContextEdit): void {
    // Simplified transformation logic
    if (concurrentEdit.operation === 'insert' && edit.position > concurrentEdit.position) {
      edit.position += concurrentEdit.content?.length || 0;
    } else if (concurrentEdit.operation === 'delete' && edit.position > concurrentEdit.position) {
      edit.position -= concurrentEdit.length || 0;
    }
  }

  private setupPresenceHeartbeat(participantId: string, ws: WebSocket): void {
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch (error) {
          logger.error('Failed to send heartbeat', { participantId, error });
          clearInterval(heartbeat);
          this.presenceHeartbeat.delete(participantId);
        }
      } else {
        clearInterval(heartbeat);
        this.presenceHeartbeat.delete(participantId);
      }
    }, 30000); // 30 second heartbeat

    this.presenceHeartbeat.set(participantId, heartbeat);
  }

  private setupPresenceMonitoring(): void {
    // Monitor participant presence and update status
    setInterval(() => {
      const now = Date.now();
      
      for (const [sessionId, session] of this.sessions) {
        for (const participant of session.participants) {
          const timeSinceLastSeen = now - participant.lastSeen.getTime();
          
          if (timeSinceLastSeen > 60000 && participant.status === 'online') {
            // Mark as away after 1 minute of inactivity
            participant.status = 'away';
            
            this.broadcastToSession(sessionId, {
              id: uuidv4(),
              sessionId,
              userId: participant.userId,
              type: 'presence-update',
              data: { status: 'away' },
              timestamp: new Date(),
            });
          } else if (timeSinceLastSeen > 300000 && participant.status === 'away') {
            // Mark as offline after 5 minutes of inactivity
            participant.status = 'offline';
            
            this.broadcastToSession(sessionId, {
              id: uuidv4(),
              sessionId,
              userId: participant.userId,
              type: 'presence-update',
              data: { status: 'offline' },
              timestamp: new Date(),
            });
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private setupConflictResolution(): void {
    // Clean up resolved edits periodically
    setInterval(() => {
      for (const [contextId, edits] of this.pendingEdits) {
        const unresolved = edits.filter(edit => !edit.applied);
        if (unresolved.length === 0) {
          this.pendingEdits.delete(contextId);
        } else {
          this.pendingEdits.set(contextId, unresolved);
        }
      }
    }, 60000); // Clean up every minute
  }

  private updatePresence(sessionId: string, userId: string, status: Participant['status']): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) return;

    participant.status = status;
    participant.lastSeen = new Date();

    this.broadcastToSession(sessionId, {
      id: uuidv4(),
      sessionId,
      userId,
      type: 'presence-update',
      data: { status },
      timestamp: new Date(),
    }, userId);
  }

  private transferOwnership(sessionId: string, oldOwnerId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Find the next eligible participant (editors first, then viewers)
    const newOwner = session.participants.find(p => 
      p.id !== oldOwnerId && (p.role === 'editor' || p.role === 'viewer')
    );

    if (newOwner) {
      newOwner.role = 'owner';
      newOwner.permissions = {
        canEdit: true,
        canComment: true,
        canInvite: true,
        canManageSettings: true,
      };

      this.broadcastToSession(sessionId, {
        id: uuidv4(),
        sessionId,
        userId: newOwner.userId,
        type: 'presence-update',
        data: { role: 'owner', permissions: newOwner.permissions },
        timestamp: new Date(),
      });

      logger.info('Session ownership transferred', {
        sessionId,
        oldOwnerId,
        newOwnerId: newOwner.userId,
      });
    }
  }

  private getDefaultPermissions(role: Participant['role']): Participant['permissions'] {
    switch (role) {
      case 'owner':
        return {
          canEdit: true,
          canComment: true,
          canInvite: true,
          canManageSettings: true,
        };
      
      case 'editor':
        return {
          canEdit: true,
          canComment: true,
          canInvite: false,
          canManageSettings: false,
        };
      
      case 'viewer':
        return {
          canEdit: false,
          canComment: true,
          canInvite: false,
          canManageSettings: false,
        };
      
      case 'guest':
        return {
          canEdit: false,
          canComment: false,
          canInvite: false,
          canManageSettings: false,
        };
      
      default:
        return {
          canEdit: false,
          canComment: false,
          canInvite: false,
          canManageSettings: false,
        };
    }
  }
}