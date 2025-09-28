import { useState, useEffect } from "react";
import { Box, Button, Flex, Heading, Text, TextField, Card } from "@radix-ui/themes";
import { useSocket } from "../hooks/useSocket";
import { useZkLogin } from "../hooks/useZkLogin";
import { SuccessModal } from "./Modal";

interface QuizRoom {
  id: string;
  roomCode: string;
  title: string;
  host: string;
  currentPlayers: number;
  maxPlayers: number;
  status: 'waiting' | 'in_progress' | 'finished';
  createdAt: number;
}

interface QuizLobbyProps {
  refreshKey: number;
  setRefreshKey: (key: number) => void;
  onNavigateToGame?: (roomCode?: string, isHost?: boolean) => void;
}

export function QuizLobby({ refreshKey, setRefreshKey, onNavigateToGame }: QuizLobbyProps) {
  const [rooms, setRooms] = useState<QuizRoom[]>([]);
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinData, setJoinData] = useState<{roomCode: string, nickname: string, isHost: boolean} | null>(null);
  
  const { isConnected, joinRoom, onEvent, offEvent } = useSocket();
  const { user, isAuthenticated, getAddress } = useZkLogin();

  // Generate automatic nickname from wallet info
  const generateNickname = () => {
    if (user?.name && user.name !== 'Enoki User') {
      return user.name;
    }
    
    const address = getAddress();
    if (address) {
      // Use first 6 characters of address + last 4 characters
      return `Player_${address.slice(0, 6)}${address.slice(-4)}`;
    }
    
    return `Player_${Math.random().toString(36).substr(2, 6)}`;
  };

  // Generate nickname when needed
  const getCurrentNickname = () => {
    return generateNickname();
  };

  // Check if user is the host of a room
  const isHostOfRoom = (room: QuizRoom) => {
    const userAddress = getAddress();
    return userAddress && room.hostAddress === userAddress;
  };

  // Global host disconnect listener
  useEffect(() => {
    const handleGlobalHostDisconnected = (data: any) => {
      console.log("Global host disconnected:", data);
      // Refresh rooms to update status
      fetchRooms();
    };

    onEvent('host-disconnected', handleGlobalHostDisconnected);

    return () => {
      offEvent('host-disconnected', handleGlobalHostDisconnected);
    };
  }, [onEvent, offEvent]);

  // Fetch rooms from backend
  const fetchRooms = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/rooms');
      const result = await response.json();
      
      if (result.success) {
        setRooms(result.rooms);
      } else {
        console.error('Error fetching rooms:', result.error);
        setRooms([]);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setRooms([]);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [refreshKey]);

  // Auto-refresh rooms every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected && !isLoading) {
        fetchRooms();
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [isConnected, isLoading]);

  const joinRoomById = async (roomId: string) => {
    if (!isAuthenticated) {
      alert("Please login with Google first");
      return;
    }

    setIsJoining(true);
    try {
      // Get room by ID and join via WebSocket
      const room = rooms.find(r => r.id === roomId);
      if (!room) {
        alert("Room not found");
        setIsJoining(false);
        return;
      }

      const userAddress = getAddress() || "0x0000000000000000000000000000000000000000";
      const autoNickname = generateNickname();
      
      // Check if user is the host
      const isHost = isHostOfRoom(room);
      
      if (isHost) {
        // Host joining their own room - direct join without room code
        joinRoom(room.roomCode, autoNickname, userAddress);
        setJoinData({ roomCode: room.roomCode, nickname: autoNickname, isHost: true });
        setShowJoinModal(true);
      } else {
        // Regular player joining - use room code
        joinRoom(room.roomCode, autoNickname, userAddress);
        setJoinData({ roomCode: room.roomCode, nickname: autoNickname, isHost: false });
        setShowJoinModal(true);
      }
      
      // Set up event listeners
      const handleRoomState = (data: any) => {
        console.log("Room state received:", data);
        setIsJoining(false);
      };

      const handleError = (error: any) => {
        console.error("Error joining room:", error);
        alert(error.message || "Failed to join room. Please try again.");
        setIsJoining(false);
      };

      const handleHostDisconnected = (data: any) => {
        console.log("Host disconnected:", data);
        // Refresh rooms to update status
        fetchRooms();
        alert("Host disconnected. Quiz has been reset.");
      };

      onEvent('room-state', handleRoomState);
      onEvent('error', handleError);
      onEvent('host-disconnected', handleHostDisconnected);

      // Clean up listeners after 5 seconds
      setTimeout(() => {
        offEvent('room-state', handleRoomState);
        offEvent('error', handleError);
        offEvent('host-disconnected', handleHostDisconnected);
      }, 5000);
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Failed to join room. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const joinByCode = async () => {
    if (!roomCode.trim()) {
      alert("Please enter room code");
      return;
    }

    if (!isAuthenticated) {
      alert("Please login with Google first");
      return;
    }

    if (!isConnected) {
      alert("Not connected to server. Please wait and try again.");
      return;
    }

    setIsJoining(true);
    try {
      // Use WebSocket to join room
      const userAddress = getAddress() || "0x0000000000000000000000000000000000000000";
      const autoNickname = generateNickname();
      joinRoom(roomCode, autoNickname, userAddress);
      
      // Show success modal
      setJoinData({ roomCode, nickname: autoNickname, isHost: false });
      setShowJoinModal(true);
      
      // Set up event listeners
      const handleRoomState = (data: any) => {
        console.log("Room state received:", data);
        setRoomCode("");
        setIsJoining(false);
      };

      const handleError = (error: any) => {
        console.error("Error joining room:", error);
        alert(error.message || "Failed to join room. Please check the room code and try again.");
        setIsJoining(false);
      };

      const handleHostDisconnected = (data: any) => {
        console.log("Host disconnected:", data);
        // Refresh rooms to update status
        fetchRooms();
        alert("Host disconnected. Quiz has been reset.");
      };

      onEvent('room-state', handleRoomState);
      onEvent('error', handleError);
      onEvent('host-disconnected', handleHostDisconnected);

      // Clean up listeners after 5 seconds
      setTimeout(() => {
        offEvent('room-state', handleRoomState);
        offEvent('error', handleError);
        offEvent('host-disconnected', handleHostDisconnected);
      }, 5000);

    } catch (error) {
      console.error("Error joining room:", error);
      alert("Failed to join room. Please check the room code and try again.");
      setIsJoining(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return '#e37a1c';
      case 'in_progress': return '#ff6b6b';
      case 'finished': return '#666';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return 'Waiting';
      case 'in_progress': return 'In Progress';
      case 'finished': return 'Finished';
      default: return 'Unknown';
    }
  };

  return (
    <Box>
        <Heading size="5" style={{ color: "#dcdcdc", marginBottom: "20px" }}>
          Quiz Lobby
        </Heading>

      <Flex direction="column" gap="6">
        {/* Connection Status */}
        <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "16px" }}>
          <Flex align="center" gap="3">
            <Box
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: isConnected ? "#4ade80" : "#f87171",
              }}
            />
            <Text size="2" style={{ color: "#dcdcdc" }}>
              {isConnected ? "Connected to server" : "Disconnected from server"}
            </Text>
          </Flex>
        </Card>

        {/* Join by Room Code */}
        <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "20px" }}>
          <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "16px" }}>
            Join by Room Code
          </Heading>
          
          <Flex direction="column" gap="3">
            <Box>
              <Text size="3" style={{ color: "#dcdcdc", marginBottom: "8px", display: "block" }}>
                Room Code
              </Text>
              <TextField.Root
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-digit room code..."
                maxLength={6}
                style={{
                  backgroundColor: "#4b4b4b",
                  border: "1px solid #e37a1c",
                  color: "#dcdcdc",
                }}
              />
            </Box>

            {/* Auto-generated nickname info */}
            {isAuthenticated && (
              <Box style={{ padding: "12px", backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", borderRadius: "8px" }}>
                <Text size="2" style={{ color: "#dcdcdc", opacity: 0.8 }}>
                  Playing as: <Text style={{ color: "#e37a1c", fontWeight: "600" }}>{getCurrentNickname()}</Text>
                </Text>
              </Box>
            )}

            <Button
              onClick={joinByCode}
              disabled={isJoining || !roomCode.trim() || !isAuthenticated}
              style={{
                backgroundColor: isJoining ? "#666" : "#e37a1c",
                color: "#4b4b4b",
                border: "none",
                cursor: isJoining ? "not-allowed" : "pointer",
                padding: "12px 24px",
                fontSize: "16px",
                fontWeight: "600",
                borderRadius: "8px",
              }}
            >
              {isJoining ? "Joining..." : "Join Room"}
            </Button>
          </Flex>
        </Card>

        {/* Available Rooms */}
        <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "20px" }}>
          <Flex justify="between" align="center" style={{ marginBottom: "16px" }}>
            <Heading size="4" style={{ color: "#dcdcdc" }}>
              Available Quiz Rooms
            </Heading>
            <Button
              onClick={fetchRooms}
              disabled={isLoading}
              style={{
                backgroundColor: isLoading ? "#666" : "#e37a1c",
                color: "#4b4b4b",
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "600",
                borderRadius: "6px",
              }}
            >
              {isLoading ? "Loading..." : "🔄 Refresh"}
            </Button>
          </Flex>
          
          {/* Auto-generated nickname info */}
          {isAuthenticated && (
            <Box style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", borderRadius: "8px" }}>
              <Text size="2" style={{ color: "#dcdcdc", opacity: 0.8 }}>
                Playing as: <Text style={{ color: "#e37a1c", fontWeight: "600" }}>{getCurrentNickname()}</Text>
              </Text>
            </Box>
          )}

          {isLoading ? (
            <Box style={{ textAlign: "center", padding: "40px" }}>
              <Text size="3" style={{ color: "#dcdcdc" }}>
                Loading quiz rooms...
              </Text>
            </Box>
          ) : rooms.length === 0 ? (
            <Box style={{ textAlign: "center", padding: "40px" }}>
              <Text size="3" style={{ color: "#dcdcdc", marginBottom: "16px", display: "block" }}>
                No quiz rooms available yet.
              </Text>
              <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                Create a quiz using the "Create Quiz" button above, then use the Room Code to join!
              </Text>
            </Box>
          ) : (
            <Flex direction="column" gap="3">
              {rooms.map((room) => (
                <Box
                  key={room.id}
                  style={{
                    border: "1px solid #e37a1c",
                    borderRadius: "8px",
                    padding: "16px",
                    backgroundColor: "#4b4b4b",
                  }}
                >
                  <Flex justify="between" align="center" style={{ marginBottom: "12px" }}>
                    <Box>
                      <Text size="4" style={{ color: "#dcdcdc", fontWeight: "600" }}>
                        {room.title}
                      </Text>
                      <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                        Room Code: {room.roomCode}
                      </Text>
                    </Box>
                    <Box style={{ textAlign: "right" }}>
                      <Text
                        size="2"
                        style={{
                          color: getStatusColor(room.status),
                          fontWeight: "600",
                          backgroundColor: getStatusColor(room.status) + "20",
                          padding: "4px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        {getStatusText(room.status)}
                      </Text>
                    </Box>
                  </Flex>

                  <Flex justify="between" align="center">
                    <Flex align="center" gap="2">
                      <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                        Players: {room.currentPlayers}/{room.maxPlayers}
                      </Text>
                      {isHostOfRoom(room) && (
                        <Text size="1" style={{ 
                          color: "#e37a1c", 
                          backgroundColor: "#e37a1c20",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontWeight: "600"
                        }}>
                          YOUR ROOM
                        </Text>
                      )}
                    </Flex>
                    <Flex gap="2">
                      <Button
                        onClick={() => joinRoomById(room.id)}
                        disabled={isJoining || room.status !== 'waiting' || room.currentPlayers >= room.maxPlayers || !isAuthenticated}
                        style={{
                          backgroundColor: 
                            room.status !== 'waiting' || room.currentPlayers >= room.maxPlayers 
                              ? "#666" 
                              : isHostOfRoom(room)
                                ? "#4ade80" // Green for host's own room
                                : "#e37a1c",
                          color: "#4b4b4b",
                          border: "none",
                          cursor: 
                            room.status !== 'waiting' || room.currentPlayers >= room.maxPlayers 
                              ? "not-allowed" 
                              : "pointer",
                          padding: "8px 16px",
                          fontSize: "14px",
                          fontWeight: "600",
                          borderRadius: "6px",
                        }}
                      >
                        {room.status === 'waiting' 
                          ? room.currentPlayers >= room.maxPlayers 
                            ? "Room Full" 
                            : !isAuthenticated
                              ? "Login Required"
                              : isHostOfRoom(room)
                                ? "Enter Room"
                                : "Join"
                          : "In Progress"
                        }
                      </Button>
                      
                      {isHostOfRoom(room) && (
                        <Button
                          onClick={async () => {
                            if (confirm('Are you sure you want to delete this room? All players will be disconnected and the room will be permanently deleted.')) {
                              try {
                                const hostAddress = getAddress();
                                const response = await fetch(`http://localhost:3001/api/rooms/${room.roomCode}`, {
                                  method: 'DELETE',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    hostAddress: hostAddress,
                                  }),
                                });

                                const result = await response.json();
                                
                                if (result.success) {
                                  console.log('Room deleted successfully:', result);
                                  // Refresh rooms list
                                  fetchRooms();
                                } else {
                                  throw new Error(result.error || 'Failed to delete room');
                                }
                              } catch (error) {
                                console.error('Error deleting room:', error);
                                alert(`Failed to delete room: ${error instanceof Error ? error.message : 'Unknown error'}`);
                              }
                            }
                          }}
                          style={{
                            backgroundColor: "#ef4444",
                            color: "white",
                            border: "none",
                            cursor: "pointer",
                            padding: "8px 16px",
                            fontSize: "14px",
                            fontWeight: "600",
                            borderRadius: "6px",
                          }}
                        >
                          🗑️ Delete Room
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                </Box>
              ))}
            </Flex>
          )}
        </Card>
      </Flex>

      {/* Join Success Modal */}
      <SuccessModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title={joinData?.isHost ? "Entered Your Room!" : "Successfully Joined Room!"}
        message={joinData?.isHost ? "You have entered your own quiz room!" : "You have joined the quiz room successfully!"}
        details={`Room Code: ${joinData?.roomCode} • Playing as: ${joinData?.nickname}`}
        buttonText="Start Playing"
        onButtonClick={() => {
          setShowJoinModal(false);
          if (onNavigateToGame) {
            onNavigateToGame(joinData?.roomCode, joinData?.isHost);
          }
        }}
      />
    </Box>
  );
}
