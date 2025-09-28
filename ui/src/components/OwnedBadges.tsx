import { useState, useEffect } from "react";
import { Box, Button, Flex, Heading, Text, Card } from "@radix-ui/themes";
import { useZkLogin } from "../hooks/useZkLogin";
import { config } from "../config/environment";

interface Badge {
  id: string;
  badgeType: string;
  quizTitle: string;
  score: number;
  totalPossible: number;
  earnedAt: number;
  isSealed: boolean;
  sealedBy?: string;
  sealedAt?: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  color: string;
}

interface OwnedBadgesProps {
  refreshKey: number;
  setRefreshKey: (key: number) => void;
}

export function OwnedBadges({ refreshKey, setRefreshKey }: OwnedBadgesProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getAddress } = useZkLogin();

  // Fetch badges from API
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        setIsLoading(true);
        
        // Get current user address from wallet
        const userAddress = getAddress();
        console.log('🔍 getAddress() result:', userAddress);
        
        if (!userAddress) {
          console.warn('❌ No user address found - user might not be logged in');
          setBadges([]);
          setIsLoading(false);
          return;
        }
        
        console.log('✅ Fetching badges for address:', userAddress);
        
        const response = await fetch(`${config.api.baseUrl}/api/badges/${userAddress}`);
        console.log('Badge fetch response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Badge fetch response data:', data);
          setBadges(data.badges || []);
        } else {
          console.error('Failed to fetch badges:', response.statusText);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          setBadges([]);
        }
      } catch (error) {
        console.error('Error fetching badges:', error);
        setBadges([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBadges();
  }, [refreshKey]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return '#6B7280';
      case 'uncommon': return '#10B981';
      case 'rare': return '#3B82F6';
      case 'epic': return '#8B5CF6';
      case 'legendary': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'common': return '🥉';
      case 'uncommon': return '🥈';
      case 'rare': return '🥇';
      case 'epic': return '💎';
      case 'legendary': return '👑';
      default: return '🏆';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getScorePercentage = (score: number, total: number) => {
    return Math.round((score / total) * 100);
  };

  const handleSealBadge = async (badgeId: string) => {
    try {
      // Get current user address
      const userAddress = getAddress();
      if (!userAddress) {
        alert('Please connect your wallet first');
        return;
      }

      console.log('Sealing badge:', { badgeId, userAddress });

      const response = await fetch(`${config.api.baseUrl}/api/seal-badge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          badgeId,
          sealerAddress: userAddress,
          sealerName: 'Official Sealer'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Badge sealed successfully:', result);
        
        // Update the badge in local state
        setBadges(prevBadges => 
          prevBadges.map(badge => 
            badge.id === badgeId 
              ? { 
                  ...badge, 
                  isSealed: true, 
                  sealedAt: result.sealedAt,
                  sealedBy: result.sealedBy 
                }
              : badge
          )
        );
        
        alert('Badge sealed successfully! 🎉');
      } else {
        throw new Error('Failed to seal badge');
      }
    } catch (error) {
      console.error('Error sealing badge:', error);
      alert('Failed to seal badge. Please try again.');
    }
  };

  const handleShareBadge = (badge: Badge) => {
    const shareText = `🏆 I earned a ${badge.badgeType} badge in ${badge.quizTitle}! Score: ${badge.score}/${badge.totalPossible} (${getScorePercentage(badge.score, badge.totalPossible)}%)`;
    
    if (navigator.share) {
      navigator.share({
        title: 'My SuiQuiz Badge',
        text: shareText,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert('Badge info copied to clipboard!');
    }
  };

  return (
    <Box>
      <Heading size="5" style={{ color: "#dcdcdc", marginBottom: "20px" }}>
        🏆 Your Badges & Certificates
      </Heading>

      {isLoading ? (
        <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "40px", textAlign: "center" }}>
          <Text size="3" style={{ color: "#dcdcdc" }}>
            Loading your badges...
          </Text>
        </Card>
      ) : badges.length === 0 ? (
        <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "40px", textAlign: "center" }}>
          <Text size="3" style={{ color: "#dcdcdc", marginBottom: "16px", display: "block" }}>
            You haven't earned any badges yet!
          </Text>
          <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
            Complete some quizzes to start collecting badges and certificates.
          </Text>
        </Card>
      ) : (
        <Flex direction="column" gap="4">
          {badges.map((badge) => (
            <Card
              key={badge.id}
              style={{
                backgroundColor: "#4b4b4b",
                border: `2px solid ${badge.isSealed ? "#e37a1c" : getRarityColor(badge.rarity)}`,
                padding: "20px",
                position: "relative",
              }}
            >
              {/* Badge Header */}
              <Flex justify="between" align="center" style={{ marginBottom: "16px" }}>
                <Flex align="center" gap="3">
                  <Box
                    style={{
                      backgroundColor: getRarityColor(badge.rarity),
                      borderRadius: "50%",
                      width: "40px",
                      height: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                    }}
                  >
                    {getRarityIcon(badge.rarity)}
                  </Box>
                  <Box>
                    <Text size="4" style={{ color: "#dcdcdc", fontWeight: "600" }}>
                      {badge.badgeType}
                    </Text>
                    <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7, textTransform: "capitalize" }}>
                      {badge.rarity} • {badge.quizTitle}
                    </Text>
                  </Box>
                </Flex>

                {badge.isSealed && (
                  <Box
                    style={{
                      backgroundColor: "#e37a1c",
                      color: "#4b4b4b",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    🔒 SEALED
                  </Box>
                )}
              </Flex>

              {/* Badge Details */}
              <Flex direction="column" gap="3">
                <Flex justify="between" align="center">
                  <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                    Score
                  </Text>
                  <Text size="3" style={{ color: "#dcdcdc", fontWeight: "600" }}>
                    {badge.score}/{badge.totalPossible} ({getScorePercentage(badge.score, badge.totalPossible)}%)
                  </Text>
                </Flex>

                <Flex justify="between" align="center">
                  <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                    Earned
                  </Text>
                  <Text size="2" style={{ color: "#dcdcdc" }}>
                    {formatDate(badge.earnedAt)}
                  </Text>
                </Flex>

                {badge.isSealed && badge.sealedAt && (
                  <Flex justify="between" align="center">
                    <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                      Sealed
                    </Text>
                    <Text size="2" style={{ color: "#e37a1c" }}>
                      {formatDate(badge.sealedAt)}
                    </Text>
                  </Flex>
                )}
              </Flex>

              {/* Progress Bar */}
              <Box style={{ marginTop: "16px" }}>
                <Box
                  style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: "#666",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      width: `${getScorePercentage(badge.score, badge.totalPossible)}%`,
                      height: "100%",
                      backgroundColor: badge.isSealed ? "#e37a1c" : getRarityColor(badge.rarity),
                      transition: "width 0.3s ease",
                    }}
                  />
                </Box>
              </Box>

              {/* Badge Actions */}
              {!badge.isSealed && (
                <Flex gap="2" style={{ marginTop: "16px" }}>
                  <Button
                    onClick={() => handleSealBadge(badge.id)}
                    style={{
                      backgroundColor: "transparent",
                      color: "#e37a1c",
                      border: "1px solid #e37a1c",
                      cursor: "pointer",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: "500",
                      borderRadius: "4px",
                    }}
                  >
                    🔒 Request Seal
                  </Button>
                  <Button
                    onClick={() => handleShareBadge(badge)}
                    style={{
                      backgroundColor: "transparent",
                      color: "#dcdcdc",
                      border: "1px solid #dcdcdc",
                      cursor: "pointer",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: "500",
                      borderRadius: "4px",
                    }}
                  >
                    📤 Share
                  </Button>
                </Flex>
              )}

              {/* Sealed Badge Actions */}
              {badge.isSealed && (
                <Flex gap="2" style={{ marginTop: "16px" }}>
                  <Button
                    onClick={() => handleShareBadge(badge)}
                    style={{
                      backgroundColor: "transparent",
                      color: "#e37a1c",
                      border: "1px solid #e37a1c",
                      cursor: "pointer",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: "500",
                      borderRadius: "4px",
                    }}
                  >
                    📤 Share Certificate
                  </Button>
                  <Button
                    style={{
                      backgroundColor: "transparent",
                      color: "#dcdcdc",
                      border: "1px solid #dcdcdc",
                      cursor: "pointer",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: "500",
                      borderRadius: "4px",
                    }}
                  >
                    📄 View Certificate
                  </Button>
                </Flex>
              )}
            </Card>
          ))}

          {/* Badge Statistics */}
          <Card style={{ backgroundColor: "#4b4b4b", border: "1px solid #e37a1c", padding: "20px" }}>
            <Heading size="4" style={{ color: "#dcdcdc", marginBottom: "16px" }}>
              📊 Badge Statistics
            </Heading>
            
            <Flex direction="column" gap="3">
              <Flex justify="between" align="center">
                <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                  Total Badges
                </Text>
                <Text size="3" style={{ color: "#dcdcdc", fontWeight: "600" }}>
                  {badges.length}
                </Text>
              </Flex>

              <Flex justify="between" align="center">
                <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                  Sealed Certificates
                </Text>
                <Text size="3" style={{ color: "#e37a1c", fontWeight: "600" }}>
                  {badges.filter(b => b.isSealed).length}
                </Text>
              </Flex>

              <Flex justify="between" align="center">
                <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7 }}>
                  Average Score
                </Text>
                <Text size="3" style={{ color: "#dcdcdc", fontWeight: "600" }}>
                  {Math.round(badges.reduce((acc, badge) => acc + getScorePercentage(badge.score, badge.totalPossible), 0) / badges.length)}%
                </Text>
              </Flex>
            </Flex>
          </Card>
        </Flex>
      )}
    </Box>
  );
}
