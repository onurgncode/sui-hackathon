import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomCode: string, nickname: string, address: string) => void;
  leaveRoom: () => void;
  startQuiz: () => void;
  submitAnswer: (questionIndex: number, answer: number) => void;
  nextQuestion: () => void;
  onEvent: (event: string, callback: (...args: any[]) => void) => void;
  offEvent: (event: string, callback: (...args: any[]) => void) => void;
}

// Global socket instance to prevent multiple connections
let globalSocket: Socket | null = null;

// Function to properly disconnect the global socket
export const disconnectGlobalSocket = () => {
  if (globalSocket) {
    console.log('🔌 Disconnecting global WebSocket');
    globalSocket.disconnect();
    globalSocket = null;
  }
};

// Function to reset global socket (for reconnection after logout)
export const resetGlobalSocket = () => {
  if (globalSocket) {
    console.log('🔄 Resetting global WebSocket');
    globalSocket.disconnect();
    globalSocket = null;
  }
};

export function useSocket(): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Use existing socket or create new one
    if (!globalSocket) {
      console.log('🔌 Creating new WebSocket connection');
      globalSocket = io('http://localhost:3001', {
        transports: ['websocket', 'polling'], // Allow both WebSocket and polling
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: false,
      });
    } else {
      console.log('🔌 Reusing existing WebSocket connection, current state:', globalSocket.connected ? 'connected' : 'disconnected');
    }

    socketRef.current = globalSocket;

    const socket = globalSocket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server, socket ID:', socket.id);
      console.log('🔍 Socket connection state:', {
        connected: socket.connected,
        id: socket.id,
        transport: socket.io.engine.transport.name
      });
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from WebSocket server, reason:', reason);
      console.log('🔍 Disconnect details:', {
        reason,
        wasConnected: socket.connected,
        id: socket.id
      });
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🚨 WebSocket connection error:', error);
    });

    socket.on('error', (error) => {
      console.error('🚨 WebSocket error:', error);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to WebSocket server after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
      console.error('🚨 Reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      console.error('🚨 Reconnection failed after all attempts');
    });

    // Ping-pong mechanism for connection stability
    socket.on('pong', () => {
      console.log('🏓 Received pong from server');
    });

    // Send ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
        console.log('🏓 Sent ping to server');
      }
    }, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(pingInterval);
      // Don't disconnect the global socket, just remove event listeners
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('error');
      socket.off('reconnect');
      socket.off('reconnect_attempt');
      socket.off('reconnect_error');
      socket.off('reconnect_failed');
      socket.off('pong');
    };
  }, []);

  const joinRoom = (roomCode: string, nickname: string, address: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join-room', { roomCode, nickname, address });
    }
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room');
    }
  };

  const startQuiz = () => {
    if (socketRef.current) {
      socketRef.current.emit('start-quiz');
    }
  };

  const submitAnswer = (questionIndex: number, answer: number) => {
    if (socketRef.current) {
      socketRef.current.emit('submit-answer', { questionIndex, answer });
    }
  };

  const nextQuestion = () => {
    if (socketRef.current) {
      socketRef.current.emit('next-question');
    }
  };

  const onEvent = (event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const offEvent = (event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    joinRoom,
    leaveRoom,
    startQuiz,
    submitAnswer,
    nextQuestion,
    onEvent,
    offEvent,
  };
}
