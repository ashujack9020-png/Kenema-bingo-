import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Smartphone, User, Coins, RefreshCw, LogOut, Trophy, 
  Wifi, Battery, ShieldAlert, Sparkles, CheckCircle2, Volume2, VolumeX,
  Settings, Save, Plus, Edit, X
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
  // Preset profiles for simulation with persistent local storage
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bela_bingo_selected_profile_id');
      if (saved) return saved;
    }
    return 'sim_fitsum_a';
  });
  const [customName, setCustomName] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [customBalance, setCustomBalance] = useState('500');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customProfiles, setCustomProfiles] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bela_bingo_custom_profiles');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });

  const [showProfileModal, setShowProfileModal] = useState(false);

  // Sync profile selections and custom profiles persistently in background
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bela_bingo_selected_profile_id', selectedProfileId);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bela_bingo_custom_profiles', JSON.stringify(customProfiles));
    }
  }, [customProfiles]);

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
  const [isAddingAnotherCard, setIsAddingAnotherCard] = useState<boolean>(false);

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
  const activePlayersInGame = game.players.filter(p => p.id === activeProfile.id);
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);

  // Auto-reset active card index if it gets out of bounds
  useEffect(() => {
    if (activeCardIndex >= activePlayersInGame.length && activeCardIndex !== 0) {
      setActiveCardIndex(0);
    }
  }, [activePlayersInGame.length, activeCardIndex]);

  const activePlayerInGame = activePlayersInGame[activeCardIndex] || null;

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
      // Select the newly added card (it will be at the end of the players list)
      setTimeout(() => {
        setActiveCardIndex(prev => prev + 1);
      }, 500);
      setIsAddingAnotherCard(false);
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

  // 3. Leave Game (Specific active card)
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
          text: `/leave ${activePlayerInGame.cardNumber}`,
          userId: activeProfile.id
        })
      });
      if (!res.ok) throw new Error('ጨዋታውን መልቀቅ አልተቻለም');

      setStatusMessage({ text: `👋 ከካርድ ቁጥር #${activePlayerInGame.cardNumber} ወጥተዋል፣ መወራረቢያዎ ተመላሽ ሆኗል።`, type: 'info' });
      // Reset active card index to 0
      setActiveCardIndex(0);
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: `❌ ስህተት፡ ${err.message}`, type: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. Leave All Games
  const handleLeaveAll = async () => {
    if (activePlayersInGame.length === 0) return;
    setLoadingAction('leaving-all');
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

      setStatusMessage({ text: '👋 ከሁሉም ቢንጎ ካርታዎችዎ ወጥተዋል፣ መወራረቢያዎ ተመላሽ ሆኗል።', type: 'info' });
      setActiveCardIndex(0);
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

  // Premium Gaming Chip styling for each stake amount (Optimized for gorgeous light-mode contrasts)
  const getChipStyle = (amt: number) => {
    switch(amt) {
      case 10: return { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100', chosen: 'bg-emerald-500 border-emerald-400 text-white shadow-lg font-black scale-105' };
      case 20: return { bg: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100', chosen: 'bg-blue-500 border-blue-400 text-white shadow-lg font-black scale-105' };
      case 30: return { bg: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100', chosen: 'bg-amber-500 border-amber-400 text-white shadow-lg font-black scale-105' };
      case 50: return { bg: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100', chosen: 'bg-indigo-500 border-indigo-400 text-white shadow-lg font-black scale-105' };
      case 100: return { bg: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100', chosen: 'bg-purple-500 border-purple-400 text-white shadow-lg font-black scale-105' };
      case 200: return { bg: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100', chosen: 'bg-rose-500 border-rose-400 text-white shadow-lg font-black scale-105' };
      case 500: return { bg: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100', chosen: 'bg-cyan-500 border-cyan-400 text-white shadow-lg font-black scale-105' };
      case 1000: return { bg: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100', chosen: 'bg-orange-500 border-orange-400 text-white shadow-lg font-black scale-105' };
      default: return { bg: 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200', chosen: 'bg-slate-800 border-slate-700 text-white shadow-lg font-black scale-105' };
    }
  };

  // Uniform beautiful card selector styling - TAKEN CARDS ARE FULLY PAINTED IN RED COLOR
  const getCardBgColor = (num: number, isSelected: boolean, isTaken: boolean) => {
    if (isSelected) {
      return 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-400 font-black shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-110 z-10';
    }
    if (isTaken) {
      // FULLY RED CARD BACKGROUND AS REQUESTED BY USER (የተያዙ ካርዶች ሙሉ ለሙሉ በቀይ ከለር ይቀቡ)
      return 'bg-red-600 border-red-500 text-white font-black shadow-md cursor-not-allowed';
    }
    
    // Beautiful clean white-adjacent button for gorgeous contrast and consistency
    return 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-400 shadow-sm transition-all duration-200';
  };

  // Uniform custom styling for play squares matching the card selector exactly
  const getPlaySquareStyle = (cell: any, rIdx: number, cIdx: number) => {
    const isFree = rIdx === 2 && cIdx === 2;
    const marked = cell.marked;

    if (isFree) {
      return 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black shadow-[0_0_12px_rgba(16,185,129,0.4)] border-emerald-400 scale-102 ring-2 ring-emerald-300/40 animate-pulse';
    }

    if (marked) {
      // Beautiful uniform emerald green matching chip color
      return 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400 text-white font-black ring-2 ring-emerald-300/40 shadow-md scale-102';
    } else {
      // Uniform gorgeous light mode squares for high contrast and extreme readability
      return 'bg-white border-slate-200 text-slate-800 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 shadow-sm';
    }
  };

  // Calculate dynamic "Derash" (80% of stakes or customized)
  const derashPrize = game.status !== 'idle' 
    ? (game.players.length * game.betAmount * 0.8) 
    : 40;

  return (
    <div className="flex justify-center items-center w-full min-h-screen py-4 px-4 bg-[#f8fafc] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.03),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.03),transparent_45%)] relative select-none overflow-hidden">
      
      {/* Decorative ambient background lights for a premium professional look */}
      <div className="absolute top-1/4 left-1/10 w-80 h-80 rounded-full bg-emerald-500/3 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 rounded-full bg-sky-500/3 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/2 blur-[180px] pointer-events-none" />
      
      {/* Confetti Celebration overlay */}
      {confettiActive && (
        <div className="absolute pointer-events-none z-50 animate-bounce text-center text-3xl md:text-4xl text-amber-500 font-black">
          🎉✨🏆 BINGO! WINNER! 🏆✨🎉
        </div>
      )}

      {/* Smartphone Casing container (Premium metallic silver design) */}
      <div className="relative mx-auto w-full max-w-[420px] bg-slate-200 border-[12px] border-slate-300 rounded-[52px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col min-h-[780px]">
          
          {/* Smartphone Ear Speaker & Camera Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-slate-300 rounded-b-2xl z-50 flex items-center justify-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <div className="w-12 h-1 bg-slate-400 rounded-full" />
          </div>

          {/* Smartphone Screen Inner content (Polished white-adjacent canvas) */}
          <div className="flex-1 flex flex-col text-slate-800 pt-6 relative select-none font-sans bg-[#f8fafc]">
            
            {/* PROFILES MANAGER / SIMULATOR OVERLAY DIALOG */}
            <AnimatePresence>
              {showProfileModal && (
                <motion.div 
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="absolute inset-0 bg-white/98 backdrop-blur-md z-50 flex flex-col p-5 justify-between font-sans text-slate-800"
                >
                  <div className="space-y-4">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <User size={18} className="text-orange-500" />
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">የተጫዋች መገለጫ (Profiles)</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowProfileModal(false)}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Switch profile section */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">ተጫዋች ይምረጡ (Select Profile)</label>
                      <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto custom-scrollbar">
                        {allProfiles.map((p) => {
                          const isSelected = p.id === selectedProfileId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedProfileId(p.id);
                                setShowProfileModal(false);
                              }}
                              className={`p-3 rounded-xl border text-left flex items-center justify-between transition ${
                                isSelected
                                  ? 'bg-orange-500/10 border-orange-500/40 text-white font-black'
                                  : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black uppercase ${
                                  isSelected ? 'bg-orange-500 text-slate-950' : 'bg-zinc-850 text-zinc-400'
                                }`}>
                                  {p.firstName.charAt(0)}
                                </div>
                                <div>
                                  <div className="text-xs font-bold">{p.firstName}</div>
                                  <div className="text-[9px] text-zinc-500 font-mono">@{p.username}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-mono font-bold text-emerald-400">{p.balance.toFixed(2)} Birr</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Create custom profile section */}
                    <div className="border-t border-zinc-800/80 pt-3">
                      <label className="block text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider mb-2">አዲስ ተጫዋች ፍጠር (Create New Player)</label>
                      
                      <form onSubmit={handleCreateCustom} className="space-y-2">
                        <input
                          type="text"
                          required
                          placeholder="ሙሉ ስም (ለምሳሌ፡ አስቴር)"
                          value={customName}
                          onChange={e => setCustomName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="የቴሌግራም ዩዘር"
                            value={customUsername}
                            onChange={e => setCustomUsername(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
                          />
                          <input
                            type="number"
                            required
                            placeholder="ባላንስ (Birr)"
                            value={customBalance}
                            onChange={e => setCustomBalance(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium font-mono"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black rounded-xl transition shadow-md shadow-orange-500/10 flex items-center justify-center gap-1"
                        >
                          <Plus size={12} /> ተጫዋች ፍጠር (Add Player)
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowProfileModal(false)}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl transition"
                    >
                      ተመለስ (Close)
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top Stat/Status Bar */}
            <div className="px-5 py-2 flex justify-between items-center text-[10px] text-slate-500 font-semibold border-b border-slate-200 bg-white">
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
            {(!activePlayerInGame || isAddingAnotherCard) ? (
              /* MULTI-STEP PRE-GAME WIZARD FLOW (User requested) */
              <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] overflow-y-auto custom-scrollbar">
                
                {/* 1. Header Logo (Consistent across all pre-game screens) */}
                <div className="text-center py-4 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-20">
                  <div className="flex items-center justify-center gap-1 text-2xl font-black tracking-tight text-slate-800 uppercase">
                    <span className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-extrabold text-lg shadow-lg shadow-orange-500/20 mr-1">b</span>
                    bela bingo / ቤላ ቢንጎ
                  </div>
                  <p className="text-[9px] text-slate-500 tracking-wider uppercase mt-0.5">Ethiopian Mobile Bingo App</p>
                  
                  {isAddingAnotherCard && (
                    <button
                      type="button"
                      onClick={() => setIsAddingAnotherCard(false)}
                      className="mt-2.5 px-3.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-full text-[10px] font-extrabold transition-all inline-flex items-center gap-1 border border-red-200 shadow-sm"
                    >
                      ✕ ወደ ጨዋታው ተመለስ (Back to Game)
                    </button>
                  )}
                </div>

                <div className="flex-1 flex flex-col p-5 justify-between gap-4">
                  
                  {/* Status Banner inside phone screen */}
                  <AnimatePresence mode="wait">
                    {statusMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className={`p-3 rounded-2xl border text-[10.5px] leading-relaxed font-bold shadow-lg flex items-start gap-2 shrink-0 ${
                          statusMessage.type === 'success' 
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                            : statusMessage.type === 'error'
                            ? 'bg-red-500/15 border-red-500/30 text-red-400'
                            : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                        }`}
                      >
                        <ShieldAlert className="shrink-0 mt-0.5 text-orange-400" size={13} />
                        <div className="flex-1">
                          {statusMessage.text}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                   {/* Active Game / Countdown Banner warn if game is in progress */}
                  {game.status === 'playing' && (
                    game.isOvertime ? (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-[10px] text-amber-300 flex items-start gap-2 shrink-0 animate-pulse">
                        <span className="text-xs">⚡</span>
                        <div className="flex-1">
                          <div className="font-extrabold text-amber-400 text-xs">ተጨማሪ እጣ! (Overtime Mode Active!)</div>
                          <p className="text-zinc-400 mt-0.5 leading-relaxed">
                            ከ 25 በላይ ካርዶች በመያዛቸው ምክንያት አሸናፊ እስኪገኝ ድረስ እጣ ማውጣቱ ይቀጥላል! 🎰
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-purple-500/10 border border-purple-500/25 rounded-2xl p-3 text-[10px] text-purple-300 flex items-start gap-2 shrink-0 animate-pulse">
                        <span className="text-xs">🎮</span>
                        <div className="flex-1">
                          <div className="font-extrabold text-purple-400 text-xs">ጨዋታ በመካሄድ ላይ ነው!</div>
                          <p className="text-zinc-400 mt-0.5 leading-relaxed">
                            የአሁኑ ዙር ለመጠናቀቅ <b>{game.gameTimeLeft || 90} ሰከንድ</b> ቀረው። ምዝገባው እንደተጠናቀቀ አዲስ ጨዋታ በራስ-ሰር ይጀምራል!
                          </p>
                        </div>
                      </div>
                    )
                  )}

                  {game.status === 'finished' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-3 text-[10px] text-emerald-300 flex items-start gap-2 shrink-0">
                      <span className="text-xs">🏆</span>
                      <div className="flex-1">
                        <div className="font-extrabold text-emerald-400 text-xs">ጨዋታ ተጠናቋል!</div>
                        <p className="text-zinc-400 mt-0.5 leading-relaxed">
                          አዲሱ ዙር ለመጀመር <b>{game.nextGameCountdown || 8} ሰከንድ</b> ይቀረዋል። እባክዎን ይጠብቁ...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Elegant Active Profile HUD */}
                  <div className="bg-[#0b1420]/80 border border-[#152336] rounded-2xl p-3 flex items-center justify-between shrink-0 select-none">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-400 border border-orange-500/20 flex items-center justify-center font-black text-sm uppercase">
                        {activeProfile.firstName.charAt(0)}
                      </div>
                      <div>
                        <span className="text-[8px] text-zinc-500 block uppercase font-extrabold tracking-wider">ተጫዋች (Active Profile)</span>
                        <div className="flex items-center gap-1.5 -mt-0.5">
                          <span className="text-xs font-black text-white">{activeProfile.firstName}</span>
                          <span className="text-[9px] text-zinc-400 font-mono">@{activeProfile.username}</span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setShowProfileModal(true)}
                      className="text-[9px] font-black bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 px-2.5 py-1.5 rounded-xl transition-all"
                    >
                      ቀይር (Switch)
                    </button>
                  </div>
                  
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
                            const chip = getChipStyle(amt);
                            return (
                              <button
                                key={amt}
                                type="button"
                                disabled={!affordable}
                                onClick={() => setSelectedStake(amt)}
                                className={`py-3 rounded-2xl border font-mono text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 relative ${
                                  isChosen
                                    ? chip.chosen
                                    : affordable
                                    ? chip.bg
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
                              }
                            }}
                            className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-xl px-3 py-2 text-xs font-bold transition shrink-0 flex items-center gap-1"
                          >
                            🎲 ራስ-ሰር
                          </button>
                        </div>

                        {/* Grid of all 400 Cards scrolling downwards */}
                        <div className="grid grid-cols-10 gap-1 max-h-[300px] overflow-y-auto pr-1 select-none custom-scrollbar border border-zinc-800/40 p-2 rounded-2xl bg-[#070d14]">
                          {(() => {
                            const cards = Array.from({ length: 400 }, (_, i) => i + 1);

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
                                  className={`h-8 rounded-lg text-[10px] font-mono font-bold border transition flex items-center justify-center relative ${
                                    getCardBgColor(num, isSelected, isTaken)
                                  }`}
                                >
                                  <span>{num}</span>
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
                                let previewStyle = 'bg-zinc-900 border border-zinc-800 text-zinc-300';
                                if (isCenter) {
                                  previewStyle = 'bg-emerald-500/20 text-emerald-400 font-black border border-emerald-500/30';
                                } else {
                                  switch (cIdx) {
                                    case 0: previewStyle = 'bg-red-950/25 text-red-300 border border-red-900/10'; break;
                                    case 1: previewStyle = 'bg-blue-950/25 text-blue-300 border border-blue-900/10'; break;
                                    case 2: previewStyle = 'bg-emerald-950/25 text-emerald-300 border border-emerald-900/10'; break;
                                    case 3: previewStyle = 'bg-amber-950/25 text-amber-300 border border-amber-900/10'; break;
                                    case 4: previewStyle = 'bg-purple-950/25 text-purple-300 border border-purple-900/10'; break;
                                  }
                                }
                                return (
                                  <div
                                    key={`${rIdx}-${cIdx}`}
                                    className={`h-[15px] rounded-[3px] text-[8px] font-mono font-bold flex items-center justify-center ${previewStyle}`}
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
                  <div className="bg-white border border-slate-200 rounded-xl py-1 px-1 shadow-sm">
                    <div className="text-[8px] text-slate-500 uppercase font-semibold">Games</div>
                    <div className="text-[11px] font-black font-mono text-slate-800">1</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl py-1 px-1 shadow-sm">
                    <div className="text-[8px] text-slate-500 uppercase font-semibold">Derash</div>
                    <div className="text-[11px] font-black font-mono text-amber-600">{derashPrize}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl py-1 px-1 shadow-sm">
                    <div className="text-[8px] text-slate-500 uppercase font-semibold">Players</div>
                    <div className="text-[11px] font-black font-mono text-slate-800">{game.players.length}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl py-1 px-1 shadow-sm">
                    <div className="text-[8px] text-slate-500 uppercase font-semibold">Bet</div>
                    <div className="text-[11px] font-black font-mono text-slate-800">{game.betAmount}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl py-1 px-1 shadow-sm">
                    <div className="text-[8px] text-slate-500 uppercase font-semibold">Call</div>
                    <div className="text-[11px] font-black font-mono text-slate-800">{game.drawnNumbers.length}</div>
                  </div>
                </div>

                {/* MAIN CONTENT GRID: LEFT 75-BOARD VS RIGHT CONTROLS */}
                <div className="grid grid-cols-12 gap-2 flex-1 items-stretch select-none">
                  
                  {/* LEFT COLUMN: 75-NUMBER TABLE (Span 5) */}
                  <div className="col-span-5 bg-white border border-slate-200 rounded-2xl p-2 flex flex-col gap-1 justify-between shadow-sm">
                    
                    {/* B I N G O Header Row */}
                    <div className="grid grid-cols-5 gap-0.5 text-center font-sans pb-1.5 border-b border-slate-100">
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

                          let cellStyle = 'bg-slate-50 border-slate-100 text-slate-400 font-medium';
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
                    <div className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 flex items-center justify-between text-[10px] font-bold text-slate-600 shadow-sm">
                      <span>ማብቂያ ጊዜ (Time Left)</span>
                      {game.isOvertime ? (
                        <span className="font-mono text-rose-600 font-black animate-pulse text-[9px] bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-lg">
                          ተጨማሪ እጣ (Overtime)
                        </span>
                      ) : (
                        <span className="font-mono text-rose-600 font-black animate-pulse">
                          {game.gameTimeLeft !== undefined ? `${game.gameTimeLeft}s` : '90s'}
                        </span>
                      )}
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
                    <div className="bg-white border border-slate-200 rounded-2xl p-2 flex flex-col gap-1 shadow-inner flex-1 justify-between shadow-sm">
                      
                      {/* Winning Patterns HUD */}
                      <div className="flex gap-1.5 justify-center items-center py-1 border-b border-slate-100 mb-1 select-none overflow-x-auto custom-scrollbar shrink-0">
                        <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider shrink-0">የአሸናፊነት ቅጦች (PATTERNS):</span>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[7px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                          ➖ መስመር (Line)
                        </span>
                        <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[7px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                          📐 ሰያፍ (Diagonal)
                        </span>
                        <span className="bg-purple-50 text-purple-700 border border-purple-100 text-[7px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
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
                            const squareStyle = getPlaySquareStyle(cell, rIdx, cIdx);

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
                    className="py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-full flex items-center justify-center gap-1.5 transition shadow-md"
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>

                  <button
                    type="button"
                    disabled={loadingAction === 'leaving'}
                    onClick={handleLeaveGame}
                    className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full flex items-center justify-center gap-1.5 transition shadow-md"
                  >
                    {loadingAction === 'leaving' ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <>
                         <LogOut size={12} /> Leave Card
                      </>
                    )}
                  </button>
                </div>

                {activePlayersInGame.length > 1 && (
                  <div className="mt-2 text-center shrink-0">
                    <button
                      type="button"
                      disabled={loadingAction === 'leaving-all'}
                      onClick={handleLeaveAll}
                      className="text-[10px] text-red-500 font-extrabold hover:underline"
                    >
                      {loadingAction === 'leaving-all' ? 'Leaving all...' : '✕ ከሁሉም ካርዶች ውጣ (Leave All Cards)'}
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* Simulated Android Home Button bar */}
            <div className="h-6 flex items-center justify-center shrink-0">
              <div className="w-28 h-1 bg-zinc-600/80 rounded-full hover:bg-zinc-500 transition cursor-pointer" />
            </div>

          </div>
        </div>

      </div>
    );
  }
