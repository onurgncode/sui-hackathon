import { Box, Container, Flex, Heading, Separator } from "@radix-ui/themes";
import { useState } from "react";
import { CreateQuiz } from "./components/CreateQuiz";
import { QuizLobby } from "./components/QuizLobby";
import { OwnedBadges } from "./components/OwnedBadges";
import { QuizGame } from "./components/QuizGame";
import { LoginPage } from "./components/LoginPage";
import { ProfilePage } from "./components/ProfilePage";
import { useZkLogin } from "./hooks/useZkLogin";
import Logo from "./assets/Logo.png";

function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentView, setCurrentView] = useState<'lobby' | 'create' | 'badges' | 'profile' | 'game'>('lobby');
  const [gameRoomCode, setGameRoomCode] = useState<string>('');
  const [gameIsHost, setGameIsHost] = useState<boolean>(false);
  const { user, isAuthenticated, isLoading, logout } = useZkLogin();

  // Handle logout
  const handleLogout = () => {
    logout();
    setCurrentView('lobby');
  };
  
  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  return (
    <>
      {/* Header */}
      <Flex
        position="sticky"
        px="4"
        py="3"
        justify="between"
        align="center"
        style={{
          borderBottom: "2px solid #e37a1c",
          background: "#4b4b4b",
          zIndex: 10,
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <Box>
                 <Flex align="center" gap="3">
                   <img 
                     src={Logo} 
                     alt="SuiQuiz Logo" 
                     style={{ 
                       height: "40px", 
                       width: "40px",
                       borderRadius: "8px"
                     }} 
                   />
                   <Heading size="6" style={{ color: "#dcdcdc" }}>
                     SuiQuiz Platform
                   </Heading>
                 </Flex>
               </Box>

        <Flex gap="2" align="center" style={{ flexWrap: "wrap" }}>
          <Box>
            <button
              onClick={() => setCurrentView('lobby')}
              style={{
                padding: "6px 12px",
                backgroundColor: currentView === 'lobby' ? "#e37a1c" : "transparent",
                color: "#dcdcdc",
                border: "1px solid #e37a1c",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                minWidth: "80px",
              }}
            >
              Lobby
            </button>
          </Box>
          <Box>
            <button
              onClick={() => setCurrentView('create')}
              style={{
                padding: "6px 12px",
                backgroundColor: currentView === 'create' ? "#e37a1c" : "transparent",
                color: "#dcdcdc",
                border: "1px solid #e37a1c",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                minWidth: "80px",
              }}
            >
              Create
            </button>
          </Box>
          <Box>
            <button
              onClick={() => setCurrentView('badges')}
              style={{
                padding: "6px 12px",
                backgroundColor: currentView === 'badges' ? "#e37a1c" : "transparent",
                color: "#dcdcdc",
                border: "1px solid #e37a1c",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                minWidth: "80px",
              }}
            >
              Badges
            </button>
          </Box>
          <Box>
            <button
              onClick={() => setCurrentView('profile')}
              style={{
                padding: "6px 12px",
                backgroundColor: currentView === 'profile' ? "#e37a1c" : "transparent",
                color: "#dcdcdc",
                border: "1px solid #e37a1c",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                minWidth: "80px",
              }}
            >
              Profile
            </button>
        </Box>

          {/* Authentication & Wallet */}
          <Flex align="center" gap="2" style={{ flexWrap: "wrap" }}>
            {/* zkLogin Authentication */}
            {isAuthenticated && (
              <Flex align="center" gap="2" style={{ flexWrap: "wrap" }}>
                <Box
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "#e37a1c",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#4b4b4b",
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </Box>
        <Box>
                  <div style={{ fontSize: "12px", color: "#dcdcdc", fontWeight: "600" }}>
                    {user?.name}
                  </div>
                  <div style={{ fontSize: "10px", color: "#dcdcdc", opacity: 0.7 }}>
                    {user?.address?.slice(0, 8)}...
                  </div>
        </Box>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "transparent",
                    color: "#dcdcdc",
                    border: "1px solid #dcdcdc",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Logout
                </button>
              </Flex>
            )}
          </Flex>
        </Flex>
      </Flex>

      {/* Main Content */}
      <Container size="4" style={{ 
        padding: "16px", 
        backgroundColor: "#4b4b4b", 
        minHeight: "100vh",
        maxWidth: "100%",
      }}>
        <Flex direction="column" gap="8">

          {/* Dynamic Content Based on Current View */}
          {currentView === 'lobby' && (
          <Box>
              <QuizLobby 
              refreshKey={refreshKey}
              setRefreshKey={setRefreshKey}
                onNavigateToGame={(roomCode?: string, isHost?: boolean) => {
                  setGameRoomCode(roomCode || '');
                  setGameIsHost(isHost || false);
                  setCurrentView('game');
                }}
            />
          </Box>
          )}

          {currentView === 'create' && (
          <Box>
              <CreateQuiz 
              refreshKey={refreshKey}
              setRefreshKey={setRefreshKey}
                onNavigateToLobby={() => setCurrentView('lobby')}
            />
          </Box>
          )}

          {currentView === 'badges' && (
          <Box>
              <OwnedBadges refreshKey={refreshKey} setRefreshKey={setRefreshKey} />
          </Box>
          )}

          {currentView === 'profile' && (
          <Box>
              <ProfilePage 
                onNavigateToLobby={() => setCurrentView('lobby')}
                onNavigateToCreate={() => setCurrentView('create')}
                onNavigateToBadges={() => setCurrentView('badges')}
              />
          </Box>
          )}

          {currentView === 'game' && (
          <Box>
              <QuizGame 
                refreshKey={refreshKey} 
                setRefreshKey={setRefreshKey}
                roomCode={gameRoomCode}
                isHost={gameIsHost}
                onNavigateToLobby={() => setCurrentView('lobby')}
              />
          </Box>
          )}
        </Flex>
      </Container>
    </>
  );
}

export default App;
