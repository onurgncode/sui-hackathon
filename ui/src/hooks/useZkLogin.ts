import { useState, useEffect } from 'react';
import { useConnectWallet, useCurrentAccount, useWallets, useDisconnectWallet } from '@mysten/dapp-kit';
import { isGoogleWallet, isEnokiWallet } from '@mysten/enoki';
import { disconnectGlobalSocket, resetGlobalSocket } from './useSocket';

interface ZkLoginUser {
  address: string;
  email: string;
  name: string;
  picture?: string;
  jwt: string;
}

interface UseZkLoginReturn {
  user: ZkLoginUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  getAddress: () => string | null;
}

export function useZkLogin(): UseZkLoginReturn {
  const [user, setUser] = useState<ZkLoginUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Enoki hooks
  const currentAccount = useCurrentAccount();
  const { mutate: connect } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  const wallets = useWallets();
  
  // Find Google wallet from Enoki
  const googleWallet = wallets.find(wallet => {
    const isGoogle = isGoogleWallet(wallet);
    const isEnoki = isEnokiWallet(wallet);
    const isEnokiByName = wallet.name.toLowerCase().includes('enoki') || 
                         wallet.name.toLowerCase().includes('google') ||
                         wallet.name.toLowerCase().includes('zklogin');
    console.log(`Wallet: ${wallet.name}, isGoogle: ${isGoogle}, isEnoki: ${isEnoki}, isEnokiByName: ${isEnokiByName}`);
    return isGoogle || isEnoki || isEnokiByName;
  });

  // Debug: Log available wallets
  useEffect(() => {
    console.log('Available wallets:', wallets.map(w => ({ name: w.name })));
    console.log('Google wallet found:', googleWallet?.name);
  }, [wallets, googleWallet]);

  // Check if user is already logged in via Enoki or regular wallet
  useEffect(() => {
    if (currentAccount) {
      // Check if it's an Enoki wallet
      const isEnoki = wallets.find(w => w.accounts[0]?.address === currentAccount.address && isEnokiWallet(w));
      
      if (isEnoki) {
        // User is connected via Enoki
        const zkLoginUser: ZkLoginUser = {
          address: currentAccount.address,
          email: 'user@example.com', // Enoki doesn't expose email directly
          name: 'Enoki User',
          picture: undefined,
          jwt: 'enoki-jwt-token',
        };
        
        setUser(zkLoginUser);
        setIsAuthenticated(true);
        localStorage.setItem('zklogin_user', JSON.stringify(zkLoginUser));
      } else {
        // User is connected via regular wallet
        const walletUser: ZkLoginUser = {
          address: currentAccount.address,
          email: 'wallet@example.com',
          name: 'Wallet User',
          picture: undefined,
          jwt: 'wallet-token',
        };
        
        setUser(walletUser);
        setIsAuthenticated(true);
        localStorage.setItem('zklogin_user', JSON.stringify(walletUser));
        
        // Reset WebSocket for new user session
        resetGlobalSocket();
      }
    } else {
      // Clear any saved user data if not connected
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('zklogin_user');
    }
  }, [currentAccount, wallets]);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      // Try to find any Enoki wallet if Google wallet not found
      let targetWallet = googleWallet;
      
      if (!targetWallet) {
        // Look for any Enoki wallet
        targetWallet = wallets.find(wallet => 
          wallet.name.toLowerCase().includes('enoki') || 
          wallet.name.toLowerCase().includes('google') ||
          isEnokiWallet(wallet)
        );
      }
      
      if (!targetWallet) {
        throw new Error('No Enoki wallet found. Available wallets: ' + wallets.map(w => w.name).join(', '));
      }

      console.log('Using wallet:', targetWallet.name);
      
      // Use Enoki wallet with proper OAuth flow
      await connect({ 
        wallet: targetWallet,
        // Force OAuth popup
        options: {
          force: true
        }
      });
      console.log('Enoki login successful');
      
      // Reset WebSocket for new user session
      resetGlobalSocket();
      
      // Wait a moment for the account to be updated
      setTimeout(() => {
        if (currentAccount) {
          const zkLoginUser: ZkLoginUser = {
            address: currentAccount.address,
            email: 'user@example.com', // Enoki doesn't expose email directly
            name: 'Google User',
            picture: undefined,
            jwt: 'enoki-jwt-token',
          };
          
          setUser(zkLoginUser);
          setIsAuthenticated(true);
          localStorage.setItem('zklogin_user', JSON.stringify(zkLoginUser));
          
          console.log('Real Enoki Google OAuth successful:', zkLoginUser);
          alert('Login successful! Welcome to SuiQuiz!');
        }
      }, 1000);
    } catch (error) {
      console.error('Enoki login error:', error);
      alert('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const logout = () => {
    console.log('Logging out user...');
    
    // Disconnect from all wallets first
    if (currentAccount) {
      console.log('Disconnecting from wallet...');
      disconnect();
    }
    
    // Disconnect WebSocket connection
    console.log('Disconnecting WebSocket...');
    disconnectGlobalSocket();
    
    // Clear user state
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('zklogin_user');
    
    console.log('Logout completed, isAuthenticated:', false);
  };


  const getAddress = () => {
    return user?.address || null;
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    loginWithGoogle,
    logout,
    getAddress,
  };
}


