// Environment configuration for SuiQuiz Platform

export const config = {
  // Google OAuth Configuration
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '20125149505-k6stooabdj31t2lsibg5jq645ge90vbl.apps.googleusercontent.com',
    redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || window.location.origin,
  },

  // Sui Network Configuration
  sui: {
    network: import.meta.env.VITE_SUI_NETWORK || 'testnet',
    rpcUrl: import.meta.env.VITE_SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
  },

  // Backend API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
    wsUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3001',
  },

  // Note: Sensitive API keys (Enoki, Walrus) are handled by backend
  // Frontend only needs public configuration
};

// Development mode check
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
