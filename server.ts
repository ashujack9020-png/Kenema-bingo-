import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { BingoCell, BingoGame, TelegramBotConfig, TelegramLog, Player, DepositRequest, WithdrawRequest } from './src/types.js';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const app = express();
const PORT = 3000;

let lastKnownHost = 'https://ais-pre-ui6a7otpvo25w3htkttohj-51280531867.europe-west1.run.app';

let preUrlActive = false;
let lastCheckTime = 0;
let lastWarningLoggedTime = 0;

async function checkPreUrlActive(): Promise<boolean> {
  const now = Date.now();
  if (now - lastCheckTime < 15000) {
    return preUrlActive;
  }
  lastCheckTime = now;

  if (botSettings.forceSharedPreUrl) {
    preUrlActive = true;
    return true;
  }

  try {
    let preUrl = lastKnownHost;
    if (preUrl.includes('ais-dev-')) {
      preUrl = preUrl.replace('ais-dev-', 'ais-pre-');
    }
    if (preUrl.includes('ais-pre-')) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(preUrl, { 
        method: 'HEAD',
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      preUrlActive = res.status === 200 || res.status === 302;
    } else {
      preUrlActive = true;
    }
  } catch (e) {
    preUrlActive = false;
  }

  const checkNow = Date.now();
  if (!preUrlActive && lastKnownHost.includes('ais-dev-')) {
    if (checkNow - lastWarningLoggedTime > 300000) {
      lastWarningLoggedTime = checkNow;
      addLog('system', 'System', '⚠️ ቴሌግራም ላይ ለመጫወት እባክዎን AI Studio ላይ ሄደው "Share" በተንን በመጫን የህዝብ መጫወቻ ሊንኩን ያንቀሳቅሱ! የህዝብ ሊንክ ገና ስላልተጋራ "Page not found" ሊል ይችላል።');
    }
  }

  return preUrlActive;
}

function getSecureWebAppUrl(): string {
  // Trigger background check to keep preUrlActive fresh
  checkPreUrlActive().catch(() => {});

  let url = lastKnownHost;
  
  // Unconditionally convert dev host to pre host for public sharing (Google login bypass)
  if (url && url.includes('ais-dev-')) {
    url = url.replace('ais-dev-', 'ais-pre-');
  }

  // Fallback to public cloud URL if host is local/invalid for Telegram WebApps
  if (
    !url || 
    url.includes('localhost') || 
    url.includes('127.0.0.1') || 
    url.includes('0.0.0.0') || 
    url.includes('::1')
  ) {
    url = 'https://ais-pre-ui6a7otpvo25w3htkttohj-51280531867.europe-west1.run.app';
  }

  // External sandboxed / Cloud Run URLs must be HTTPS for Telegram WebApp to load
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }

  return url;
}

app.use((req, res, next) => {
  if (req.headers.host) {
    const host = req.headers.host.toLowerCase();
    
    // Log the request to help debug 404s and routing issues
    if (req.url && !req.url.startsWith('/api/logs') && !req.url.startsWith('/api/state')) {
      addLog('system', 'HTTP Request', `${req.method} ${req.url} (Host: ${host})`);
    }

    const isLocal = 
      host.includes('localhost') || 
      host.includes('127.0.0.1') || 
      host.includes('0.0.0.0') || 
      host.includes('::1') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.');

    if (!isLocal) {
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      let candidate = `${protocol}://${req.headers.host}`;
      if (candidate.startsWith('http://')) {
        candidate = candidate.replace('http://', 'https://');
      }
      lastKnownHost = candidate;
      
      if (candidate.includes('ais-pre-')) {
        preUrlActive = true;
      }

      if (botConfig.token && botSettings.botMode === 'webhook') {
        registerWebhookIfNeeded(candidate).catch(err => {
          console.error('Failed to register webhook on request:', err.message);
        });
      }
    }
  }
  next();
});

app.use(express.json());

// User profile mapping for balance tracking (chatId -> user info)
interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  phone?: string;
  balance: number;
  gamesPlayedToday: number;
  totalWins: number;
  weeklyWins: number;
  monthlyWins: number;
  referredBy?: string;
  lastGiftClaim?: number;
  muted?: boolean;
}

const userProfiles = new Map<string, UserProfile>();

// Prepopulate default simulated players so backend balances match the frontend presets initially
userProfiles.set('sim_fitsum_a', { id: 'sim_fitsum_a', username: 'Fitsum_A', firstName: 'ፍጹም', balance: 500, gamesPlayedToday: 0, totalWins: 12, weeklyWins: 3, monthlyWins: 8 });
userProfiles.set('sim_almaz_t', { id: 'sim_almaz_t', username: 'Almaz_T', firstName: 'አልማዝ', balance: 350, gamesPlayedToday: 0, totalWins: 9, weeklyWins: 2, monthlyWins: 5 });
userProfiles.set('sim_yohannes_b', { id: 'sim_yohannes_b', username: 'Yohannes_B', firstName: 'ዮሐንስ', balance: 420, gamesPlayedToday: 0, totalWins: 11, weeklyWins: 4, monthlyWins: 7 });
userProfiles.set('sim_martha_h', { id: 'sim_martha_h', username: 'Martha_H', firstName: 'ማርታ', balance: 150, gamesPlayedToday: 0, totalWins: 4, weeklyWins: 1, monthlyWins: 3 });
userProfiles.set('sim_sara_m', { id: 'sim_sara_m', username: 'Sara_M', firstName: 'ሳራ', balance: 200, gamesPlayedToday: 0, totalWins: 6, weeklyWins: 2, monthlyWins: 4 });

function getMainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: "🎮 Play", web_app: { url: getSecureWebAppUrl() } }],
      [{ text: "💰 Deposit" }, { text: "🏧 Withdraw" }],
      [{ text: "💳 Check Balance" }, { text: "🎁 4-Hour Gift" }],
      [{ text: "📊 Leaderboard" }, { text: "🔊 Sound Settings" }],
      [{ text: "📢 Invite" }, { text: "📘 How To Play" }],
      [{ text: "📞 Contact Us" }]
    ],
    resize_keyboard: true
  };
}

interface BotSettings {
  telebirrNumber: string;
  telebirrName: string;
  cbeAccount: string;
  cbeName: string;
  contactUsername: string;
  welcomeBonus: number;
  referralBonus: number;
  forceSharedPreUrl?: boolean;
  botMode?: 'polling' | 'webhook' | 'disabled';
  productionWebhookUrl?: string;
  telegramBotToken?: string;
}

let botSettings: BotSettings = {
  telebirrNumber: '0991515755',
  telebirrName: 'አሸናፊ (Ashenafi)',
  cbeAccount: '1000528063512',
  cbeName: 'አሸናፊ (Ashenafi)',
  contactUsername: 'ashujack9020',
  welcomeBonus: 10,
  referralBonus: 10,
  forceSharedPreUrl: true,
  botMode: process.env.NODE_ENV === 'production' ? 'webhook' : 'disabled',
  productionWebhookUrl: '',
  telegramBotToken: '',
};

const SETTINGS_FILE = path.join(process.cwd(), 'bot_settings_persistent.json');
const PROFILES_FILE = path.join(process.cwd(), 'user_profiles_persistent.json');
const WITHDRAWALS_FILE = path.join(process.cwd(), 'withdraw_requests_persistent.json');
const DEPOSITS_FILE = path.join(process.cwd(), 'deposit_requests_persistent.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const loaded = JSON.parse(data);
      botSettings = { ...botSettings, ...loaded };
      console.log('Persistent bot settings loaded:', botSettings);
      
      // If a persistent token exists and botConfig is not initialized, load it
      if (botSettings.telegramBotToken && !botConfig.token) {
        botConfig.token = botSettings.telegramBotToken;
      }
    }
  } catch (err: any) {
    console.error('Failed to load persistent bot settings:', err.message);
  }
  
  // Enforce webhook in production to ensure Render always uses webhooks
  if (process.env.NODE_ENV === 'production') {
    botSettings.botMode = 'webhook';
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(botSettings, null, 2), 'utf8');
    console.log('Persistent bot settings saved.');
  } catch (err: any) {
    console.error('Failed to save persistent bot settings:', err.message);
  }
}

function saveProfiles() {
  try {
    const profilesObj = Object.fromEntries(userProfiles);
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profilesObj, null, 2), 'utf8');
  } catch (err: any) {
    console.error('Failed to save persistent profiles:', err.message);
  }
}

function loadProfiles() {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const data = fs.readFileSync(PROFILES_FILE, 'utf8');
      const loaded = JSON.parse(data);
      for (const [key, val] of Object.entries(loaded)) {
        userProfiles.set(key, val as UserProfile);
      }
      console.log('Persistent profiles loaded:', userProfiles.size);
    }
  } catch (err: any) {
    console.error('Failed to load persistent profiles:', err.message);
  }
}

function saveWithdrawals() {
  try {
    fs.writeFileSync(WITHDRAWALS_FILE, JSON.stringify(withdrawRequests, null, 2), 'utf8');
  } catch (err: any) {
    console.error('Failed to save withdrawals:', err.message);
  }
}

function loadWithdrawals() {
  try {
    if (fs.existsSync(WITHDRAWALS_FILE)) {
      const data = fs.readFileSync(WITHDRAWALS_FILE, 'utf8');
      withdrawRequests = JSON.parse(data);
      console.log('Persistent withdrawals loaded:', withdrawRequests.length);
    }
  } catch (err: any) {
    console.error('Failed to load withdrawals:', err.message);
  }
}

function saveDeposits() {
  try {
    fs.writeFileSync(DEPOSITS_FILE, JSON.stringify(depositRequests, null, 2), 'utf8');
  } catch (err: any) {
    console.error('Failed to save deposits:', err.message);
  }
}

function loadDeposits() {
  try {
    if (fs.existsSync(DEPOSITS_FILE)) {
      const data = fs.readFileSync(DEPOSITS_FILE, 'utf8');
      depositRequests = JSON.parse(data);
      console.log('Persistent deposits loaded:', depositRequests.length);
    }
  } catch (err: any) {
    console.error('Failed to load deposits:', err.message);
  }
}

// Initial settings and profiles load
loadSettings();
loadProfiles();

function getUserProfile(chatId: string, username: string, firstName: string): UserProfile {
  let profile = userProfiles.get(chatId);
  if (!profile) {
    const isSimulated = chatId.startsWith('sim_');
    profile = {
      id: chatId,
      username,
      firstName,
      balance: isSimulated ? 500 : botSettings.welcomeBonus, // Simulated bots start with 500 Birr; real players get welcome bonus
      gamesPlayedToday: 0,
      totalWins: isSimulated ? Math.floor(Math.random() * 15) + 3 : 0,
      weeklyWins: 0,
      monthlyWins: 0,
    };
    userProfiles.set(chatId, profile);
    saveProfiles();
  }
  return profile;
}

// Multi-step withdrawal states mapping (chatId -> state)
interface WithdrawalState {
  step: 'select_bank' | 'awaiting_amount' | 'awaiting_account' | 'awaiting_name' | 'awaiting_confirmation';
  bankName?: string;
  amount?: number;
  accountNumber?: string;
  accountName?: string;
}

const userWithdrawalStates = new Map<string, WithdrawalState>();
const userReferralStates = new Map<string, string>(); // chatId -> inviterId (for start parameter ref tracking)

// In-memory withdrawal requests
let withdrawRequests: WithdrawRequest[] = [
  {
    id: 'wd_1',
    chatId: 'sim_almaz_t',
    username: 'Almaz_T',
    firstName: 'አልማዝ',
    amount: 150,
    bankName: 'Commercial Bank of Ethiopia (CBE)',
    accountNumber: '1000123456789',
    accountName: 'አልማዝ ተሰማ',
    status: 'pending',
    timestamp: Date.now() - 3600000 * 3,
  }
];

// In-memory deposit requests
let depositRequests: DepositRequest[] = [
  {
    id: 'dep_1',
    chatId: 'sim_yohannes_b',
    username: 'Yohannes_B',
    firstName: 'ዮሐንስ',
    amount: 100,
    method: 'telebirr',
    screenshotUrl: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60',
    timestamp: Date.now() - 3600000 * 2,
    status: 'pending',
  },
  {
    id: 'dep_2',
    chatId: 'sim_almaz_t',
    username: 'Almaz_T',
    firstName: 'አልማዝ',
    amount: 200,
    method: 'bank',
    screenshotUrl: 'https://images.unsplash.com/photo-1563013544-824ae1d704d3?w=500&auto=format&fit=crop&q=60',
    timestamp: Date.now() - 3600000 * 1,
    status: 'pending',
  },
];

// Load withdrawals and deposits from backup files
loadWithdrawals();
loadDeposits();

// In-memory game state
let gameState: BingoGame = {
  status: 'idle',
  drawnNumbers: [],
  players: [],
  maxPlayers: 400,
  autoDraw: false,
  autoDrawIntervalMs: 5000,
  gameCode: 'BINGO-ETH',
  prizePool: '100 Birr (ብር)',
  createdAt: Date.now(),
  betAmount: 10, // Default stake of 10 Birr
};

let botConfig: TelegramBotConfig = {
  token: process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY' ? '' : (process.env.TELEGRAM_BOT_TOKEN || ''),
  botUsername: 'Bela_Bingo_bot',
  isActive: false,
  error: null,
};

function getSafeState() {
  // Sync players' current profile balances before returning
  gameState.players.forEach(p => {
    const profile = getUserProfile(p.id, p.username, p.firstName);
    p.balance = profile.balance;
  });

  // Return config with masked token for safety
  const safeConfig = {
    ...botConfig,
    token: botConfig.token ? `${botConfig.token.substring(0, 8)}...` : '',
    hasToken: !!botConfig.token,
  };

  return {
    game: gameState,
    config: safeConfig,
    settings: botSettings,
    logs: logs,
    deposits: depositRequests,
    withdrawals: withdrawRequests,
    profiles: Array.from(userProfiles.values()),
    systemTime: new Date().toLocaleString(),
  };
}

const wssClients = new Set<WebSocket>();

function broadcastState() {
  const statePayload = JSON.stringify({ event: 'state_update', data: getSafeState() });
  for (const client of wssClients) {
    if (client.readyState === 1) { // 1 is WebSocket.OPEN
      try {
        client.send(statePayload);
      } catch (err) {
        console.error('Error broadcasting state to client:', err);
      }
    }
  }
}

let logs: TelegramLog[] = [];
let botPollingActive = false;
let pollingTimeout: NodeJS.Timeout | null = null;
let autoDrawInterval: NodeJS.Timeout | null = null;
let currentOffset = 0;

// Log helper
function addLog(type: 'incoming' | 'outgoing' | 'system' | 'error', username: string, message: string) {
  const log: TelegramLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    type,
    username,
    message,
  };
  logs.unshift(log);
  if (logs.length > 150) {
    logs.pop();
  }
  // Real-time broadcast via WebSockets
  broadcastState();
}

// System initial log
addLog('system', 'System', 'Telegram Bingo Engine loaded. Ready for play.');

// Seeded random number generator (Linear Congruential Generator) for reproducible card layouts
function seededRandom(seed: number) {
  let state = seed;
  return function() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Get an available unique card number between 1 and 400 for a joining player
function getAvailableCardNumber(): number {
  const assigned = gameState.players.map(p => p.cardNumber);
  const available: number[] = [];
  for (let i = 1; i <= 400; i++) {
    if (!assigned.includes(i)) {
      available.push(i);
    }
  }
  if (available.length === 0) {
    return Math.floor(Math.random() * 400) + 1;
  }
  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

// Update the dynamic prize pool based on the number of registered players and the stake
function updatePrizePool() {
  const totalStake = gameState.players.length * gameState.betAmount;
  const derash = totalStake * 0.8;
  gameState.prizePool = `${derash > 0 ? derash : (gameState.betAmount * 10)} Birr (ብር)`;
}

// BINGO CARD GENERATION (B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75)
function generateBingoCard(seed?: number): BingoCell[][] {
  const rand = seed !== undefined ? seededRandom(seed) : Math.random;
  const columns: number[][] = [];
  const ranges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ];

  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const available = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    
    // Fisher-Yates Shuffle with custom seeded or unseeded random
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const temp = available[i];
      available[i] = available[j];
      available[j] = temp;
    }
    columns.push(available.slice(0, 5));
  }

  const card: BingoCell[][] = [];
  for (let row = 0; row < 5; row++) {
    const cardRow: BingoCell[] = [];
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        cardRow.push({ value: 0, marked: true }); // center is FREE
      } else {
        cardRow.push({ value: columns[col][row], marked: false });
      }
    }
    card.push(cardRow);
  }
  return card;
}

// BINGO CHECKER (Row, Column, Diagonal, Full House)
function checkBingo(card: BingoCell[][]): { won: boolean; pattern?: string; amhPattern?: string } {
  // Check rows
  for (let r = 0; r < 5; r++) {
    if (card[r].every(cell => cell.marked)) {
      return { won: true, pattern: `Row ${r + 1}`, amhPattern: `አግድም መስመር ${r + 1}` };
    }
  }

  // Check columns
  for (let c = 0; c < 5; c++) {
    let colMarked = true;
    for (let r = 0; r < 5; r++) {
      if (!card[r][c].marked) {
        colMarked = false;
        break;
      }
    }
    if (colMarked) {
      const letters = ['B', 'I', 'N', 'G', 'O'];
      const amhLetters = ['ቢ', 'ን', 'ጎ', 'ፕ', 'ያ'];
      return { won: true, pattern: `Column ${letters[c]}`, amhPattern: `ቀጥታ አምድ ${amhLetters[c]}` };
    }
  }

  // Check main diagonal (top-left to bottom-right)
  let diag1Marked = true;
  for (let i = 0; i < 5; i++) {
    if (!card[i][i].marked) {
      diag1Marked = false;
      break;
    }
  }
  if (diag1Marked) {
    return { won: true, pattern: 'Main Diagonal', amhPattern: 'ማዕዘን መስመር (ግራ ወደ ቀኝ)' };
  }

  // Check anti diagonal (top-right to bottom-left)
  let diag2Marked = true;
  for (let i = 0; i < 5; i++) {
    if (!card[i][4 - i].marked) {
      diag2Marked = false;
      break;
    }
  }
  if (diag2Marked) {
    return { won: true, pattern: 'Anti Diagonal', amhPattern: 'ማዕዘን መስመር (ቀኝ ወደ ግራ)' };
  }

  // Check Full House
  let fullHouse = true;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!card[r][c].marked) {
        fullHouse = false;
        break;
      }
    }
  }
  if (fullHouse) {
    return { won: true, pattern: 'Full House (Blackout)', amhPattern: 'ሙሉ ካርታ (ቶምቦላ)' };
  }

  return { won: false };
}

// Generate text card representation for Telegram monospace formatting
function formatTelegramCard(card: BingoCell[][], cardNumber?: number): string {
  const headers = ['ቢ', 'ን', 'ጎ', 'ፕ', 'ያ'];
  let text = `<b>🎟 የእርስዎ ቢንጎ ካርታ (Your Bingo Card)${cardNumber ? ` - ካርታ ቁጥር ${cardNumber} (#${cardNumber})` : ''}</b>\n\n`;
  text += `<code> ${headers.join('  |  ')} </code>\n`;
  text += `<code>------------------------</code>\n`;
  for (let r = 0; r < 5; r++) {
    const rowStr = card[r].map((cell, col) => {
      if (r === 2 && col === 2) {
        return ' 🆓 ';
      }
      if (cell.marked) {
        return ' 🔴 ';
      }
      return ' ' + cell.value.toString().padStart(2, '0') + ' ';
    }).join('|');
    text += `<code>${rowStr}</code>\n`;
  }
  text += `\n<i>ቁጥሮች ሲወጡ በራሳቸው ምልክት ይደረግባቸዋል (Auto-marked)!</i>\n`;
  text += `<i>አሸናፊ ሲሆኑ <b>/bingo</b> ይበሉ ወይም ከታች ያለውን ቁልፍ ይጫኑ!</i>`;
  return text;
}

// Telegram API Direct Request Helper
async function telegramRequest(method: string, body: any = null) {
  if (!botConfig.token) return null;
  const url = `https://api.telegram.org/bot${botConfig.token}/${method}`;
  try {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.description || `Telegram HTTP ${res.status}`);
    }
    return data.result;
  } catch (err: any) {
    const errorMsg = err.message || '';
    const ignorableErrors = [
      'chat not found',
      'bot was blocked',
      'user is deactivated',
      'peer not found',
      'chat description is not modified',
      'message is not modified',
      'forbidden'
    ];
    const isIgnorable = ignorableErrors.some(msg => 
      errorMsg.toLowerCase().includes(msg)
    );
    if (isIgnorable) {
      console.warn(`Telegram API [${method}] Expected warning (ignored): ${errorMsg}`);
      return null;
    }
    console.error(`Telegram API [${method}] Error:`, errorMsg);
    throw err;
  }
}

// Broadcast message to all Telegram players in the lobby
async function broadcastTelegramMessage(text: string, replyMarkup: any = null) {
  for (const player of gameState.players) {
    if (!player.isSimulated) {
      try {
        await telegramRequest('sendMessage', {
          chat_id: player.id,
          text,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        });
      } catch (e) {
        console.error(`Failed to broadcast to player ${player.id}`);
      }
    }
  }
}

// Start Telegram Bot Long Polling
async function startBotPolling() {
  if (botPollingActive) return;
  if (!botConfig.token) {
    botConfig.isActive = false;
    botConfig.error = 'No token provided';
    return;
  }
  if (botSettings.botMode !== 'polling') {
    addLog('system', 'Bot', `Telegram bot polling is disabled on this instance (Connection Mode is: ${botSettings.botMode}).`);
    return;
  }

  botPollingActive = true;
  botConfig.isActive = true;
  botConfig.error = null;
  addLog('system', 'Bot', 'Connecting to Telegram API via Long Polling...');

  try {
    // Delete any active conflicting webhooks (critical for long polling to work if previously integrated with webhook-based hosts)
    try {
      await telegramRequest('deleteWebhook');
      addLog('system', 'Bot', 'Cleared any conflicting active Telegram webhooks successfully.');
    } catch (whErr: any) {
      console.warn('Non-blocking webhook deletion warn:', whErr.message);
    }

    const me = await telegramRequest('getMe');
    if (me) {
      botConfig.botUsername = me.username;
      addLog('system', 'Bot', `Connected! Bot username: @${me.username}`);

      // Set Chat Menu Button so users have a permanent "Play Bingo" button on the bottom left
      try {
        await telegramRequest('setChatMenuButton', {
          menu_button: {
            type: 'web_app',
            text: '🎯 Play Bingo 🚀',
            web_app: { url: getSecureWebAppUrl() }
          }
        });
        addLog('system', 'Bot', 'Successfully set default Telegram Chat Menu Button.');
      } catch (menuErr: any) {
        console.error('Failed to set chat menu button:', menuErr.message);
        addLog('error', 'Bot', `Warning: Could not set chat menu button: ${menuErr.message}`);
      }
    }
  } catch (err: any) {
    botConfig.isActive = false;
    botConfig.error = err.message;
    botPollingActive = false;
    addLog('error', 'Bot', `Connection failed: ${err.message}`);
    return;
  }

  // Recursive poll
  async function poll() {
    if (!botPollingActive) return;
    try {
      const updates = await telegramRequest('getUpdates', {
        offset: currentOffset,
        timeout: 15,
      });

      if (updates && updates.length > 0) {
        for (const update of updates) {
          currentOffset = update.update_id + 1;
          await handleTelegramUpdate(update);
        }
      }
      pollingTimeout = setTimeout(poll, 200);
    } catch (err: any) {
      const errMsg = err.message || '';
      console.error('Polling cycle error:', errMsg);
      
      const isWebhookConflict = errMsg.includes('webhook is active') || 
                                errMsg.includes('setWebhook') || 
                                errMsg.includes('terminated by setWebhook');
      const isOtherPollingConflict = errMsg.includes('terminated by other getUpdates');
      
      if (isWebhookConflict) {
        botPollingActive = false;
        botConfig.isActive = false;
        botConfig.error = 'Webhook conflict detected (active on another server)';
        addLog('error', 'Bot', 'Conflict Detected: A Webhook is active on another instance (e.g., Render production). Suspending local polling to avoid breaking your production bot. You can switch Bot Mode to webhook or re-enable polling when ready.');
        return;
      }
      
      if (isOtherPollingConflict) {
        botPollingActive = false;
        botConfig.isActive = false;
        botConfig.error = 'Another bot polling instance is running';
        addLog('error', 'Bot', 'Conflict Detected: Another instance is polling. Suspending local polling to avoid conflicts. Please ensure only one developer instance has polling enabled.');
        return;
      }
      
      addLog('error', 'Bot', `Polling interrupted: ${errMsg}. Retrying in 5s...`);
      pollingTimeout = setTimeout(poll, 5000);
    }
  }

  poll();
}

// Stop Telegram Bot Polling
function stopBotPolling() {
  botPollingActive = false;
  botConfig.isActive = false;
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }
  addLog('system', 'Bot', 'Telegram bot polling stopped.');
}

let lastRegisteredWebhookUrl = '';

async function registerWebhookIfNeeded(hostUrl: string) {
  if (!botConfig.token) return;
  if (botSettings.botMode !== 'webhook') return;
  
  // If productionWebhookUrl is specified, use it as priority instead of hostUrl!
  let effectiveHost = (botSettings.productionWebhookUrl && botSettings.productionWebhookUrl.trim()) 
    ? botSettings.productionWebhookUrl.trim() 
    : hostUrl;

  // Ensure it has https:// prefix
  if (effectiveHost && !effectiveHost.startsWith('http://') && !effectiveHost.startsWith('https://')) {
    effectiveHost = `https://${effectiveHost}`;
  }
  if (effectiveHost && effectiveHost.startsWith('http://')) {
    effectiveHost = effectiveHost.replace('http://', 'https://');
  }

  // Skip local addresses and AI Studio authenticated preview URLs
  if (
    !effectiveHost || 
    effectiveHost.includes('localhost') || 
    effectiveHost.includes('127.0.0.1') || 
    effectiveHost.includes('ais-dev-') || 
    effectiveHost.includes('ais-pre-') || 
    effectiveHost.includes('europe-west1.run.app')
  ) {
    return;
  }
  
  const targetWebhookUrl = `${effectiveHost}/api/telegram-webhook`;
  if (lastRegisteredWebhookUrl === targetWebhookUrl) {
    return; // Already registered in this session
  }
  
  lastRegisteredWebhookUrl = targetWebhookUrl;
  addLog('system', 'Bot', `Configuring Telegram Webhook to: ${targetWebhookUrl}`);
  
  try {
    if (botPollingActive) {
      stopBotPolling();
    }
    
    // Set Chat Menu Button and webhook
    const me = await telegramRequest('getMe');
    if (me) {
      botConfig.botUsername = me.username;
      
      // Set webhook
      await telegramRequest('setWebhook', {
        url: targetWebhookUrl,
        allowed_updates: ['message', 'callback_query']
      });
      
      // Set Chat Menu Button so users have a permanent "Play Bingo" button
      try {
        await telegramRequest('setChatMenuButton', {
          menu_button: {
            type: 'web_app',
            text: '🎯 Play Bingo 🚀',
            web_app: { url: `${effectiveHost}` } // use the correct resolved effectiveHost!
          }
        });
      } catch (menuErr: any) {
        console.error('Failed to set chat menu button on webhook:', menuErr.message);
      }
      
      botConfig.isActive = true;
      botConfig.error = null;
      addLog('system', 'Bot', `Telegram Webhook registered successfully for bot @${me.username}!`);
    }
  } catch (err: any) {
    console.error('Failed to register Telegram Webhook:', err.message);
    botConfig.isActive = false;
    botConfig.error = `Webhook registration failed: ${err.message}`;
    addLog('error', 'Bot', `Webhook registration failed: ${err.message}`);
    lastRegisteredWebhookUrl = ''; // Clear so we can retry
  }
}

// Handle Incoming Updates (Messages & Callbacks)
async function handleTelegramUpdate(update: any) {
  try {
    if (update.message) {
      const chat = update.message.chat;
      const user = update.message.from;
      const username = user.username || `${user.first_name}_${user.id}`;

      if (update.message.contact) {
        // Handle contact registration
        const contact = update.message.contact;
        const chatId = contact.user_id ? contact.user_id.toString() : chat.id.toString();
        const phone = contact.phone_number;

        if (contact.user_id && contact.user_id.toString() !== user.id.toString()) {
          await telegramRequest('sendMessage', {
            chat_id: chat.id.toString(),
            text: '❌ <b>ስህተት!</b> እባክዎ የእራስዎን ስልክ ቁጥር ያጋሩ።',
            parse_mode: 'HTML'
          });
          return;
        }

        const profile = getUserProfile(chatId, username, user.first_name);
        const isFirstTime = !profile.phone;
        profile.phone = phone;

        addLog('incoming', username, `[Shared Contact: ${phone}]`);

        let welcomeBonusMsg = '';
        if (isFirstTime) {
          profile.balance += botSettings.welcomeBonus; // registration bonus
          welcomeBonusMsg = `🎁 የ <b>${botSettings.welcomeBonus.toFixed(2)} ETB</b> መመዝገቢያ ቦነስ በነፃ ተሰጥቶዎታል።\n\n`;

          // Check if user was referred
          const inviterId = userReferralStates.get(chatId);
          if (inviterId && inviterId !== chatId) {
            const inviterProfile = userProfiles.get(inviterId);
            if (inviterProfile) {
              inviterProfile.balance += botSettings.referralBonus; // to inviter!
              addLog('system', 'Referral', `Referral Bonus: ${inviterProfile.firstName} received ${botSettings.referralBonus} ETB for inviting ${profile.firstName}.`);
              try {
                await telegramRequest('sendMessage', {
                  chat_id: inviterId,
                  text: `📢 <b>አዲስ ሰው በሊንክዎ ተመዝግቧል!</b>\n🎁 የ <b>+${botSettings.referralBonus.toFixed(2)} ETB</b> የግብዣ ቦነስ ተሰጥቶዎታል።`,
                  parse_mode: 'HTML'
                });
              } catch (e) {
                console.error('Failed to notify inviter:', e);
              }
            }
            userReferralStates.delete(chatId);
          }
        }

        saveProfiles();

        await telegramRequest('sendMessage', {
          chat_id: chat.id.toString(),
          text: `✅ <b>ምዝገባዎ በተሳካ ሁኔታ ተጠናቋል!</b>\n\n${welcomeBonusMsg}🏆 ዋና ማውጫ። የፈለጉትን ምርጫ ይጫኑ👇`,
          parse_mode: 'HTML',
          reply_markup: getMainMenuKeyboard()
        });
        return;
      }

      if (update.message.photo) {
        // Handle CBE CBE / Telebirr transaction screenshots
        const caption = update.message.caption || '';
        const cbeMatch = caption.toUpperCase().match(/\b(FT\d{9,15})\b/);
        const telebirrMatch = caption.toUpperCase().match(/\b([A-Z0-9]{10,12})\b/);
        const txnId = cbeMatch ? cbeMatch[1] : (telebirrMatch ? telebirrMatch[1] : `TXN${Math.floor(Math.random() * 9000000) + 1000000}`);

        const amountMatch = caption.match(/\b\d+\b/);
        const amount = amountMatch ? parseFloat(amountMatch[0]) : 100; // default to 100 if not specified
        const isBank = caption.toLowerCase().includes('bank') || caption.toLowerCase().includes('cbe') || caption.includes('ባንክ');
        const method = isBank ? 'bank' : 'telebirr';

        const photoArray = update.message.photo;
        const largestPhoto = photoArray[photoArray.length - 1];
        const fileId = largestPhoto.file_id;

        let screenshotUrl = 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60';
        try {
          const fileData = await telegramRequest('getFile', { file_id: fileId });
          if (fileData && fileData.file_path) {
            screenshotUrl = `https://api.telegram.org/file/bot${botConfig.token}/${fileData.file_path}`;
          }
        } catch (e) {
          console.error('Error getting Telegram file:', e);
        }

        const depId = 'dep_' + Math.random().toString(36).substring(2, 9);
        const newDep: DepositRequest = {
          id: depId,
          chatId: chat.id.toString(),
          username,
          firstName: user.first_name,
          amount,
          method,
          screenshotUrl,
          smsText: caption || undefined,
          transactionId: txnId || undefined,
          timestamp: Date.now(),
          status: 'pending',
        };
        depositRequests.unshift(newDep);
        saveDeposits();

        addLog('incoming', username, `[Sent Photo: ${amount} Birr via ${method}, Txn ID: ${txnId}]`);

        const replyMsg = `📥 <b>የደረሰኝ ፎቶ ደርሶናል!</b>\n\n` +
          `👤 <b>ስም:</b> ${user.first_name}\n` +
          `💰 <b>የብር መጠን:</b> ${amount} Birr\n` +
          `🔑 <b>የግብይት ቁጥር (Txn ID):</b> <code>${txnId}</code>\n` +
          `💳 <b>የአከፋፈል ዘዴ:</b> ${method === 'telebirr' ? 'Telebirr' : 'Commercial Bank'}\n\n` +
          `⏳ አስተዳዳሪው ደረሰኝዎን አረጋግጦ ሂሳብዎን እስኪጨምርልዎ ድረስ እባክዎ ጥቂት ደቂቃዎችን ይጠብቁ።`;

        await telegramRequest('sendMessage', {
          chat_id: chat.id.toString(),
          text: replyMsg,
          parse_mode: 'HTML',
        });
      } else if (update.message.text) {
        const text = update.message.text.trim();
        addLog('incoming', username, text);
        await processCommand(chat.id.toString(), username, user.first_name, text);
      }
    } else if (update.callback_query) {
      const callback = update.callback_query;
      const chat_id = callback.message.chat.id.toString();
      const user = callback.from;
      const username = user.username || `${user.first_name}_${user.id}`;
      const data = callback.data;

      addLog('incoming', username, `[Callback Action: ${data}]`);

      try {
        await telegramRequest('answerCallbackQuery', {
          callback_query_id: callback.id,
        });
      } catch (e) {}

      if (data === 'view_card') {
        await processCommand(chat_id, username, user.first_name, '/card');
      } else if (data === 'claim_bingo') {
        await processCommand(chat_id, username, user.first_name, '/bingo');
      } else if (data === 'sound_on') {
        const profile = getUserProfile(chat_id, username, user.first_name);
        profile.muted = false;
        await telegramRequest('sendMessage', { chat_id, text: '🔊 <b>ድምፅ በራስ-ሰር በርቷል (Sound Unmuted)!</b> ቁጥር ሲጠራ ድምፅ ይሰማል!', parse_mode: 'HTML' });
      } else if (data === 'sound_off') {
        const profile = getUserProfile(chat_id, username, user.first_name);
        profile.muted = true;
        await telegramRequest('sendMessage', { chat_id, text: '🔕 <b>ድምፅ አልባ ሆኗል (Sound Muted)!</b> ቁጥር ሲጠራ አይረብሽዎትም!', parse_mode: 'HTML' });
      }
    }
  } catch (err: any) {
    addLog('error', 'Engine', `Error handling update: ${err.message}`);
  }
}

// CORE BINGO BOT LOGIC (Reusable for real Telegram and simulator UI)
async function processCommand(chatId: string, username: string, firstName: string, text: string): Promise<string> {
  const cleanText = text.trim();
  const lowerText = cleanText.toLowerCase();
  const command = lowerText.split(' ')[0];

  const inlineButtons = {
    inline_keyboard: [
      [
        { text: '🎟 View Card (ካርታዬ)', callback_data: 'view_card' },
        { text: '📢 Claim BINGO! (ቢንጎ!)', callback_data: 'claim_bingo' }
      ]
    ]
  };

  const isSim = chatId.startsWith('sim_');
  const profile = getUserProfile(chatId, username, firstName);

  // 1. Force Registration Safeguard (Skip for simulated/virtual players)
  if (!profile.phone && !isSim) {
    // If we're not running /start, force them to do start/register first
    const isStartCommand = command === '/start';
    if (isStartCommand) {
      const parts = cleanText.split(' ');
      if (parts.length > 1) {
        const refPayload = parts[1];
        const inviterId = refPayload.replace('ref_', '');
        if (inviterId && inviterId !== chatId) {
          userReferralStates.set(chatId, inviterId);
        }
      }
    }

    const guardText = `⚠️ <b>ደህንነትን ለማረጋገጥ እና ማጭበርበርን ለመከላከል፦</b>\n\n` +
      `እባክዎ መጀመሪያ ታች ያለውን <b>'📱 ስልክ ቁጥርዎን ያጋሩ (Share Contact)'</b> የሚለውን ቁልፍ ተጭነው ይመዝገቡ።\n\n` +
      `🎁 እንደገቡ የ <b>${botSettings.welcomeBonus.toFixed(2)} ETB</b> መመዝገቢያ ቦነስ በነፃ ያገኛሉ!`;

    await telegramRequest('sendMessage', {
      chat_id: chatId,
      text: guardText,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: "📱 ስልክ ቁጥርዎን ያጋሩ (Share Contact)", request_contact: true }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return guardText;
  }

  // 2. Active Withdrawal Multi-Step Flow Processing
  const wdState = userWithdrawalStates.get(chatId);
  if (wdState) {
    if (cleanText === '❌ ሰርዝ' || lowerText === '/cancel') {
      userWithdrawalStates.delete(chatId);
      const cancelMsg = '❌ የገንዘብ ማውጣት ሂደት ተሰርዟል።';
      await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: cancelMsg,
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard()
      });
      return cancelMsg;
    }

    if (wdState.step === 'select_bank') {
      const allowedBanks = ['Telebirr', 'Commercial Bank of Ethiopia (CBE)', 'Dashen Bank', 'Awash Bank'];
      const matchedBank = allowedBanks.find(b => b.toLowerCase().includes(lowerText) || lowerText.includes(b.toLowerCase()));
      
      if (!matchedBank && !allowedBanks.includes(cleanText)) {
        await telegramRequest('sendMessage', {
          chat_id: chatId,
          text: '⚠️ እባክዎ ከታች ካሉት የባንክ አማራጮች አንዱን ይምረጡ ወይም ለመሰረዝ \'❌ ሰርዝ\' የሚለውን ይጫኑ👇',
          parse_mode: 'HTML'
        });
        return 'Invalid bank choice';
      }

      wdState.bankName = matchedBank || cleanText;
      wdState.step = 'awaiting_amount';
      const promptMsg = `🏦 <b>የተመረጠው ባንክ:</b> ${wdState.bankName}\n\n` +
        `እባክዎ ማውጣት የሚፈልጉትን የብር መጠን ያስገቡ👇\n` +
        `• ዝቅተኛው ማውጫ፦ <code>100 Birr</code>\n` +
        `• የእርስዎ ከፍተኛ ማውጫ፦ <code>${profile.balance} Birr</code>`;

      await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: promptMsg,
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [[{ text: '❌ ሰርዝ' }]],
          resize_keyboard: true
        }
      });
      return promptMsg;
    }

    if (wdState.step === 'awaiting_amount') {
      const amount = parseFloat(cleanText);
      if (isNaN(amount) || amount < 100 || amount > profile.balance) {
        const errorMsg = `❌ <b>ስህተት!</b> ያስገቡት መጠን ከተፈቀደው ውጭ ነው።\n` +
          `• ዝቅተኛው ማውጫ፦ <code>100 Birr</code>\n` +
          `• የእርስዎ ከፍተኛ ማውጫ፦ <code>${profile.balance} Birr</code>\n\n` +
          `እባክዎ ትክክለኛ መጠን በቁጥር ብቻ ያስገቡ👇`;
        await telegramRequest('sendMessage', {
          chat_id: chatId,
          text: errorMsg,
          parse_mode: 'HTML'
        });
        return errorMsg;
      }

      wdState.amount = amount;
      wdState.step = 'awaiting_account';
      const promptMsg = `✅ እሺ! በመቀጠል ገንዘቡ የሚገባበትን <b>የባንክ አካውንት ቁጥር (Account Number)</b> ያስገቡ👇`;
      await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: promptMsg,
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [[{ text: '❌ ሰርዝ' }]],
          resize_keyboard: true
        }
      });
      return promptMsg;
    }

    if (wdState.step === 'awaiting_account') {
      wdState.accountNumber = cleanText;
      wdState.step = 'awaiting_name';
      const promptMsg = `✅ እሺ! በመጨረሻም የባንክ አካውንቱ ባለቤት <b>ሙሉ ስም (Account Holder Name)</b> ያስገቡ👇`;
      await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: promptMsg,
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [[{ text: '❌ ሰርዝ' }]],
          resize_keyboard: true
        }
      });
      return promptMsg;
    }

    if (wdState.step === 'awaiting_name') {
      wdState.accountName = cleanText;
      wdState.step = 'awaiting_confirmation';

      const confirmMsg = `📝 <b>እባክዎ መረጃዎን በድጋሚ ያረጋግጡ፦</b>\n\n` +
        `🏦 <b>ባንክ፦</b> <code>${wdState.bankName}</code>\n` +
        `💰 <b>የብር መጠን፦</b> <code>${wdState.amount} Birr</code>\n` +
        `💳 <b>አካውንት ቁጥር፦</b> <code>${wdState.accountNumber}</code>\n` +
        `👤 <b>የባለቤት ስም፦</b> <code>${wdState.accountName}</code>\n\n` +
        `ያስተላለፉት መረጃ ትክክል ከሆነ '✅ አረጋግጣለሁ' የሚለውን ይጫኑ👇`;

      await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: confirmMsg,
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [{ text: '✅ አረጋግጣለሁ' }],
            [{ text: '❌ ሰርዝ' }]
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      });
      return confirmMsg;
    }

    if (wdState.step === 'awaiting_confirmation') {
      if (cleanText === '✅ አረጋግጣለሁ') {
        const amount = wdState.amount!;
        profile.balance -= amount;

        const wdId = 'wd_' + Math.random().toString(36).substring(2, 9);
        const newWd: WithdrawRequest = {
          id: wdId,
          chatId,
          username,
          firstName,
          amount,
          bankName: wdState.bankName!,
          accountNumber: wdState.accountNumber!,
          accountName: wdState.accountName!,
          status: 'pending',
          timestamp: Date.now()
        };

        withdrawRequests.unshift(newWd);
        saveWithdrawals();
        saveProfiles();

        userWithdrawalStates.delete(chatId);

        addLog('system', 'Withdrawal', `Withdrawal Requested: ${firstName} (@${username}) requested ${amount} Birr to ${wdState.bankName}`);

        const successMsg = `✅ <b>የገንዘብ ማውጫ ጥያቄዎ በተሳካ ሁኔታ ቀርቧል!</b>\n\n` +
          `⏳ አስተዳዳሪው ጥያቄዎን አይቶ በባንክ በኩል በደቂቃዎች ውስጥ ብር ይልክልዎታል። ገንዘቡ ሲላክ የቴሌግራም መልእክት ይደርስዎታል።\n` +
          `💳 <b>የቀረው ሂሳብዎ:</b> <code>${profile.balance} Birr</code>`;

        await telegramRequest('sendMessage', {
          chat_id: chatId,
          text: successMsg,
          parse_mode: 'HTML',
          reply_markup: getMainMenuKeyboard()
        });
        return successMsg;
      }
    }
  }

  // 2.5 Admin Secure Panel Commands
  if (command === '/admin' || command === '/finance' || command === '/control' || lowerText === 'አስተዳዳሪ' || lowerText === 'ፊናንስ') {
    const isAdmin = username.toLowerCase() === botSettings.contactUsername.toLowerCase() || username.toLowerCase() === 'ashujack9020';
    if (!isAdmin) {
      const accessDeniedMsg = `❌ <b>ይቅርታ ${firstName}!</b> ይህ ትዕዛዝ ለዋናው አስተዳዳሪ (@${botSettings.contactUsername}) ብቻ የተፈቀደ ነው።`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: accessDeniedMsg, parse_mode: 'HTML' });
      return accessDeniedMsg;
    }

    const adminWebAppUrl = getSecureWebAppUrl() + "?admin_pin=kenema009020";
    const adminPanelMsg = `🔑 <b>የቢንጎ አስተዳዳሪ መቆጣጠሪያ ሰሌዳ (Bela Bingo Admin Control Board)</b> 🔑\n\n` +
      `ሰላም ዋናው አስተዳዳሪ <b>${firstName}</b>!\n\n` +
      `የተጫዋቾችን ሂሳብ ለመሙላት (Deposit)፣ ገንዘብ ለመላክ (Withdraw)፣ ወይም ጨዋታዎችን ለመቆጣጠር ከታች ያሉትን አማራጮች ይጠቀሙ👇\n\n` +
      `🔗 <b>በቀጥታ ያለ ፒን ለመግባት (Direct Login Link):</b>\n<a href="${adminWebAppUrl}">👉 እዚህ በመጫን የአስተዳዳሪ ሰሌዳውን ይክፈቱ 👈</a>\n\n` +
      `📌 <b>በስልክ መተግበሪያ ላይ ለመግባት፦</b>\n` +
      `1️⃣ መጫወቻውን (Open WebApp) ይክፈቱ\n` +
      `2️⃣ በሞባይል ስክሪኑ ላይ ከላይ በስተግራ ያለውን የሰዓት ምልክት 🔒 <b>'13:57'</b> ይንኩ\n` +
      `3️⃣ ይህንን ሚስጥር ቁጥር ያስገቡ፦ <code>kenema009020</code>\n\n` +
      `<i>ማሳሰቢያ: አንዴ በስልክዎ ወይም በኮምፒተርዎ ከገቡ በኋላ የይለፍ ቃሉ በራሱ ስለሚቀመጥ ሁልጊዜ ሚስጥር ቁጥሩን ማስገባት አይጠበቅብዎትም! ✨</i>`;

    await telegramRequest('sendMessage', {
      chat_id: chatId,
      text: adminPanelMsg,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 መቆጣጠሪያ ሰሌዳ (Open Admin WebApp) 🚀', web_app: { url: adminWebAppUrl } }
          ]
        ]
      }
    });
    return adminPanelMsg;
  }

  // 3. Regular Commands & Text Menu Router
  if (command === '/start' || command === '/help' || lowerText.includes('help') || lowerText === 'እገዛ') {
    let activeWarning = '';
    if (!preUrlActive) {
      activeWarning = `💡 <b>ጠቃሚ ማሳሰቢያ ለአስተዳዳሪው፦</b> የቴሌግራም ዌብአፕ <b>ያለ ምንም የጉግል አካውንት (Google Account) ቀጥታ እንዲሰራ</b> ለመፍቀድ፦\n` +
        `1️⃣ እባክዎ Google AI Studio ገጽ ላይ ይሂዱ\n` +
        `2️⃣ ከላይ በስተቀኝ ያለውን <b>'Share' (ማጋራት)</b> ቁልፍን ይጫኑ\n` +
        `ይህንን ሲያደርጉ የህዝብ መጫወቻ ሊንክ ስለሚበራ ያለ ምንም መግቢያ ቀጥታ ወደ ብር መምረጫው ያስገባዎታል! ✨\n\n`;
    }

    const welcomeMsg = activeWarning +
      `<b>ሰላም ${firstName}! ወደ ቢንጎ ቴሌግራም ቦት በደህና መጡ! 🎲</b>\n` +
      `<i>Welcome to the Ethiopian Telegram Bingo Bot!</i>\n\n` +
      `<b>የቦት ምርጫዎች (Bot Options):</b>\n` +
      `🎮 <b>Play</b> - ጨዋታውን ለመቀላቀል\n` +
      `💰 <b>Deposit</b> - ሂሳብ ለመሙላት (Telebirr/CBE)\n` +
      `🏧 <b>Withdraw</b> - ገንዘብ ለማውጣት\n` +
      `💳 <b>Check Balance</b> - ቀሪ ሂሳብ ለማየት\n` +
      `🎁 <b>4-Hour Gift</b> - በየ 4 ሰዓቱ ነፃ ቦነስ ለመውሰድ\n` +
      `📊 <b>Leaderboard</b> - ከፍተኛ አሸናፊዎችን ለማየት\n` +
      `🔊 <b>Sound Settings</b> - ድምፅ ለማስተካከል\n` +
      `📢 <b>Invite</b> - ሰዎችን ጋብዘው 10 ብር ለማግኘት\n` +
      `📘 <b>How To Play</b> - እንዴት እንደሚጫወቱ ለማንበብ\n` +
      `📞 <b>Contact Us</b> - አስተዳዳሪን ለማነጋገር\n\n` +
      `💰 <b>የጨዋታው መክፈያ (Stake):</b> <code>${gameState.betAmount} Birr</code>\n` +
      `💳 <b>የእርስዎ ሂሳብ (Balance):</b> <code>${profile.balance} Birr</code>\n` +
      `🏆 <b>የሽልማት ገንዳ (Prize Pool):</b> <code>${gameState.prizePool}</code>\n\n` +
      `<i>እባክዎ ከታች ያሉትን ቁልፎች ተጭነው ማውጫዎችን ይጠቀሙ👇</i>`;

    await telegramRequest('sendMessage', {
      chat_id: chatId,
      text: welcomeMsg,
      parse_mode: 'HTML',
      reply_markup: getMainMenuKeyboard()
    });
    return welcomeMsg;
  }

  if (lowerText === '💳 check balance' || command === '/balance' || lowerText === 'ባላንስ' || lowerText === 'ሂሳብ') {
    const balMsg = `💰 <b>የአሁኑ ሂሳብዎ (Your Balance):</b>\n\n` +
      `👤 <b>ተጠቃሚ:</b> ${firstName} (@${username})\n` +
      `💵 <b>ሂሳብ:</b> <code>${profile.balance} Birr (ብር)</code>\n\n` +
      `📥 ሂሳብ ለመሙላት <b>'💰 Deposit'</b> የሚለውን ይጫኑ!`;
    await telegramRequest('sendMessage', { chat_id: chatId, text: balMsg, parse_mode: 'HTML' });
    return balMsg;
  }

  if (lowerText === '💰 deposit' || command === '/deposit' || lowerText === 'መሙያ' || lowerText === 'ዲፖዚት') {
    const depInstructions = `💰 <b>የቢንጎ መጫወቻ ብር ማስገቢያ መመሪያ (Deposit Instructions)</b> 💰\n\n` +
      `የካርድ መግዣ ብር በሚከተሉት የባንክ አካውንቶች ያስገቡ👇\n\n` +
      `📱 <b>በቴሌብር (Telebirr)፦</b>\n• ቁጥር፦ <code>${botSettings.telebirrNumber}</code> — ስም፦ ${botSettings.telebirrName}\n\n` +
      `🏦 <b>በንግድ ባንክ (CBE)፦</b>\n• አካውንት፦ <code>${botSettings.cbeAccount}</code> — ስም፦ ${botSettings.cbeName}\n\n` +
      `📢 <b>አስፈላጊ ማስታወሻ:</b>\n` +
      `ብር ካስተላለፉ በኋላ <b>የደረሰኝ ፎቶ (Screenshot)</b> እዚህ ቦት ላይ ይላኩ። ፎቶውን ሲልኩ በጽሁፉ (caption) ላይ የላኩትን የብር መጠን ቁጥር ብቻ ይጻፉ (ለምሳሌ: <code>100</code>)።\n\n` +
      `አስተዳዳሪው ሲያረጋግጥ በደቂቃዎች ውስጥ ሂሳብዎ ይሞላል!`;
    await telegramRequest('sendMessage', { chat_id: chatId, text: depInstructions, parse_mode: 'HTML' });
    return depInstructions;
  }

  if (lowerText === '🏧 withdraw' || command === '/withdraw' || lowerText === 'ዊዝድሮው' || lowerText === 'ማውጫ') {
    userWithdrawalStates.set(chatId, { step: 'select_bank' });
    const promptMsg = `🏧 <b>የገንዘብ ማውጫ ፎርም (Withdrawal Form)</b>\n\n` +
      `💰 <b>የእርስዎ ሂሳብ:</b> <code>${profile.balance} Birr</code>\n` +
      `• ዝቅተኛው ማውጫ፦ <code>100 Birr</code>\n\n` +
      `እባክዎ ገንዘቡ የሚገባበትን የባንክ አማራጭ ከታች ይምረጡ👇`;

    await telegramRequest('sendMessage', {
      chat_id: chatId,
      text: promptMsg,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: 'Telebirr' }, { text: 'Commercial Bank of Ethiopia (CBE)' }],
          [{ text: 'Dashen Bank' }, { text: 'Awash Bank' }],
          [{ text: '❌ ሰርዝ' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
    return promptMsg;
  }

  if (
    lowerText === '🎁 4-hour gift' || 
    lowerText === '4-hour gift' || 
    command === '/gift' || 
    lowerText === 'ስጦታ' || 
    lowerText === 'እድል' || 
    lowerText === 'ዕድል' || 
    lowerText === 'ቦነስ'
  ) {
    const now = Date.now();
    if (profile.lastGiftClaim && (now - profile.lastGiftClaim < 4 * 3600 * 1000)) {
      const diff = (4 * 3600 * 1000) - (now - profile.lastGiftClaim);
      const hoursLeft = Math.floor(diff / (3600 * 1000));
      const minutesLeft = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
      const timeStr = hoursLeft > 0 ? `${hoursLeft} ሰዓት ከ ${minutesLeft} ደቂቃ` : `${minutesLeft} ደቂቃ`;

      const limitMsg = `❌ <b>ይቅርታ ${firstName}!</b> የ 4 ሰዓት ልዩ ስጦታዎን ቀድመው ወስደዋል። በድጋሚ ለመውሰድ <b>${timeStr}</b> ይቀረዎታል።`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: limitMsg, parse_mode: 'HTML' });
      return limitMsg;
    }

    profile.balance += 10.0;
    profile.lastGiftClaim = now;
    saveProfiles();
    addLog('system', 'Gift', `Gift Claimed: ${firstName} (@${username}) claimed 10 Birr gift.`);

    const giftMsg = `🎉 <b>እንኳን ደስ አለዎት ${firstName}!</b> 🎉\n` +
      `🎁 የ 4 ሰዓት ልዩ ስጦታዎ ተለቋል!\n` +
      `💰 <b>+10.00 ETB</b> በነፃ ወደ ሂሳብዎ ተጨምሯል!\n` +
      `💳 <b>የአሁኑ ቀሪ ሂሳብዎ:</b> <code>${profile.balance} Birr</code>`;

    await telegramRequest('sendMessage', { chat_id: chatId, text: giftMsg, parse_mode: 'HTML' });
    return giftMsg;
  }

  if (lowerText === '📊 leaderboard' || command === '/leaderboard' || lowerText === 'ደረጃ') {
    const profilesArray = Array.from(userProfiles.values());
    profilesArray.sort((a, b) => (b.totalWins || 0) - (a.totalWins || 0));
    const topPlayers = profilesArray.slice(0, 5);

    let boardText = `📊 🏆 <b>የቢንጎ ከፍተኛ አሸናፊዎች ሰሌዳ (Leaderboard)</b> 🏆 📊\n\n`;
    boardText += `🥇 <b>በቀን / በጠቅላላ ብዙ የበሉ፦</b>\n`;

    if (topPlayers.length === 0) {
      boardText += `<i>እስካሁን ምንም አሸናፊ አልተመዘገበም!</i>\n`;
    } else {
      topPlayers.forEach((p, idx) => {
        boardText += `${idx + 1}. @${p.username || p.firstName} — <code>${p.totalWins || 0} ጊዜ</code> 🏆\n`;
      });
    }

    await telegramRequest('sendMessage', { chat_id: chatId, text: boardText, parse_mode: 'HTML' });
    return boardText;
  }

  if (lowerText === '🔊 sound settings' || command === '/sound' || lowerText === 'ድምጽ') {
    profile.muted = !profile.muted;
    const statusStr = profile.muted ? "🔕 ድምፅ አልባ (Muted)" : "🔊 በድምፅ (Unmuted)";
    addLog('system', 'Config', `Player ${firstName} changed sound: ${statusStr}`);

    const soundMsg = `🔊 <b>የድምፅ ማስተካከያ (Sound Settings)</b>\n\n` +
      `የድምፅ ሁኔታዎ ወደ <b>${statusStr}</b> ተቀይሯል! ቁጥር ሲጠራ ድምፅ እንዳይረብሽዎት ማድረግ ይችላሉ።`;
    await telegramRequest('sendMessage', { chat_id: chatId, text: soundMsg, parse_mode: 'HTML' });
    return soundMsg;
  }

  if (lowerText === '📢 invite' || command === '/invite' || lowerText === 'ጋብዝ') {
    const botName = botConfig.botUsername || 'Bela_Bingo_bot';
    const refLink = `https://t.me/${botName}?start=ref_${chatId}`;

    const inviteText = `📢 <b>ሰዎችን ይጋብዙ - ብር ያግኙ!</b> 📢\n\n` +
      `የእርስዎን መጋበዣ ሊንክ ለጓደኞችዎ በማጋራት አዲስ ሰዎችን ይጋብዙ。\n` +
      `🎯 እያንዳንዱ ሊንክዎን ተጭኖ የሚመዘገብ <b>አዲስ ሰው +${botSettings.referralBonus.toFixed(2)} ETB</b> በነፃ ወደ ሂሳብዎ ያስገኝልዎታል!\n\n` +
      `🔗 <b>የእርስዎ መጋበዣ ሊንክ👇</b>\n<code>${refLink}</code>`;

    await telegramRequest('sendMessage', { chat_id: chatId, text: inviteText, parse_mode: 'HTML' });
    return inviteText;
  }

  if (lowerText === '📘 how to play' || command === '/howtoplay' || lowerText === 'መመሪያ') {
    const manualMsg = `📘 <b>የቢንጎ አጫዋች መመሪያ (How to Play Bingo)</b>\n\n` +
      `1️⃣ በመጀመሪያ <b>/join</b> ወይም '🎮 Play' የሚለውን ቁልፍ ተጭነው ዙሩን ይቀላቀሉ። ለዚህም የ <code>${gameState.betAmount} Birr</code> መወራረቢያ ያስፈልግዎታል\n` +
      `2️⃣ ጨዋታው ሲጀመር ቦቱ በየ 5 ሰከንዱ የዕጣ ቁጥሮችን በራስ-ሰር ማውጣት ይጀምራል\n` +
      `3️⃣ በእርስዎ የ 5x5 ካርታ ላይ የወጡት ቁጥሮች በራስ-ሰር ምልክት ይደረግባቸዋል (Auto-marked)\n` +
      `4️⃣ ማንኛውም መስመር (አግድም፣ ቀጥታ፣ ወይም ማዕዘን መስመር) ሲሞላልዎ ወዲያውኑ <b>/bingo</b> በመጻፍ ወይም 'Claim BINGO!' የሚለውን በመጫን ድልዎን ያውጁ!\n\n` +
      `🏆 🥇 አንደኛ የወጣው ተጫዋች <b>የሽልማቱን 80% (Derash)</b> ወዲያውኑ ወደ አካውንቱ ያገኛል!`;

    await telegramRequest('sendMessage', { chat_id: chatId, text: manualMsg, parse_mode: 'HTML' });
    return manualMsg;
  }

  if (lowerText === '📞 contact us' || command === '/contact' || lowerText === 'አድራሻ') {
    const contactMsg = `📞 <b>አስተዳዳሪ ማነጋገርያ (Contact Support)</b>\n\n` +
      `ማንኛውም የክፍያ ስህተት፣ የገንዘብ ማውጣት ወይም የጨዋታ ጥያቄ ሲኖርዎት ዋናውን አስተዳዳሪ ማነጋገር ይችላሉ👇\n\n` +
      `👤 <b>አስተዳዳሪ:</b> @${botSettings.contactUsername}\n` +
      `💬 <b>የእገዛ መስመር:</b> 24/7 ሰዓት ዝግጁ ነን!`;
    await telegramRequest('sendMessage', { chat_id: chatId, text: contactMsg, parse_mode: 'HTML' });
    return contactMsg;
  }

  if (
    command === '/join' || 
    command === '/play' || 
    command === 'ቀላቅል' || 
    command === 'play' || 
    lowerText === 'play' || 
    lowerText === '🎮 play' || 
    lowerText.includes('play') || 
    lowerText.includes('ቀላቅል') ||
    lowerText.startsWith('play') || 
    lowerText.startsWith('/play') || 
    lowerText.startsWith('ቀላቅል') ||
    lowerText.startsWith('🎮 play')
  ) {
    // Check if a specific card number is requested (e.g. /join 137 or play 137)
    let requestedCardNumber: number | null = null;
    const parts = cleanText.split(' ');
    if (parts.length > 1) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 400) {
        requestedCardNumber = parsed;
      }
    }

    // If no card number was requested directly, show the gorgeous interactive WebApp button!
    if (requestedCardNumber === null) {
      let activeWarning = '';
      if (!preUrlActive) {
        activeWarning = `💡 <b>ጠቃሚ ማሳሰቢያ ለአስተዳዳሪው፦</b> የቴሌግራም ዌብአፕ <b>ያለ ምንም የጉግል አካውንት (Google Account) ቀጥታ እንዲሰራ</b> ለመፍቀድ፦\n` +
          `1️⃣ እባክዎ Google AI Studio ገጽ ላይ ይሂዱ\n` +
          `2️⃣ ከላይ በስተቀኝ ያለውን <b>'Share' (ማጋራት)</b> ቁልፍን ይጫኑ\n` +
          `ይህንን ሲያደርጉ የህዝብ መጫወቻ ሊንክ ስለሚበራ ያለ ምንም መግቢያ ቀጥታ ወደ ብር መምረጫው ያስገባዎታል! ✨\n\n`;
      }

      const playOfferMsg = activeWarning +
        `🎮 <b>ወደ ቢንጎ መጫወቻ እንኳን ደህና መጡ!</b> 🎮\n\n` +
        `ከታች ያለውን <b>'🎯 በዌብአፕ ይጫወቱ (Open WebApp)'</b> የሚለውን ቁልፍ በመጫን፦\n` +
        `💵 <b>ደረጃ 1፦</b> የመወራረቢያ ብር መጠን በቀላሉ ይምረጡ\n` +
        `🎟 <b>ደረጃ 2፦</b> ከ 400 ካርዶች ውስጥ የሚፈልጉትን መርጠው በቅጽበታዊ ማሳያ ይመልከቱ\n` +
        `🚀 <b>ደረጃ 3፦</b> ጀምር ሲሉ ወደ ጨዋታው ሰሌዳ በቀጥታ ይግቡ!\n\n` +
        `✍️ <b>ማሳሰቢያ፦</b> ያለ ዌብአፕ በቀጥታ በጽሁፍ ለመጫወት ከፈለጉ <code>/join [የካርድ ቁጥር]</code> ብለው መላክ ይችላሉ (ለምሳሌ፦ <code>/join 137</code>)`;

      await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: playOfferMsg,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎯 በዌብአፕ ይጫወቱ (Open WebApp) 🚀',
                web_app: { url: getSecureWebAppUrl() }
              }
            ],
            [
              { text: 'ℹ️ የካርታዬ ቁጥሮች', callback_data: 'view_card' }
            ]
          ]
        }
      });
      return playOfferMsg;
    }

    if (profile.balance < gameState.betAmount) {
      const msg = `❌ <b>ይቅርታ ${firstName} (@${username})</b>!\n\n` +
        `ለጨዋታ ለመመዝገብ በቂ ሂሳብ የሎትም።\n` +
        `💰 <b>የጨዋታው መክፈያ (Stake):</b> <code>${gameState.betAmount} Birr</code>\n` +
        `💳 <b>የእርስዎ ሂሳብ (Balance):</b> <code>${profile.balance} Birr</code>\n\n` +
        `ሂሳብዎን ለመሙላት በ <b>Telebirr</b> ወይም በ <b>ባንክ (Bank)</b> ብር ይላኩና የደረሰኝ ፎቶ (screenshot) እዚህ ይላኩ!\n` +
        `ለበለጠ መረጃ <b>/deposit</b> ወይም <b>እገዛ</b> ይበሉ።`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
      return msg;
    }

    if (gameState.status === 'idle' || gameState.status === 'finished') {
      gameState.status = 'lobby';
      gameState.drawnNumbers = [];
      gameState.players = [];
      addLog('system', 'Lobby', 'A new game lobby is automatically created by user request!');
    }

    if (gameState.status === 'playing') {
      const msg = `❌ <b>ይቅርታ ${firstName}</b>! ጨዋታው በአሁኑ ሰዓት በመካሄድ ላይ ነው። እባክዎን ይህ ጨዋታ እስኪያልቅ ይጠብቁ።`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
      return msg;
    }

    // We allow joining multiple times with different cards!
    if (requestedCardNumber !== null) {
      const isTaken = gameState.players.some(p => p.cardNumber === requestedCardNumber);
      if (isTaken) {
        const msg = `❌ <b>ይቅርታ</b>! ካርድ ቁጥር ${requestedCardNumber} ቀድሞውኑ በሌላ ተጫዋች ወይም በእርስዎ ተይዟል። እባክዎ ሌላ ካርድ ይምረጡ።`;
        await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
        return msg;
      }
    }

    if (gameState.players.length >= gameState.maxPlayers) {
      const msg = `❌ <b>ይቅርታ</b>! ጨዋታው ሙሉ ነው። የሚፈቀደው ከፍተኛ የተጫዋች ብዛት: ${gameState.maxPlayers}`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
      return msg;
    }

    // Deduct entry fee
    profile.balance -= gameState.betAmount;
    saveProfiles();

    const cardNumber = requestedCardNumber !== null ? requestedCardNumber : getAvailableCardNumber();
    const playerCard = generateBingoCard(cardNumber);
    const newPlayer: Player = {
      id: chatId,
      username,
      firstName,
      card: playerCard,
      isSimulated: isSim,
      joinedAt: Date.now(),
      hasWon: false,
      cardNumber,
      balance: profile.balance,
    };

    gameState.players.push(newPlayer);
    updatePrizePool();

    addLog('system', 'Lobby', `Player ${firstName} joined with Card #${cardNumber}. Deducted ${gameState.betAmount} Birr.`);

    const msg = `🎉 <b>${firstName}</b> (@${username}) ጨዋታውን ተቀላቅለዋል! <b>(ተመዝጋቢ #${gameState.players.length})</b>\n` +
      `💰 <b>የተቀነሰ ክፍያ (Bet):</b> <code>${gameState.betAmount} Birr</code>\n` +
      `💳 <b>ቀሪ ሂሳብዎ:</b> <code>${profile.balance} Birr</code>\n\n` +
      `ካርታዎ (ካርታ ቁጥር ${cardNumber}) በተሳካ ሁኔታ ተዘጋጅቷል!`;

    await telegramRequest('sendMessage', {
      chat_id: chatId,
      text: msg,
      parse_mode: 'HTML'
    });

    const cardMsg = formatTelegramCard(playerCard, cardNumber);
    await telegramRequest('sendMessage', {
      chat_id: chatId,
      text: cardMsg,
      parse_mode: 'HTML',
      reply_markup: inlineButtons,
    });

    return msg;
  }

  if (command === '/card' || command === 'ካርታዬ') {
    const players = gameState.players.filter(p => p.id === chatId);
    if (players.length === 0) {
      const msg = `⚠️ <b>${firstName}</b>! እርስዎ ገና አልተመዘገቡም። ለመመዝገብ መጀመሪያ <b>/join</b> ይበሉ።`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
      return msg;
    }

    let allCardMsgs = '';
    for (const player of players) {
      const cardMsg = formatTelegramCard(player.card, player.cardNumber);
      await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: cardMsg,
        parse_mode: 'HTML',
        reply_markup: inlineButtons,
      });
      allCardMsgs += cardMsg + '\n\n';
    }
    return allCardMsgs;
  }

  if (command === '/leave' || command === 'ውጣ') {
    const parts = cleanText.split(' ');
    let targetCardNum: number | null = null;
    if (parts.length > 1) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) targetCardNum = parsed;
    }

    const players = gameState.players.filter(p => p.id === chatId);
    if (players.length === 0) {
      const msg = `⚠️ አልተመዘገቡም ነበር።`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
      return msg;
    }

    if (targetCardNum !== null) {
      const index = gameState.players.findIndex(p => p.id === chatId && p.cardNumber === targetCardNum);
      if (index !== -1) {
        gameState.players.splice(index, 1);
        profile.balance += gameState.betAmount;
        saveProfiles();
        updatePrizePool();
        addLog('system', 'Lobby', `Player ${firstName} left with Card #${targetCardNum}. Refunded ${gameState.betAmount} Birr.`);
        const msg = `👋 <b>${firstName}</b> ከቢንጎ ካርታ ቁጥር #${targetCardNum} ወጥተዋል። <code>${gameState.betAmount} Birr</code> ተመላሽ ተደርጓል`;
        await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
        return msg;
      } else {
        const msg = `❌ <b>ይቅርታ</b>! ካርታ ቁጥር ${targetCardNum} የእርስዎ አይደለም ወይም አልተገኘም።`;
        await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
        return msg;
      }
    }

    const count = players.length;
    gameState.players = gameState.players.filter(p => p.id !== chatId);
    profile.balance += gameState.betAmount * count;
    saveProfiles();
    updatePrizePool();

    addLog('system', 'Lobby', `Player ${firstName} left the lobby (${count} cards). Refunded ${gameState.betAmount * count} Birr.`);
    const msg = `👋 <b>${firstName}</b> ከሁሉም ቢንጎ ካርታዎችዎ ወጥተዋል (${count} ካርታዎች)። <code>${gameState.betAmount * count} Birr</code> ተመላሽ ተደርጓል)`;
    await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
    return msg;
  }

  if (command === '/bingo' || command === 'ቢንጎ') {
    if (gameState.status !== 'playing') {
      const msg = `⚠️ ጨዋታው በአሁኑ ወቅት ገባሪ አይደለም ወይም አልተጀመረም።`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
      return msg;
    }

    const players = gameState.players.filter(p => p.id === chatId);
    if (players.length === 0) {
      const msg = `⚠️ እርስዎ በዚህ ጨዋታ ውስጥ አልተሳተፉም።`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
      return msg;
    }

    let winningPlayer: Player | null = null;
    let checkResult: any = null;

    for (const p of players) {
      const res = checkBingo(p.card);
      if (res.won) {
        winningPlayer = p;
        checkResult = res;
        break;
      }
    }

    if (!winningPlayer || !checkResult) {
      const msg = `❌ <b>ውድ ${firstName}</b>! ካርታዎ ላይ ገና ቢንጎ አልሞላም። እባክዎ ሁሉም የካርታዎ መስመሮች እስኪሞሉ ድረስ ይጠብቁ!`;
      await telegramRequest('sendMessage', { chat_id: chatId, text: msg, parse_mode: 'HTML' });
      return msg;
    }

    const player = winningPlayer;
    player.hasWon = true;
    player.winningPattern = checkResult.pattern;
    gameState.status = 'finished';
    gameState.autoDraw = false;
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      autoDrawInterval = null;
    }

      const totalStake = gameState.players.length * gameState.betAmount;
      const winPrize = totalStake * 0.8;

      profile.balance += winPrize;
      profile.totalWins = (profile.totalWins || 0) + 1;
      saveProfiles();

      addLog('system', 'Winner', `🏆 BINGO! Player ${player.firstName} WON ${winPrize} Birr via ${checkResult.pattern}!`);

      const winMsg = `🏆 <b>ቢንጎ! (BINGO!)</b> 🏆\n\n` +
        `🎉 <b>እንኳን ደስ ያለዎት ${player.firstName} (@${player.username})!</b>\n` +
        `🎯 <b>በ${checkResult.amhPattern} (${checkResult.pattern})</b> አሸንፈዋል!\n\n` +
        `💰 <b>የእርስዎ ሽልማት:</b> <code>${winPrize} Birr (ብር)</code> 🥇 (80% Derash)\n` +
        `💳 <b>አዲስ ሂሳብዎ:</b> <code>${profile.balance} Birr</code>\n` +
        `🔢 ጠቅላላ የወጡ ቁጥሮች ብዛት: ${gameState.drawnNumbers.length}\n\n` +
        `<i>አስተዳዳሪው ጨዋታውን እስኪጀምር ድረስ ለአዲስ ዙር ይጠብቁ!</i>`;

      await telegramRequest('sendMessage', { chat_id: chatId, text: winMsg, parse_mode: 'HTML' });

      await broadcastTelegramMessage(`🏆 <b>ጨዋታው ተጠናቋል!</b>\n\n` +
        `አሸናፊ: <b>${player.firstName} (@${player.username})</b>\n` +
        `ሽልማት: <b>${winPrize} Birr</b>\n` +
        `አሸናፊ ቅጥ: <b>${checkResult.amhPattern}</b>\n` +
        `የወጡ ቁጥሮች: ${gameState.drawnNumbers.length} ቁጥሮች`);

      return winMsg;
  }

  // Unknown message or input text that is not a command/state
  const unknownMsg = `❓ <b>ያልታወቀ ትዕዛዝ።</b> እባክዎ ከታች ያለውን ማውጫ ምርጫዎች በመጠቀም ይጫወቱ👇`;
  await telegramRequest('sendMessage', {
    chat_id: chatId,
    text: unknownMsg,
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard()
  });
  return unknownMsg;
}

// TRIGGER BINGO WIN AUTOMATICALLY OR MANUALLY
async function triggerBingoWin(player: Player, checkResult: { won: boolean; pattern?: string; amhPattern?: string }) {
  if (gameState.status !== 'playing') return;

  player.hasWon = true;
  player.winningPattern = checkResult.pattern;
  gameState.status = 'finished';
  gameState.nextGameCountdown = 8; // 8 seconds countdown before next lobby starts
  gameState.isOvertime = false;

  const totalStake = gameState.players.length * gameState.betAmount;
  const winPrize = totalStake * 0.8;

  // Award prize if profile exists
  const profile = getUserProfile(player.id, player.username, player.firstName);
  profile.balance += winPrize;
  profile.totalWins = (profile.totalWins || 0) + 1;
  saveProfiles();

  addLog('system', 'Winner', `🏆 BINGO! Player ${player.firstName} (@${player.username}) WON ${winPrize} Birr via ${checkResult.pattern}!`);

  const winMsg = `🏆 <b>ቢንጎ! (BINGO!)</b> 🏆\n\n` +
    `🎉 <b>እንኳን ደስ ያለዎት ${player.firstName} (@${player.username})!</b>\n` +
    `🎯 <b>በ${checkResult.amhPattern} (${checkResult.pattern})</b> አሸንፈዋል!\n\n` +
    `💰 <b>የእርስዎ ሽልማት:</b> <code>${winPrize} Birr (ብር)</code> 🥇 (80% Derash)\n` +
    `💳 <b>አዲስ ሂሳብዎ:</b> <code>${profile.balance.toFixed(2)} Birr</code>\n` +
    `🔢 ጠቅላላ የወጡ ቁጥሮች ብዛት: ${gameState.drawnNumbers.length}\n\n` +
    `<i>ቀጣዩ አዲስ ጨዋታ በ 8 ሰከንድ ውስጥ በራሱ ይከፈታል!</i>`;

  // Try to notify the winner via Telegram
  try {
    await telegramRequest('sendMessage', { chat_id: player.id, text: winMsg, parse_mode: 'HTML' });
  } catch (err) {}

  // Broadcast to all
  await broadcastTelegramMessage(`🏆 <b>ጨዋታው ተጠናቋል! (BINGO!)</b>\n\n` +
    `አሸናፊ: <b>${player.firstName} (@${player.username})</b>\n` +
    `ሽልማት: <b>${winPrize} Birr</b>\n` +
    `አሸናፊ ቅጥ: <b>${checkResult.amhPattern}</b>\n` +
    `የወጡ ቁጥሮች: ${gameState.drawnNumbers.length} ቁጥሮች\n\n` +
    `<i>ቀጣዩ አዲስ ዙር ካርድ መምረጫ በ 8 ሰከንድ ውስጥ በራሱ ይከፈታል!</i>`);
}

// AUTO-ADD VIRTUAL PLAYERS FOR LIVE ACTION 24/7
function autoAddBotsToLobby() {
  const mockNames = [
    { username: 'Yohannes_B', name: 'ዮሐንስ' },
    { username: 'Almaz_T', name: 'አልማዝ' },
    { username: 'Kebede_G', name: 'ከበደ' },
    { username: 'Sara_M', name: 'ሳራ' },
    { username: 'Fitsum_A', name: 'ፍጹም' },
    { username: 'Martha_H', name: 'ማርታ' },
    { username: 'Abdi_K', name: 'አብዲ' },
    { username: 'Selam_W', name: 'ሰላም' },
  ];

  let addedCount = 0;
  // Choose a random subset of bots to add
  const shuffled = [...mockNames].sort(() => 0.5 - Math.random());
  const botsToAdd = shuffled.slice(0, Math.floor(Math.random() * 3) + 2); // 2 to 4 bots

  botsToAdd.forEach(bot => {
    const simUserId = `sim_${bot.username.toLowerCase()}`;
    const exists = gameState.players.find(p => p.id === simUserId);
    if (!exists && gameState.players.length < gameState.maxPlayers) {
      const cardNumber = getAvailableCardNumber();
      const card = generateBingoCard(cardNumber);
      gameState.players.push({
        id: simUserId,
        username: bot.username,
        firstName: bot.name,
        card: card,
        isSimulated: true,
        joinedAt: Date.now(),
        hasWon: false,
        cardNumber,
        balance: 500,
      });
      addedCount++;
    }
  });

  if (addedCount > 0) {
    updatePrizePool();
    addLog('system', 'Simulator', `Added ${addedCount} virtual players to the lobby! Total players: ${gameState.players.length}`);
  }
}

// DRAW BALL AUTOMATED
function drawBallAutomated() {
  if (gameState.status !== 'playing') return;
  if (gameState.drawnNumbers.length >= 75) {
    gameState.status = 'finished';
    gameState.nextGameCountdown = 8;
    addLog('system', 'Game Over', 'All 75 balls have been drawn! Game finished with no winner.');
    broadcastTelegramMessage('🏁 <b>ጨዋታው ተጠናቋል!</b> ሁሉም 75 ቁጥሮች ወጥተዋል ነገር ግን ያሸነፈ የለም። ለአዲስ ዙር በመዘጋጀት ላይ...');
    return;
  }

  // Find unused number
  let nextBall = 0;
  do {
    nextBall = Math.floor(Math.random() * 75) + 1;
  } while (gameState.drawnNumbers.includes(nextBall));

  gameState.drawnNumbers.push(nextBall);

  // Amharic letter mapping
  let letter = '';
  if (nextBall <= 15) letter = 'ቢ (B)';
  else if (nextBall <= 30) letter = 'ን (I)';
  else if (nextBall <= 45) letter = 'ጎ (N)';
  else if (nextBall <= 60) letter = 'ፕ (G)';
  else letter = 'ያ (O)';

  addLog('system', 'Ball Caller', `🎯 Ball Drawn: ${letter} - ${nextBall}`);

  // Auto-mark drawn number on all players' cards
  for (const player of gameState.players) {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (player.card[r][c].value === nextBall) {
          player.card[r][c].marked = true;
        }
      }
    }
  }

  // Broadcast drawn number to Telegram players
  broadcastTelegramMessage(`🔢 <b>የወጣ ቁጥር (Ball drawn):</b>\n` +
    `👉  <b>${letter} - ${nextBall}</b>  👈\n\n` +
    `<i>ቁጥር #${gameState.drawnNumbers.length} / 75</i>`);

  // Check if ANY player has won (real or bot)
  for (const player of gameState.players) {
    if (!player.hasWon) {
      const check = checkBingo(player.card);
      if (check.won) {
        triggerBingoWin(player, check);
        break; // Only one winner can win at a time
      }
    }
  }
}

// SIMULATE AUTOMATED BALL DRAW
function drawBall() {
  drawBallAutomated();
}

// 24/7 AUTOMATED CONTINUOUS BINGO MASTER LOOP
let masterLoopInterval: NodeJS.Timeout | null = null;
let secondsCounter = 0;

function startAutomatedGameLoop() {
  if (masterLoopInterval) {
    clearInterval(masterLoopInterval);
  }

  // Set initial automated state
  gameState.status = 'lobby';
  gameState.lobbyTimeLeft = 30; // 30 seconds card/stake selection phase
  gameState.gameTimeLeft = 90; // 90 seconds active drawing phase (Total limit 120s / 2m)
  gameState.drawnNumbers = [];
  gameState.players = [];
  gameState.autoDraw = true;
  gameState.autoDrawIntervalMs = 3000; // Ball every 3 seconds as requested!

  addLog('system', 'Automated Loop', '24/7 Automated Bingo loop started. Lobby is open!');

  masterLoopInterval = setInterval(() => {
    try {
      if (gameState.status === 'lobby') {
        if (gameState.lobbyTimeLeft && gameState.lobbyTimeLeft > 0) {
          gameState.lobbyTimeLeft--;

          // Automatically add bots to make it active and interesting
          if (gameState.lobbyTimeLeft === 20 || gameState.lobbyTimeLeft === 10) {
            autoAddBotsToLobby();
          }
        } else {
          // Lobby time over! Start active play
          if (gameState.players.length === 0) {
            // No human players? Add bots so there is always continuous play!
            autoAddBotsToLobby();
          }

          gameState.status = 'playing';
          gameState.drawnNumbers = [];
          gameState.gameTimeLeft = 90; // 90s playing time limit (makes it 120s / 2m combined)
          secondsCounter = 0;

          // Fresh cards for everyone based on card numbers
          gameState.players.forEach(p => {
            p.card = generateBingoCard(p.cardNumber);
            p.hasWon = false;
            p.winningPattern = undefined;
          });

          updatePrizePool();

          addLog('system', 'Automated Loop', `Lobby closed. Game started with ${gameState.players.length} players! Prize Pool: ${gameState.prizePool}`);
          broadcastTelegramMessage(`🚀 <b>ጨዋታው ተጀምሯል! (Bingo Game Started!)</b>\n\n` +
            `ጠቅላላ ተጫዋቾች ብዛት: <b>${gameState.players.length}</b>\n` +
            `ሽልማት: <b>${gameState.prizePool}</b>\n\n` +
            `መልካም እድል ለሁላችሁም! 👍`);
        }
      } 
      else if (gameState.status === 'playing') {
        const is25OrMore = gameState.players.length >= 25;
        if (gameState.gameTimeLeft && gameState.gameTimeLeft > 0) {
          gameState.gameTimeLeft--;
          secondsCounter++;

          // Call/Draw a ball every 3 seconds
          if (secondsCounter % 3 === 0) {
            drawBallAutomated();
          }
        } else {
          // Timeout reached (90s limit reached)
          if (is25OrMore) {
            // Overtime mode active! Keep drawing balls until someone wins
            secondsCounter++;
            if (!gameState.isOvertime) {
              gameState.isOvertime = true;
              addLog('system', 'Automated Loop', '⚡ Overtime / ተጨማሪ እጣ started! 25+ players are active. Drawing continues until a winner is found.');
              broadcastTelegramMessage('⚡ <b>ተጨማሪ እጣ! (Overtime Mode Active!)</b>\n\nከ 25 በላይ ካርዶች በመያዛቸው ምክንያት አሸናፊ እስኪገኝ ድረስ እጣ ማውጣቱ ይቀጥላል! 🎰');
            }
            if (secondsCounter % 3 === 0) {
              drawBallAutomated();
            }
            gameState.gameTimeLeft = 0; // lock at 0
          } else {
            gameState.status = 'finished';
            gameState.nextGameCountdown = 8;
            gameState.isOvertime = false;
            addLog('system', 'Automated Loop', 'Game timeout reached (2 minutes maximum time limit)!');
            broadcastTelegramMessage('🏁 <b>ጨዋታው ተጠናቋል!</b> የ 2 ደቂቃ የጊዜ ገደብ አልቋል። አሸናፊ የለም። ለአዲስ ዙር በመዘጋጀት ላይ...');
          }
        }
      } 
      else if (gameState.status === 'finished') {
        if (gameState.nextGameCountdown && gameState.nextGameCountdown > 0) {
          gameState.nextGameCountdown--;
        } else {
          // Next round starts now! Open new lobby
          gameState.status = 'lobby';
          gameState.lobbyTimeLeft = 30;
          gameState.gameTimeLeft = 90;
          gameState.drawnNumbers = [];
          gameState.players = []; // Clear players so clients automatically return to card selection!
          gameState.isOvertime = false;

          addLog('system', 'Automated Loop', 'New continuous game cycle started! Lobby is now open.');
          broadcastTelegramMessage('🆕 <b>አዲስ ዙር ተከፍቷል!</b>\n\nእባክዎን ከታች ያለውን ቁልፍ ተጭነው ካርድ እና የውርርድ መጠን በመምረጥ አዲሱን ጨዋታ ይቀላቀሉ! 🎰');
        }
      }
    } catch (error: any) {
      console.error('Error in automated game loop:', error);
    }
  }, 1000);
}

// REST API ENDPOINTS

// Get Game State
app.get('/api/game-state', (req, res) => {
  // Check if public/shared preview URL is active in background
  checkPreUrlActive().catch(() => {});

  // Sync players' current profile balances before returning
  gameState.players.forEach(p => {
    const profile = getUserProfile(p.id, p.username, p.firstName);
    p.balance = profile.balance;
  });

  // Return config with masked token for safety
  const safeConfig = {
    ...botConfig,
    token: botConfig.token ? `${botConfig.token.substring(0, 8)}...` : '',
    hasToken: !!botConfig.token,
  };
  res.json({
    game: gameState,
    config: safeConfig,
    settings: botSettings,
    logs: logs,
    deposits: depositRequests,
    withdrawals: withdrawRequests,
    profiles: Array.from(userProfiles.values()),
    systemTime: new Date().toLocaleString(),
  });
});

// Telegram Webhook Endpoint
app.post('/api/telegram-webhook', async (req, res) => {
  try {
    const update = req.body;
    if (update) {
      handleTelegramUpdate(update).catch(err => {
        console.error('Error handling Telegram Webhook Update:', err);
      });
    }
    res.sendStatus(200);
  } catch (err: any) {
    console.error('Telegram Webhook error:', err.message);
    res.sendStatus(500);
  }
});

// Update bot settings
app.post('/api/config/settings', async (req, res) => {
  const { telebirrNumber, telebirrName, cbeAccount, cbeName, contactUsername, welcomeBonus, referralBonus, forceSharedPreUrl, botMode, productionWebhookUrl } = req.body;
  
  if (telebirrNumber !== undefined) botSettings.telebirrNumber = String(telebirrNumber);
  if (telebirrName !== undefined) botSettings.telebirrName = String(telebirrName);
  if (cbeAccount !== undefined) botSettings.cbeAccount = String(cbeAccount);
  if (cbeName !== undefined) botSettings.cbeName = String(cbeName);
  if (contactUsername !== undefined) botSettings.contactUsername = String(contactUsername);
  if (welcomeBonus !== undefined) botSettings.welcomeBonus = Number(welcomeBonus);
  if (referralBonus !== undefined) botSettings.referralBonus = Number(referralBonus);
  if (forceSharedPreUrl !== undefined) botSettings.forceSharedPreUrl = Boolean(forceSharedPreUrl);
  
  if (productionWebhookUrl !== undefined) {
    const oldUrl = botSettings.productionWebhookUrl;
    botSettings.productionWebhookUrl = String(productionWebhookUrl);
    if (botSettings.productionWebhookUrl !== oldUrl && botSettings.botMode === 'webhook') {
      // Re-trigger webhook registration with the new URL!
      registerWebhookIfNeeded(botSettings.productionWebhookUrl).catch(err => console.error('Failed to register webhook:', err));
    }
  }
  
  const oldMode = botSettings.botMode;
  if (botMode !== undefined && botMode !== oldMode) {
    botSettings.botMode = botMode;
    addLog('system', 'Config', `Bot Mode changed from ${oldMode} to ${botMode}`);
    
    try {
      if (botMode === 'polling') {
        lastRegisteredWebhookUrl = '';
        try {
          await telegramRequest('deleteWebhook');
          addLog('system', 'Bot', 'Cleared Telegram Webhook to switch to Long Polling.');
        } catch (e) {}
        startBotPolling().catch(err => console.error('Failed to start polling:', err));
      } else if (botMode === 'webhook') {
        if (botPollingActive) {
          stopBotPolling();
        }
        if (lastKnownHost && !lastKnownHost.includes('localhost')) {
          registerWebhookIfNeeded(lastKnownHost).catch(err => console.error('Failed to register webhook:', err));
        }
      } else if (botMode === 'disabled') {
        if (botPollingActive) {
          stopBotPolling();
        }
        try {
          await telegramRequest('deleteWebhook');
        } catch (e) {}
        botConfig.isActive = false;
        addLog('system', 'Bot', 'Bot connection has been completely disabled.');
      }
    } catch (err: any) {
      console.error('Error switching bot mode:', err.message);
    }
  }

  addLog('system', 'Config', 'Bot Settings updated successfully.');
  saveSettings();
  res.json({ success: true, settings: botSettings });
});

// Update game stake/bet amount
app.post('/api/game/stake', (req, res) => {
  const { amount } = req.body;
  if (amount) {
    gameState.betAmount = Number(amount);
    updatePrizePool();
    addLog('system', 'Config', `Game stake updated to ${amount} Birr. Dynamic prize pool recalculated.`);
  }
  res.json({ success: true, betAmount: gameState.betAmount, prizePool: gameState.prizePool });
});

// Approve a deposit request
app.post('/api/deposits/:id/approve', async (req, res) => {
  const { id } = req.params;
  const deposit = depositRequests.find(d => d.id === id);
  if (!deposit) {
    return res.status(404).json({ error: 'Deposit request not found' });
  }

  if (deposit.status !== 'pending') {
    return res.status(400).json({ error: 'Deposit request already processed' });
  }

  deposit.status = 'approved';
  
  // Add balance to user profile
  const profile = getUserProfile(deposit.chatId, deposit.username, deposit.firstName);
  profile.balance += deposit.amount;

  saveDeposits();
  saveProfiles();

  addLog('system', 'Payment', `Approved ${deposit.amount} Birr deposit for ${deposit.firstName} (@${deposit.username}) via ${deposit.method}.`);

  // Notify user on Telegram
  const noticeMsg = `✅ <b>ክፍያዎ ተረጋግጧል! (Deposit Approved!)</b>\n\n` +
    `💰 <b>የተቀበልነው መጠን:</b> <code>${deposit.amount} Birr</code>\n` +
    `💳 <b>የአሁኑ ቀሪ ሂሳብዎ:</b> <code>${profile.balance} Birr</code>\n\n` +
    `መልካም ጨዋታ! 🎲`;

  try {
    await telegramRequest('sendMessage', {
      chat_id: deposit.chatId,
      text: noticeMsg,
      parse_mode: 'HTML',
    });
  } catch (e) {
    console.error(`Could not send telegram notification to ${deposit.chatId}`);
  }

  res.json({ success: true, deposit, balance: profile.balance });
});

// Reject a deposit request
app.post('/api/deposits/:id/reject', async (req, res) => {
  const { id } = req.params;
  const deposit = depositRequests.find(d => d.id === id);
  if (!deposit) {
    return res.status(404).json({ error: 'Deposit request not found' });
  }

  if (deposit.status !== 'pending') {
    return res.status(400).json({ error: 'Deposit request already processed' });
  }

  deposit.status = 'rejected';

  saveDeposits();

  addLog('system', 'Payment', `Rejected ${deposit.amount} Birr deposit for ${deposit.firstName} (@${deposit.username}).`);

  // Notify user on Telegram
  const noticeMsg = `❌ <b>ይቅርታ፣ ክፍያዎ ውድቅ ተደርጓል! (Deposit Rejected!)</b>\n\n` +
    `የላኩት ደረሰኝ/Screenshot በትክክል አልተረጋገጠም። እባክዎ ትክክለኛውን ደረሰኝ በድጋሚ ይላኩ ወይም አስተዳዳሪውን ያነጋግሩ።`;

  try {
    await telegramRequest('sendMessage', {
      chat_id: deposit.chatId,
      text: noticeMsg,
      parse_mode: 'HTML',
    });
  } catch (e) {
    console.error(`Could not send telegram notification to ${deposit.chatId}`);
  }

  res.json({ success: true, deposit });
});

// Approve a withdrawal request
app.post('/api/withdrawals/:id/approve', async (req, res) => {
  const { id } = req.params;
  const withdraw = withdrawRequests.find(w => w.id === id);
  if (!withdraw) {
    return res.status(404).json({ error: 'Withdrawal request not found' });
  }

  if (withdraw.status !== 'pending') {
    return res.status(400).json({ error: 'Withdrawal request already processed' });
  }

  withdraw.status = 'approved';

  saveWithdrawals();

  addLog('system', 'Payment', `Approved withdrawal of ${withdraw.amount} Birr for ${withdraw.firstName} (@${withdraw.username}) to ${withdraw.bankName}.`);

  // Notify user on Telegram
  const noticeMsg = `✅ <b>የገንዘብ ማውጫ ጥያቄዎ ፀድቋል! (Withdrawal Processed!)</b>\n\n` +
    `💰 <b>የተላከው መጠን:</b> <code>${withdraw.amount} Birr</code>\n` +
    `🏦 <b>ባንክ:</b> ${withdraw.bankName}\n` +
    `💳 <b>የሂሳብ ቁጥር:</b> <code>${withdraw.accountNumber}</code>\n` +
    `👤 <b>የባለቤት ስም:</b> <code>${withdraw.accountName}</code>\n\n` +
    `ገንዘቡ በተሳካ ሁኔታ ተልኮልዎታል። አካውንትዎን ያረጋግጡ! 🙏`;

  try {
    await telegramRequest('sendMessage', {
      chat_id: withdraw.chatId,
      text: noticeMsg,
      parse_mode: 'HTML',
    });
  } catch (e) {
    console.error(`Could not send telegram notification to ${withdraw.chatId}`);
  }

  res.json({ success: true, withdraw });
});

// Reject a withdrawal request (refunds the amount back to user's profile)
app.post('/api/withdrawals/:id/reject', async (req, res) => {
  const { id } = req.params;
  const withdraw = withdrawRequests.find(w => w.id === id);
  if (!withdraw) {
    return res.status(404).json({ error: 'Withdrawal request not found' });
  }

  if (withdraw.status !== 'pending') {
    return res.status(400).json({ error: 'Withdrawal request already processed' });
  }

  withdraw.status = 'rejected';

  // Refund user's profile balance
  const profile = getUserProfile(withdraw.chatId, withdraw.username, withdraw.firstName);
  profile.balance += withdraw.amount;

  saveWithdrawals();
  saveProfiles();

  addLog('system', 'Payment', `Rejected withdrawal of ${withdraw.amount} Birr for ${withdraw.firstName} (@${withdraw.username}). Refunded to balance.`);

  // Notify user on Telegram
  const noticeMsg = `❌ <b>የገንዘብ ማውጫ ጥያቄዎ ውድቅ ተደርጓል! (Withdrawal Rejected!)</b>\n\n` +
    `💰 <b>መጠን:</b> <code>${withdraw.amount} Birr</code>\n\n` +
    `ያቀረቡት መረጃ ትክክል ስላልሆነ ጥያቄዎ ውድቅ ሆኖ የብር መጠን ወደ ቦት ቀሪ ሂሳብዎ ተመላሽ ተደርጓል። እባክዎ መረጃዎን አስተካክለው እንደገና ይሞክሩ ወይም አስተዳዳሪውን ያነጋግሩ።`;

  try {
    await telegramRequest('sendMessage', {
      chat_id: withdraw.chatId,
      text: noticeMsg,
      parse_mode: 'HTML',
    });
  } catch (e) {
    console.error(`Could not send telegram notification to ${withdraw.chatId}`);
  }

  res.json({ success: true, withdraw, balance: profile.balance });
});

// Simulate a player sending a transaction screenshot
app.post('/api/game/simulate-deposit', (req, res) => {
  const { username, firstName, amount, method, smsText, transactionId } = req.body;
  if (!username || !amount) {
    return res.status(400).json({ error: 'Username and amount are required' });
  }

  const simUserId = `sim_${username.toLowerCase()}`;
  const depId = 'dep_' + Math.random().toString(36).substring(2, 9);

  const mockScreenshots = {
    telebirr: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60',
    bank: 'https://images.unsplash.com/photo-1563013544-824ae1d704d3?w=500&auto=format&fit=crop&q=60'
  };

  const selectedMethod = method === 'bank' ? 'bank' : 'telebirr';
  const finalTxnId = transactionId || (selectedMethod === 'bank' ? `FT${Math.floor(Math.random() * 900000000) + 100000000}` : `TXN${Math.floor(Math.random() * 900000000) + 100000000}`);
  const finalSmsText = smsText || `አስተላለፊያ ደረሰኝ፡ ${amount} Birr via ${selectedMethod === 'bank' ? 'CBE' : 'Telebirr'}. Txn ID: ${finalTxnId}`;

  const newDep: DepositRequest = {
    id: depId,
    chatId: simUserId,
    username,
    firstName: firstName || username,
    amount: Number(amount),
    method: selectedMethod,
    screenshotUrl: mockScreenshots[selectedMethod],
    smsText: finalSmsText,
    transactionId: finalTxnId,
    timestamp: Date.now(),
    status: 'pending',
  };

  depositRequests.unshift(newDep);
  saveDeposits();

  addLog('incoming', username, `[Simulated Screenshot: ${amount} Birr via ${selectedMethod}]`);
  addLog('outgoing', 'Bot', `Reply to @${username}: የደረሰኝ ፎቶ ደርሶናል። አስተዳዳሪው ሲያረጋግጥ ሂሳብዎ ይሞላል።`);

  res.json({ success: true, deposit: newDep });
});

// Update Token and restart polling
app.post('/api/config/token', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    stopBotPolling();
    botConfig.token = '';
    botConfig.isActive = false;
    botConfig.error = 'Token removed';
    botSettings.telegramBotToken = '';
    saveSettings();
    addLog('system', 'Bot', 'Telegram Token removed by administrator.');
    return res.json({ success: true, message: 'Token removed' });
  }

  const trimmedToken = token.trim();
  botConfig.token = trimmedToken;
  botSettings.telegramBotToken = trimmedToken;
  saveSettings();
  addLog('system', 'Bot', 'New Telegram token registered. Initiating connection...');
  
  stopBotPolling();
  await startBotPolling();

  if (botConfig.error) {
    res.status(400).json({ success: false, message: botConfig.error });
  } else {
    res.json({ success: true, botUsername: botConfig.botUsername });
  }
});

// Start Game (Moves from lobby -> playing)
app.post('/api/game/start', (req, res) => {
  if (gameState.status !== 'lobby') {
    return res.status(400).json({ error: 'Game must be in lobby status to start' });
  }
  if (gameState.players.length === 0) {
    return res.status(400).json({ error: 'Cannot start game without any players' });
  }

  gameState.status = 'playing';
  gameState.drawnNumbers = [];
  
  // Re-generate cards to be fresh using their assigned unique card numbers
  gameState.players.forEach(p => {
    p.card = generateBingoCard(p.cardNumber);
    p.hasWon = false;
    p.winningPattern = undefined;
  });

  addLog('system', 'Game', '🎯 Bingo Game has officially started!');
  broadcastTelegramMessage(`🚀 <b>ጨዋታው ተጀምሯል! (Bingo Game Started!)</b>\n\n` +
    `ጠቅላላ ተጫዋቾች ብዛት: <b>${gameState.players.length}</b>\n` +
    `ሽልማት: <b>${gameState.prizePool}</b>\n\n` +
    `መልካም እድል ለሁላችሁም! 👍`);

  // Start auto-draw if selected
  if (gameState.autoDraw) {
    if (autoDrawInterval) clearInterval(autoDrawInterval);
    autoDrawInterval = setInterval(drawBall, gameState.autoDrawIntervalMs);
  }

  res.json({ success: true, game: gameState });
});

// Draw manual number
app.post('/api/game/draw', (req, res) => {
  if (gameState.status !== 'playing') {
    return res.status(400).json({ error: 'Game is not in active playing state' });
  }
  drawBall();
  res.json({ success: true, game: gameState });
});

// Toggle Autodraw
app.post('/api/game/toggle-autodraw', (req, res) => {
  const { autoDraw, intervalMs } = req.body;
  gameState.autoDraw = !!autoDraw;
  if (intervalMs) {
    gameState.autoDrawIntervalMs = Number(intervalMs);
  }

  if (autoDrawInterval) {
    clearInterval(autoDrawInterval);
    autoDrawInterval = null;
  }

  if (gameState.autoDraw && gameState.status === 'playing') {
    autoDrawInterval = setInterval(drawBall, gameState.autoDrawIntervalMs);
    addLog('system', 'Engine', `Automated Draw activated (Every ${gameState.autoDrawIntervalMs / 1000} seconds)`);
  } else {
    addLog('system', 'Engine', 'Automated Draw deactivated.');
  }

  res.json({ success: true, game: gameState });
});

// Set Prize Pool
app.post('/api/game/prize', (req, res) => {
  const { prize } = req.body;
  if (prize) {
    gameState.prizePool = prize;
    addLog('system', 'Config', `Prize pool updated to: ${prize}`);
  }
  res.json({ success: true, prize: gameState.prizePool });
});

// Reset Game
app.post('/api/game/reset', (req, res) => {
  if (autoDrawInterval) {
    clearInterval(autoDrawInterval);
    autoDrawInterval = null;
  }
  startAutomatedGameLoop();
  addLog('system', 'Engine', 'Bingo Game state reset and 24/7 automated game loop restarted!');
  res.json({ success: true, game: gameState });
});

// Simulate message from custom Telegram user (For offline testing)
app.post('/api/game/simulate-command', async (req, res) => {
  const { username, firstName, text, userId } = req.body;
  if (!username || !text) {
    return res.status(400).json({ error: 'Username and command/text required' });
  }

  const cleanText = text.trim();
  const simUserId = userId ? String(userId) : `sim_${username.toLowerCase()}`;
  addLog('incoming', username, cleanText);

  const reply = await processCommand(simUserId, username, firstName || username, cleanText);
  addLog('outgoing', 'Bot', `Reply to @${username}: ${reply.replace(/<[^>]*>/g, '')}`);

  // Look for error or warning markers in reply
  if (reply.includes('❌') || reply.includes('⚠️') || reply.includes('ይቅርታ')) {
    return res.json({ 
      success: false, 
      error: reply.replace(/<[^>]*>/g, ''), 
      reply 
    });
  }

  res.json({ success: true, reply });
});

// Quick Add Bot Players for Demo
app.post('/api/game/add-bots', (req, res) => {
  const mockNames = [
    { username: 'Yohannes_B', name: 'ዮሐንስ' },
    { username: 'Almaz_T', name: 'አልማዝ' },
    { username: 'Kebede_G', name: 'ከበደ' },
    { username: 'Sara_M', name: 'ሳራ' },
    { username: 'Fitsum_A', name: 'ፍጹም' },
    { username: 'Martha_H', name: 'ማርታ' },
  ];

  let addedCount = 0;
  mockNames.forEach(bot => {
    // Check if bot already exists
    const simUserId = `sim_${bot.username.toLowerCase()}`;
    const exists = gameState.players.find(p => p.id === simUserId);
    if (!exists && gameState.players.length < gameState.maxPlayers) {
      const cardNumber = getAvailableCardNumber();
      const card = generateBingoCard(cardNumber);
      gameState.players.push({
        id: simUserId,
        username: bot.username,
        firstName: bot.name,
        card: card,
        isSimulated: true,
        joinedAt: Date.now(),
        hasWon: false,
        cardNumber,
        balance: 500,
      });
      addedCount++;
    }
  });

  addLog('system', 'Simulator', `Added ${addedCount} virtual Ethiopian bot players to the lobby!`);
  res.json({ success: true, added: addedCount, players: gameState.players });
});

// Auto-start bot if token is already in environment variable
if (botConfig.token) {
  if (botSettings.botMode === 'polling') {
    startBotPolling().catch(err => {
      console.error('Failed to auto-start Telegram Bot polling:', err.message);
    });
  } else if (botSettings.botMode === 'webhook') {
    // If APP_URL is defined or productionWebhookUrl is specified, register webhook on startup, else wait for dynamic incoming requests
    const envAppUrl = process.env.APP_URL || botSettings.productionWebhookUrl || lastKnownHost;
    if (envAppUrl && !envAppUrl.includes('localhost') && !envAppUrl.includes('127.0.0.1')) {
      registerWebhookIfNeeded(envAppUrl).catch(err => {
        console.error('Failed to auto-register Telegram Webhook on startup:', err.message);
      });
    } else {
      console.log('Bot is in webhook mode. Waiting for first client request to register webhook URL.');
    }
  }
}

// Serve Vite Static files / Middleware
async function serveApp() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Create unified HTTP server
  const server = http.createServer(app);

  // Initialize WebSocket Server
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    wssClients.add(ws);

    // Send latest state instantly on connection
    try {
      ws.send(JSON.stringify({ event: 'state_update', data: getSafeState() }));
    } catch (err) {
      console.error('Error sending initial WS state:', err);
    }

    ws.on('close', () => {
      wssClients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err);
      wssClients.delete(ws);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running with WebSockets on http://0.0.0.0:${PORT}`);
    // Start the 24/7 automated continuous game loop
    startAutomatedGameLoop();
  });
}

serveApp();
