export interface BingoCell {
  value: number; // 0 represents the center "FREE" cell
  marked: boolean;
}

export interface Player {
  id: string; // Telegram user ID (chat_id) or simulated ID (e.g. "sim_123")
  username: string; // Telegram @username or display name
  firstName: string;
  card: BingoCell[][]; // 5x5 grid
  isSimulated: boolean;
  joinedAt: number;
  hasWon: boolean;
  winningPattern?: string; // e.g. "Horizontal Line", "Vertical Line", "Diagonal Line", "Full House"
  cardNumber: number; // Unique card number between 1 and 400
  balance: number; // Player's current balance in Birr
  phone?: string; // Registered phone number
  totalWins?: number; // Total game wins
  lastGiftClaim?: number; // Unix timestamp of last gift claim
  muted?: boolean; // Whether the user muted the number call sounds
}

export type GameStatus = 'idle' | 'lobby' | 'playing' | 'finished';

export interface BingoGame {
  status: GameStatus;
  drawnNumbers: number[]; // Array of balls drawn so far (1 to 75)
  players: Player[];
  maxPlayers: number;
  autoDraw: boolean;
  autoDrawIntervalMs: number;
  gameCode: string;
  prizePool: string; // Amharic custom prize description, e.g. "100 Birr"
  createdAt: number;
  betAmount: number; // The bet amount/stake for this game
  lobbyTimeLeft?: number; // Automated timer for card selection in seconds
  gameTimeLeft?: number; // Automated timer for the playing phase in seconds
  nextGameCountdown?: number; // Countdown before starting the next game
  isOvertime?: boolean; // Overtime mode for 25+ players
}

export interface TelegramBotConfig {
  token: string;
  botUsername: string;
  isActive: boolean;
  error: string | null;
}

export interface TelegramLog {
  id: string;
  timestamp: number;
  type: 'incoming' | 'outgoing' | 'system' | 'error';
  username: string;
  message: string;
}

export interface DepositRequest {
  id: string;
  chatId: string;
  username: string;
  firstName: string;
  amount: number;
  method: 'telebirr' | 'bank';
  screenshotUrl: string;
  smsText?: string;
  transactionId?: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface WithdrawRequest {
  id: string;
  chatId: string;
  username: string;
  firstName: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

export interface PlayerProfile {
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

export interface BotSettings {
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
}

export interface AppState {
  game: BingoGame;
  config: TelegramBotConfig;
  settings: BotSettings;
  logs: TelegramLog[];
  systemTime: string;
  deposits: DepositRequest[];
  withdrawals: WithdrawRequest[];
  profiles?: PlayerProfile[];
}
