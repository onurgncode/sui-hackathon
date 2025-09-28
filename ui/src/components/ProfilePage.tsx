import { useState, useEffect } from "react";
import { Box, Button, Card, Flex, Heading, Text, Badge, Separator, Grid } from "@radix-ui/themes";
import { useZkLogin } from "../hooks/useZkLogin";
import { config } from "../config/environment";
import { useSuiWallet } from "../hooks/useSuiWallet";

interface QuizStats {
  totalQuizzesPlayed: number;
  totalQuizzesCreated: number;
  totalScore: number;
  averageScore: number;
  badgesEarned: number;
  suiEarned: number;
  rank: string;
}

interface QuizHistory {
  id: string;
  title: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
  isHost: boolean;
  rewardEarned?: number;
}

interface BadgeInfo {
  id: string;
  badgeType: string;
  quizTitle: string;
  score: number;
  earnedAt: string;
  rarity: string;
  color: string;
}

interface ProfilePageProps {
  onNavigateToLobby?: () => void;
  onNavigateToCreate?: () => void;
  onNavigateToBadges?: () => void;
}

export function ProfilePage({ onNavigateToLobby, onNavigateToCreate, onNavigateToBadges }: ProfilePageProps) {
  const [stats, setStats] = useState<QuizStats>({
    totalQuizzesPlayed: 0,
    totalQuizzesCreated: 0,
    totalScore: 0,
    averageScore: 0,
    badgesEarned: 0,
    suiEarned: 0,
    rank: "Beginner"
  });
  const [quizHistory, setQuizHistory] = useState<QuizHistory[]>([]);
  const [badges, setBadges] = useState<BadgeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'badges'>('overview');
  const [copySuccess, setCopySuccess] = useState(false);

  const { getAddress: getZkAddress, isAuthenticated: isZkAuthenticated } = useZkLogin();
  const { wallet, isConnected: isWalletConnected } = useSuiWallet();

  // Get current user address
  const currentAddress = isZkAuthenticated ? getZkAddress() : (isWalletConnected ? wallet?.address : null);

  useEffect(() => {
    if (currentAddress) {
      loadProfileData();
    }
  }, [currentAddress]);

  const loadProfileData = async () => {
    if (!currentAddress) return;

    setIsLoading(true);
    try {
      // Load user stats
      const statsResponse = await fetch(`${config.api.baseUrl}/api/profile/${currentAddress}/stats`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Load quiz history
      const historyResponse = await fetch(`${config.api.baseUrl}/api/profile/${currentAddress}/history`);
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setQuizHistory(historyData);
      }

      // Load badges
      const badgesResponse = await fetch(`${config.api.baseUrl}/api/profile/${currentAddress}/badges`);
      if (badgesResponse.ok) {
        const badgesData = await badgesResponse.json();
        setBadges(badgesData);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankColor = (rank: string) => {
    switch (rank) {
      case 'Beginner': return 'gray';
      case 'Novice': return 'green';
      case 'Intermediate': return 'blue';
      case 'Advanced': return 'purple';
      case 'Expert': return 'orange';
      case 'Master': return 'red';
      default: return 'gray';
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return '#808080';
      case 'uncommon': return '#00FF00';
      case 'rare': return '#0080FF';
      case 'epic': return '#8000FF';
      case 'legendary': return '#FFD700';
      default: return '#808080';
    }
  };

  const copyAddressToClipboard = async () => {
    if (!currentAddress) return;
    
    try {
      await navigator.clipboard.writeText(currentAddress);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentAddress;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  if (!currentAddress) {
    return (
      <Box>
        <Heading size="5" style={{ color: "#dcdcdc", marginBottom: "20px" }}>
          👤 Profile
        </Heading>
        <Card style={{ padding: "20px", textAlign: "center" }}>
          <Text size="4" style={{ color: "#dcdcdc" }}>
            Please connect your wallet to view your profile
          </Text>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="between" align="center" style={{ marginBottom: "20px" }}>
        <Heading size="5" style={{ color: "#dcdcdc" }}>
          👤 Profile
        </Heading>
        <Flex gap="2">
          <Button 
            variant="outline" 
            onClick={onNavigateToLobby}
            style={{ color: "#dcdcdc", borderColor: "#444" }}
          >
            🏠 Lobby
          </Button>
          <Button 
            variant="outline" 
            onClick={onNavigateToCreate}
            style={{ color: "#dcdcdc", borderColor: "#444" }}
          >
            ➕ Create Quiz
          </Button>
        </Flex>
      </Flex>

      {/* User Info Card */}
      <Card style={{ padding: "20px", marginBottom: "20px" }}>
        <Flex align="center" gap="4">
          <Box style={{ 
            width: "60px", 
            height: "60px", 
            borderRadius: "50%", 
            backgroundColor: "#333", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            fontSize: "24px"
          }}>
            👤
          </Box>
          <Box style={{ flex: 1 }}>
            <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "4px" }}>
              {isZkAuthenticated ? "Google User" : "Wallet User"}
            </Heading>
            <Flex align="center" gap="2" style={{ marginBottom: "8px" }}>
              <Text size="2" style={{ color: "#888", fontFamily: "monospace", wordBreak: "break-all", flex: 1 }}>
                {currentAddress}
              </Text>
              <Button
                size="1"
                variant="outline"
                onClick={copyAddressToClipboard}
                style={{ 
                  color: copySuccess ? "#00FF00" : "#dcdcdc",
                  borderColor: copySuccess ? "#00FF00" : "#444",
                  minWidth: "60px"
                }}
              >
                {copySuccess ? "✓ Copied" : "📋 Copy"}
              </Button>
            </Flex>
            <Badge 
              color={getRankColor(stats.rank) as any} 
              style={{ marginTop: "8px" }}
            >
              {stats.rank}
            </Badge>
          </Box>
        </Flex>
      </Card>

      {/* Stats Overview */}
      <Grid columns="4" gap="4" style={{ marginBottom: "20px" }}>
        <Card style={{ padding: "16px", textAlign: "center" }}>
          <Text size="6" weight="bold" style={{ color: "#dcdcdc" }}>
            {stats.totalQuizzesPlayed}
          </Text>
          <Text size="2" style={{ color: "#888" }}>
            Quizzes Played
          </Text>
        </Card>
        <Card style={{ padding: "16px", textAlign: "center" }}>
          <Text size="6" weight="bold" style={{ color: "#dcdcdc" }}>
            {stats.totalQuizzesCreated}
          </Text>
          <Text size="2" style={{ color: "#888" }}>
            Quizzes Created
          </Text>
        </Card>
        <Card style={{ padding: "16px", textAlign: "center" }}>
          <Text size="6" weight="bold" style={{ color: "#dcdcdc" }}>
            {stats.averageScore.toFixed(1)}%
          </Text>
          <Text size="2" style={{ color: "#888" }}>
            Average Score
          </Text>
        </Card>
        <Card style={{ padding: "16px", textAlign: "center" }}>
          <Text size="6" weight="bold" style={{ color: "#dcdcdc" }}>
            {stats.badgesEarned}
          </Text>
          <Text size="2" style={{ color: "#888" }}>
            Badges Earned
          </Text>
        </Card>
      </Grid>

      {/* Tab Navigation */}
      <Flex gap="2" style={{ marginBottom: "20px" }}>
        <Button 
          variant={activeTab === 'overview' ? 'solid' : 'outline'}
          onClick={() => setActiveTab('overview')}
          style={{ 
            color: activeTab === 'overview' ? "#000" : "#dcdcdc",
            backgroundColor: activeTab === 'overview' ? "#dcdcdc" : "transparent",
            borderColor: "#444"
          }}
        >
          📊 Overview
        </Button>
        <Button 
          variant={activeTab === 'history' ? 'solid' : 'outline'}
          onClick={() => setActiveTab('history')}
          style={{ 
            color: activeTab === 'history' ? "#000" : "#dcdcdc",
            backgroundColor: activeTab === 'history' ? "#dcdcdc" : "transparent",
            borderColor: "#444"
          }}
        >
          📝 Quiz History
        </Button>
        <Button 
          variant={activeTab === 'badges' ? 'solid' : 'outline'}
          onClick={() => setActiveTab('badges')}
          style={{ 
            color: activeTab === 'badges' ? "#000" : "#dcdcdc",
            backgroundColor: activeTab === 'badges' ? "#dcdcdc" : "transparent",
            borderColor: "#444"
          }}
        >
          🏆 Badges
        </Button>
      </Flex>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <Card style={{ padding: "20px" }}>
          <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "16px" }}>
            📊 Performance Overview
          </Heading>
          <Grid columns="2" gap="4">
            <Box>
              <Text size="3" weight="bold" style={{ color: "#dcdcdc" }}>
                Total Score: {stats.totalScore}
              </Text>
              <br />
              <Text size="3" weight="bold" style={{ color: "#dcdcdc" }}>
                SUI Earned: {stats.suiEarned.toFixed(4)} SUI
              </Text>
            </Box>
            <Box>
              <Text size="3" weight="bold" style={{ color: "#dcdcdc" }}>
                Success Rate: {stats.averageScore.toFixed(1)}%
              </Text>
              <br />
              <Text size="3" weight="bold" style={{ color: "#dcdcdc" }}>
                Current Rank: {stats.rank}
              </Text>
            </Box>
          </Grid>
        </Card>
      )}

      {activeTab === 'history' && (
        <Card style={{ padding: "20px" }}>
          <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "16px" }}>
            📝 Quiz History
          </Heading>
          {quizHistory.length === 0 ? (
            <Text style={{ color: "#888" }}>No quiz history found</Text>
          ) : (
            <Box>
              {quizHistory.map((quiz, index) => (
                <Box key={quiz.id}>
                  <Flex justify="between" align="center" style={{ padding: "12px 0" }}>
                    <Box>
                      <Text size="3" weight="bold" style={{ color: "#dcdcdc" }}>
                        {quiz.title}
                      </Text>
                      <br />
                      <Text size="2" style={{ color: "#888" }}>
                        Score: {quiz.score}/{quiz.totalQuestions} • {new Date(quiz.completedAt).toLocaleDateString()}
                        {quiz.isHost && " • Host"}
                      </Text>
                    </Box>
                    <Box style={{ textAlign: "right" }}>
                      <Badge color={quiz.score >= 80 ? "green" : quiz.score >= 60 ? "yellow" : "red"}>
                        {((quiz.score / quiz.totalQuestions) * 100).toFixed(1)}%
                      </Badge>
                      {quiz.rewardEarned && (
                        <Text size="2" style={{ color: "#dcdcdc", marginTop: "4px", display: "block" }}>
                          +{quiz.rewardEarned.toFixed(4)} SUI
                        </Text>
                      )}
                    </Box>
                  </Flex>
                  {index < quizHistory.length - 1 && <Separator />}
                </Box>
              ))}
            </Box>
          )}
        </Card>
      )}

      {activeTab === 'badges' && (
        <Card style={{ padding: "20px" }}>
          <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "16px" }}>
            🏆 Badges & Achievements
          </Heading>
          {badges.length === 0 ? (
            <Text style={{ color: "#888" }}>No badges earned yet</Text>
          ) : (
            <Grid columns="3" gap="4">
              {badges.map((badge) => (
                <Card key={badge.id} style={{ padding: "16px", textAlign: "center" }}>
                  <Box style={{ 
                    width: "40px", 
                    height: "40px", 
                    borderRadius: "50%", 
                    backgroundColor: getRarityColor(badge.rarity),
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    fontSize: "20px",
                    margin: "0 auto 8px"
                  }}>
                    🏆
                  </Box>
                  <Text size="2" weight="bold" style={{ color: "#dcdcdc" }}>
                    {badge.badgeType}
                  </Text>
                  <br />
                  <Text size="1" style={{ color: "#888" }}>
                    {badge.quizTitle}
                  </Text>
                  <br />
                  <Text size="1" style={{ color: "#888" }}>
                    {new Date(badge.earnedAt).toLocaleDateString()}
                  </Text>
                </Card>
              ))}
            </Grid>
          )}
        </Card>
      )}
    </Box>
  );
}
