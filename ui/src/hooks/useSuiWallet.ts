import { useState, useEffect } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { config } from '../config/environment';
import { resetGlobalSocket } from './useSocket';

interface SuiWallet {
  address: string;
  publicKey: string;
  keypair: Ed25519Keypair;
}

interface UseSuiWalletReturn {
  wallet: SuiWallet | null;
  isConnected: boolean;
  isLoading: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  getBalance: () => Promise<string>;
  signTransaction: (transaction: any) => Promise<string>;
}

export function useSuiWallet(): UseSuiWalletReturn {
  const [wallet, setWallet] = useState<SuiWallet | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Sui client
  const suiClient = new SuiClient({ url: config.sui.rpcUrl });

  // Check if wallet is already connected
  useEffect(() => {
    const savedWallet = localStorage.getItem('sui_wallet');
    if (savedWallet) {
      try {
        const parsedWallet = JSON.parse(savedWallet);
        // Recreate keypair from saved data
        const keypair = Ed25519Keypair.fromSecretKey(
          new Uint8Array(parsedWallet.secretKey)
        );
        
        setWallet({
          address: parsedWallet.address,
          publicKey: parsedWallet.publicKey,
          keypair,
        });
        setIsConnected(true);
      } catch (error) {
        console.error('Error loading saved wallet:', error);
        localStorage.removeItem('sui_wallet');
      }
    }
  }, []);

  const connectWallet = async () => {
    setIsLoading(true);
    try {
      // Generate new keypair
      const keypair = new Ed25519Keypair();
      const address = keypair.getPublicKey().toSuiAddress();
      const publicKey = keypair.getPublicKey().toBase64();

      const newWallet: SuiWallet = {
        address,
        publicKey,
        keypair,
      };

      // Save wallet to state and localStorage
      setWallet(newWallet);
      setIsConnected(true);
      
      // Save to localStorage (only save necessary data)
      localStorage.setItem('sui_wallet', JSON.stringify({
        address,
        publicKey,
        secretKey: Array.from(keypair.getSecretKey()),
      }));

      console.log('Sui wallet connected:', { address, publicKey });
      
      // Reset WebSocket for new user session
      resetGlobalSocket();
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    setIsConnected(false);
    localStorage.removeItem('sui_wallet');
    
    // Reset WebSocket for logout
    resetGlobalSocket();
    
    console.log('Sui wallet disconnected');
  };

  const getBalance = async (): Promise<string> => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      const balance = await suiClient.getBalance({
        owner: wallet.address,
      });
      
      return balance.totalBalance;
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  };

  const signTransaction = async (transaction: any): Promise<string> => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      // Sign transaction with wallet keypair
      const signature = await wallet.keypair.signTransaction(transaction);
      return signature;
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw error;
    }
  };

  return {
    wallet,
    isConnected,
    isLoading,
    connectWallet,
    disconnectWallet,
    getBalance,
    signTransaction,
  };
}
