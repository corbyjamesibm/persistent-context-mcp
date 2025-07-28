/**
 * Collaboration API Routes
 * Provides RESTful endpoints for real-time collaboration features
 */

import { Router, Request, Response } from 'express';
import WebSocket from 'ws';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { CollaborationService } from '../../core/services/collaboration.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const collaborationService = new CollaborationService();

// Request validation schemas
const CreateSessionSchema = z.object({
  name: z.string().min(1).max(100),
  settings: z.object({
    maxParticipants: z.number().min(1).max(50).default(10),
    allowGuests: z.boolean().default(false),
    autoSave: z.boolean().default(true),
    conflictResolution: z.enum(['last-write-wins', 'operational-transform', 'manual']).default('last-write-wins'),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const JoinSessionSchema = z.object({
  displayName: z.string().min(1).max(50),
  role: z.enum(['editor', 'viewer', 'guest']).default('viewer'),
});

const UpdateContextSchema = z.object({
  contextId: z.string().uuid(),
  operation: z.enum(['insert', 'delete', 'replace', 'move']),
  position: z.number().min(0),
  content: z.string().optional(),
  length: z.number().min(0).optional(),
});

const AddCommentSchema = z.object({
  contextId: z.string().uuid(),
  content: z.string().min(1).max(1000),
  position: z.number().min(0),
  mentions: z.array(z.string()).default([]),
});

const UpdateCursorSchema = z.object({
  contextId: z.string().uuid().optional(),
  position: z.number().min(0).optional(),
  selection: z.object({
    start: z.number().min(0),
    end: z.number().min(0),
  }).optional(),
});

/**
 * Create a new collaborative session
 */
router.post('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const validatedData = CreateSessionSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const session = await collaborationService.createSession({
      ...validatedData,
      ownerId: userId,
      settings: {
        maxParticipants: 10,
        allowGuests: false,
        autoSave: true,
        conflictResolution: 'last-write-wins',
        ...validatedData.settings,
      },
    });

    res.status(201).json({ session });
  } catch (error) {
    logger.error('Failed to create collaborative session', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * Get session information
 */
router.get('/sessions/:sessionId', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const session = collaborationService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user has access to the session
    const userParticipant = session.participants.find(p => p.userId === userId);
    if (!userParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ session });
  } catch (error) {
    logger.error('Failed to get session', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * Join a collaborative session
 */
router.post('/sessions/:sessionId/join', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const validatedData = JoinSessionSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const result = await collaborationService.joinSession(
      sessionId,
      userId,
      validatedData.displayName,
      validatedData.role
    );

    res.json(result);
  } catch (error) {
    logger.error('Failed to join session', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    } else if (error.message.includes('capacity') || error.message.includes('not allowed')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to join session' });
  }
});

/**
 * Leave a collaborative session
 */
router.post('/sessions/:sessionId/leave', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    await collaborationService.leaveSession(sessionId, userId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to leave session', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to leave session' });
  }
});

/**
 * Get user's active sessions
 */
router.get('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const sessions = collaborationService.getUserSessions(userId);
    res.json({ sessions });
  } catch (error) {
    logger.error('Failed to get user sessions', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

/**
 * Update context content with collaboration support
 */
router.post('/sessions/:sessionId/contexts/update', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const validatedData = UpdateContextSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    await collaborationService.updateContext(
      sessionId,
      userId,
      validatedData.contextId,
      {
        operation: validatedData.operation,
        position: validatedData.position,
        content: validatedData.content,
        length: validatedData.length,
        contextId: validatedData.contextId,
      }
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update context', error);
    
    if (error.message.includes('not found') || error.message.includes('permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update context' });
  }
});

/**
 * Add comment to context
 */
router.post('/sessions/:sessionId/comments', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const validatedData = AddCommentSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const comment = await collaborationService.addComment(
      sessionId,
      userId,
      validatedData.contextId,
      validatedData.content,
      validatedData.position,
      validatedData.mentions
    );

    res.status(201).json({ comment });
  } catch (error) {
    logger.error('Failed to add comment', error);
    
    if (error.message.includes('not found') || error.message.includes('permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * Get comments for a context
 */
router.get('/contexts/:contextId/comments', authenticate, async (req: Request, res: Response) => {
  try {
    const { contextId } = req.params;
    const comments = collaborationService.getComments(contextId);
    res.json({ comments });
  } catch (error) {
    logger.error('Failed to get comments', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

/**
 * Update cursor position
 */
router.post('/sessions/:sessionId/cursor', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const validatedData = UpdateCursorSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    collaborationService.updateCursor(sessionId, userId, {
      contextId: validatedData.contextId,
      position: validatedData.position,
      selection: validatedData.selection,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update cursor', error);
    res.status(500).json({ error: 'Failed to update cursor' });
  }
});

/**
 * Get typing indicators for a context
 */
router.get('/contexts/:contextId/typing', authenticate, async (req: Request, res: Response) => {
  try {
    const { contextId } = req.params;
    const typingIndicators = collaborationService.getTypingIndicators(contextId);
    res.json({ typingIndicators });
  } catch (error) {
    logger.error('Failed to get typing indicators', error);
    res.status(500).json({ error: 'Failed to get typing indicators' });
  }
});

/**
 * WebSocket upgrade handler
 */
export const handleWebSocketUpgrade = (
  request: any,
  socket: any,
  head: Buffer,
  wss: WebSocket.Server
): void => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const userId = url.searchParams.get('userId');
  const token = url.searchParams.get('token');

  if (!sessionId || !userId || !token) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  // Verify authentication token
  // In a real implementation, you would verify the JWT token here
  
  wss.handleUpgrade(request, socket, head, (ws) => {
    logger.info('WebSocket connection established', { sessionId, userId });
    
    collaborationService.connectWebSocket(sessionId, userId, ws);
    
    ws.on('close', () => {
      logger.info('WebSocket connection closed', { sessionId, userId });
    });
  });
};

export default router;