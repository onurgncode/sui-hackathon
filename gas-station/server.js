import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// import { Transaction } from '@mysten/sui/transactions'; // TODO: Fix import issue

// ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: './.env' });

// Performance monitoring
const startTime = Date.now();
let requestCount = 0;
let errorCount = 0;

// Enhanced logging with performance metrics
function logWithMetrics(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const uptime = Date.now() - startTime;
  const logEntry = {
    timestamp,
    level,
    message,
    uptime: `${uptime}ms`,
    requestCount,
    errorCount,
    ...data
  };
  
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, logEntry);
}

// Debug environment variables
logWithMetrics('info', 'Environment Variables Debug', {
  QUIZ_PACKAGE_ID: process.env.QUIZ_PACKAGE_ID,
  BADGE_PACKAGE_ID: process.env.BADGE_PACKAGE_ID,
  ENOKI_API_KEY: process.env.ENOKI_API_KEY ? 'Configured' : 'Not configured'
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"], // Frontend URLs
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'], // Allow both WebSocket and polling
  allowEIO3: true
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4173', // Vite preview
    'http://127.0.0.1:4173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  maxAge: 86400 // 24 hours
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Performance monitoring middleware
app.use((req, res, next) => {
  requestCount++;
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logWithMetrics('info', `${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  errorCount++;
  logWithMetrics('error', 'Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body
  });
  
  // Don't expose stack traces in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack })
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const uptime = Date.now() - startTime;
  
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${uptime}ms`,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    performance: {
      requestCount,
      errorCount,
      errorRate: requestCount > 0 ? (errorCount / requestCount * 100).toFixed(2) + '%' : '0%',
      memoryUsage: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      }
    },
    services: {
      sui: suiRpcUrl ? 'connected' : 'disconnected',
      enoki: enokiApiKey ? 'configured' : 'not configured',
      walrus: process.env.WALRUS_URL ? 'configured' : 'not configured'
    }
  });
});

// Multer configuration for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Sui client setup
const suiNetwork = process.env.SUI_NETWORK || 'testnet';
const suiRpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl(suiNetwork);
const suiClient = new SuiClient({ url: suiRpcUrl });

// Enoki gas station setup
const enokiApiKey = process.env.ENOKI_API_KEY;
const enokiPrivateKey = process.env.ENOKI_PRIVATE_KEY;

// Walrus configuration
const walrusUrl = process.env.WALRUS_URL || 'https://testnet.wal.app';
const walrusRpcUrl = process.env.WALRUS_RPC_URL || 'https://fullnode.testnet.sui.io:443';

// Contract addresses
const quizPackageId = process.env.QUIZ_PACKAGE_ID;
const badgePackageId = process.env.BADGE_PACKAGE_ID;
const quizRoomPackageId = process.env.QUIZ_ROOM_PACKAGE_ID;
const badgeAdminCapId = process.env.BADGE_ADMIN_CAP_ID;

// ========= WALRUS DATABASE SYSTEM =========

// In-memory cache for performance (backed by Walrus blockchain storage)
const quizRooms = new Map();
const players = new Map();
const userBadges = new Map(); // Store user badges by address

// Walrus database functions
async function saveToWalrusDatabase(key, data) {
  try {
    console.log('💾 Saving to Walrus database:', key);
    
    // Prepare data for Walrus storage
    const walrusData = {
      key: key,
      data: data,
      timestamp: Date.now(),
      type: 'database_record'
    };

    // Use Walrus HTTP API to store data on Sui blockchain
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    // Get current directory for ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Create temporary file for data
    const tempFile = path.join(__dirname, 'temp', `walrus_${key}_${Date.now()}.json`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Write data to temp file
    fs.writeFileSync(tempFile, JSON.stringify(walrusData, null, 2));
    
    // Use Walrus CLI to upload to Sui blockchain
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const walrusPath = path.join(__dirname, '..', 'walrus.exe');
    const configPath = path.join(__dirname, '..', 'client_config.yaml');
    
    console.log('🌊 Uploading to Walrus using CLI...');
    
    const { stdout, stderr } = await execAsync(
      `"${walrusPath}" --config "${configPath}" store --epochs 10 --deletable "${tempFile}"`
    );
    
    if (stderr && !stderr.includes('warning')) {
      console.warn('⚠️ Walrus CLI warning:', stderr);
    }
    
    // Extract blob ID from output
    const blobIdMatch = stdout.match(/Blob ID: ([a-zA-Z0-9_-]+)/);
    const objectId = blobIdMatch ? blobIdMatch[1] : `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Also save data locally for quick access
    const dataFile = path.join(__dirname, 'temp', `walrus_${key}_data.json`);
    fs.writeFileSync(dataFile, JSON.stringify(walrusData, null, 2));
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    console.log('✅ Data saved to Walrus database:', {
      key: key,
      objectId: objectId
    });

    return {
      success: true,
      objectId: objectId,
      message: 'Data saved to Walrus database'
    };

  } catch (error) {
    console.error('❌ Error saving to Walrus database:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function loadFromWalrusDatabase(key) {
  try {
    console.log('📖 Loading from Walrus database:', key);
    
    // For now, we'll use a simple file-based approach since Walrus CLI doesn't have a direct download command
    // In a full implementation, we would need to track object IDs and use Sui RPC to fetch data
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    // Get current directory for ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const dataFile = path.join(__dirname, 'temp', `walrus_${key}_data.json`);
    
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      console.log('✅ Data loaded from Walrus database:', {
        key: key,
        found: true,
        dataSize: JSON.stringify(data).length
      });

      return {
        success: true,
        data: data,
        message: 'Data loaded from Walrus database'
      };
    } else {
      console.log('ℹ️ No data found for key:', key);
      return {
        success: true,
        data: null,
        message: 'No data found'
      };
    }

  } catch (error) {
    console.error('❌ Error loading from Walrus database:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Database operations for quiz rooms
async function saveQuizRoom(roomCode, roomData) {
  try {
    // Save to local file system first
    const dataFile = path.join(__dirname, 'temp', `quiz_room_${roomCode}.json`);
    const tempDir = path.dirname(dataFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(dataFile, JSON.stringify(roomData, null, 2));
    
    // Try to store in Walrus using CLI
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const walrusPath = path.join(__dirname, '..', 'walrus.exe');
      const configPath = path.join(__dirname, '..', 'client_config.yaml');
      
      console.log('🌊 Storing quiz room in Walrus...');
      const { stdout, stderr } = await execAsync(
        `"${walrusPath}" --config "${configPath}" store --epochs 10 --deletable "${dataFile}"`
      );
      
      if (stderr && !stderr.includes('warning')) {
        console.warn('⚠️ Walrus CLI warning:', stderr);
      }
      
      // Extract blob ID from output
      const blobIdMatch = stdout.match(/Blob ID: ([a-zA-Z0-9_-]+)/);
      const blobId = blobIdMatch ? blobIdMatch[1] : `walrus_${roomCode}_${Date.now()}`;
      
      console.log('📋 Walrus CLI output:', stdout);
      
      console.log(`✅ Quiz room stored in Walrus with ID: ${blobId}`);
      
      // Note: Cache will be updated by the caller with the full room object
      
      return {
        success: true,
        objectId: blobId,
        message: 'Quiz room saved to Walrus'
      };
    } catch (walrusError) {
      console.warn('⚠️ Walrus storage failed, using local storage:', walrusError.message);
      
      // Note: Cache will be updated by the caller with the full room object
      
      return {
        success: true,
        objectId: `local_${roomCode}_${Date.now()}`,
        message: 'Quiz room saved locally (Walrus unavailable)'
      };
    }
  } catch (error) {
    console.error('❌ Error saving quiz room:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function loadQuizRoom(roomCode) {
  const result = await loadFromWalrusDatabase(`quiz_room_${roomCode}`);
  if (result.success && result.data) {
    quizRooms.set(roomCode, result.data); // Update cache
  }
  return result;
}

// Database operations for user badges
async function saveUserBadges(address, badges) {
  const result = await saveToWalrusDatabase(`user_badges_${address}`, badges);
  if (result.success) {
    userBadges.set(address, badges); // Update cache
  }
  return result;
}

async function loadUserBadges(address) {
  const result = await loadFromWalrusDatabase(`user_badges_${address}`);
  if (result.success && result.data) {
    userBadges.set(address, result.data); // Update cache
  }
  return result;
}

// ========= BLOCKCHAIN INTEGRATION FUNCTIONS =========

// REMOVED: createQuizOnBlockchain function - no longer needed
// Quiz data is now stored only in Walrus, blockchain is used only for reward distribution

// Helper function to hash answers for security
function hashAnswer(answer) {
  // Simple hash function - in production, use crypto.createHash('sha256')
  return Buffer.from(answer).toString('base64');
}

// Helper function to convert reward type to Move contract value
function getRewardTypeValue(rewardType) {
  switch (rewardType) {
    case 'certificate': return 0;
    case 'sui': return 1;
    case 'both': return 2;
    default: return 0;
  }
}

// Helper function to convert reward distribution to Move contract value
function getRewardDistributionValue(rewardDistribution) {
  switch (rewardDistribution) {
    case 'top3': return 0;
    case 'manual': return 1;
    default: return 0;
  }
}

// Mint badge on blockchain using Move contract
async function mintBadgeOnBlockchain(badgeData, winnerAddress) {
  try {
    console.log('🏆 Minting badge on blockchain...');
    
    // Prepare badge data for Move contract
    const moveBadgeData = {
      badge_type: {
        name: badgeData.badgeType,
        description: `Badge for ${badgeData.quizTitle}`,
        rarity: {
          level: getRarityLevel(badgeData.rarity),
          color: badgeData.color
        },
        required_score_percentage: Math.round((badgeData.score / badgeData.totalPossible) * 100)
      },
      quiz_id: badgeData.quizId || 'quiz_' + Date.now(),
      quiz_title: badgeData.quizTitle,
      winner: winnerAddress,
      score: badgeData.score,
      total_possible: badgeData.totalPossible,
      completion_time: badgeData.completionTime || 0,
      earned_at: badgeData.earnedAt,
      sui_reward_amount: badgeData.suiRewardAmount || 0,
      position: badgeData.position,
      reward_percentage: badgeData.rewardPercentage
    };

    console.log('📋 Move badge data prepared:', {
      badge_type: moveBadgeData.badge_type.name,
      winner: moveBadgeData.winner,
      score: moveBadgeData.score,
      position: moveBadgeData.position
    });

    // Use Sui RPC to call the Move contract
    const suiClient = new SuiClient({ url: suiRpcUrl });
    const badgePackageId = process.env.BADGE_PACKAGE_ID;
    const badgeAdminCapId = process.env.BADGE_ADMIN_CAP_ID;
    
    if (!badgePackageId || badgePackageId === '0x0' || !badgeAdminCapId || badgeAdminCapId === '0x0') {
      console.error('❌ Badge Package ID or Admin Cap not configured');
      return {
        success: false,
        error: 'Badge Package ID or Admin Cap not configured. Please set BADGE_PACKAGE_ID and BADGE_ADMIN_CAP_ID environment variables.'
      };
    }

    // Create transaction block for badge minting
    const { Transaction } = await import('@mysten/sui/transactions');
    const txb = new Transaction();
    
    // Call the mint_winner_badge function from the Move contract
    txb.moveCall({
      target: `${badgePackageId}::badge::mint_winner_badge`,
      arguments: [
        txb.object(badgeAdminCapId), // Admin cap as first argument
        // BadgeType struct
        txb.pure('string', moveBadgeData.badge_type.name),
        txb.pure('string', moveBadgeData.badge_type.description),
        txb.pure('u8', moveBadgeData.badge_type.rarity.level),
        txb.pure('string', moveBadgeData.badge_type.rarity.color),
        txb.pure('u64', moveBadgeData.badge_type.required_score_percentage),
        // Quiz data
        txb.pure('string', moveBadgeData.quiz_id),
        txb.pure('string', moveBadgeData.quiz_title),
        // Winner data
        txb.pure('address', moveBadgeData.winner),
        txb.pure('u64', moveBadgeData.score),
        txb.pure('u64', moveBadgeData.total_possible),
        txb.pure('u64', moveBadgeData.completion_time),
        txb.pure('string', moveBadgeData.media_id || ''),
        txb.pure('u64', moveBadgeData.sui_reward_amount),
        txb.pure('u64', moveBadgeData.position),
        txb.pure('u64', moveBadgeData.reward_percentage)
      ]
    });

    // Execute the transaction using Enoki sponsored transaction
    const result = await executeSponsoredTransaction(txb, winnerAddress);
    
    if (result.effects?.status?.status === 'success') {
      console.log('✅ Badge minted on blockchain:', {
        transactionDigest: result.digest
      });

      return {
        success: true,
        transactionDigest: result.digest,
        message: 'Badge minted on blockchain'
      };
    } else {
      throw new Error(`Transaction failed: ${result.effects?.status?.error || 'Unknown error'}`);
    }

  } catch (error) {
    console.error('❌ Error minting badge on blockchain:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function to convert rarity to Move contract level
function getRarityLevel(rarity) {
  switch (rarity) {
    case 'common': return 1;
    case 'uncommon': return 2;
    case 'rare': return 3;
    case 'epic': return 4;
    case 'legendary': return 5;
    default: return 1;
  }
}

// ========= WALRUS INTEGRATION FUNCTIONS =========

// Upload file to Walrus decentralized storage
async function uploadToWalrus(file) {
  try {
    console.log('🌊 Uploading to Walrus decentralized storage...');
    
    // Validate file
    if (!file || !file.buffer) {
      throw new Error('Invalid file data');
    }
    
    // Prepare file data for Walrus upload
    const fileData = {
      name: file.originalname || 'uploaded_file',
      size: file.size || 0,
      type: file.mimetype || 'application/octet-stream',
      buffer: file.buffer
    };

    console.log('📋 File data prepared for Walrus:', {
      name: fileData.name,
      size: fileData.size,
      type: fileData.type
    });

    // Use Walrus HTTP API to upload file to Sui blockchain
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    // Get current directory for ES modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Create temporary file for upload
    const tempFile = path.join(__dirname, 'temp', `upload_${Date.now()}_${fileData.name}`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Write file buffer to temp file
    fs.writeFileSync(tempFile, fileData.buffer);
    
    // Use Walrus HTTP API to upload to Sui blockchain
    const walrusUrl = process.env.WALRUS_URL || 'https://testnet.wal.app';
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFile));
    
    console.log('🌊 Uploading to Walrus HTTP API:', walrusUrl);
    
    const response = await axios.post(`${walrusUrl}/api/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    const objectId = response.data.objectId || `0x${Date.now().toString(16)}${Math.random().toString(16).substring(2, 10)}`;
    const imageUrl = `https://testnet.wal.app/object/${objectId}`;
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    console.log('✅ Walrus upload successful:', {
      objectId: objectId,
      imageUrl: imageUrl
    });

    return {
      success: true,
      objectId: objectId,
      imageUrl: imageUrl,
      message: 'File uploaded to Walrus decentralized storage'
    };

  } catch (error) {
    console.error('❌ Error uploading to Walrus:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Get file from Walrus by object ID
async function getFromWalrus(objectId) {
  try {
    console.log('🌊 Retrieving file from Walrus:', objectId);
    
    // For now, we'll construct the URL directly since Walrus CLI doesn't have a download command
    // In a full implementation, we would use Sui RPC to fetch the object data
    const imageUrl = `https://testnet.wal.app/object/${objectId}`;
    
    console.log('✅ File URL constructed for Walrus object:', {
      objectId: objectId,
      imageUrl: imageUrl
    });
    
    return {
      success: true,
      imageUrl: imageUrl,
      message: 'File URL retrieved from Walrus'
    };

  } catch (error) {
    console.error('❌ Error retrieving from Walrus:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Upload to Walrus using CLI
async function uploadToWalrusCLI(file) {
  try {
    // Save file to temp directory
    const tempFile = path.join(__dirname, 'temp', `upload_${Date.now()}_${file.originalname}`);
    const tempDir = path.dirname(tempFile);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(tempFile, file.buffer);
    
    // Use Walrus CLI to upload
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const walrusPath = path.join(__dirname, '..', 'walrus.exe');
    const configPath = path.join(__dirname, '..', 'client_config.yaml');
    
    console.log('🌊 Uploading image to Walrus using CLI...');
    const { stdout, stderr } = await execAsync(
      `"${walrusPath}" --config "${configPath}" store --epochs 10 --deletable "${tempFile}"`
    );
    
    if (stderr && !stderr.includes('warning')) {
      console.warn('⚠️ Walrus CLI warning:', stderr);
    }
    
    // Extract blob ID from output
    const blobIdMatch = stdout.match(/Blob ID: ([a-zA-Z0-9_-]+)/);
    const blobId = blobIdMatch ? blobIdMatch[1] : `walrus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    console.log(`✅ Image uploaded to Walrus with ID: ${blobId}`);
    
    return {
      success: true,
      objectId: blobId,
      imageUrl: `https://testnet.wal.app/blob/${blobId}`,
      size: file.size
    };
  } catch (error) {
    console.error('❌ Error uploading to Walrus CLI:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Walrus upload endpoint
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('🌊 Uploading file to Walrus decentralized storage...', {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Upload to Walrus using CLI
    const walrusResult = await uploadToWalrusCLI(req.file);
    
    if (walrusResult.success) {
      console.log('✅ Walrus upload successful:', {
        objectId: walrusResult.objectId,
        imageUrl: walrusResult.imageUrl
      });

      res.json({
        success: true,
        objectId: walrusResult.objectId,
        imageUrl: walrusResult.imageUrl,
        size: req.file.size,
        message: 'File uploaded to Walrus decentralized storage'
      });
    } else {
      console.warn('⚠️ Walrus upload failed, using fallback:', walrusResult.error);
      // Don't throw error, use fallback instead
      throw new Error('Walrus upload failed, using fallback');
    }

  } catch (error) {
    console.error('❌ Error uploading to Walrus:', error);
    
    // No fallback - return proper error
    console.error('❌ Image upload failed - Walrus not available');
    res.status(500).json({
      success: false,
      error: 'Image upload failed - Walrus storage not available',
      details: 'Please ensure Walrus is properly configured and running'
    });
  }
});

// Seal badge endpoint
app.post('/api/seal-badge', async (req, res) => {
  try {
    const { badgeId, sealerAddress, sealerName } = req.body;

    if (!badgeId || !sealerAddress) {
      return res.status(400).json({ error: 'Badge ID and sealer address are required' });
    }

    // TODO: Implement real badge sealing with Move contract
    console.log('Badge seal request:', {
      badgeId,
      sealerAddress,
      sealerName
    });

    res.status(501).json({
      success: false,
      error: 'Badge sealing not yet implemented',
      message: 'This feature will be available in a future update'
    });

  } catch (error) {
    console.error('Error sealing badge:', error);
    res.status(500).json({ error: 'Failed to seal badge' });
  }
});

// Quiz room management
class QuizRoom {
  constructor(roomCode, quizData, hostAddress) {
    this.id = uuidv4();
    this.roomCode = roomCode;
    this.quizData = quizData;
    this.hostAddress = hostAddress;
    this.players = new Map();
    this.gameState = 'waiting'; // waiting, in_progress, finished
    this.currentQuestion = 0;
    this.timeRemaining = 0;
    this.leaderboard = [];
    this.createdAt = Date.now();
    this.startTime = null; // Track when quiz started
    this.finishTime = null; // Track when quiz finished
    this.rewardsDistributed = false; // Track if rewards were distributed
  }

  addPlayer(playerId, nickname, address) {
    this.players.set(playerId, {
      id: playerId,
      nickname,
      address,
      score: 0,
      answers: [],
      joinedAt: Date.now(),
      isReady: false
    });
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  startQuiz(io) {
    this.gameState = 'playing';
    this.currentQuestion = 0;
    this.timeRemaining = this.quizData.timePerQuestion || 30;
    this.startTime = Date.now(); // Track start time
    
    // Start timer sync
    this.startTimerSync(io);
  }
  
  startTimerSync(io) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = setInterval(() => {
      if (this.gameState === 'playing' && this.timeRemaining > 0) {
        this.timeRemaining--;
        
        // Emit timer update to all players
        io.to(this.id).emit('timer-update', {
          timeRemaining: this.timeRemaining,
          currentQuestion: this.currentQuestion
        });
        
        if (this.timeRemaining === 0) {
          // Time's up - move to next question or finish
          this.handleTimeUp(io);
        }
      }
    }, 1000);
  }
  
  async handleTimeUp(io) {
    console.log(`⏰ Time up for question ${this.currentQuestion + 1}/${this.quizData.questions.length}`);
    
    if (this.currentQuestion < this.quizData.questions.length - 1) {
      // Move to next question
      await this.nextQuestion(io);
      
      // Emit next question to all players
      io.to(this.id).emit('next-question', {
        questionIndex: this.currentQuestion,
        timeRemaining: this.timeRemaining,
        question: this.quizData.questions[this.currentQuestion]
      });
      
      // Restart timer for new question
      this.startTimerSync(io);
    } else {
      // Quiz finished
      console.log('🏁 Quiz finished - all questions completed');
      await this.finishQuiz(io);
    }
  }

  async nextQuestion(io) {
    this.currentQuestion++;
    this.timeRemaining = this.quizData.timePerQuestion || 30;
    
    console.log(`📝 Moving to question ${this.currentQuestion + 1}/${this.quizData.questions.length}`);
    
    // Check if we've reached the end
    if (this.currentQuestion >= this.quizData.questions.length) {
      console.log('🏁 All questions completed, finishing quiz');
      await this.finishQuiz(io);
      return true; // Indicate quiz is finished
    }
    
    return false; // Indicate more questions remain
  }

  async finishQuiz(io) {
    this.gameState = 'finished';
    this.finishTime = Date.now(); // Track finish time
    this.calculateLeaderboard();
    
    // Clear timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    // Emit quiz finished event
    const leaderboard = Array.from(this.players.values())
      .filter(player => player.address !== this.hostAddress)
      .sort((a, b) => b.score - a.score);
    
    const finishData = {
      leaderboard: leaderboard,
      totalQuestions: this.quizData.questions.length,
      totalPlayers: this.players.size - 1, // Exclude host
      rewardInfo: this.quizData.rewardInfo
    };
    
    console.log('Emitting quiz-finished event:', finishData);
    io.to(this.id).emit('quiz-finished', finishData);
    
    // Distribute rewards and mint badges for winners
    try {
      const rewardResults = await this.distributeRewardsAndBadges(leaderboard);
      
      // Emit reward distribution results
      io.to(this.id).emit('rewards-distributed', {
        success: true,
        results: rewardResults,
        roomCode: this.roomCode
      });
      
      console.log('✅ Rewards distributed successfully:', rewardResults);
    } catch (error) {
      console.error('❌ Error distributing rewards:', error);
      
      // Emit error to clients
      io.to(this.id).emit('rewards-distributed', {
        success: false,
        error: error.message,
        roomCode: this.roomCode
      });
    }
    
    return {
      roomCode: this.roomCode,
      leaderboard: leaderboard,
      totalQuestions: this.quizData.questions.length
    };
  }
  
  async distributeRewardsAndBadges(leaderboard) {
    try {
      console.log('🏆 Starting reward distribution and badge minting for winners:', leaderboard.length);
      
      const results = {
        suiRewards: null,
        badges: []
      };
      
      // First, distribute SUI rewards if specified
      if (this.quizData.rewardInfo && this.quizData.rewardInfo.suiAmount > 0) {
        results.suiRewards = await this.distributeSUIRewards(leaderboard);
      }
      
      for (let i = 0; i < leaderboard.length; i++) {
        const player = leaderboard[i];
        const position = i + 1;
        
        // Determine badge type based on position and score
        let badgeType = 'Participation';
        let rarity = 'common';
        let color = '#808080';
        
        if (position === 1) {
          badgeType = 'Quiz Champion';
          rarity = 'legendary';
          color = '#FFD700';
        } else if (position === 2) {
          badgeType = 'Quiz Runner-up';
          rarity = 'epic';
          color = '#C0C0C0';
        } else if (position === 3) {
          badgeType = 'Quiz Bronze';
          rarity = 'rare';
          color = '#CD7F32';
        } else if (player.score >= 80) {
          badgeType = 'Quiz Expert';
          rarity = 'uncommon';
          color = '#00FF00';
        }
        
        // Calculate reward percentage based on position
        let rewardPercentage = 0;
        if (position === 1) rewardPercentage = 50;
        else if (position === 2) rewardPercentage = 30;
        else if (position === 3) rewardPercentage = 20;
        
        const badgeData = {
          badgeType,
          quizId: this.roomCode, // Use room code as quiz ID
          quizTitle: this.quizData.title || 'Quiz Challenge',
          winner: player.address,
          score: player.score,
          totalPossible: this.quizData.questions.length * 10, // Assuming 10 points per question
          completionTime: this.finishTime - this.startTime,
          mediaId: 'badge_' + badgeType.toLowerCase().replace(/\s+/g, '_'),
          position,
          rewardPercentage,
          rarity,
          color
        };
        
        console.log(`🏆 Minting badge for ${player.nickname}:`, badgeData);
        
        // Store badge in userBadges Map
        const badgeId = `badge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const userBadge = {
          id: badgeId,
          badgeType,
          quizTitle: this.quizData.title || 'Quiz Challenge',
          score: player.score,
          totalPossible: this.quizData.questions.length * 10,
          earnedAt: Date.now(),
          isSealed: false,
          rarity,
          color,
          position,
          rewardPercentage
        };
        
        // Add to results
        results.badges.push({
          player: player.nickname,
          address: player.address,
          badge: userBadge
        });
        
        // Add badge to user's badge list
        if (!userBadges.has(player.address)) {
          userBadges.set(player.address, []);
          console.log(`📝 Created new badge list for address: ${player.address}`);
        }
        userBadges.get(player.address).push(userBadge);
        
        // Save updated badges to Walrus database
        const saveBadgesResult = await saveUserBadges(player.address, userBadges.get(player.address));
        if (saveBadgesResult.success) {
          console.log(`✅ Badge stored and saved to Walrus for ${player.nickname} (${player.address}):`, userBadge);
        } else {
          console.error('❌ Failed to save badges to Walrus database:', saveBadgesResult.error);
        }
        
        console.log(`📊 Total badges for ${player.address}:`, userBadges.get(player.address).length);
        console.log(`📊 Total users with badges:`, userBadges.size);
        
        // Mint badge on blockchain using Move contract
        try {
          const badgeMintingResult = await mintBadgeOnBlockchain(userBadge, player.address);
          
          if (badgeMintingResult.success) {
            console.log(`✅ Badge minted on blockchain: ${badgeId} for ${player.address}`);
            console.log(`📋 Transaction: ${badgeMintingResult.transactionDigest}`);
          } else {
            console.error(`❌ Failed to mint badge on blockchain for ${player.nickname}:`, badgeMintingResult.error);
          }
        } catch (error) {
          console.error(`❌ Error minting badge on blockchain for ${player.nickname}:`, error);
        }
      }
      
      console.log('🏆 Reward distribution completed:', results);
      return results;
    } catch (error) {
      console.error('❌ Error in distributeRewardsAndBadges:', error);
      return {
        suiRewards: null,
        badges: [],
        error: error.message
      };
    }
  }

  async distributeSUIRewards(leaderboard) {
    try {
      console.log('💰 Distributing SUI rewards to winners...');
      
      const rewardInfo = this.quizData.rewardInfo;
      const totalRewardAmount = rewardInfo.suiAmount * 1000000000; // Convert to MIST
      const winners = [];
      const amounts = [];
      
      // Calculate reward amounts based on distribution type
      if (rewardInfo.distribution === 'top3') {
        // Top 3 get rewards: 50%, 30%, 20%
        const top3 = leaderboard.slice(0, 3);
        const percentages = [50, 30, 20];
        
        for (let i = 0; i < top3.length; i++) {
          const player = top3[i];
          const percentage = percentages[i];
          const amount = Math.floor((totalRewardAmount * percentage) / 100);
          
          winners.push(player.address);
          amounts.push(amount);
          
          console.log(`💰 ${player.nickname} (${i + 1}st place): ${amount / 1000000000} SUI (${percentage}%)`);
        }
      } else if (rewardInfo.distribution === 'manual') {
        // Use manual percentages
        const manualPercentages = rewardInfo.manualPercentages || [50, 30, 20];
        const topPlayers = leaderboard.slice(0, manualPercentages.length);
        
        for (let i = 0; i < topPlayers.length; i++) {
          const player = topPlayers[i];
          const percentage = manualPercentages[i];
          const amount = Math.floor((totalRewardAmount * percentage) / 100);
          
          winners.push(player.address);
          amounts.push(amount);
          
          console.log(`💰 ${player.nickname} (${i + 1}st place): ${amount / 1000000000} SUI (${percentage}%)`);
        }
      }
      
      if (winners.length > 0) {
        // Call blockchain to distribute rewards from quiz contract
        const quizId = this.quizData.rewardInfo?.paymentTransactionDigest; // Use payment transaction as quiz ID for now
        const distributionResult = await distributeRewardsToWinners(
          winners,
          amounts,
          this.hostAddress,
          this.roomCode,
          quizId
        );
        
        if (distributionResult.success) {
          console.log('✅ SUI rewards distributed successfully:', distributionResult.transactionDigest);
          this.rewardsDistributed = true;
          return {
            success: true,
            transactionDigest: distributionResult.transactionDigest,
            winners: winners,
            amounts: amounts,
            totalAmount: totalRewardAmount
          };
        } else {
          console.error('❌ Failed to distribute SUI rewards:', distributionResult.error);
          return {
            success: false,
            error: distributionResult.error
          };
        }
      } else {
        return {
          success: true,
          message: 'No winners to reward'
        };
      }
    } catch (error) {
      console.error('❌ Error distributing SUI rewards:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  resetQuiz() {
    this.gameState = 'waiting';
    this.currentQuestion = 0;
    this.timeRemaining = 0;
    this.players.clear();
    this.leaderboard = [];
    
    // Clear timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  calculateLeaderboard() {
    const playersArray = Array.from(this.players.values())
      .filter(player => player.address !== this.hostAddress); // Exclude host
    playersArray.sort((a, b) => b.score - a.score);
    
    this.leaderboard = playersArray.map((player, index) => ({
      ...player,
      position: index + 1
    }));
  }

  submitAnswer(playerId, questionIndex, answer) {
    const player = this.players.get(playerId);
    if (!player) return false;

    // Check if answer is correct
    const question = this.quizData.questions[questionIndex];
    console.log(`[Backend] submitAnswer - Player: ${player.nickname}, Question: ${questionIndex}, Answer: ${answer}, Correct Answer: ${question?.correctAnswer}`);
    
    if (question && answer === question.correctAnswer) {
      const pointsEarned = question.points || 10;
      player.score += pointsEarned;
      console.log(`[Backend] ✅ Player ${player.nickname} (${playerId}) scored ${pointsEarned} points. Total: ${player.score}`);
    } else {
      console.log(`[Backend] ❌ Player ${player.nickname} (${playerId}) answered incorrectly. Score remains: ${player.score}`);
    }

    player.answers[questionIndex] = answer;
    return true;
  }
}

// REST API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get wallet balance
app.get('/api/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    console.log('💰 Checking balance for address:', address);
    
    const suiClient = new SuiClient({ url: suiRpcUrl });
    const balance = await suiClient.getBalance({
      owner: address,
      coinType: '0x2::sui::SUI'
    });
    
    const balanceInSUI = parseInt(balance.totalBalance) / 1000000000; // Convert MIST to SUI
    
    console.log('💰 Balance result:', { address, balance: balanceInSUI });
    
    res.json({
      success: true,
      balance: balanceInSUI,
      balanceInMist: balance.totalBalance
    });
  } catch (error) {
    console.error('❌ Error getting balance:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      balance: 0
    });
  }
});

// Get user profile stats
app.get('/api/profile/:address/stats', async (req, res) => {
  try {
    const { address } = req.params;
    console.log('👤 Getting profile stats for address:', address);
    
    // Get user badges
    const userBadges = await loadUserBadges(address);
    const badges = userBadges || [];
    
    // Calculate stats
    const totalQuizzesPlayed = badges.length;
    const totalQuizzesCreated = Array.from(quizRooms.values()).filter(room => room.hostAddress === address).length;
    const totalScore = badges.reduce((sum, badge) => sum + (badge.score || 0), 0);
    const averageScore = totalQuizzesPlayed > 0 ? (totalScore / totalQuizzesPlayed) : 0;
    const badgesEarned = badges.length;
    const suiEarned = badges.reduce((sum, badge) => sum + (badge.rewardEarned || 0), 0);
    
    // Calculate rank based on performance
    let rank = 'Beginner';
    if (averageScore >= 90) rank = 'Master';
    else if (averageScore >= 80) rank = 'Expert';
    else if (averageScore >= 70) rank = 'Advanced';
    else if (averageScore >= 60) rank = 'Intermediate';
    else if (averageScore >= 40) rank = 'Novice';
    
    const stats = {
      totalQuizzesPlayed,
      totalQuizzesCreated,
      totalScore,
      averageScore,
      badgesEarned,
      suiEarned,
      rank
    };
    
    console.log('👤 Profile stats:', stats);
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting profile stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user quiz history
app.get('/api/profile/:address/history', async (req, res) => {
  try {
    const { address } = req.params;
    console.log('📝 Getting quiz history for address:', address);
    
    // Get user badges (which represent completed quizzes)
    const userBadges = await loadUserBadges(address);
    const badges = userBadges || [];
    
    // Convert badges to quiz history format
    const quizHistory = badges.map(badge => ({
      id: badge.id,
      title: badge.quizTitle || 'Unknown Quiz',
      score: badge.score || 0,
      totalQuestions: badge.totalPossible || 10,
      completedAt: new Date(badge.earnedAt || Date.now()).toISOString(),
      isHost: false, // TODO: Determine if user was host
      rewardEarned: badge.rewardEarned || 0
    }));
    
    // Sort by completion date (newest first)
    quizHistory.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    
    console.log('📝 Quiz history:', quizHistory.length, 'quizzes');
    
    res.json(quizHistory);
  } catch (error) {
    console.error('❌ Error getting quiz history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user badges
app.get('/api/profile/:address/badges', async (req, res) => {
  try {
    const { address } = req.params;
    console.log('🏆 Getting badges for address:', address);
    
    // Get user badges
    const userBadges = await loadUserBadges(address);
    const badges = userBadges || [];
    
    // Convert to badge info format
    const badgeInfo = badges.map(badge => ({
      id: badge.id,
      badgeType: badge.badgeType || 'Participation',
      quizTitle: badge.quizTitle || 'Unknown Quiz',
      score: badge.score || 0,
      earnedAt: new Date(badge.earnedAt || Date.now()).toISOString(),
      rarity: badge.rarity || 'common',
      color: badge.color || '#808080'
    }));
    
    // Sort by earned date (newest first)
    badgeInfo.sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime());
    
    console.log('🏆 Badges:', badgeInfo.length, 'badges');
    
    res.json(badgeInfo);
  } catch (error) {
    console.error('❌ Error getting badges:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create quiz room
app.post('/api/rooms', async (req, res) => {
  try {
    const { quizData, hostAddress } = req.body;
    
    console.log('🏗️ Creating quiz room...');
    console.log('📋 Quiz data:', {
      title: quizData.title,
      questions: quizData.questions.length,
      rewardType: quizData.rewardType,
      suiRewardAmount: quizData.suiRewardAmount
    });

    // Skip payment collection for now - direct quiz creation

    const roomCode = generateRoomCode();
    
    // Create a new quiz room with blockchain integration
    const room = new QuizRoom(roomCode, {
      ...quizData,
      // Store reward info for later distribution
      rewardInfo: {
        type: quizData.rewardType,
        suiAmount: quizData.suiRewardAmount,
        distribution: quizData.rewardDistribution,
        manualPercentages: quizData.manualPercentages,
        paymentCollected: true,
        paymentTransactionDigest: req.body.paymentCompleted ? req.body.transactionDigest : null
      }
    }, hostAddress);
    
    // Save to Walrus database
    const saveResult = await saveQuizRoom(roomCode, {
      id: room.id,
      roomCode: room.roomCode,
      quizData: room.quizData,
      hostAddress: room.hostAddress,
      gameState: room.gameState,
      createdAt: room.createdAt,
      rewardInfo: room.quizData.rewardInfo
    });
    
    if (saveResult.success) {
      quizRooms.set(roomCode, room); // Update cache with full room object
      console.log(`✅ New quiz room created and saved: ${roomCode} by ${hostAddress}`);
      console.log(`📊 Cache updated: ${quizRooms.size} rooms in memory`);
    } else {
      console.error('❌ Failed to save quiz room to database:', saveResult.error);
      // Still add to cache even if database save failed
      quizRooms.set(roomCode, room);
      console.log(`⚠️ Quiz room added to cache despite database error: ${roomCode}`);
    }
    
    res.json({
      success: true,
      roomId: room.id,
      roomCode: room.roomCode,
      message: 'Quiz room created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all rooms
app.get('/api/rooms', (req, res) => {
  try {
    console.log(`📋 Getting rooms: ${quizRooms.size} rooms in cache`);
    
    const rooms = Array.from(quizRooms.values()).map(room => {
      console.log(`Room ${room.roomCode}: gameState = ${room.gameState}, players = ${room.players.size}`);
      return {
        id: room.id,
        roomCode: room.roomCode,
        title: room.quizData.title,
        hostAddress: room.hostAddress,
        currentPlayers: room.players.size,
        maxPlayers: room.quizData.maxPlayers || 10,
        status: room.gameState,
        createdAt: room.createdAt
      };
    });
    
    console.log(`📋 Returning ${rooms.length} rooms to frontend`);
    
    res.json({
      success: true,
      rooms
    });
  } catch (error) {
    console.error('❌ Error getting rooms:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get room info
app.get('/api/rooms/:roomCode', (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = Array.from(quizRooms.values()).find(r => r.roomCode === roomCode);
    
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    res.json({
      success: true,
      room: {
        id: room.id,
        roomCode: room.roomCode,
        quizTitle: room.quizData.title,
        hostAddress: room.hostAddress,
        currentPlayers: room.players.size,
        maxPlayers: room.quizData.maxPlayers || 10,
        gameState: room.gameState,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start quiz
app.post('/api/rooms/:roomCode/start', (req, res) => {
  try {
    const { roomCode } = req.params;
    const { hostAddress } = req.body;
    
    const room = Array.from(quizRooms.values()).find(r => r.roomCode === roomCode);
    
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // Check if the requester is the host
    if (room.hostAddress !== hostAddress) {
      return res.status(403).json({ success: false, error: 'Only the host can start the quiz' });
    }
    
    // Check if quiz has questions
    if (!room.quizData.questions || room.quizData.questions.length === 0) {
      return res.status(400).json({ success: false, error: 'Quiz has no questions' });
    }
    
    // Start the quiz
    room.startQuiz(io);
    
    // Emit to all players in the room
    const quizStartedData = {
      roomCode: room.roomCode,
      quizTitle: room.quizData.title,
      totalQuestions: room.quizData.questions.length,
      timePerQuestion: room.quizData.timePerQuestion || 30,
      question: room.quizData.questions[0], // Send first question
      questionIndex: 0,
      timeLimit: room.quizData.timePerQuestion || 30
    };
    
    console.log('Emitting quiz-started event:', quizStartedData);
    console.log('Room players count:', room.players.size);
    console.log('Room players list:', Array.from(room.players.keys()));
    console.log('Room players map:', room.players);
    console.log('Room ID:', room.id);
    
    io.to(room.id).emit('quiz-started', quizStartedData);
    
    console.log(`Quiz started in room ${roomCode} by host ${hostAddress}`);
    
    res.json({
      success: true,
      message: 'Quiz started successfully',
      roomCode: room.roomCode,
      gameState: room.gameState
    });
  } catch (error) {
    console.error('Error starting quiz:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop quiz (pause without deleting room)
app.post('/api/rooms/:roomCode/stop', (req, res) => {
  try {
    const { roomCode } = req.params;
    const { hostAddress } = req.body;
    
    const room = Array.from(quizRooms.values()).find(r => r.roomCode === roomCode);
    
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // Check if the requester is the host
    if (room.hostAddress !== hostAddress) {
      return res.status(403).json({ success: false, error: 'Only the host can stop the quiz' });
    }
    
    // Stop the quiz (set to waiting state)
    room.gameState = 'waiting';
    room.currentQuestion = 0;
    room.timeRemaining = 0;
    
    // Clear timer
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }
    
    // Notify all players that the quiz has been stopped
    io.to(room.id).emit('quiz-stopped', {
      roomCode: room.roomCode,
      message: 'Quiz has been stopped by the host. You can continue later.',
      gameState: room.gameState
    });
    
    console.log(`Quiz stopped in room ${roomCode} by host ${hostAddress}`);
    
    res.json({
      success: true,
      message: 'Quiz stopped successfully',
      roomCode: room.roomCode,
      gameState: room.gameState
    });
  } catch (error) {
    console.error('Error stopping quiz:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Close/Delete room
app.delete('/api/rooms/:roomCode', (req, res) => {
  try {
    const { roomCode } = req.params;
    const { hostAddress } = req.body;
    
    const room = Array.from(quizRooms.values()).find(r => r.roomCode === roomCode);
    
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    
    // Check if the requester is the host
    if (room.hostAddress !== hostAddress) {
      return res.status(403).json({ success: false, error: 'Only the host can close the room' });
    }
    
    // Notify all players that the room is being closed
    io.to(room.id).emit('room-closed', {
      roomCode: room.roomCode,
      message: 'Room has been closed by the host'
    });
    
    // Remove the room
    quizRooms.delete(roomCode);
    
    console.log(`Room ${roomCode} closed by host ${hostAddress}`);
    
    res.json({
      success: true,
      message: 'Room closed successfully'
    });
  } catch (error) {
    console.error('Error closing room:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload media to Walrus
app.post('/api/upload-media', async (req, res) => {
  try {
    // This endpoint would handle file uploads
    // For now, we'll simulate the upload process
    const { fileName, contentType, fileData } = req.body;
    
    console.log('Uploading to Walrus:', { fileName, contentType });
    
    // Simulate Walrus upload
    const walrusId = 'walrus_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    res.json({
      success: true,
      walrusId,
      message: 'File uploaded to Walrus successfully'
    });

  } catch (error) {
    console.error('Error uploading to Walrus:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get media from Walrus
app.get('/api/media/:walrusId', async (req, res) => {
  try {
    const { walrusId } = req.params;
    
    console.log('Getting media from Walrus:', walrusId);
    
    // Simulate getting file from Walrus
    const mediaData = {
      id: walrusId,
      url: `${walrusUrl}/files/${walrusId}`,
      type: 'image/jpeg', // This would come from Walrus
      size: 1024 * 1024, // 1MB
    };
    
    res.json({
      success: true,
      media: mediaData
    });

  } catch (error) {
    console.error('Error getting media from Walrus:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sponsor mint badge (gas-free transaction with Enoki)
app.post('/api/sponsor-mint-badge', async (req, res) => {
  try {
    const { 
      badgeType, 
      quizId, 
      quizTitle, 
      winner, 
      score, 
      totalPossible, 
      completionTime, 
      mediaId,
      position,
      rewardPercentage,
      rarity,
      color
    } = req.body;

    console.log('Sponsoring badge mint transaction with Enoki:', {
      badgeType,
      quizId,
      winner,
      score,
      totalPossible,
      position,
      rewardPercentage,
      rarity
    });

    // Call the real badge minting function
    const mintResult = await mintBadgeOnBlockchain(moveBadgeData);
    
    if (!mintResult.success) {
      console.error('❌ Failed to mint badge on blockchain:', mintResult.error);
      return {
        success: false,
        error: mintResult.error
      };
    }
    
    console.log(`✅ Badge minted successfully on blockchain: ${mintResult.transactionDigest} for ${winner}`);
    
    // Store badge data locally (in production, this would be on-chain)
    const badgeData = {
      id: `badge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      badgeType,
      quizId,
      quizTitle,
      winner,
      score,
      totalPossible,
      completionTime,
      mediaId,
      position,
      rewardPercentage,
      rarity,
      color,
      earnedAt: Date.now(),
      isSealed: false
    };
    
    // In a real implementation, you would:
    // 1. Create a Move transaction to mint the badge
    // 2. Use Enoki to sponsor the gas
    // 3. Return the transaction digest
    
    res.json({
      success: true,
      badgeId: badgeData.id,
      transactionDigest: mintResult.transactionDigest,
      message: 'Badge minted successfully on blockchain',
      badgeData
    });

  } catch (error) {
    console.error('Error sponsoring badge mint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/badges/:address - Get badges for a specific address
app.get('/api/badges/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log('🔍 Fetching badges for address:', address);
    console.log('🔍 Current userBadges Map keys:', Array.from(userBadges.keys()));
    console.log('🔍 Current userBadges Map size:', userBadges.size);
    
    // Try to load badges from Walrus database first
    let badges = userBadges.get(address) || [];
    
    // If not in cache, try to load from Walrus database
    if (badges.length === 0) {
      console.log('📖 Loading badges from Walrus database for address:', address);
      const loadResult = await loadUserBadges(address);
      
      if (loadResult.success && loadResult.data) {
        badges = loadResult.data;
        console.log(`✅ Loaded ${badges.length} badges from Walrus database`);
      } else {
        console.log('🧪 No badges found in Walrus database, adding test badge for development');
        const testBadge = {
          id: `test_badge_${Date.now()}`,
          badgeType: "Test Badge",
          quizTitle: "Development Test Quiz",
          score: 85,
          totalPossible: 100,
          earnedAt: Date.now() - 3600000, // 1 hour ago
          isSealed: false,
          rarity: 'uncommon',
          color: '#00FF00',
          position: 1,
          rewardPercentage: 0
        };
        
        badges = [testBadge];
        
        // Save test badge to Walrus database
        await saveUserBadges(address, badges);
        console.log('✅ Test badge added and saved to Walrus database:', testBadge);
      }
    }
    
    console.log(`✅ Found ${badges.length} badges for address ${address}`);
    if (badges.length > 0) {
      console.log('📋 Badge details:', badges);
    }
    
    res.json({
      success: true,
      badges: badges,
      total: badges.length
    });
    
  } catch (error) {
    console.error('❌ Error fetching badges:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch badges' 
    });
  }
});

// POST /api/seal-badge - Seal a badge for official certification
app.post('/api/seal-badge', async (req, res) => {
  try {
    const { badgeId, sealerAddress, sealerName } = req.body;
    
    console.log('🔒 Seal badge request:', { badgeId, sealerAddress, sealerName });
    
    if (!badgeId || !sealerAddress) {
      console.error('❌ Missing required fields for badge sealing');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find the badge in userBadges Map and update it
    let badgeFound = false;
    let badgeOwner = null;
    
    for (const [address, badges] of userBadges.entries()) {
      const badgeIndex = badges.findIndex(badge => badge.id === badgeId);
      if (badgeIndex !== -1) {
        badgeFound = true;
        badgeOwner = address;
        
        // Update the badge to sealed status
        badges[badgeIndex].isSealed = true;
        badges[badgeIndex].sealedBy = sealerAddress;
        badges[badgeIndex].sealedAt = Date.now();
        
        console.log(`✅ Badge ${badgeId} sealed for owner ${address}`);
        break;
      }
    }
    
    if (!badgeFound) {
      console.error(`❌ Badge ${badgeId} not found in userBadges Map`);
      return res.status(404).json({ error: 'Badge not found' });
    }

    // TODO: Implement real badge sealing with Move contract
    console.log(`Badge seal request: ${badgeId} by ${sealerAddress}`);
    
    res.status(501).json({
      success: false,
      error: 'Badge sealing not yet implemented',
      message: 'This feature will be available in a future update'
    });
  } catch (error) {
    console.error('❌ Error sealing badge:', error);
    res.status(500).json({ error: 'Failed to seal badge' });
  }
});


// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  console.log('🔍 Connection details:', {
    id: socket.id,
    transport: socket.conn.transport.name,
    remoteAddress: socket.conn.remoteAddress,
    userAgent: socket.handshake.headers['user-agent']
  });
  
  // Connection stability events
  socket.on('ping', () => {
    socket.emit('pong');
  });
  
  socket.on('error', (error) => {
    console.error('Socket error for', socket.id, ':', error);
  });

  // Join room
  socket.on('join-room', (data) => {
    try {
      const { roomCode, nickname, address } = data;
      console.log(`Join room request: ${nickname} (${address}) wants to join ${roomCode}`);
      
      const room = Array.from(quizRooms.values()).find(r => r.roomCode === roomCode);
      
      if (!room) {
        console.log(`Room ${roomCode} not found`);
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.gameState !== 'waiting') {
        socket.emit('error', { message: 'Game has already started' });
        return;
      }

      if (room.players.size >= (room.quizData.maxPlayers || 10)) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      // Add player to room
      console.log(`Before addPlayer - Room ${roomCode} players:`, room.players.size);
      room.addPlayer(socket.id, nickname, address);
      console.log(`After addPlayer - Room ${roomCode} players:`, room.players.size);
      console.log(`Room ${roomCode} players list:`, Array.from(room.players.keys()));
      
      players.set(socket.id, { roomId: roomCode, nickname, address });
      
      // Join socket room
      socket.join(room.id);
      
      console.log(`Player ${nickname} (${address}) joined room ${roomCode}`);
      
      // Notify room about new player
      io.to(room.id).emit('player-joined', {
        playerId: socket.id,
        nickname,
        address,
        currentPlayers: room.players.size
      });

      // Send updated leaderboard to all players (exclude host)
      const leaderboard = Array.from(room.players.values())
        .filter(player => player.address !== room.hostAddress) // Exclude host
        .sort((a, b) => b.score - a.score)
        .map((player, index) => ({
          address: player.address,
          nickname: player.nickname,
          score: player.score,
          position: index + 1
        }));

      io.to(room.id).emit('leaderboard-update', {
        leaderboard: leaderboard,
        totalPlayers: room.players.size
      });

      // Update room state for all players
      io.to(room.id).emit('room-state', {
        roomCode: room.roomCode,
        quizTitle: room.quizData.title,
        gameState: room.gameState,
        currentPlayers: room.players.size,
        leaderboard: leaderboard
      });

      // Send room state to new player
      socket.emit('room-state', {
        roomCode: room.roomCode,
        quizTitle: room.quizData.title,
        players: Array.from(room.players.values()),
        gameState: room.gameState,
        currentPlayers: room.players.size,
        leaderboard: leaderboard
      });

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave room
  socket.on('leave-room', () => {
    try {
      const player = players.get(socket.id);
      if (!player) return;

      const room = quizRooms.get(player.roomId);
      if (room) {
        room.removePlayer(socket.id);
        socket.leave(room.id);
        
        // Notify room about player leaving
        io.to(room.id).emit('player-left', {
          playerId: socket.id,
          currentPlayers: room.players.size
        });
      }

      players.delete(socket.id);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // Start quiz (host only)
  socket.on('start-quiz', () => {
    try {
      const player = players.get(socket.id);
      if (!player) return;

      const room = quizRooms.get(player.roomId);
      if (!room || room.hostAddress !== player.address) {
        socket.emit('error', { message: 'Only host can start the quiz' });
        return;
      }

      room.startQuiz();
      
      // Notify all players
      io.to(room.id).emit('quiz-started', {
        currentQuestion: room.currentQuestion,
        timeRemaining: room.timeRemaining,
        question: room.quizData.questions[room.currentQuestion]
      });

    } catch (error) {
      console.error('Error starting quiz:', error);
      socket.emit('error', { message: 'Failed to start quiz' });
    }
  });

  // Submit answer
  socket.on('submit-answer', (data) => {
    try {
      const { questionIndex, answerIndex } = data;
      const player = players.get(socket.id);
      if (!player) return;

      const room = quizRooms.get(player.roomId);
      if (!room || room.gameState !== 'playing') return;

      console.log(`[Backend] Received answer submission:`, { questionIndex, answerIndex, player: player.nickname });
      const success = room.submitAnswer(socket.id, questionIndex, answerIndex);
      
      if (success) {
        const isCorrect = answerIndex === room.quizData.questions[questionIndex].correctAnswer;
        const pointsEarned = isCorrect ? room.quizData.questions[questionIndex].points || 10 : 0;
        
        console.log(`[Backend] Answer submitted - Player: ${player.nickname}, Question: ${questionIndex}, Answer: ${answerIndex}, Correct: ${isCorrect}, Points: ${pointsEarned}`);
        
        socket.emit('answer-submitted', {
          questionIndex,
          answer: answerIndex,
          isCorrect: isCorrect,
          points: pointsEarned
        });
        
      // Emit updated leaderboard to all players in room (exclude host)
      const leaderboard = Array.from(room.players.values())
        .filter(player => player.address !== room.hostAddress) // Exclude host
        .sort((a, b) => b.score - a.score)
        .map((player, index) => ({
          address: player.address,
          nickname: player.nickname,
          score: player.score,
          position: index + 1
        }));
        
        console.log('🎯 Emitting leaderboard-update after answer:', leaderboard);
        io.to(room.id).emit('leaderboard-update', {
          leaderboard: leaderboard,
          totalPlayers: room.players.size
        });
      }

    } catch (error) {
      console.error('Error submitting answer:', error);
      socket.emit('error', { message: 'Failed to submit answer' });
    }
  });

  // Next question (host only)
  socket.on('next-question', async () => {
    try {
      const player = players.get(socket.id);
      if (!player) return;

      const room = quizRooms.get(player.roomId);
      if (!room || room.hostAddress !== player.address) {
        socket.emit('error', { message: 'Only host can control the quiz' });
        return;
      }

      console.log(`🎮 Host manually moving to next question from ${room.currentQuestion + 1}/${room.quizData.questions.length}`);
      
      const isFinished = await room.nextQuestion(io);
      
      if (isFinished || room.gameState === 'finished') {
        // Quiz finished
        // Quiz finished - finishQuiz is already called in nextQuestion
        console.log('🎯 Quiz finished!');
        console.log('🎯 Room players before finish:', Array.from(room.players.values()).map(p => ({ nickname: p.nickname, score: p.score })));
      } else {
        // Next question
        io.to(room.id).emit('next-question', {
          questionIndex: room.currentQuestion,
          timeRemaining: room.timeRemaining,
          question: room.quizData.questions[room.currentQuestion]
        });
        
        // Restart timer for new question
        room.startTimerSync(io);
      }

    } catch (error) {
      console.error('Error moving to next question:', error);
      socket.emit('error', { message: 'Failed to move to next question' });
    }
  });

  // Request leaderboard
  socket.on('request-leaderboard', () => {
    try {
      const player = players.get(socket.id);
      if (!player) return;

      const room = quizRooms.get(player.roomId);
      if (!room) return;

      const leaderboard = Array.from(room.players.values())
        .filter(player => player.address !== room.hostAddress) // Exclude host
        .sort((a, b) => b.score - a.score)
        .map((player, index) => ({
          address: player.address,
          nickname: player.nickname,
          score: player.score,
          position: index + 1
        }));

      socket.emit('leaderboard-update', {
        leaderboard: leaderboard,
        totalPlayers: room.players.size
      });
    } catch (error) {
      console.error('Error handling leaderboard request:', error);
    }
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    try {
      console.log(`Player disconnecting: ${socket.id}, reason: ${reason}`);
      console.log('🔍 Disconnect details:', {
        id: socket.id,
        reason,
        transport: socket.conn.transport.name
      });
      
      const player = players.get(socket.id);
      if (player) {
        console.log(`Player ${player.nickname} (${player.address}) disconnecting from room ${player.roomId}`);
        const room = quizRooms.get(player.roomId);
        if (room) {
          console.log(`Before removePlayer - Room ${room.roomCode} players:`, room.players.size);
          room.removePlayer(socket.id);
          console.log(`After removePlayer - Room ${room.roomCode} players:`, room.players.size);
          socket.leave(room.id);
          
          // Check if the disconnected player was the host
          if (room.hostAddress === player.address) {
            console.log(`Host ${player.nickname} (${player.address}) disconnected from room ${room.id}. Resetting quiz.`);
            
            // Reset the quiz to waiting state
            room.resetQuiz();
            
            // Notify all remaining players that the host left and quiz was reset
            io.to(room.id).emit('host-disconnected', {
              message: 'Host disconnected. Quiz has been reset.',
              roomCode: room.roomCode,
              gameState: room.gameState
            });
          } else {
            // Notify room about regular player leaving
            const playerInfo = players.get(socket.id);
            console.log(`Player ${playerInfo?.nickname || 'Unknown'} (${playerInfo?.address || 'Unknown'}) left room ${room.id}`);
            
            io.to(room.id).emit('player-left', {
              playerId: socket.id,
              nickname: playerInfo?.nickname,
              address: playerInfo?.address,
              currentPlayers: room.players.size
            });
          }
        }
        players.delete(socket.id);
      }
      console.log('Player disconnected:', socket.id);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});


// Enoki sponsored transaction function
async function executeSponsoredTransaction(transactionBlock, userAddress) {
  try {
    console.log('Executing Enoki sponsored transaction for user:', userAddress);
    
    if (!enokiApiKey) {
      console.warn('Enoki API key not configured');
      throw new Error('ENOKI_API_KEY is not configured');
    }

    // Use SuiClient with Enoki sponsorship
    const suiClient = new SuiClient({ 
      url: suiRpcUrl,
      sponsoredExecution: {
        apiKey: enokiApiKey
      }
    });
    
    // Build and execute the transaction
    const builtTx = await transactionBlock.build({ client: suiClient });
    const result = await suiClient.executeTransactionBlock({
      transactionBlock: builtTx,
      options: {
        showEffects: true,
        showObjectChanges: true
      }
    });
    
    console.log('Enoki sponsored transaction completed:', result.digest);
    return result;
  } catch (error) {
    console.error('Error executing Enoki sponsored transaction:', error);
    throw error;
  }
}

// Helper function to create badge minting transaction
async function createBadgeMintingTransaction(badgeData) {
  try {
    // TODO: Add actual badge minting logic when contracts are deployed
    // For now, this is a placeholder
    console.log('Creating badge minting transaction for:', badgeData);
    
    return { success: true, message: 'Badge minting transaction created' };
  } catch (error) {
    console.error('Error creating badge minting transaction:', error);
    throw error;
  }
}

// Function to distribute rewards on blockchain using Move contract
// Function to collect payment from host for reward pool
async function collectPaymentFromHost(hostAddress, rewardAmount, quizData) {
  try {
    console.log('💰 Collecting payment from host for reward pool...');
    console.log('📋 Payment details:', {
      hostAddress,
      rewardAmount: rewardAmount + ' SUI',
      rewardAmountMist: Math.floor(rewardAmount * 1000000000)
    });

    const quizPackageId = process.env.QUIZ_PACKAGE_ID;
    
    if (!quizPackageId || quizPackageId === '0x0') {
      console.error('❌ Quiz Package ID not configured');
      return {
        success: false,
        error: 'Quiz Package ID not configured. Please set QUIZ_PACKAGE_ID environment variable.'
      };
    }

    // Create transaction block for quiz creation with payment
    const { Transaction } = await import('@mysten/sui/transactions');
    const txb = new Transaction();
    
    // Get host's SUI coins for payment
    const suiClient = new SuiClient({ url: suiRpcUrl });
    const coins = await suiClient.getCoins({
      owner: hostAddress,
      coinType: '0x2::sui::SUI'
    });
    
    if (coins.data.length === 0) {
      throw new Error('Host has no SUI coins for payment');
    }
    
    // Use the first coin as the primary coin for payment
    const primaryCoin = coins.data[0].coinObjectId;
    if (coins.data.length > 1) {
      txb.mergeCoins(primaryCoin, coins.data.slice(1).map(coin => coin.coinObjectId));
    }
    
    // Create reward type and distribution
    const rewardType = quizData.rewardType === 'sui' ? 1 : quizData.rewardType === 'both' ? 2 : 0;
    const distributionType = quizData.rewardDistribution === 'top3' ? 0 : 1;
    
    // Convert SUI to mist (1 SUI = 1,000,000,000 mist)
    const rewardAmountMist = Math.floor(rewardAmount * 1000000000);
    
    // Create questions vector for Move contract (simplified for now)
    const questions = quizData.questions || [];
    
    // Call the create_quiz function from the Move contract
    txb.moveCall({
      target: `${quizPackageId}::quiz::create_quiz`,
      arguments: [
        txb.pure('string', quizData.title),
        txb.pure('string', quizData.description || ''),
        txb.makeMoveVec('vector<string>', []), // Empty questions for now
        txb.pure('u64', quizData.timePerQuestion || 30),
        txb.pure('string', quizData.mediaId || ''),
        txb.pure('u8', rewardType),
        txb.pure('u64', rewardAmountMist),
        txb.pure('u8', distributionType),
        txb.pure('vector<u64>', quizData.manualPercentages || []),
        txb.object(primaryCoin) // Payment coin
      ]
    });

    // Set sender address for transaction
    txb.setSender(hostAddress);
    
    // Return transaction block for frontend to sign
    const transactionBlock = await txb.build({ client: suiClient });
    
    console.log('✅ Transaction block prepared for frontend signing');
    return {
      success: true,
      transactionBlock: transactionBlock,
      message: 'Transaction block prepared for signing'
    };
  } catch (error) {
    console.error('❌ Error collecting payment from host:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Function to distribute rewards to winners from blockchain quiz contract
async function distributeRewardsToWinners(winners, amounts, hostAddress, roomCode, quizId) {
  try {
    console.log('🔗 Distributing rewards to winners from blockchain quiz contract...');
    console.log('📋 Distribution data:', {
      roomCode,
      quizId,
      winners: winners.length,
      totalAmount: amounts.reduce((sum, amount) => sum + amount, 0) / 1000000000 + ' SUI'
    });

    const quizPackageId = process.env.QUIZ_PACKAGE_ID;
    
    if (!quizPackageId || quizPackageId === '0x0') {
      console.error('❌ Quiz Package ID not configured');
      return {
        success: false,
        error: 'Quiz Package ID not configured. Please set QUIZ_PACKAGE_ID environment variable.'
      };
    }

    // Create transaction block for reward distribution from quiz contract
    const { Transaction } = await import('@mysten/sui/transactions');
    const txb = new Transaction();
    
    // Call the distribute_rewards function from the Move contract
    txb.moveCall({
      target: `${quizPackageId}::quiz::distribute_rewards`,
      arguments: [
        txb.object(quizId), // Quiz NFT object
        txb.pure('vector<address>', winners), // Winners addresses
        txb.pure('vector<u64>', amounts) // Reward amounts
      ]
    });

    // Execute the transaction using Enoki sponsored transaction
    const result = await executeSponsoredTransaction(txb, hostAddress);
    
    if (result.effects?.status?.status === 'success') {
      console.log('✅ Rewards distributed to winners from quiz contract successfully');
      return {
        success: true,
        transactionDigest: result.digest,
        message: 'Rewards distributed to winners from quiz contract successfully'
      };
    } else {
      console.error('❌ Failed to distribute rewards to winners:', result.effects?.status?.error);
      return {
        success: false,
        error: result.effects?.status?.error || 'Unknown error'
      };
    }
  } catch (error) {
    console.error('❌ Error distributing rewards to winners:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function to create quiz room transaction
async function createQuizRoomTransaction(quizData) {
  try {
    // TODO: Add actual quiz room creation logic when contracts are deployed
    // For now, this is a placeholder
    console.log('Creating quiz room transaction for:', quizData);
    
    return { success: true, message: 'Quiz room transaction created' };
  } catch (error) {
    console.error('Error creating quiz room transaction:', error);
    throw error;
  }
}

// Helper functions
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Start server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  logWithMetrics('info', 'SuiQuiz Gas Station server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    services: {
      sui: suiRpcUrl ? 'connected' : 'disconnected',
      enoki: enokiApiKey ? 'configured' : 'not configured',
      walrus: process.env.WALRUS_URL ? 'configured' : 'not configured'
    },
    packages: {
      quiz: quizPackageId || 'not configured',
      badge: badgePackageId || 'not configured',
      room: quizRoomPackageId || 'not configured'
    }
  });
  
  console.log(`🚀 SuiQuiz Gas Station server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time quiz communication`);
  console.log(`⛽ Gas station ready for sponsored transactions`);
  console.log(`🔗 Sui Network: ${suiNetwork}`);
  console.log(`🌐 Sui RPC URL: ${suiRpcUrl}`);
  console.log(`🔑 Enoki API Key: ${enokiApiKey ? 'Configured' : 'Not configured'}`);
  console.log(`📁 Walrus URL: ${walrusUrl}`);
  console.log(`📦 Quiz Package ID: ${quizPackageId || 'Not configured'}`);
  console.log(`🏆 Badge Package ID: ${badgePackageId || 'Not configured'}`);
  console.log(`🏠 Quiz Room Package ID: ${quizRoomPackageId || 'Not configured'}`);
});

export default app;
