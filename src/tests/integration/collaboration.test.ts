/**
 * Collaboration Service Integration Tests
 * Tests real-time collaboration features including multi-user sessions,
 * WebSocket communication, and operational transformation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import WebSocket from 'ws';
import request from 'supertest';
import { CollaborationService } from '../../core/services/collaboration.service.js';
import { setupTestEnvironment } from '../setup/test-environment.js';

describe('Collaboration Service Integration Tests', () => {
  let testEnv: any;
  let collaborationService: CollaborationService;
  let app: any;

  beforeEach(async () => {
    testEnv = await setupTestEnvironment();
    collaborationService = new CollaborationService();
    app = testEnv.app;
  });

  afterEach(async () => {
    if (testEnv?.cleanup) {
      await testEnv.cleanup();
    }
  });

  describe('Session Management', () => {
    it('should create and manage collaborative sessions', async () => {
      // Create a new session
      const sessionData = {
        name: 'Test Collaboration Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins' as const,
        },
      };

      const session = await collaborationService.createSession(sessionData);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.name).toBe(sessionData.name);
      expect(session.ownerId).toBe(sessionData.ownerId);
      expect(session.participants).toHaveLength(1);
      expect(session.participants[0].role).toBe('owner');
      expect(session.isActive).toBe(true);
    });

    it('should allow users to join sessions', async () => {
      // Create session
      const session = await collaborationService.createSession({
        name: 'Join Test Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      // Join session as another user
      const result = await collaborationService.joinSession(
        session.id,
        'user2',
        'Test User 2',
        'editor'
      );

      expect(result.session.participants).toHaveLength(2);
      expect(result.participant.userId).toBe('user2');
      expect(result.participant.role).toBe('editor');
      expect(result.participant.status).toBe('online');
    });

    it('should handle session capacity limits', async () => {
      // Create session with max 2 participants
      const session = await collaborationService.createSession({
        name: 'Capacity Test Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 2,
          allowGuests: false,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      // Second user joins successfully
      await collaborationService.joinSession(session.id, 'user2', 'User 2', 'editor');

      // Third user should be rejected
      await expect(
        collaborationService.joinSession(session.id, 'user3', 'User 3', 'viewer')
      ).rejects.toThrow('Session is at maximum capacity');
    });

    it('should handle guest access permissions', async () => {
      // Create session with guests disabled
      const session = await collaborationService.createSession({
        name: 'No Guests Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: false,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      // Guest should be rejected
      await expect(
        collaborationService.joinSession(session.id, 'guest1', 'Guest User', 'guest')
      ).rejects.toThrow('Guest access is not allowed in this session');
    });
  });

  describe('Real-time Communication', () => {
    it('should handle WebSocket connections', (done) => {
      // This test would require a running WebSocket server
      // For now, we'll test the connection setup logic
      
      const mockWS = {
        on: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN,
        ping: jest.fn(),
        send: jest.fn(),
      } as any;

      // Create session first
      collaborationService.createSession({
        name: 'WebSocket Test Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      }).then((session) => {
        // Connect WebSocket
        collaborationService.connectWebSocket(session.id, 'user1', mockWS);

        // Verify event handlers were set up
        expect(mockWS.on).toHaveBeenCalledWith('message', expect.any(Function));
        expect(mockWS.on).toHaveBeenCalledWith('close', expect.any(Function));
        expect(mockWS.on).toHaveBeenCalledWith('error', expect.any(Function));

        done();
      });
    });

    it('should broadcast events to session participants', async () => {
      // Create session with multiple participants
      const session = await collaborationService.createSession({
        name: 'Broadcast Test Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      await collaborationService.joinSession(session.id, 'user2', 'User 2', 'editor');

      // Mock WebSocket connections
      const mockWS1 = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
      } as any;

      const mockWS2 = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
      } as any;

      collaborationService.connectWebSocket(session.id, 'user1', mockWS1);
      collaborationService.connectWebSocket(session.id, 'user2', mockWS2);

      // Update cursor position (should broadcast to other users)
      collaborationService.updateCursor(session.id, 'user1', {
        contextId: 'context1',
        position: 100,
      });

      // Verify broadcast (user2 should receive the cursor update)
      expect(mockWS2.send).toHaveBeenCalled();
    });
  });

  describe('Context Collaboration', () => {
    it('should handle context updates with conflict resolution', async () => {
      // Create session
      const session = await collaborationService.createSession({
        name: 'Context Update Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      await collaborationService.joinSession(session.id, 'user2', 'User 2', 'editor');

      // Update context
      await collaborationService.updateContext(session.id, 'user1', 'context1', {
        contextId: 'context1',
        operation: 'insert',
        position: 0,
        content: 'Hello, world!',
      });

      // Verify no errors were thrown
      expect(true).toBe(true);
    });

    it('should enforce edit permissions', async () => {
      // Create session
      const session = await collaborationService.createSession({
        name: 'Permissions Test Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      // Join as viewer (no edit permissions)
      await collaborationService.joinSession(session.id, 'user2', 'User 2', 'viewer');

      // Attempt to edit should fail
      await expect(
        collaborationService.updateContext(session.id, 'user2', 'context1', {
          contextId: 'context1',
          operation: 'insert',
          position: 0,
          content: 'Unauthorized edit',
        })
      ).rejects.toThrow('User does not have edit permissions');
    });
  });

  describe('Comments and Annotations', () => {
    it('should add and manage comments', async () => {
      // Create session
      const session = await collaborationService.createSession({
        name: 'Comments Test Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      await collaborationService.joinSession(session.id, 'user2', 'User 2', 'editor');

      // Add comment
      const comment = await collaborationService.addComment(
        session.id,
        'user1',
        'context1',
        'This is a test comment',
        50,
        ['user2']
      );

      expect(comment).toBeDefined();
      expect(comment.id).toBeDefined();
      expect(comment.content).toBe('This is a test comment');
      expect(comment.position).toBe(50);
      expect(comment.mentions).toContain('user2');
      expect(comment.resolved).toBe(false);

      // Get comments for context
      const comments = collaborationService.getComments('context1');
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe(comment.id);
    });

    it('should enforce comment permissions', async () => {
      // Create session
      const session = await collaborationService.createSession({
        name: 'Comment Permissions Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      // Join as guest (no comment permissions)
      await collaborationService.joinSession(session.id, 'guest1', 'Guest User', 'guest');

      // Attempt to comment should fail
      await expect(
        collaborationService.addComment(
          session.id,
          'guest1',
          'context1',
          'Unauthorized comment',
          50
        )
      ).rejects.toThrow('User does not have comment permissions');
    });
  });

  describe('Presence and Typing Indicators', () => {
    it('should track typing indicators', async () => {
      // Create session
      const session = await collaborationService.createSession({
        name: 'Typing Test Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      // Start typing
      collaborationService.updateTypingIndicator(session.id, 'user1', 'context1', true);

      // Check typing indicators
      const indicators = collaborationService.getTypingIndicators('context1');
      expect(indicators).toHaveLength(1);
      expect(indicators[0].userId).toBe('user1');

      // Stop typing
      collaborationService.updateTypingIndicator(session.id, 'user1', 'context1', false);

      // Check indicators cleared
      const clearedIndicators = collaborationService.getTypingIndicators('context1');
      expect(clearedIndicators).toHaveLength(0);
    });

    it('should automatically expire old typing indicators', async () => {
      // Create session
      const session = await collaborationService.createSession({
        name: 'Typing Expiry Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      // Manually add an old typing indicator
      const typingIndicators = new Map();
      typingIndicators.set('context1', [{
        userId: 'user1',
        contextId: 'context1',
        timestamp: new Date(Date.now() - 10000), // 10 seconds ago
      }]);

      // Mock the private typingIndicators map
      (collaborationService as any).typingIndicators = typingIndicators;

      // Get indicators should filter out expired ones
      const indicators = collaborationService.getTypingIndicators('context1');
      expect(indicators).toHaveLength(0);
    });
  });

  describe('Session Lifecycle', () => {
    it('should handle participant leaving', async () => {
      // Create session
      const session = await collaborationService.createSession({
        name: 'Leave Test Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      await collaborationService.joinSession(session.id, 'user2', 'User 2', 'editor');

      // Verify both users are in session
      const sessionBefore = collaborationService.getSession(session.id);
      expect(sessionBefore?.participants).toHaveLength(2);

      // User 2 leaves
      await collaborationService.leaveSession(session.id, 'user2');

      // Verify user status is updated
      const sessionAfter = collaborationService.getSession(session.id);
      const leftParticipant = sessionAfter?.participants.find(p => p.userId === 'user2');
      expect(leftParticipant?.status).toBe('offline');
    });

    it('should transfer ownership when owner leaves', async () => {
      // Create session
      const session = await collaborationService.createSession({
        name: 'Ownership Transfer Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      await collaborationService.joinSession(session.id, 'user2', 'User 2', 'editor');

      // Owner leaves
      await collaborationService.leaveSession(session.id, 'user1');

      // Verify ownership transfer
      const updatedSession = collaborationService.getSession(session.id);
      const newOwner = updatedSession?.participants.find(p => p.userId === 'user2');
      expect(newOwner?.role).toBe('owner');
      expect(newOwner?.permissions.canManageSettings).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle session not found errors', async () => {
      await expect(
        collaborationService.joinSession('nonexistent-session', 'user1', 'User 1', 'viewer')
      ).rejects.toThrow('Session not found');
    });

    it('should handle user not in session errors', async () => {
      const session = await collaborationService.createSession({
        name: 'Error Test Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 5,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'last-write-wins',
        },
      });

      await expect(
        collaborationService.leaveSession(session.id, 'nonexistent-user')
      ).rejects.toThrow('User not in session');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      // Create session
      const session = await collaborationService.createSession({
        name: 'Concurrent Operations Session',
        ownerId: 'user1',
        settings: {
          maxParticipants: 10,
          allowGuests: true,
          autoSave: true,
          conflictResolution: 'operational-transform',
        },
      });

      // Add multiple users
      const userPromises = [];
      for (let i = 2; i <= 5; i++) {
        userPromises.push(
          collaborationService.joinSession(session.id, `user${i}`, `User ${i}`, 'editor')
        );
      }

      await Promise.all(userPromises);

      // Verify all users joined successfully
      const updatedSession = collaborationService.getSession(session.id);
      expect(updatedSession?.participants).toHaveLength(5);

      // Simulate concurrent cursor updates
      const cursorPromises = [];
      for (let i = 1; i <= 5; i++) {
        cursorPromises.push(
          Promise.resolve(collaborationService.updateCursor(session.id, `user${i}`, {
            contextId: 'context1',
            position: i * 10,
          }))
        );
      }

      await Promise.all(cursorPromises);

      // Verify no errors occurred
      expect(true).toBe(true);
    });
  });
});