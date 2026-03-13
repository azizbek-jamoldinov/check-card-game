import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  FC,
  ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../services/socket';
import type { ClientGameState, PeekedCard, RoomData, ActionType } from '../types/game.types';

// ============================================================
// Types
// ============================================================

interface YourTurnData {
  playerId: string;
  canCheck: boolean;
  availableActions: ActionType[];
}

interface SocketContextValue {
  isConnected: boolean;
  playerId: string | null;
  username: string | null;
  roomData: RoomData | null;
  gameState: ClientGameState | null;
  peekedCards: PeekedCard[] | null;
  isMyTurn: boolean;
  turnData: YourTurnData | null;
  createRoom: (username: string) => Promise<{ success: boolean; error?: string }>;
  joinRoom: (roomCode: string, username: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => void;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  endPeek: () => Promise<{ success: boolean; error?: string }>;
  performAction: (
    actionType: ActionType,
    slot?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

const SocketContext = createContext<SocketContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: FC<SocketProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [peekedCards, setPeekedCards] = useState<PeekedCard[] | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [turnData, setTurnData] = useState<YourTurnData | null>(null);

  // Use a ref for navigate to avoid re-registering socket listeners
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Connect socket on mount
  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('roomUpdated', (data: RoomData) => {
      setRoomData(data);
    });

    socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
    });

    socket.on('gameStarted', (data: { gameState: ClientGameState; peekedCards: PeekedCard[] }) => {
      console.log('Game started, peeked cards:', data.peekedCards);
      setGameState(data.gameState);
      setPeekedCards(data.peekedCards);
      setIsMyTurn(false);
      setTurnData(null);
      navigateRef.current('/game');
    });

    socket.on('gameStateUpdated', (data: ClientGameState) => {
      console.log('Game state updated, phase:', data.phase);
      setGameState(data);
      // Reset turn state — will be re-set by 'yourTurn' if it's still our turn
      setIsMyTurn(false);
      setTurnData(null);
    });

    socket.on('yourTurn', (data: YourTurnData) => {
      console.log('Your turn!', data);
      setIsMyTurn(true);
      setTurnData(data);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('roomUpdated');
      socket.off('error');
      socket.off('gameStarted');
      socket.off('gameStateUpdated');
      socket.off('yourTurn');
      socket.disconnect();
    };
  }, []);

  // ----------------------------------------------------------
  // Create Room
  // ----------------------------------------------------------
  const createRoom = useCallback((name: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.emit(
        'createRoom',
        { username: name },
        (response: {
          success: boolean;
          roomCode?: string;
          playerId?: string;
          room?: RoomData;
          error?: string;
        }) => {
          if (response.success && response.playerId && response.roomCode) {
            setPlayerId(response.playerId);
            setUsername(name);
            if (response.room) {
              setRoomData(response.room);
            }
          }
          resolve({ success: response.success, error: response.error });
        },
      );
    });
  }, []);

  // ----------------------------------------------------------
  // Join Room
  // ----------------------------------------------------------
  const joinRoom = useCallback(
    (roomCode: string, name: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        socket.emit(
          'joinRoom',
          { roomCode, username: name },
          (response: { success: boolean; playerId?: string; room?: RoomData; error?: string }) => {
            if (response.success && response.playerId) {
              setPlayerId(response.playerId);
              setUsername(name);
              if (response.room) {
                setRoomData(response.room);
              }
            }
            resolve({ success: response.success, error: response.error });
          },
        );
      });
    },
    [],
  );

  // ----------------------------------------------------------
  // Leave Room
  // ----------------------------------------------------------
  const leaveRoom = useCallback(() => {
    if (roomData && playerId) {
      socket.emit('leaveRoom', { roomCode: roomData.roomCode, playerId });
    }
    setRoomData(null);
    setPlayerId(null);
    setUsername(null);
    setGameState(null);
    setPeekedCards(null);
  }, [roomData, playerId]);

  // ----------------------------------------------------------
  // Start Game
  // ----------------------------------------------------------
  const startGame = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!roomData || !playerId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }
      socket.emit(
        'startGame',
        { roomCode: roomData.roomCode, playerId },
        (response: { success: boolean; error?: string }) => {
          resolve(response);
        },
      );
    });
  }, [roomData, playerId]);

  // ----------------------------------------------------------
  // End Peek — transition from peeking to playing (F-031 → F-033)
  // ----------------------------------------------------------
  const endPeek = useCallback((): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!roomData || !playerId) {
        resolve({ success: false, error: 'Not in a room' });
        return;
      }
      socket.emit(
        'endPeek',
        { roomCode: roomData.roomCode, playerId },
        (response: { success: boolean; error?: string }) => {
          setPeekedCards(null);
          resolve(response);
        },
      );
    });
  }, [roomData, playerId]);

  // ----------------------------------------------------------
  // Perform Action — send a player action to the server (F-035)
  // ----------------------------------------------------------
  const performAction = useCallback(
    (actionType: ActionType, slot?: string): Promise<{ success: boolean; error?: string }> => {
      return new Promise((resolve) => {
        if (!roomData || !playerId) {
          resolve({ success: false, error: 'Not in a room' });
          return;
        }
        const action: { type: ActionType; slot?: string } = { type: actionType };
        if (slot) {
          action.slot = slot;
        }
        socket.emit(
          'playerAction',
          { roomCode: roomData.roomCode, playerId, action },
          (response: { success: boolean; error?: string }) => {
            resolve(response);
          },
        );
      });
    },
    [roomData, playerId],
  );

  const value: SocketContextValue = {
    isConnected,
    playerId,
    username,
    roomData,
    gameState,
    peekedCards,
    isMyTurn,
    turnData,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    endPeek,
    performAction,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

// ============================================================
// Hook
// ============================================================

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
