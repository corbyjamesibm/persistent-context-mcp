import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';

export interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  subscribe: (event: string, callback: (data: any) => void) => void;
  unsubscribe: (event: string, callback?: (data: any) => void) => void;
  emit: (event: string, data?: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  
  const { user, isAuthenticated } = useAuth();
  const { showError, showInfo } = useNotification();

  useEffect(() => {
    if (isAuthenticated && user) {
      initializeSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, user]);

  const initializeSocket = () => {
    if (socket) {
      socket.disconnect();
    }

    setConnectionStatus('connecting');

    const newSocket = io(import.meta.env.VITE_WS_URL || 'ws://localhost:3000', {
      auth: {
        token: localStorage.getItem('auth-token'),
        userId: user?.id,
      },
      transports: ['websocket'],
      upgrade: true,
      rememberUpgrade: true,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      showInfo('Connected', 'Real-time updates enabled');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, show notification
        showError('Connection Lost', 'Real-time updates disabled');
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
      setConnectionStatus('error');
      showError('Connection Error', 'Unable to establish real-time connection');
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setConnectionStatus('connected');
      showInfo('Reconnected', 'Real-time updates restored');
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
      setConnectionStatus('error');
    });

    // System event handlers
    newSocket.on('system:health', (data) => {
      console.log('System health update:', data);
      if (data.status === 'critical') {
        showError('System Alert', data.message || 'Critical system issue detected');
      }
    });

    newSocket.on('system:maintenance', (data) => {
      showInfo('Maintenance Notice', data.message || 'System maintenance scheduled');
    });

    // Collaboration event handlers
    newSocket.on('collaboration:session-update', (data) => {
      console.log('Collaboration session update:', data);
    });

    newSocket.on('collaboration:participant-joined', (data) => {
      console.log('Participant joined:', data);
    });

    newSocket.on('collaboration:participant-left', (data) => {
      console.log('Participant left:', data);
    });

    // Migration event handlers
    newSocket.on('migration:progress', (data) => {
      console.log('Migration progress:', data);
    });

    newSocket.on('migration:completed', (data) => {
      showInfo('Migration Completed', `${data.type} operation finished successfully`);
    });

    newSocket.on('migration:failed', (data) => {
      showError('Migration Failed', data.error || 'Migration operation failed');
    });

    // Performance monitoring
    newSocket.on('performance:alert', (data) => {
      if (data.severity === 'high') {
        showError('Performance Alert', data.message);
      } else {
        showInfo('Performance Notice', data.message);
      }
    });

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  };

  const subscribe = (event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const unsubscribe = (event: string, callback?: (data: any) => void) => {
    if (socket) {
      if (callback) {
        socket.off(event, callback);
      } else {
        socket.off(event);
      }
    }
  };

  const emit = (event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn('Cannot emit event: Socket not connected');
    }
  };

  const value: WebSocketContextType = {
    socket,
    isConnected,
    connectionStatus,
    subscribe,
    unsubscribe,
    emit,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};