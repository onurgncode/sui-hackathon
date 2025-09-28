import { useState, useEffect } from "react";
import { Box, Button, Flex, Heading, Text, Card } from "@radix-ui/themes";
import { useSocket } from "../hooks/useSocket";
import { useZkLogin } from "../hooks/useZkLogin";

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  points: number;
  timeLimit: number;
}

interface Player {
  address: string;
  nickname: string;
  score: number;
  position: number;
}

interface QuizGameProps {
  refreshKey: number;
  setRefreshKey: (key: number) => void;
  roomCode?: string;
  isHost?: boolean;
  onNavigateToLobby?: () => void;
}

export function QuizGame({ refreshKey, setRefreshKey, roomCode: propRoomCode, isHost, onNavigateToLobby }: QuizGameProps) {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [activePlayers, setActivePlayers] = useState<Player[]>([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [roomCode, setRoomCode] = useState<string>(propRoomCode || '');
  const [isJoined, setIsJoined] = useState(!!propRoomCode);
  const [rewardResults, setRewardResults] = useState<any>(null);
  
  // WebSocket connection
  const { socket, isConnected } = useSocket();
  const { user, getAddress } = useZkLogin();

  // WebSocket event listeners
  useEffect(() => {
    if (!socket) {
      console.log('No socket available');
      return;
    }

    console.log('Setting up WebSocket event listeners');

    // Listen for room state updates
    socket.on('room-state', (data) => {
      console.log('Room state update:', data);
      setGameState(data.gameState);
      setLeaderboard(data.leaderboard || []);
      setActivePlayers(data.leaderboard || []);
      // Update player count from room state
      if (data.currentPlayers !== undefined) {
        console.log('Updating player count from room state:', data.currentPlayers);
        // Update active players based on current count
        setActivePlayers(prev => {
          const newPlayers = [...prev];
          // Ensure we have the right number of players
          while (newPlayers.length < data.currentPlayers) {
            newPlayers.push({
              address: `player_${newPlayers.length + 1}`,
              nickname: `Player ${newPlayers.length + 1}`,
              score: 0,
              position: newPlayers.length + 1
            });
          }
          return newPlayers.slice(0, data.currentPlayers);
        });
      }
    });

    // Listen for leaderboard updates
    socket.on('leaderboard-update', (data) => {
      console.log('🎯 Leaderboard update received:', data);
      console.log('🎯 Setting leaderboard:', data.leaderboard);
      setLeaderboard(data.leaderboard || []);
      setActivePlayers(data.leaderboard || []);
      // Update player count from leaderboard
      if (data.totalPlayers !== undefined) {
        console.log('Updating player count from leaderboard:', data.totalPlayers);
      }
    });

    // Listen for quiz started
    socket.on('quiz-started', (data) => {
      console.log('Quiz started:', data);
      console.log('Question data:', data.question);
      console.log('Total questions:', data.totalQuestions);
      console.log('Game state setting to playing');
      setGameState('playing');
      setCurrentQuestion(data.question);
      setQuestionIndex(0);
      setTotalQuestions(data.totalQuestions || 0);
      setTimeRemaining(data.timeLimit || 30);
    });

    // Listen for timer updates from backend
    socket.on('timer-update', (data) => {
      console.log('Timer update received:', data);
      setTimeRemaining(data.timeRemaining);
      setQuestionIndex(data.currentQuestion);
    });

    // Listen for quiz stopped
    socket.on('quiz-stopped', (data) => {
      console.log('Quiz stopped:', data);
      setGameState('waiting');
      setCurrentQuestion(null);
      setQuestionIndex(0);
      setTimeRemaining(0);
      setSelectedAnswer(null);
      setShowResult(false);
    });

    // Listen for next question
    socket.on('next-question', (data) => {
      console.log('Next question:', data);
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTimeRemaining(data.timeLimit || 30);
      setSelectedAnswer(null);
      setShowResult(false);
    });

    // Listen for quiz finished
    socket.on('quiz-finished', (data) => {
      console.log('🎯 Quiz finished event received:', data);
      console.log('🎯 Setting game state to finished');
      console.log('🎯 Final leaderboard data:', data.leaderboard);
      console.log('🎯 Current playerScore before update:', playerScore);
      setGameState('finished');
      setLeaderboard(data.leaderboard || []);
    });

    // Listen for rewards distributed
    socket.on('rewards-distributed', (data) => {
      console.log('💰 Rewards distributed event received:', data);
      // Store reward results for display
      setRewardResults(data.results);
    });

    // Listen for answer submission result
    socket.on('answer-submitted', (data) => {
      console.log('🎯 Answer submitted:', data);
      setShowResult(true);
      if (data.isCorrect) {
        setPlayerScore(prev => {
          const newScore = prev + data.points;
          console.log(`🎯 Score updated: ${prev} + ${data.points} = ${newScore}`);
          return newScore;
        });
      } else {
        console.log('🎯 Answer was incorrect, no points awarded');
      }
    });

    // Listen for quiz stopped
    socket.on('quiz-stopped', (data) => {
      console.log('Quiz stopped:', data);
      alert('Quiz has been stopped by the host. Redirecting to lobby...');
      window.location.href = '/';
    });

    // Listen for player joined
    socket.on('player-joined', (data) => {
      console.log('Player joined:', data);
      // Update active players count
      setActivePlayers(prev => {
        const newPlayers = [...prev];
        const existingPlayer = newPlayers.find(p => p.address === data.address);
        if (!existingPlayer) {
          newPlayers.push({
            address: data.address,
            nickname: data.nickname,
            score: 0,
            position: newPlayers.length + 1
          });
        }
        return newPlayers;
      });
      // Request updated leaderboard
      if (socket) {
        socket.emit('request-leaderboard');
      }
    });

    // Listen for player left
    socket.on('player-left', (data) => {
      console.log('Player left:', data);
      // Update active players count
      setActivePlayers(prev => prev.filter(p => p.address !== data.address));
      // Request updated leaderboard
      if (socket) {
        socket.emit('request-leaderboard');
      }
    });

    // Listen for room closed
    socket.on('room-closed', (data) => {
      console.log('Room closed:', data);
      alert('Room has been closed by the host. Redirecting to lobby...');
      window.location.href = '/';
    });

    // Listen for errors
    socket.on('error', (error) => {
      console.error('Quiz game error:', error);
      alert(`Error: ${error.message}`);
    });

    return () => {
      socket.off('room-state');
      socket.off('quiz-started');
      socket.off('next-question');
      socket.off('quiz-finished');
      socket.off('answer-submitted');
      socket.off('quiz-stopped');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('room-closed');
      socket.off('timer-update');
      socket.off('leaderboard-update');
      socket.off('error');
    };
  }, [socket]);

  // Auto-join if room code is provided (for host)
  useEffect(() => {
    if (propRoomCode && isHost && socket && isConnected && !isJoined) {
      console.log('Auto-joining room as host:', propRoomCode);
      const nickname = generateNickname();
      const address = getAddress() || "0x0000000000000000000000000000000000000000";
      
      console.log('🚀 Emitting join-room event:', {
        roomCode: propRoomCode.trim(),
        nickname: nickname,
        address: address,
        socketId: socket.id
      });
      
      socket.emit('join-room', {
        roomCode: propRoomCode.trim(),
        nickname: nickname,
        address: address,
      });
      
      setIsJoined(true);
    }
  }, [propRoomCode, isHost, socket, isConnected, isJoined, getAddress]);

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

  // Join room function
  const joinRoom = () => {
    if (!socket || !roomCode.trim()) return;
    
    const nickname = generateNickname();
    const address = getAddress() || "0x0000000000000000000000000000000000000000";
    
    console.log('🚀 Manual join-room event:', {
      roomCode: roomCode.trim(),
      nickname: nickname,
      address: address,
      socketId: socket.id
    });
    
    socket.emit('join-room', {
      roomCode: roomCode.trim(),
      nickname: nickname,
      address: address,
    });
    
    setIsJoined(true);
  };

  // Submit answer function
  const submitAnswer = (answerIndex: number) => {
    if (!socket || selectedAnswer !== null) return;
    
    console.log('🎯 Submitting answer:', answerIndex, 'for question:', questionIndex);
    setSelectedAnswer(answerIndex);
    
    socket.emit('submit-answer', {
      roomCode: roomCode.trim(),
      questionIndex: questionIndex,
      answerIndex: answerIndex,
    });
  };

  // Timer effect removed - now using backend sync
  // Backend will send timer-update events every second

  const getAnswerColor = (index: number) => {
    // Always show selected answer in green, regardless of showResult
    return selectedAnswer === index ? "#4ade80" : "transparent";
  };

  const getAnswerTextColor = (index: number) => {
    // Always show selected answer with dark text
    return selectedAnswer === index ? "#1f2937" : "#dcdcdc";
  };

  if (gameState === 'waiting') {
    return (
      <Box>
        <Heading size="5" style={{ color: "#dcdcdc", marginBottom: "20px" }}>
          Quiz Game
        </Heading>

        {!isJoined ? (
          <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "40px", textAlign: "center" }}>
            <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "16px" }}>
              {isHost ? "Your Quiz Room" : "Join Quiz Room"}
            </Heading>
            <Text size="3" style={{ color: "#dcdcdc", marginBottom: "24px", display: "block" }}>
              {isHost ? "You are the host of this quiz room." : "Enter the room code to join a quiz game."}
            </Text>
            
            <Flex direction="column" gap="3" align="center">
              {!isHost && (
                <input
                  type="text"
                  placeholder="Enter room code (e.g., ABC123)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  style={{
                    padding: "12px 16px",
                    backgroundColor: "#4b4b4b",
                    color: "#dcdcdc",
                    border: "1px solid #e37a1c",
                    borderRadius: "8px",
                    fontSize: "16px",
                    width: "200px",
                    textAlign: "center",
                  }}
                  maxLength={6}
                />
              )}
              
              {isHost && (
                <Text size="3" style={{ color: "#e37a1c", fontWeight: "600" }}>
                  Room Code: {roomCode}
                </Text>
              )}
              
              <Button
                onClick={joinRoom}
                disabled={(!isHost && !roomCode.trim()) || !isConnected}
                style={{
                  backgroundColor: isConnected ? "#e37a1c" : "#666",
                  color: "#4b4b4b",
                  border: "none",
                  cursor: isConnected ? "pointer" : "not-allowed",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  borderRadius: "8px",
                }}
              >
                {isConnected ? (isHost ? "Enter Room" : "Join Room") : "Connecting..."}
              </Button>
            </Flex>
          </Card>
        ) : (
          <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "40px", textAlign: "center" }}>
            <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "16px" }}>
              {isHost ? "Your Quiz Room" : "Waiting for Quiz to Start"}
            </Heading>
            <Text size="3" style={{ color: "#dcdcdc", marginBottom: "24px", display: "block" }}>
              Room Code: {roomCode}
            </Text>
            
            {isHost ? (
              <Flex direction="column" gap="3" align="center">
                <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7, marginBottom: "16px" }}>
                  You are the host. Start the quiz when ready!
                </Text>
                <Flex gap="2" align="center">
                  <Button
                  onClick={async () => {
                    console.log('Starting quiz as host');
                    try {
                      const hostAddress = getAddress();
                      const response = await fetch(`http://localhost:3001/api/rooms/${roomCode}/start`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          hostAddress: hostAddress,
                        }),
                      });

                      const result = await response.json();
                      
                      if (result.success) {
                        console.log('Quiz started successfully:', result);
                        setGameState('playing');
                      } else {
                        throw new Error(result.error || 'Failed to start quiz');
                      }
                    } catch (error) {
                      console.error('Error starting quiz:', error);
                      alert(`Failed to start quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                  }}
                  style={{
                    backgroundColor: "#4ade80",
                    color: "#1f2937",
                    border: "none",
                    cursor: "pointer",
                    padding: "12px 24px",
                    fontSize: "16px",
                    fontWeight: "600",
                    borderRadius: "8px",
                  }}
                >
                  🚀 Start Quiz
                </Button>
              </Flex>
              </Flex>
            ) : (
              <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                The host will start the quiz soon...
              </Text>
            )}
          </Card>
        )}
      </Box>
    );
  }

  if (gameState === 'finished') {
    return (
      <Box>
        <Heading size="5" style={{ color: "#dcdcdc", marginBottom: "20px" }}>
          🏆 Quiz Complete!
        </Heading>

        <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "40px" }}>
          {!isHost && (
            <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "16px", textAlign: "center" }}>
              Your Final Score: {playerScore} points
            </Heading>
          )}
          
          <Box style={{ marginBottom: "24px" }}>
            <Text size="3" style={{ color: "#dcdcdc", marginBottom: "12px", display: "block", fontWeight: "600" }}>
              🏅 Leaderboard
            </Text>
            {leaderboard.map((player, index) => (
              <Box
                key={player.address}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  backgroundColor: player.nickname === "You" ? "#e37a1c20" : "transparent",
                  borderRadius: "6px",
                  marginBottom: "4px",
                }}
              >
                <Text size="2" style={{ color: "#dcdcdc" }}>
                  #{player.position} {player.nickname}
                </Text>
                <Text size="2" style={{ color: "#dcdcdc", fontWeight: "600" }}>
                  {player.score} pts
                </Text>
              </Box>
            ))}
          </Box>

          {!isHost && (
            <Flex gap="3" justify="center">
              <Button
                onClick={() => {
                  setGameState('waiting');
                  setQuestionIndex(0);
                  setPlayerScore(0);
                  setSelectedAnswer(null);
                  setShowResult(false);
                  setIsJoined(false);
                  setRoomCode('');
                }}
                style={{
                  backgroundColor: "#e37a1c",
                  color: "#4b4b4b",
                  border: "none",
                  cursor: "pointer",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  borderRadius: "8px",
                }}
              >
                Play Again
              </Button>
            </Flex>
          )}
          
          {isHost && (
            <Flex gap="3" justify="center">
              <Button
                onClick={() => onNavigateToLobby()}
                style={{
                  backgroundColor: "#e37a1c",
                  color: "#4b4b4b",
                  border: "none",
                  cursor: "pointer",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  borderRadius: "8px",
                }}
              >
                🏠 Ana Lobiye Dön
              </Button>
              <Button
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: "#4b4b4b",
                  color: "#e37a1c",
                  border: "1px solid #e37a1c",
                  cursor: "pointer",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  borderRadius: "8px",
                }}
              >
                🎯 Yeni Quiz Oluştur
              </Button>
            </Flex>
          )}
        </Card>
      </Box>
    );
  }

  console.log('Rendering playing state:', { gameState, currentQuestion, timeRemaining, questionIndex, isConnected, socket: !!socket });
  
  // Quiz finished state
  console.log('Game state check:', { gameState, isFinished: gameState === 'finished', isHost, playerScore, leaderboard });
  console.log('🔍 DEBUG: gameState === "finished":', gameState === 'finished');
  console.log('🔍 DEBUG: isHost:', isHost);
  console.log('🔍 DEBUG: playerScore:', playerScore);
  
  if (gameState === 'finished') {
    console.log('✅ Quiz finished state reached - isHost:', isHost, 'playerScore:', playerScore);
    
    // Host view - only leaderboard
    if (isHost) {
      console.log('Rendering HOST final leaderboard page - leaderboard:', leaderboard);
      return (
        <Box>
          <Heading size="5" style={{ color: "#dcdcdc", marginBottom: "20px" }}>
            🏆 Quiz Complete!
          </Heading>

          <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "40px" }}>
            <Box style={{ marginBottom: "24px" }}>
              <Text size="3" style={{ color: "#dcdcdc", marginBottom: "12px", display: "block", fontWeight: "600" }}>
                🏅 Final Leaderboard
              </Text>
              {leaderboard.map((player, index) => (
                <Box
                  key={player.address}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px",
                    backgroundColor: "#2a2a2a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    marginBottom: "8px"
                  }}
                >
                  <Flex align="center" gap="2">
                    <Text size="2" style={{ color: "#e37a1c", fontWeight: "600" }}>
                      #{index + 1}
                    </Text>
                    <Text size="2" style={{ color: "#dcdcdc" }}>
                      {player.nickname}
                    </Text>
                  </Flex>
                  <Text size="2" style={{ color: "#4ade80", fontWeight: "600" }}>
                    {player.score} pts
                  </Text>
                </Box>
              ))}
            </Box>

            <Flex direction="column" gap="3" align="center">
              <Button
                onClick={() => {
                  // Navigate back to lobby
                  window.location.href = '/';
                }}
                style={{
                  backgroundColor: "#e37a1c",
                  color: "#1f2937",
                  border: "none",
                  cursor: "pointer",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "600",
                  borderRadius: "8px",
                }}
              >
                🏠 Back to Lobby
              </Button>
            </Flex>

            {/* Reward Information */}
            {rewardResults && (
              <Box style={{ marginTop: "24px", padding: "20px", backgroundColor: "#3a3a3a", borderRadius: "8px" }}>
                <Heading size="3" style={{ color: "#e37a1c", marginBottom: "16px", textAlign: "center" }}>
                  🎁 Ödül Dağıtım Sonuçları
                </Heading>
                
                {/* SUI Rewards */}
                {rewardResults.suiRewards && rewardResults.suiRewards.success && (
                  <Box style={{ marginBottom: "16px" }}>
                    <Text size="2" style={{ color: "#dcdcdc", marginBottom: "8px" }}>
                      💰 SUI Ödülleri Dağıtıldı:
                    </Text>
                    <Text size="2" style={{ color: "#00ff00", marginBottom: "8px" }}>
                      Transaction: {rewardResults.suiRewards.transactionDigest}
                    </Text>
                    <Text size="2" style={{ color: "#dcdcdc" }}>
                      <a 
                        href={`https://suiexplorer.com/txblock/${rewardResults.suiRewards.transactionDigest}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#e37a1c", textDecoration: "underline" }}
                      >
                        🔗 Sui Explorer'da Görüntüle
                      </a>
                    </Text>
                  </Box>
                )}
                
                {/* Badges */}
                {rewardResults.badges && rewardResults.badges.length > 0 && (
                  <Box>
                    <Text size="2" style={{ color: "#dcdcdc", marginBottom: "8px" }}>
                      🏆 Dağıtılan Rozetler:
                    </Text>
                    {rewardResults.badges.map((badgeResult: any, index: number) => (
                      <Box key={index} style={{ marginBottom: "8px", padding: "8px", backgroundColor: "#2a2a2a", borderRadius: "4px" }}>
                        <Text size="2" style={{ color: badgeResult.badge.color }}>
                          {badgeResult.player}: {badgeResult.badge.badgeType} - {badgeResult.badge.rarity}
                        </Text>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Card>
        </Box>
      );
    }

    // Player view - final score page
    console.log('Rendering PLAYER final score page - playerScore:', playerScore);
    return (
      <Box>
        <Heading size="5" style={{ color: "#dcdcdc", marginBottom: "20px" }}>
          🎉 Quiz Tamamlandı!
        </Heading>

        <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "40px" }}>
          <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "16px", textAlign: "center" }}>
            Final Skorunuz: {playerScore} puan
          </Heading>
          
          <Text size="3" style={{ color: "#dcdcdc", marginBottom: "24px", textAlign: "center" }}>
            Tebrikler! Quiz'i başarıyla tamamladınız.
          </Text>

          {/* Reward Information */}
          {rewardResults && (
            <Box style={{ marginBottom: "24px", padding: "20px", backgroundColor: "#3a3a3a", borderRadius: "8px" }}>
              <Heading size="3" style={{ color: "#e37a1c", marginBottom: "16px", textAlign: "center" }}>
                🎁 Ödülleriniz
              </Heading>
              
              {/* SUI Rewards */}
              {rewardResults.suiRewards && rewardResults.suiRewards.success && (
                <Box style={{ marginBottom: "16px" }}>
                  <Text size="2" style={{ color: "#dcdcdc", marginBottom: "8px" }}>
                    💰 SUI Ödülü:
                  </Text>
                  <Text size="2" style={{ color: "#00ff00", marginBottom: "8px" }}>
                    Transaction: {rewardResults.suiRewards.transactionDigest}
                  </Text>
                  <Text size="2" style={{ color: "#dcdcdc" }}>
                    <a 
                      href={`https://suiexplorer.com/txblock/${rewardResults.suiRewards.transactionDigest}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#e37a1c", textDecoration: "underline" }}
                    >
                      🔗 Sui Explorer'da Görüntüle
                    </a>
                  </Text>
                </Box>
              )}
              
              {/* Badges */}
              {rewardResults.badges && rewardResults.badges.length > 0 && (
                <Box>
                  <Text size="2" style={{ color: "#dcdcdc", marginBottom: "8px" }}>
                    🏆 Kazandığınız Rozetler:
                  </Text>
                  {rewardResults.badges.map((badgeResult: any, index: number) => (
                    <Box key={index} style={{ marginBottom: "8px", padding: "8px", backgroundColor: "#2a2a2a", borderRadius: "4px" }}>
                      <Text size="2" style={{ color: badgeResult.badge.color }}>
                        {badgeResult.badge.badgeType} - {badgeResult.badge.rarity}
                      </Text>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          <Flex direction="column" gap="3" align="center">
            <Button
              onClick={() => {
                // Navigate back to lobby
                window.location.href = '/';
              }}
              style={{
                backgroundColor: "#e37a1c",
                color: "#1f2937",
                border: "none",
                cursor: "pointer",
                padding: "12px 24px",
                fontSize: "16px",
                fontWeight: "600",
                borderRadius: "8px",
              }}
            >
              🏠 Ana Lobiye Dön
            </Button>
            
            <Button
              onClick={() => {
                // Create new quiz
                window.location.href = '/';
              }}
              style={{
                backgroundColor: "transparent",
                color: "#e37a1c",
                border: "1px solid #e37a1c",
                cursor: "pointer",
                padding: "12px 24px",
                fontSize: "16px",
                fontWeight: "600",
                borderRadius: "8px",
              }}
            >
              🎯 Tekrar Oyna
            </Button>
          </Flex>
        </Card>
      </Box>
    );
  }

  // Host Management View
  if (isHost) {
    return (
      <Box>
        <Flex justify="between" align="center" style={{ marginBottom: "20px" }}>
          <Heading size="5" style={{ color: "#dcdcdc" }}>
            Quiz Management - Question {questionIndex + 1}
          </Heading>
          
          <Flex gap="2" align="center">
            {/* Real-time Player Count */}
            <Text size="2" style={{ color: "#dcdcdc", marginRight: "16px" }}>
              👥 Players: {activePlayers.length}
            </Text>
            
            {gameState === 'waiting' && (
              <Button
                onClick={async () => {
                  try {
                    const hostAddress = getAddress();
                    const response = await fetch(`http://localhost:3001/api/rooms/${roomCode}/start`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        hostAddress: hostAddress,
                      }),
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                      console.log('Quiz started successfully:', result);
                    } else {
                      throw new Error(result.error || 'Failed to start quiz');
                    }
                  } catch (error) {
                    console.error('Error starting quiz:', error);
                    alert(`Failed to start quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }}
                style={{
                  backgroundColor: "#4ade80",
                  color: "#1f2937",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: "600",
                  borderRadius: "6px",
                }}
              >
                🚀 Start Quiz
              </Button>
            )}
            
            {gameState === 'playing' && (
              <Button
                onClick={async () => {
                  if (confirm('Are you sure you want to stop this quiz? The quiz will be paused and players can continue later.')) {
                    try {
                      const hostAddress = getAddress();
                      const response = await fetch(`http://localhost:3001/api/rooms/${roomCode}/stop`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          hostAddress: hostAddress,
                        }),
                      });

                      const result = await response.json();
                      
                      if (result.success) {
                        console.log('Quiz stopped successfully:', result);
                        // Navigate back to lobby
                        window.location.href = '/';
                      } else {
                        throw new Error(result.error || 'Failed to stop quiz');
                      }
                    } catch (error) {
                      console.error('Error stopping quiz:', error);
                      alert(`Failed to stop quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                  }
                }}
                style={{
                  backgroundColor: "#f59e0b",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: "600",
                  borderRadius: "6px",
                }}
              >
                ⏸️ Stop Quiz
              </Button>
            )}
          </Flex>
        </Flex>

        {/* Host Management Dashboard */}
        <Card style={{ 
          backgroundColor: "#2a2a2a", 
          border: "1px solid #e37a1c",
          padding: "24px",
          marginBottom: "20px"
        }}>
          <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "16px" }}>
            📊 Quiz Control Panel
          </Heading>
          
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center">
              <Text size="3" style={{ color: "#dcdcdc" }}>
                Current Question: {questionIndex + 1}{totalQuestions > 0 ? ` of ${totalQuestions}` : ''}
              </Text>
              <Text size="3" style={{ color: "#e37a1c" }}>
                Time Remaining: {timeRemaining}s
              </Text>
            </Flex>
            
            <Flex justify="between" align="center">
              <Text size="3" style={{ color: "#dcdcdc" }}>
                Game State: {gameState}
              </Text>
              <Text size="3" style={{ color: "#4ade80" }}>
                Active Players: {activePlayers.length}
              </Text>
            </Flex>
          </Flex>
        </Card>

        {/* Host Leaderboard */}
        {activePlayers.length > 0 && (
          <Card style={{ 
            backgroundColor: "#2a2a2a", 
            border: "1px solid #e37a1c",
            padding: "16px"
          }}>
            <Heading size="3" style={{ color: "#dcdcdc", marginBottom: "16px" }}>
              🏆 Live Leaderboard ({activePlayers.length} players)
            </Heading>
            
            <Flex direction="column" gap="2">
              {activePlayers.map((player, index) => (
                <Flex key={player.address} justify="between" align="center" style={{
                  backgroundColor: "#1a1a1a",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #333"
                }}>
                  <Flex align="center" gap="2">
                    <Text size="2" style={{ color: "#e37a1c", fontWeight: "600" }}>
                      #{index + 1}
                    </Text>
                    <Text size="2" style={{ color: "#dcdcdc" }}>
                      {player.nickname}
                    </Text>
                  </Flex>
                  
                  <Flex align="center" gap="2">
                    <Text size="2" style={{ color: "#4ade80", fontWeight: "600" }}>
                      {player.score} pts
                    </Text>
                    <Text size="1" style={{ color: "#666" }}>
                      {player.address.slice(0, 6)}...{player.address.slice(-4)}
                    </Text>
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </Card>
        )}

      </Box>
    );
  }

  // Player Quiz View
  return (
    <Box>
      <Flex justify="between" align="center" style={{ marginBottom: "20px" }}>
        <Heading size="5" style={{ color: "#dcdcdc" }}>
          Quiz Game - Question {questionIndex + 1}{totalQuestions > 0 ? ` of ${totalQuestions}` : ''}
        </Heading>
        
        <Flex align="center" gap="3">
          {gameState === 'finished' && (
            <Text size="3" style={{ color: "#dcdcdc" }}>
              Score: {playerScore} points
            </Text>
          )}
          <Text size="3" style={{ color: "#e37a1c" }}>
            ⏰ {timeRemaining}s
          </Text>
        </Flex>
      </Flex>

      <Flex direction="column" gap="4">

        {/* Question */}
        <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "24px" }}>
          <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "20px" }}>
            {currentQuestion?.questionText}
          </Heading>

          <Flex direction="column" gap="3">
            {currentQuestion?.options.map((option, index) => (
              <Button
                key={index}
                onClick={() => submitAnswer(index)}
                disabled={selectedAnswer !== null}
                style={{
                  backgroundColor: getAnswerColor(index),
                  color: getAnswerTextColor(index),
                  border: "1px solid #e37a1c",
                  cursor: selectedAnswer !== null ? "not-allowed" : "pointer",
                  padding: "12px 16px",
                  fontSize: "16px",
                  fontWeight: "500",
                  borderRadius: "8px",
                  textAlign: "left",
                  justifyContent: "flex-start",
                }}
              >
                {String.fromCharCode(65 + index)}. {option}
              </Button>
            ))}
          </Flex>

          {showResult && gameState !== 'finished' && (
            <Box style={{ marginTop: "20px", textAlign: "center" }}>
              <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                Waiting for next question...
              </Text>
            </Box>
          )}
        </Card>
      </Flex>

      {/* Host Player Leaderboard */}
      {isHost && leaderboard.length > 0 && (
        <Card style={{ 
          backgroundColor: "#2a2a2a", 
          border: "1px solid #e37a1c",
          padding: "16px",
          marginTop: "20px"
        }}>
          <Heading size="3" style={{ color: "#dcdcdc", marginBottom: "16px" }}>
            👥 Live Players ({leaderboard.length})
          </Heading>
          
          <Flex direction="column" gap="2">
            {leaderboard.map((player, index) => (
              <Flex key={player.address} justify="between" align="center" style={{
                backgroundColor: "#1a1a1a",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #333"
              }}>
                <Flex align="center" gap="2">
                  <Text size="2" style={{ color: "#e37a1c", fontWeight: "600" }}>
                    #{index + 1}
                  </Text>
                  <Text size="2" style={{ color: "#dcdcdc" }}>
                    {player.nickname}
                  </Text>
                </Flex>
                
                <Flex align="center" gap="2">
                  <Text size="2" style={{ color: "#4ade80", fontWeight: "600" }}>
                    {player.score} pts
                  </Text>
                  <Text size="1" style={{ color: "#666" }}>
                    {player.address.slice(0, 6)}...{player.address.slice(-4)}
                  </Text>
                </Flex>
              </Flex>
            ))}
          </Flex>
        </Card>
      )}
    </Box>
  );
}
