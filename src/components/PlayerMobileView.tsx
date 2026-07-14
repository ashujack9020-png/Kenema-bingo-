import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, User, Coins, RefreshCw, LogOut, Trophy, 
  Wifi, Battery, ShieldAlert, Sparkles, CheckCircle2, Volume2, VolumeX 
} from 'lucide-react';
import { BingoGame, Player, PlayerProfile } from '../types.js';

interface PlayerMobileViewProps {
  game: BingoGame;
  onRefresh: () => void;
  profiles?: PlayerProfile[];
  isTelegramWebApp?: boolean;
  onUnlockAdmin?: () => void;
}

export default function PlayerMobileView({ game, onRefresh, profiles, isTelegramWebApp, onUnlockAdmin }: PlayerMobileViewProps) {
  // Preset profiles for simulation
  const [selectedProfileId, setSelectedProfileId] = useState<string>('sim_fitsum_a');
  const [customName, setCustomName] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [customBalance, setCustomBalance] = useState('500');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customProfiles, setCustomProfiles] = useState<any[]>([]);

  // Local state for selected stake (bet) on the select screen
  const [selectedStake, setSelectedStake] = useState<number>(20);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Custom multi-step pre-game wizard states as requested by the user
  const [flowStep, setFlowStep] = useState<'welcome' | 'bet_select' | 'card_select'>('bet_select');
  const [selectedCardNumber, setSelectedCardNumber] = useState<number | null>(null);
  const [cardSearch, setCardSearch] = useState<string>('');
  const [cardCategory, setCardCategory] = useState<string>('1-40');

  // Client-side exact match of the seed-based card generator for beautiful real-time previewing
  const seededRandom = (seed: number) => {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  };

  const generateClientCard = (cardNumber: number) => {
    const rand = seededRandom(cardNumber);
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
      
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const temp = available[i];
        available[i] = available[j];
        available[j] = temp;
      }
      columns.push(available.slice(0, 5));
    }

    const card: { value: number; marked: boolean }[][] = [];
    for (let row = 0; row < 5; row++) {
      const cardRow: { value: number; marked: boolean }[] = [];
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col === 2) {
          cardRow.push({ value: 0, marked: true });
        } else {
          cardRow.push({ value: columns[col][row], marked: false });
        }
      }
      card.push(cardRow);
    }
    return card;
  };

  // Default simulated players list
  const defaultProfiles = [
    { id: 'sim_fitsum_a', username: 'Fitsum_A', firstName: 'ፍጹም', balance: 500 },
    { id: 'sim_almaz_t', username: 'Almaz_T', firstName: 'አልማዝ', balance: 350 },
    { id: 'sim_yohannes_b', username: 'Yohannes_B', firstName: 'ዮሐንስ', balance: 420 },
    { id: 'sim_martha_h', username: 'Martha_H', firstName: 'ማርታ', balance: 150 },
    { id: 'sim_sara_m', username: 'Sara_M', firstName: 'ሳራ', balance: 200 },
  ];

  // Resolve balances dynamically from the live server-side profiles
  const resolvedDefaultProfiles = defaultProfiles.map(p => {
    const serverProfile = profiles?.find(sp => sp.id === p.id);
    return serverProfile ? { ...p, balance: serverProfile.balance } : p;
  });

  const resolvedCustomProfiles = customProfiles.map(p => {
    const serverProfile = profiles?.find(sp => sp.id === p.id);
    return serverProfile ? { ...p, balance: serverProfile.balance } : p;
  });

  const allProfiles = [...resolvedDefaultProfiles, ...resolvedCustomProfiles];
  const activeProfile = allProfiles.find(p => p.id === selectedProfileId) || resolvedDefaultProfiles[0];

  // Reset pre-game wizard steps when active profile is changed
  useEffect(() => {
    setFlowStep('bet_select');
    setSelectedCardNumber(null);
    setCardSearch('');
  }, [selectedProfileId]);

  // Load Telegram WebApp user if available
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const tgUser = tg.initDataUnsafe?.user;
      if (tgUser) {
        const tgProfileId = tgUser.id.toString();
        const tgProfile = {
          id: tgProfileId,
          username: tgUser.username || `user_${tgUser.id}`,
          firstName: tgUser.first_name || 'ተጫዋች',
          balance: 0
        };
        
        setCustomProfiles(prev => {
          if (prev.some(p => p.id === tgProfileId)) return prev;
          return [tgProfile, ...prev];
        });
        setSelectedProfileId(tgProfileId);
      }
    }
  }, []);

  // Check if current simulated profile is joined in the active lobby/game
  const activePlayerInGame = game.players.find(p => p.id === activeProfile.id);

  // Clear status messages after a delay
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Audio announcer (optional) - Supports Amharic, English, or Muted
  const [soundMode, setSoundMode] = useState<'amh' | 'eng' | 'mute'>('amh');

  // Voice announcement of the latest drawn ball for player immersion
  useEffect(() => {
    if (activePlayerInGame && game.drawnNumbers.length > 0 && soundMode !== 'mute' && game.status === 'playing') {
      const lastNum = game.drawnNumbers[game.drawnNumbers.length - 1];
      let letter = '';
      if (lastNum <= 15) letter = 'B';
      else if (lastNum <= 30) letter = 'I';
      else if (lastNum <= 45) letter = 'N';
      else if (lastNum <= 60) letter = 'G';
      else letter = 'O';

      let textToSay = '';
      if (soundMode === 'amh') {
        let amhLetter = '';
        if (letter === 'B') amhLetter = 'ቢ';
        else if (letter === 'I') amhLetter = 'ን';
        else if (letter === 'N') amhLetter = 'ጎ';
        else if (letter === 'G') amhLetter = 'ፕ';
        else amhLetter = 'ያ';
        
        textToSay = `${amhLetter} ${lastNum}`;
      } else {
        textToSay = `${letter} ${lastNum}`;
      }

      // Clear any pending speak queue to prevent overlapping voices
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToSay);
      utterance.rate = 1.0;
      utterance.pitch = 1.1; // Friendly higher pitch
      if (soundMode === 'amh') {
        utterance.lang = 'am-ET';
      } else {
        utterance.lang = 'en-US';
      }
      window.speechSynthesis.speak(utterance);
    }
  }, [game.drawnNumbers.length, soundMode]);

  // Trigger win celebration if player won
  useEffect(() => {
    if (activePlayerInGame?.hasWon) {
      setConfettiActive(true);
      // Play a sound
      if (soundMode !== 'mute') {
        window.speechSynthesis.cancel();
        const winText = soundMode === 'amh' 
          ? `ቢንጎ! እንኳን ደስ አለዎት! አሸንፈዋል!` 
          : "Bingo! Congratulations! You won!";
        const utterance = new SpeechSynthesisUtterance(winText);
        utterance.rate = 0.95;
        if (soundMode === 'amh') {
          utterance.lang = 'am-ET';
        } else {
          utterance.lang = 'en-US';
        }
        window.speechSynthesis.speak(utterance);
      }
    } else {
      setConfettiActive(false);
    }
  }, [activePlayerInGame?.hasWon, soundMode]);

  // Handle creating a custom player
  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customUsername.trim()) return;

    const newId = `sim_${customUsername.toLowerCase().trim()}_${Date.now().toString(36)}`;
    const newProfile = {
      id: newId,
      username: customUsername.replace('@', '').trim(),
      firstName: customName.trim(),
      balance: parseFloat(customBalance) || 200
    };

    setCustomProfiles(prev => [...prev, newProfile]);
    setSelectedProfileId(newId);
    setShowCustomForm(false);
    setCustomName('');
    setCustomUsername('');
  };

  // REST endpoints integration
  // 1. Join game flow (First updates global stake, then joins player with selected card number)
  const handleJoinGame = async () => {
    if (!selectedCardNumber) {
      setStatusMessage({ text: '⚠️ እባክዎ መጀመሪያ ካርድ ይምረጡ።', type: 'error' });
      return;
    }
    setLoadingAction('joining');
    setStatusMessage(null);
    try {
      // Step 1: Update the game bet amount to match the selected stake
      const stakeRes = await fetch('/api/game/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selectedStake })
      });
      if (!stakeRes.ok) throw new Error('የውርርድ መጠን ማስተካከል አልተቻለም');

      // Step 2: Join the player via simulate-command with card number!
      const joinRes = await fetch('/api/game/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: activeProfile.username,
          firstName: activeProfile.firstName,
          text: `/join ${selectedCardNumber}`,
          userId: activeProfile.id
        })
      });
      const joinData = await joinRes.json();
      if (!joinRes.ok || joinData.error) throw new Error(joinData.error || 'ጨዋታውን መቀላቀል አልተቻለም');

      setStatusMessage({ text: `🎉 ${activeProfile.firstName} በ ${selectedStake} Birr በተሳካ ሁኔታ ተመዝግቧል! (ካርድ #${selectedCardNumber})`, type: 'success' });
      onRefresh();
      // Reset wizard steps for next time they reset or leave the game
      setFlowStep('bet_select');
      setSelectedCardNumber(null);
    } catch (err: any) {
      setStatusMessage({ text: `❌ ስህተት፡ ${err.message}`, type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. Claim BINGO!
  const handleClaimBingo = async () => {
    if (!activePlayerInGame) return;
    setLoadingAction('bingo');
    try {
      const res = await fetch('/api/game/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: activeProfile.username,
          firstName: activeProfile.firstName,
          text: '/bingo',
          userId: activeProfile.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error('ጥያቄውን ማስተናገድ አልተቻለም');

      if (data.reply.includes('ይቅርታ') || data.reply.includes('No winning line yet')) {
        setStatusMessage({ text: '❌ ይቅርታ፣ የእርስዎ ካርታ ገና ቢንጎ አልበላም! የወጡትን ቁጥሮች ያረጋግጡ።', type: 'error' });
      } else {
        setStatusMessage({ text: '🏆 ቢንጎ! እንኳን ደስ አለዎት! ጨዋታውን አሸንፈዋል! 🎉', type: 'success' });
        setConfettiActive(true);
      }
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: `❌ ስህተት፡ ${err.message}`, type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. Leave Game
  const handleLeaveGame = async () => {
    if (!activePlayerInGame) return;
    setLoadingAction('leaving');
    try {
      const res = await fetch('/api/game/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: activeProfile.username,
          firstName: activeProfile.firstName,
          text: '/leave',
          userId: activeProfile.id
        })
      });
      if (!res.ok) throw new Error('ጨዋታውን መልቀቅ አልተቻለም');

      setStatusMessage({ text: '👋 ከቢንጎ ጨዋታው ወጥተዋል፣ መወራረቢያዎ ተመላሽ ሆኗል።', type: 'info' });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: `❌ ስህተት፡ ${err.message}`, type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Calculate grid mappings for 75-number board
  const categories = [
    { label: 'ቢ', range: [1, 15], color: 'text-red-400 border-red-500/20 bg-red-500/5' },
    { label: 'ን', range: [16, 30], color: 'text-blue-400 border-blue-500/20 bg-blue-500/5' },
    { label: 'ጎ', range: [31, 45], color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' },
    { label: 'ፕ', range: [46, 60], color: 'text-amber-400 border-amber-500/20 bg-amber-500/5' },
    { label: 'ያ', range: [61, 75], color: 'text-purple-400 border-purple-500/20 bg-purple-500/5' },
  ];

  // Helper to determine the letter for a specific drawn number
  const getBallLetter = (num: number) => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  };

  // Helper to determine column colors
  const getLetterColorClass = (letter: string) => {
    switch(letter) {
      case 'B': return 'bg-red-500 text-white';
      case 'I': return 'bg-blue-500 text-white';
      case 'N': return 'bg-emerald-500 text-white';
      case 'G': return 'bg-amber-500 text-slate-950';
      case 'O': return 'bg-purple-500 text-white';
      default: return 'bg-zinc-700 text-white';
    }
  };

  // Calculate dynamic "Derash" (80% of stakes or customized)
  const derashPrize = game.status !== 'idle' 
    ? (game.players.length * game.betAmount * 0.8) 
    : 40;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
      
      {/* LEFT COLUMN: PLAYER PROFILE CONTROLLER (Column span 4) */}
      <div className="xl:col-span-4 flex flex-col gap-6">
        <div className="bg-[#111114] border border-zinc-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            👤 የሞባይል ተጫዋች መምረጫ
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-2">ለማስመሰል የሚፈልጉትን ተጫዋች ይምረጡ፡</label>
              <select
                value={selectedProfileId}
                onChange={(e) => {
                  setSelectedProfileId(e.target.value);
                  setStatusMessage(null);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-sky-500 text-zinc-200 font-sans"
              >
                {allProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} (@{p.username}) — ባላንስ: {p.balance} Birr
                  </option>
                ))}
              </select>
            </div>

            {/* Register New Player Toggle */}
            <div>
              {!showCustomForm ? (
                <button
                  onClick={() => setShowCustomForm(true)}
                  className="text-xs text-sky-400 hover:text-sky-300 font-bold transition flex items-center gap-1"
                >
                  ➕ አዲስ ተጫዋች ፍጠር (Create Custom Player)
                </button>
              ) : (
                <form onSubmit={handleCreateCustom} className="mt-3 p-4 bg-[#0a0a0c] border border-zinc-800 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-zinc-300">አዲስ ተጫዋች መረጃ</h4>
                  
                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      placeholder="ሙሉ ስም (ለምሳሌ፡ አስቴር)"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-sky-500 text-zinc-200"
                    />
                    <input
                      type="text"
                      required
                      placeholder="የቴሌግራም ዩዘርኔም (Username)"
                      value={customUsername}
                      onChange={e => setCustomUsername(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-sky-500 text-zinc-200"
                    />
                    <input
                      type="number"
                      required
                      placeholder="መጀመሪያ ባላንስ (Birr)"
                      value={customBalance}
                      onChange={e => setCustomBalance(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs focus:outline-none focus:border-sky-500 text-zinc-200"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 rounded-lg text-slate-950 text-xs font-bold transition"
                    >
                      ጨምር
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomForm(false)}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 text-xs transition"
                    >
                      ሰርዝ
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Status / Feedback Alert widget */}
        <AnimatePresence mode="wait">
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-3xl border flex items-start gap-3 ${
                statusMessage.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : statusMessage.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
              }`}
            >
              <ShieldAlert className="shrink-0 mt-0.5" size={18} />
              <div className="text-xs font-semibold leading-relaxed">
                {statusMessage.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Help Guide */}
        <div className="bg-[#111114] border border-zinc-800 p-5 rounded-3xl">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">💡 የተጫዋች ስማርትፎን ሲሙሌተር መመሪያ</h4>
          <p className="text-xs text-zinc-500 leading-relaxed space-y-1">
            ይህ ሲሙሌተር ተጫዋቾች በሞባይል ስልካቸው የሚመለከቱትን እውነተኛውን የጨዋታ ገጽታ <b>(Bela Bingo Player Screen)</b> ያሳያል።
          </p>
          <ul className="text-xs text-zinc-400 list-disc pl-4 mt-2 space-y-1.5">
            <li>ከተመራጭ ተጫዋቾች አንዱን ይምረጡ ወይም አዲስ ይፍጠሩ።</li>
            <li>ተጫዋቹ ጨዋታውን ካልተቀላቀለ የመወራረቢያ ብር (10, 20, 30...) መምረጫ ይመጣል።</li>
            <li>ብር መርጠው <b>"ተቀላቀል"</b> ሲሉ ወደ ቀጥታ ጨዋታው ይሄዳሉ!</li>
            <li>በጨዋታው ውስጥ እጣ ሲወጣ በራሱ ምልክት ይደረጋል፣ መስመር ሲሞላላችሁ <b>"Bingo"</b> የሚለውን ትልቅ የብርቱካን ቁልፍ መጫን ትችላላችሁ!</li>
          </ul>
        </div>
      </div>

      {/* RIGHT COLUMN: SMARTPHONE FRAME AND PLAYER WORKSPACE (Column span 8) */}
      <div className="xl:col-span-8 flex justify-center">
        
        {/* Confetti Celebration overlay */}
        {confettiActive && (
          <div className="absolute pointer-events-none z-50 animate-bounce text-center text-4xl">
            🎉✨🏆 BINGO! WINNER! 🏆✨🎉
          </div>
        )}

        {/* Smartphone Casing container */}
        <div className="relative mx-auto w-full max-w-[420px] bg-[#0c1219] border-[12px] border-[#181d24] rounded-[52px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col min-h-[780px]">
          
          {/* Smartphone Ear Speaker & Camera Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-[#181d24] rounded-b-2xl z-50 flex items-center justify-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
            <div className="w-12 h-1 bg-zinc-700 rounded-full" />
          </div>

          {/* Smartphone Screen Inner content */}
          <div className="flex-1 flex flex-col text-white pt-6 relative select-none font-sans bg-[#081018]">
            
            {/* Top Stat/Status Bar */}
            <div className="px-5 py-2 flex justify-between items-center text-[10px] text-zinc-500 font-semibold border-b border-[#141b24]">
              <span 
                className={`font-mono select-none ${onUnlockAdmin ? 'cursor-pointer active:opacity-60 transition-opacity' : ''}`}
                onClick={onUnlockAdmin}
                title={onUnlockAdmin ? "Unlock Admin Portal" : undefined}
              >
                13:57 🔒
              </span>
              
              {/* Connected Pill inside phone */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-0.5 flex items-center gap-1 text-emerald-400 font-bold">
                <CheckCircle2 size={9} className="animate-pulse" /> Connected
              </div>

              <div className="flex items-center gap-1.5 font-mono">
                <button 
                  onClick={() => {
                    if (soundMode === 'amh') setSoundMode('eng');
                    else if (soundMode === 'eng') setSoundMode('mute');
                    else setSoundMode('amh');
                  }} 
                  className="hover:text-zinc-200 transition shrink-0 mr-1 flex items-center gap-1 bg-[#101925] border border-zinc-800 px-2 py-0.5 rounded-full text-[8px] font-bold"
                  title="የድምፅ ሁነታ (Change Voice Caller Language)"
                >
                  {soundMode === 'amh' && (
                    <>
                      <Volume2 size={9} className="text-emerald-400" />
                      <span className="text-emerald-400">🇪🇹 AMH</span>
                    </>
                  )}
                  {soundMode === 'eng' && (
                    <>
                      <Volume2 size={9} className="text-sky-400" />
                      <span className="text-sky-400">🇬🇧 ENG</span>
                    </>
                  )}
                  {soundMode === 'mute' && (
                    <>
                      <VolumeX size={9} className="text-zinc-500" />
                      <span className="text-zinc-500">🔇 MUT</span>
                    </>
                  )}
                </button>
                <Wifi size={10} />
                <Battery size={11} />
              </div>
            </div>

            {/* SCREEN CONDITIONAL ROUTER */}
            {!activePlayerInGame ? (
              /* MULTI-STEP PRE-GAME WIZARD FLOW (User requested) */
              <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-[#081018] to-[#040810] overflow-y-auto custom-scrollbar">
                
                {/* 1. Header Logo (Consistent across all pre-game screens) */}
                <div className="text-center py-4 shrink-0 border-b border-[#141b24] bg-[#081018]/80 backdrop-blur-md sticky top-0 z-20">
                  <div className="flex items-center justify-center gap-1 text-2xl font-black tracking-tight text-white uppercase">
                    <span className="w-8 h-8 bg-orange-500 text-slate-950 rounded-full flex items-center justify-center font-extrabold text-lg shadow-lg shadow-orange-500/20 mr-1">b</span>
                    bela bingo / ቤላ ቢንጎ
                  </div>
                  <p className="text-[9px] text-zinc-500 tracking-wider uppercase mt-0.5">Ethiopian Mobile Bingo App</p>
                </div>

                <div className="flex-1 flex flex-col p-5 justify-between gap-4">
                  
                  {/* STEP 1: WELCOME SCREEN - RE-DESIGNED AS HIGH-FIDELITY BEST BINGO LOBBY DASHBOARD */}
                  {flowStep === 'welcome' && (() => {
                    const serverProfile = profiles?.find(sp => sp.id === activeProfile.id);
                    const isRegisteredOnServer = activeProfile.id.startsWith('sim_') || !!serverProfile?.phone;

                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex-1 flex flex-col justify-between gap-4"
                      >
                        {/* 1. Gorgeous Wallet Header Card */}
                        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between shadow-lg backdrop-blur-sm shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/30">
                              <Coins size={20} className="animate-bounce" />
                            </div>
                            <div>
                              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block">ቀሪ ሂሳብ (Your Balance)</span>
                              <span className="text-xl font-black text-emerald-400 font-mono tracking-tight">
                                {isRegisteredOnServer ? activeProfile.balance.toFixed(2) : '0.00'} ETB
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setRefreshing(true);
                              onRefresh();
                              setTimeout(() => setRefreshing(false), 800);
                            }}
                            className="bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800/80 px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 hover:text-white"
                          >
                            <RefreshCw size={12} className={`text-orange-400 ${refreshing ? 'animate-spin' : ''}`} />
                            <span className="text-[10px]">ያድሱ</span>
                          </button>
                        </div>

                        {/* Unregistered Alert block */}
                        {isTelegramWebApp && !isRegisteredOnServer && (
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-300 space-y-2 shrink-0">
                            <div className="flex items-center gap-2 font-bold text-amber-400">
                              <ShieldAlert size={16} />
                              <span>ያልተመዘገበ አካውንት (Not Registered)</span>
                            </div>
                            <p className="leading-relaxed">
                              እባክዎን መጀመሪያ የቴሌግራም ቦት ማውጫ ላይ <b>"📱 ስልክ ቁጥርዎን ያጋሩ (Share Contact)"</b> የሚለውን በመጫን ምዝገባዎን ያጠናቅቁ! ከዚያም ወደዚህ ስክሪን ሲመለሱ ቀሪ ሂሳብዎን ማየት እና መጫወት ይችላሉ።
                            </p>
                          </div>
                        )}

                        {/* 2. Room Selection / Lobby Table */}
                        <div className="bg-[#0b1420] border border-[#152336] rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col justify-between">
                          <div className="p-3 border-b border-[#152336] flex items-center justify-between bg-[#0a121c] shrink-0">
                            <div className="flex items-center gap-1.5">
                              <Sparkles size={13} className="text-orange-400" />
                              <span className="text-[11px] font-black uppercase text-zinc-200 tracking-wider">የቢንጎ ክፍሎች (Bingo Rooms)</span>
                            </div>
                            {game.status === 'lobby' && game.lobbyTimeLeft !== undefined ? (
                              <span className="text-[8px] bg-orange-500/15 border border-orange-500/25 text-orange-400 px-2 py-0.5 rounded-full font-bold animate-pulse flex items-center gap-1">
                                <span className="w-1 h-1 bg-orange-400 rounded-full animate-ping" />
                                ምዝገባ: {game.lobbyTimeLeft}s ቀረ
                              </span>
                            ) : (
                              <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                ● LIVE LOBBIES
                              </span>
                            )}
                          </div>

                          <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[300px]">
                            <table className="w-full text-left text-xs font-sans">
                              <thead>
                                <tr className="bg-[#070e17] text-zinc-500 text-[10px] font-bold uppercase border-b border-[#152336] sticky top-0 z-10">
                                  <th className="py-2 px-3">Stake</th>
                                  <th className="py-2 px-2">Active</th>
                                  <th className="py-2 px-2 text-center">Players</th>
                                  <th className="py-2 px-2 text-right">Derash</th>
                                  <th className="py-2 px-3 text-right">Play</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#121d2b]">
                                {[
                                  { stake: 10, players: 118, derash: 944 },
                                  { stake: 20, players: 100, derash: 1600 },
                                  { stake: 50, players: 73, derash: 2920 },
                                  { stake: 100, players: 45, derash: 3600 },
                                  { stake: 200, players: 22, derash: 3520 },
                                  { stake: 500, players: 14, derash: 5600 },
                                  { stake: 1000, players: 8, derash: 6400 }
                                ].map((room, idx) => {
                                  const isLiveGame = game.status !== 'idle' && game.status !== 'finished' && game.betAmount === room.stake;
                                  
                                  // Live data if active on the server
                                  const currentStatus = isLiveGame 
                                    ? (game.status === 'playing' ? 'playing' : 'lobby') 
                                    : 'playing'; // Default simulate playing state like best bingo screenshot
                                  
                                  const currentPlayerCount = isLiveGame ? game.players.length : room.players;
                                  const currentDerash = isLiveGame 
                                    ? (game.players.length * room.stake * 0.8) 
                                    : room.derash;

                                  const affordable = activeProfile.balance >= room.stake;

                                  return (
                                    <tr 
                                      key={room.stake} 
                                      className={`transition-colors ${
                                        isLiveGame 
                                          ? 'bg-orange-500/5 hover:bg-orange-500/10' 
                                          : idx % 2 === 0 
                                          ? 'bg-[#0a121c] hover:bg-[#0e1b2b]' 
                                          : 'bg-[#070e17] hover:bg-[#0e1b2b]'
                                      }`}
                                    >
                                      {/* Stake amount */}
                                      <td className="py-2.5 px-3 font-mono font-extrabold text-zinc-100">
                                        <span className="text-orange-400">{room.stake}</span>
                                        <span className="text-[8px] text-zinc-500 ml-0.5">ETB</span>
                                      </td>

                                      {/* Status tag */}
                                      <td className="py-2.5 px-2">
                                        <span className={`inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                          currentStatus === 'playing'
                                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                        }`}>
                                          <span className={`w-1 h-1 rounded-full ${
                                            currentStatus === 'playing' ? 'bg-purple-400' : 'bg-emerald-400'
                                          } animate-pulse`} />
                                          {currentStatus}
                                        </span>
                                      </td>

                                      {/* Players Count */}
                                      <td className="py-2.5 px-2 text-center font-mono font-bold text-zinc-300">
                                        {currentPlayerCount}
                                      </td>

                                      {/* Derash (Prize) */}
                                      <td className="py-2.5 px-2 text-right font-mono font-black text-amber-400">
                                        {currentDerash.toLocaleString()} <span className="text-[7px] text-amber-500/80 font-bold">ETB</span>
                                      </td>

                                      {/* Play Button */}
                                      <td className="py-2.5 px-3 text-right">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isTelegramWebApp && !isRegisteredOnServer) {
                                              setStatusMessage({
                                                text: '⚠️ እባክዎ መጀመሪያ ስልክ ቁጥርዎን ያጋሩ (ከታች ያለውን "📱 ስልክ ቁጥርዎን ያጋሩ" በተን ይጫኑ)።',
                                                type: 'error'
                                              });
                                              return;
                                            }
                                            if (!affordable) {
                                              setStatusMessage({
                                                text: `❌ በቂ ሂሳብ የሎትም! የእርስዎን ሂሳብ ለመሙላት እባክዎ "💰 Deposit" የሚለውን ይጠቀሙ (ያስፈልጋል: ${room.stake} ETB)።`,
                                                type: 'error'
                                              });
                                              return;
                                            }
                                            setSelectedStake(room.stake);
                                            setFlowStep('card_select');
                                          }}
                                          className={`px-2.5 py-1 text-[9px] font-black rounded-lg transition-all active:scale-95 ${
                                            affordable
                                              ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 shadow-md shadow-orange-500/10'
                                              : 'bg-zinc-800/80 border border-zinc-700/50 text-zinc-500 cursor-not-allowed opacity-55'
                                          }`}
                                        >
                                          {isLiveGame && game.status === 'lobby' ? 'ቀላቅል' : 'Play'}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Recent Winners Live Feed */}
                          <div className="bg-[#050b12] border-t border-[#152336] p-2.5 shrink-0 select-none">
                            <div className="flex items-center gap-1 mb-1.5 text-orange-400 font-bold">
                              <Trophy size={10} className="text-amber-400 animate-pulse animate-duration-1000" />
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-zinc-400">የቅርብ ጊዜ አሸናፊዎች (Recent Winners)</span>
                            </div>
                            <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                              {[
                                { name: 'ሄኖክ ኤል.', card: 284, prize: 755, time: '2m' },
                                { name: 'ሶፊያ ኤም.', card: 119, prize: 1600, time: '5m' },
                                { name: 'ኤልያስ ቲ.', card: 43, prize: 2920, time: '11m' },
                                { name: 'ማርታ ኬ.', card: 351, prize: 5600, time: '18m' },
                              ].map((w, idx) => (
                                <div key={idx} className="bg-[#0b1420] border border-[#1b2b40]/60 rounded-xl px-2 py-1 flex items-center gap-2 shrink-0">
                                  <div className="text-[10px]">🏆</div>
                                  <div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[8.5px] font-black text-zinc-200">{w.name}</span>
                                      <span className="text-[7px] text-zinc-500 font-mono font-semibold">{w.time} ago</span>
                                    </div>
                                    <div className="text-[8.5px] font-black text-emerald-400 font-mono -mt-0.5">
                                      +{w.prize} ETB <span className="text-[7px] text-zinc-500 font-normal"># {w.card}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Footer Brand Info */}
                          <div className="py-2 text-center bg-[#070e17] border-t border-[#152336] text-[8px] text-zinc-500 font-mono flex items-center justify-center gap-1 shrink-0">
                            <span>© Bela Bingo 2026</span>
                            <span>•</span>
                            <span className="text-orange-500/80 font-bold uppercase tracking-wider">Fast & Secure</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}

                  {/* STEP 2: STAKE/MONEY SELECTION SCREEN */}
                  {flowStep === 'bet_select' && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex-1 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-orange-400 mb-1">
                          <Coins size={16} />
                          <h3 className="text-sm font-extrabold uppercase tracking-wide">ውርርድ መምረጫ (Select Bet)</h3>
                        </div>
                        <p className="text-[11px] text-zinc-500 mb-3">ለመጫወት የሚፈልጉትን የብር መጠን ከታች ይምረጡ👇</p>

                        <div className="grid grid-cols-4 gap-2">
                          {[10, 20, 30, 50, 100, 200, 500, 1000].map((amt) => {
                            const affordable = activeProfile.balance >= amt;
                            const isChosen = selectedStake === amt;
                            return (
                              <button
                                key={amt}
                                type="button"
                                disabled={!affordable}
                                onClick={() => setSelectedStake(amt)}
                                className={`py-3 rounded-2xl border font-mono text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 relative ${
                                  isChosen
                                    ? 'bg-[#ed8936] text-white border-orange-400 shadow-lg shadow-orange-500/20 scale-102 font-black'
                                    : affordable
                                    ? 'bg-[#111923] border-zinc-800 text-zinc-300 hover:bg-[#14202d]'
                                    : 'bg-zinc-950/40 border-zinc-950 text-zinc-600 cursor-not-allowed'
                                }`}
                              >
                                <span className="text-sm font-black">{amt}</span>
                                <span className="text-[8px] opacity-75">Birr</span>
                                {!affordable && (
                                  <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                                    <span className="text-[8px] bg-red-900/90 text-red-200 px-1 py-0.5 rounded font-black uppercase">FUNDS</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selected Stake Summary Card */}
                      <div className="bg-[#0b1420] border border-[#152336] rounded-2xl p-4 flex items-center justify-between shadow-inner">
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold block">የተመረጠው ውርርድ</span>
                          <span className="text-lg font-black text-white font-mono">{selectedStake} Birr</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold block">የእርስዎ ቀሪ ሂሳብ</span>
                          <span className="text-xs font-black text-zinc-300 font-mono">{activeProfile.balance} Birr</span>
                        </div>
                      </div>

                      {/* Bottom navigation buttons for Step 2 */}
                      <div className="grid grid-cols-2 gap-3 mt-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const tg = (window as any).Telegram?.WebApp;
                            if (tg) {
                              tg.close();
                            } else {
                              setFlowStep('welcome');
                            }
                          }}
                          className="py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                        >
                          ← ውጣ (Exit)
                        </button>
                        <button
                          type="button"
                          disabled={activeProfile.balance < selectedStake}
                          onClick={() => setFlowStep('card_select')}
                          className="py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-orange-500/15 disabled:opacity-40"
                        >
                          ካርድ ምረጥ (Next) →
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3: CARD SELECTION SCREEN (400 Cards) */}
                  {flowStep === 'card_select' && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex-1 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-extrabold text-orange-400 uppercase tracking-wide flex items-center gap-1.5">
                            🎟 ካርድዎን ይምረጡ (Pick Card)
                            {game.lobbyTimeLeft !== undefined && (
                              <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                                ⏱️ {game.lobbyTimeLeft}s
                              </span>
                            )}
                          </h3>
                          <span className="text-[9px] text-zinc-500 font-bold font-mono">1 - 400 Cards Available</span>
                        </div>
                        
                        {/* Instant Search Bar & Random Selector */}
                        <div className="flex gap-1.5 mb-2.5">
                          <input
                            type="number"
                            min="1"
                            max="400"
                            placeholder="የካርድ ቁጥር ፈልግ (ለምሳሌ፡ 137)..."
                            value={cardSearch}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCardSearch(val);
                              const num = parseInt(val, 10);
                              if (!isNaN(num) && num >= 1 && num <= 400) {
                                setSelectedCardNumber(num);
                                // Set category range to contain the searched number
                                const catIndex = Math.floor((num - 1) / 40);
                                const start = catIndex * 40 + 1;
                                const end = start + 39;
                                setCardCategory(`${start}-${end}`);
                              }
                            }}
                            className="flex-1 bg-[#101721] border border-[#1a2b3e] rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-orange-500 text-zinc-200 font-sans"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              // Select a random unoccupied card number
                              const assigned = game.players.map(p => p.cardNumber);
                              const available: number[] = [];
                              for (let i = 1; i <= 400; i++) {
                                if (!assigned.includes(i)) available.push(i);
                              }
                              if (available.length > 0) {
                                const randomCard = available[Math.floor(Math.random() * available.length)];
                                setSelectedCardNumber(randomCard);
                                setCardSearch(randomCard.toString());
                                // Update category view
                                const catIndex = Math.floor((randomCard - 1) / 40);
                                const start = catIndex * 40 + 1;
                                const end = start + 39;
                                setCardCategory(`${start}-${end}`);
                              }
                            }}
                            className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-xl px-3 py-2 text-xs font-bold transition shrink-0 flex items-center gap-1"
                          >
                            🎲 ራስ-ሰር
                          </button>
                        </div>

                        {/* Category Selector Rows (Ranges of 40 cards to display at once) */}
                        <div className="flex gap-1 overflow-x-auto pb-1.5 select-none custom-scrollbar shrink-0 text-[10px]">
                          {[
                            '1-40', '41-80', '81-120', '121-160', '161-200', 
                            '201-240', '241-280', '281-320', '321-360', '361-400'
                          ].map((range) => (
                            <button
                              key={range}
                              type="button"
                              onClick={() => setCardCategory(range)}
                              className={`px-2 py-1 rounded-lg border font-bold transition shrink-0 ${
                                cardCategory === range
                                  ? 'bg-[#ed8936] text-white border-orange-400'
                                  : 'bg-[#101721] border-[#1b2b3d] text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              ካርድ {range}
                            </button>
                          ))}
                        </div>

                        {/* Grid of 40 Cards of the current category */}
                        <div className="grid grid-cols-5 gap-1 max-h-[160px] overflow-y-auto pr-1 select-none custom-scrollbar">
                          {(() => {
                            const [startStr, endStr] = cardCategory.split('-');
                            const start = parseInt(startStr, 10);
                            const end = parseInt(endStr, 10);
                            const cards = [];
                            for (let i = start; i <= end; i++) {
                              cards.push(i);
                            }

                            return cards.map((num) => {
                              const isTaken = game.players.some(p => p.cardNumber === num);
                              const isSelected = selectedCardNumber === num;
                              
                              return (
                                <button
                                  key={num}
                                  type="button"
                                  disabled={isTaken}
                                  onClick={() => {
                                    setSelectedCardNumber(num);
                                    setCardSearch(num.toString());
                                  }}
                                  className={`py-1.5 rounded-lg text-[10px] font-mono font-bold border transition flex flex-col items-center justify-center gap-0.5 relative ${
                                    isSelected
                                      ? 'bg-gradient-to-tr from-orange-500 to-amber-500 text-slate-950 border-orange-300 font-black shadow-md scale-102'
                                      : isTaken
                                      ? 'bg-zinc-950/60 border-zinc-950/30 text-zinc-600 line-through cursor-not-allowed'
                                      : 'bg-[#111923] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                                  }`}
                                >
                                  <span>#{num}</span>
                                  {isTaken && (
                                    <span className="text-[7px] text-red-500 font-extrabold uppercase scale-90">TAKEN</span>
                                  )}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* LIVE PREVIEW OF SEED CARD LAYOUT (Super Premium!) */}
                      {selectedCardNumber !== null && (
                        <div className="bg-[#0b1420]/90 border border-[#152336] rounded-xl p-2.5 shadow-md">
                          <div className="flex items-center justify-between border-b border-[#1c3047] pb-1 mb-1.5">
                            <span className="text-[10px] font-black uppercase text-orange-400 flex items-center gap-1">
                              👀 የካርድ #{selectedCardNumber} ቅድመ-እይታ
                            </span>
                            <span className="text-[8px] bg-sky-500/15 text-sky-400 px-1 rounded font-bold font-mono">LIVE PREVIEW</span>
                          </div>

                          {/* 5x5 Grid Mini Preview */}
                          <div className="grid grid-cols-5 gap-0.5 text-center text-[8px] font-black font-sans pb-0.5 text-zinc-500 mb-1">
                            <span>B</span>
                            <span>I</span>
                            <span>N</span>
                            <span>G</span>
                            <span>O</span>
                          </div>
                          
                          <div className="grid grid-cols-5 gap-0.5">
                            {generateClientCard(selectedCardNumber).flatMap((row, rIdx) =>
                              row.map((cell, cIdx) => {
                                const isCenter = rIdx === 2 && cIdx === 2;
                                return (
                                  <div
                                    key={`${rIdx}-${cIdx}`}
                                    className={`h-[15px] rounded-[3px] text-[8px] font-mono font-bold flex items-center justify-center ${
                                      isCenter 
                                        ? 'bg-emerald-500/20 text-emerald-400 font-black' 
                                        : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                                    }`}
                                  >
                                    {isCenter ? '★' : cell.value.toString().padStart(2, '0')}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bottom navigation buttons for Step 3 */}
                      <div className="grid grid-cols-2 gap-3 mt-auto shrink-0 pt-1">
                        <button
                          type="button"
                          onClick={() => setFlowStep('bet_select')}
                          className="py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                        >
                          ← ተመለስ (Back)
                        </button>
                        <button
                          type="button"
                          disabled={loadingAction === 'joining' || selectedCardNumber === null}
                          onClick={handleJoinGame}
                          className="py-3 bg-[#ed8936] hover:bg-orange-600 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-orange-500/15 disabled:opacity-40"
                        >
                          {loadingAction === 'joining' ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            'ጀምር (Start Game) 🚀'
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}

                </div>

              </div>
            ) : (
              /* SCREEN 2: ACTIVE GAME BOARD - IDENTICAL TO THE PROVIDED IMAGE */
              <div className="flex-1 flex flex-col justify-between p-4 bg-[#081018] relative">
                
                {game.status === 'finished' && (
                  <div className="absolute inset-0 bg-[#040810]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-gradient-to-b from-[#111925] to-[#0a1019] border border-orange-500/30 rounded-3xl p-6 shadow-2xl max-w-xs w-full space-y-4"
                    >
                      <div className="text-4xl animate-bounce">🏆</div>
                      <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">ጨዋታው ተጠናቋል!</h3>
                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Round Finished</p>
                      </div>

                      {(() => {
                        const winner = game.players.find(p => p.hasWon);
                        if (winner) {
                          const winPrize = game.players.length * game.betAmount * 0.8;
                          return (
                            <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-2xl p-4 space-y-1">
                              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">🎉 አሸናፊ (Winner)</span>
                              <span className="text-base font-black text-white block">{winner.firstName}</span>
                              <span className="text-[10px] text-zinc-400 block">@{winner.username}</span>
                              <div className="text-sm font-black text-amber-400 font-mono pt-1">
                                +{winPrize.toFixed(2)} ETB
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-2xl p-4">
                              <span className="text-xs text-zinc-400 font-bold block">🏁 አሸናፊ የለም (No Winner)</span>
                              <span className="text-[9px] text-zinc-500 block">የጊዜ ገደብ አልቋል ወይም ጨዋታው ተቋርጧል</span>
                            </div>
                          );
                        }
                      })()}

                      <div className="space-y-1 pt-2 border-t border-[#1a2536]">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase block tracking-wide">ወደ ካርድ መምረጫው ለመመለስ</span>
                        <div className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                          <span className="text-xs font-mono font-black text-orange-400">
                            {game.nextGameCountdown !== undefined ? game.nextGameCountdown : 8} ሰከንድ (Sec) wait...
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
                
                {/* Bela Bingo Header Banner */}
                <div className="flex items-center justify-between border-b border-[#141b24] pb-2.5">
                  <div className="flex items-center text-white font-extrabold text-xl tracking-tighter uppercase font-sans select-none">
                    <span className="w-6 h-6 bg-white text-[#081018] rounded-full flex items-center justify-center font-black text-sm mr-1">b</span>
                    bela bingo / ቤላ ቢንጎ
                  </div>
                  <div className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-lg font-bold font-mono">
                    CARD #{activePlayerInGame.cardNumber}
                  </div>
                </div>

                {/* Stats Pill boxes (5 rows layout matching the image top) */}
                <div className="grid grid-cols-5 gap-1.5 my-2.5 select-none text-center">
                  <div className="bg-[#101b2a] border border-[#1a2b40]/80 rounded-xl py-1 px-1">
                    <div className="text-[8px] text-zinc-400 uppercase font-semibold">Games</div>
                    <div className="text-[11px] font-black font-mono text-zinc-100">1</div>
                  </div>
                  <div className="bg-[#101b2a] border border-[#1a2b40]/80 rounded-xl py-1 px-1">
                    <div className="text-[8px] text-zinc-400 uppercase font-semibold">Derash</div>
                    <div className="text-[11px] font-black font-mono text-amber-400">{derashPrize}</div>
                  </div>
                  <div className="bg-[#101b2a] border border-[#1a2b40]/80 rounded-xl py-1 px-1">
                    <div className="text-[8px] text-zinc-400 uppercase font-semibold">Players</div>
                    <div className="text-[11px] font-black font-mono text-zinc-100">{game.players.length}</div>
                  </div>
                  <div className="bg-[#101b2a] border border-[#1a2b40]/80 rounded-xl py-1 px-1">
                    <div className="text-[8px] text-zinc-400 uppercase font-semibold">Bet</div>
                    <div className="text-[11px] font-black font-mono text-zinc-100">{game.betAmount}</div>
                  </div>
                  <div className="bg-[#101b2a] border border-[#1a2b40]/80 rounded-xl py-1 px-1">
                    <div className="text-[8px] text-zinc-400 uppercase font-semibold">Call</div>
                    <div className="text-[11px] font-black font-mono text-zinc-100">{game.drawnNumbers.length}</div>
                  </div>
                </div>

                {/* MAIN CONTENT GRID: LEFT 75-BOARD VS RIGHT CONTROLS */}
                <div className="grid grid-cols-12 gap-2 flex-1 items-stretch select-none">
                  
                  {/* LEFT COLUMN: 75-NUMBER TABLE (Span 5) */}
                  <div className="col-span-5 bg-[#0b1420] border border-[#152336] rounded-2xl p-2 flex flex-col gap-1 justify-between">
                    
                    {/* B I N G O Header Row */}
                    <div className="grid grid-cols-5 gap-0.5 text-center font-sans pb-1.5 border-b border-[#152336]">
                      <div className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center mx-auto shadow-sm">B</div>
                      <div className="w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center mx-auto shadow-sm">I</div>
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center mx-auto shadow-sm">N</div>
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center mx-auto shadow-sm">G</div>
                      <div className="w-5 h-5 rounded-full bg-purple-500 text-white text-[9px] font-black flex items-center justify-center mx-auto shadow-sm">O</div>
                    </div>

                    {/* Numbers Grid arranged vertically (B in column 1, I in col 2, etc.) */}
                    <div className="flex-1 grid grid-cols-5 gap-y-0.5 gap-x-0.5 mt-1">
                      {Array.from({ length: 15 }).map((_, rowIndex) => {
                        return [0, 1, 2, 3, 4].map((colIndex) => {
                          const base = colIndex * 15 + 1;
                          const num = base + rowIndex;
                          const isDrawn = game.drawnNumbers.includes(num);
                          const isLastDrawn = game.drawnNumbers.length > 0 && game.drawnNumbers[game.drawnNumbers.length - 1] === num;

                          let cellStyle = 'bg-[#1e293b] border-[#334155] text-zinc-400 font-medium';
                          if (isLastDrawn) {
                            cellStyle = 'bg-red-500 border-red-400 text-white font-extrabold animate-pulse shadow-md shadow-red-500/30';
                          } else if (isDrawn) {
                            cellStyle = 'bg-[#10b981] border-[#34d399] text-white font-extrabold';
                          }

                          return (
                            <div
                              key={num}
                              className={`h-[23px] rounded border text-[10px] font-mono flex items-center justify-center transition-all ${cellStyle}`}
                            >
                              {num.toString().padStart(2, '0')}
                            </div>
                          );
                        });
                      })}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: CALL DETAILS & CARD (Span 7) */}
                  <div className="col-span-7 flex flex-col gap-2 justify-between">
                    
                    {/* Countdown indicator */}
                    <div className="bg-[#0b1420] border border-[#152336] rounded-xl px-2.5 py-1 flex items-center justify-between text-[10px] font-bold text-zinc-400">
                      <span>ማብቂያ ጊዜ (Time Left)</span>
                      <span className="font-mono text-amber-400 font-black animate-pulse">
                        {game.gameTimeLeft !== undefined ? `${game.gameTimeLeft}s` : '90s'}
                      </span>
                    </div>

                    {/* Current Call Box */}
                    <div className="bg-[#2b6cb0] border border-blue-400/20 rounded-xl px-3 py-2 flex items-center justify-between text-white shadow-lg shadow-blue-600/15 shrink-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-blue-100">Current Call</span>
                      <span className="text-xl font-black font-mono tracking-tight text-white">
                        {game.drawnNumbers.length > 0 ? (
                          `${getBallLetter(game.drawnNumbers[game.drawnNumbers.length - 1])}-${game.drawnNumbers[game.drawnNumbers.length - 1]}`
                        ) : (
                          '--'
                        )}
                      </span>
                    </div>

                    {/* Recent Calls Trail (Horizontal List) */}
                    <div className="flex gap-1 justify-start items-center overflow-x-auto select-none min-h-[22px] py-1 custom-scrollbar">
                      {game.drawnNumbers.slice(0, -1).slice(-5).reverse().map((num) => {
                        const letter = getBallLetter(num);
                        let pillColor = 'bg-zinc-700 text-white';
                        if (letter === 'B') pillColor = 'bg-red-500 text-white';
                        if (letter === 'I') pillColor = 'bg-blue-500 text-white';
                        if (letter === 'N') pillColor = 'bg-emerald-500 text-white';
                        if (letter === 'G') pillColor = 'bg-amber-500 text-slate-950';
                        if (letter === 'O') pillColor = 'bg-purple-500 text-white';
                        
                        return (
                          <div
                            key={num}
                            className={`px-2 py-0.5 rounded text-[9px] font-black font-mono flex items-center justify-center gap-0.5 shadow-sm shrink-0 ${pillColor}`}
                          >
                            <span>{letter}</span>
                            <span>{num}</span>
                          </div>
                        );
                      })}
                      {game.drawnNumbers.length <= 1 && (
                        <span className="text-[9px] text-zinc-600 italic">No recent calls...</span>
                      )}
                    </div>

                    {/* 5x5 CARTELA (BINGO CARD) */}
                    <div className="bg-[#0b1420] border border-[#152336] rounded-2xl p-2 flex flex-col gap-1 shadow-inner flex-1 justify-between">
                      
                      {/* Winning Patterns HUD */}
                      <div className="flex gap-1.5 justify-center items-center py-1 border-b border-[#152336]/60 mb-1 select-none overflow-x-auto custom-scrollbar shrink-0">
                        <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-wider shrink-0">የአሸናፊነት ቅጦች (PATTERNS):</span>
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[7px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                          ➖ መስመር (Line)
                        </span>
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[7px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                          📐 ሰያፍ (Diagonal)
                        </span>
                        <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[7px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                          ⭐️ ማዕዘን (Corners)
                        </span>
                      </div>
                      
                      {/* B I N G O Header Colored Circles */}
                      <div className="grid grid-cols-5 gap-1 text-center font-sans">
                        {['B', 'I', 'N', 'G', 'O'].map((lettr) => {
                          let headerBg = 'bg-zinc-800 text-zinc-300';
                          if (lettr === 'B') headerBg = 'bg-red-500 text-white';
                          if (lettr === 'I') headerBg = 'bg-blue-500 text-white';
                          if (lettr === 'N') headerBg = 'bg-[#48bb78] text-white';
                          if (lettr === 'G') headerBg = 'bg-[#ed8936] text-white';
                          if (lettr === 'O') headerBg = 'bg-purple-500 text-white';
                          
                          return (
                            <div key={lettr} className={`w-[22px] h-[22px] rounded-full text-[10px] font-black flex items-center justify-center mx-auto ${headerBg}`}>
                              {lettr}
                            </div>
                          );
                        })}
                      </div>

                      {/* 25 Squares Grid */}
                      <div className="grid grid-cols-5 gap-1 mt-1.5">
                        {activePlayerInGame.card.flatMap((row, rIdx) =>
                          row.map((cell, cIdx) => {
                            const isFree = rIdx === 2 && cIdx === 2;
                            const marked = cell.marked;

                            let squareStyle = 'bg-[#f7fafc] border-zinc-300 text-[#1a365d] font-bold';
                            if (isFree) {
                              squareStyle = 'bg-[#48bb78] border-[#38a169] text-white font-extrabold shadow-sm';
                            } else if (marked) {
                              squareStyle = 'bg-[#48bb78] border-[#38a169] text-white font-black ring-2 ring-[#ecc94b] shadow-md';
                            }

                            return (
                              <div
                                key={`${rIdx}-${cIdx}`}
                                className={`h-[32px] rounded-lg border text-xs font-mono flex items-center justify-center transition-all ${squareStyle}`}
                              >
                                {isFree ? '★' : cell.value.toString().padStart(2, '0')}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Cartela Number label */}
                      <div className="text-center text-[10px] text-cyan-400 font-extrabold tracking-wide pt-1">
                        Cartela Number: {activePlayerInGame.cardNumber}
                      </div>

                    </div>
                  </div>
                </div>

                {/* BINGO TRIGGER BUTTON */}
                <div className="my-3 shrink-0">
                  <button
                    type="button"
                    disabled={loadingAction === 'bingo' || game.status !== 'playing'}
                    onClick={handleClaimBingo}
                    className="w-full py-3 bg-[#ed8936] hover:bg-orange-600 text-white text-base font-black rounded-full flex items-center justify-center gap-2 transition shadow-lg shadow-orange-500/10 active:scale-98 disabled:opacity-50"
                  >
                    {loadingAction === 'bingo' ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      'Bingo'
                    )}
                  </button>
                </div>

                {/* BOTTOM NAVIGATION ACTIONS */}
                <div className="grid grid-cols-2 gap-3 select-none text-xs shrink-0">
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="py-2.5 bg-[#4299e1] hover:bg-blue-600 text-white font-bold rounded-full flex items-center justify-center gap-1.5 transition shadow-md"
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>

                  <button
                    type="button"
                    disabled={loadingAction === 'leaving'}
                    onClick={handleLeaveGame}
                    className="py-2.5 bg-[#e53e3e] hover:bg-red-600 text-white font-bold rounded-full flex items-center justify-center gap-1.5 transition shadow-md"
                  >
                    {loadingAction === 'leaving' ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <>
                         <LogOut size={12} /> Leave Game
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

            {/* Simulated Android Home Button bar */}
            <div className="h-6 flex items-center justify-center shrink-0">
              <div className="w-28 h-1 bg-zinc-600/80 rounded-full hover:bg-zinc-500 transition cursor-pointer" />
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
