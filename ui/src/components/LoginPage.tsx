import { useState } from "react";
import { Box, Button, Flex, Heading, Text, Card } from "@radix-ui/themes";
import { ConnectButton } from "@mysten/dapp-kit";
import { isEnokiWallet } from "@mysten/enoki";
import { useZkLogin } from "../hooks/useZkLogin";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithGoogle } = useZkLogin();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
      // Login success will be handled by the parent component's authentication state
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Box style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      backgroundColor: "#2a2a2a",
      padding: "20px"
    }}>
      <Card style={{ 
        backgroundColor: "#4b4b4b", 
        border: "2px solid #e37a1c", 
        padding: "60px 40px",
        textAlign: "center",
        maxWidth: "500px",
        width: "100%"
      }}>
        {/* Logo */}
        <Box style={{ marginBottom: "40px" }}>
          <img 
            src="/src/assets/Logo.png" 
            alt="SuiQuiz Logo" 
            style={{ 
              maxWidth: "120px", 
              height: "auto",
              marginBottom: "20px"
            }}
            onError={(e) => {
              // Fallback if logo not found
              e.currentTarget.style.display = 'none';
            }}
          />
          <Heading size="6" style={{ color: "#dcdcdc", marginBottom: "8px" }}>
            SuiQuiz
          </Heading>
          <Text size="3" style={{ color: "#dcdcdc", opacity: 0.8 }}>
            Decentralized Learning & Entertainment Platform
          </Text>
        </Box>

        {/* Login Options */}
        <Flex direction="column" gap="4" style={{ marginBottom: "30px" }}>
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? "#666" : "#e37a1c",
              color: "#4b4b4b",
              border: "none",
              cursor: isLoading ? "not-allowed" : "pointer",
              padding: "16px 32px",
              fontSize: "18px",
              fontWeight: "600",
              borderRadius: "12px",
              width: "100%",
              height: "56px",
            }}
          >
            {isLoading ? "Connecting..." : "Login with Google"}
          </Button>

          {/* Divider */}
          <Box style={{ textAlign: "center", margin: "16px 0" }}>
            <Text size="2" style={{ color: "#dcdcdc", opacity: 0.5 }}>
              OR
            </Text>
          </Box>

          {/* Sui Wallet Connection */}
          <Box style={{ width: "100%" }}>
            <ConnectButton 
              walletFilter={(wallet) => !isEnokiWallet(wallet)}
              style={{
                width: "100%",
                height: "56px",
                fontSize: "18px",
                fontWeight: "600",
                borderRadius: "12px",
                backgroundColor: "transparent",
                border: "2px solid #e37a1c",
                color: "#dcdcdc",
              }}
            />
          </Box>
        </Flex>

        {/* Features */}
        <Box style={{ marginTop: "40px", padding: "20px", backgroundColor: "#4b4b4b", borderRadius: "8px" }}>
          <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7, lineHeight: "1.6" }}>
            <Text style={{ color: "#e37a1c", fontWeight: "600" }}>Google Login:</Text> Full access to all features, NFT certificates, and achievements
          </Text>
          <br />
          <Text size="2" style={{ color: "#dcdcdc", opacity: 0.7, lineHeight: "1.6" }}>
            <Text style={{ color: "#e37a1c", fontWeight: "600" }}>Sui Wallet:</Text> Connect your Sui wallet (Suiet, Sui Wallet, etc.) for blockchain features
          </Text>
        </Box>
      </Card>
    </Box>
  );
}
