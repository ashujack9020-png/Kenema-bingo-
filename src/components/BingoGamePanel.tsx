import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy } from 'lucide-react';
import { BingoGame } from '../types.js';

interface BingoGamePanelProps {
  game: BingoGame;
}

export default function BingoGamePanel({ game }: BingoGamePanelProps) {
  const { drawnNumbers, status } = game;
  const lastDrawn = drawnNumbers.length > 0 ? drawnNumbers[drawnNumbers.length - 1] : null;

  // Mappings for letters
  const getLetterInfo = (num: number) => {
    if (num <= 15) return { letter: 'ቢ', sub: 'B', color: 'border-red-500 text-red-400 bg-red-500/10' };
    if (num <= 30) return { letter: 'ን', sub: 'I', color: 'border-blue-500 text-blue-400 bg-blue-500/10' };
    if (num <= 45) return { letter: 'ጎ', sub: 'N', color: 'border-amber-500 text-amber-400 bg-amber-500/10' };
    if (num <= 60) return { letter: 'ፕ', sub: 'G', color: 'border-purple-500 text-purple-400 bg-purple-500/10' };
    return { letter: 'ያ', sub: 'O', color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' };
  };

  const currentLetterInfo = lastDrawn ? getLetterInfo(lastDrawn) : null;

  // Grid headers and ranges
  const categories = [
    { label: 'ቢ', eng: 'B', range: [1, 15] },
    { label: 'ን', eng: 'I', range: [16, 30] },
    { label: 'ጎ', eng: 'N', range: [31, 45] },
    { label: 'ፕ', eng: 'G', range: [46, 60] },
    { label: 'ያ', eng: 'O', range: [61, 75] },
  ];

  // Helper to check if a number is drawn
  const isDrawn = (num: number) => drawnNumbers.includes(num);

  // Past drawn history (excluding the current one)
  const history = drawnNumbers.slice(0, -1).slice(-5).reverse();

  return (
    <div id="game_panel" className="bg-[#111114] border border-zinc-800 rounded-3xl p-6 shadow-xl text-zinc-100 flex flex-col gap-6">
      
      {/* Dynamic Ball Caller Showcase */}
      <div className="bg-[#0a0a0c] border border-zinc-800/80 rounded-3xl p-5 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden min-h-[220px]">
        
        {/* Background Ambient Glow */}
        <div className="absolute inset-0 bg-radial from-sky-500/5 via-transparent to-transparent pointer-events-none" />

        {/* Left Side: Large Active Ball */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center border-r border-zinc-800/60 md:pr-6 pb-6 md:pb-0">
          <AnimatePresence mode="wait">
            {lastDrawn ? (
              <motion.div
                key={lastDrawn}
                initial={{ scale: 0.3, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.8, rotate: 90, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                className="flex flex-col items-center"
              >
                {/* Visual Bingo Ball */}
                <div className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center bg-zinc-950 active-ball-pulse relative shadow-2xl ${currentLetterInfo?.color}`}>
                  <span className="text-xl font-bold uppercase tracking-wider text-zinc-400">
                    {currentLetterInfo?.letter} <span className="text-sm font-mono opacity-80">({currentLetterInfo?.sub})</span>
                  </span>
                  <span className="text-5xl font-extrabold text-white tracking-tighter font-mono -mt-1">
                    {lastDrawn.toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1">
                  🎯 እጣ ቁጥር {drawnNumbers.length} / 75
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-6">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center text-zinc-700 mb-3 mx-auto">
                  🎟
                </div>
                <div className="text-sm font-bold text-zinc-400">እጣ በመጠባበቅ ላይ</div>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-[200px]">
                  {status === 'lobby' ? 'ጨዋታው ሲጀመር የመጀመሪያው እጣ እዚህ ይታያል' : 'አስተዳዳሪው እጣ እንዲያወጣ ይጠብቁ'}
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Last 5 Drawn Balls History Trail */}
        <div className="w-full md:w-1/2 flex flex-col justify-center">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
            ያለፉት የወጡ እጣዎች (Recent Calls)
          </h4>
          <div className="flex gap-2.5 items-center min-h-[56px]">
            {history.length === 0 ? (
              <span className="text-xs text-zinc-600 italic">የወጡ እጣዎች ታሪክ እዚህ ይታያል...</span>
            ) : (
              <AnimatePresence>
                {history.map((num, idx) => {
                  const info = getLetterInfo(num);
                  return (
                    <motion.div
                      key={num}
                      initial={{ scale: 0.6, opacity: 0, x: -20 }}
                      animate={{ scale: 1, opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      className={`w-11 h-11 rounded-full border flex flex-col items-center justify-center text-[10px] bg-zinc-950/80 shadow-md ${info.color}`}
                    >
                      <span className="font-bold">{info.letter}</span>
                      <span className="font-mono font-bold -mt-1">{num}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-zinc-800/80 flex justify-between items-center">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">የሽልማት ገንዳ (Prize Pool)</div>
              <div className="text-sm font-bold text-amber-400 flex items-center gap-1">
                <Sparkles size={14} className="text-amber-400 animate-pulse" /> {game.prizePool}
              </div>
            </div>
            {status === 'finished' && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-bounce">
                <Trophy size={13} /> ጨዋታው ተጠናቋል!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Master 75-Ball Caller Screen (The Large Board) */}
      <div>
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
          📊 የቢንጎ እጣ ሰሌዳ (Bingo Master Board)
        </h3>

        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.label} className="flex gap-2 items-center">
              {/* Category Marker Column */}
              <div className={`w-10 h-9 rounded-xl border flex flex-col items-center justify-center text-xs font-bold font-sans tracking-tight shrink-0 shadow-sm ${
                cat.label === 'ቢ' ? 'border-red-500/30 text-red-400 bg-red-500/5' :
                cat.label === 'ን' ? 'border-sky-500/30 text-sky-400 bg-sky-500/5' :
                cat.label === 'ጎ' ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' :
                cat.label === 'ፕ' ? 'border-purple-500/30 text-purple-400 bg-purple-500/5' :
                'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
              }`}>
                <span>{cat.label}</span>
                <span className="text-[8px] opacity-60 font-mono -mt-0.5">({cat.eng})</span>
              </div>

              {/* Number Boxes Grid (1 to 15 per row) */}
              <div className="flex-1 grid grid-cols-15 gap-1">
                {Array.from({ length: cat.range[1] - cat.range[0] + 1 }, (_, i) => cat.range[0] + i).map((num) => {
                  const drawn = isDrawn(num);
                  const isLast = lastDrawn === num;

                  let activeBg = 'bg-zinc-400 text-zinc-950 border-zinc-300';
                  if (cat.label === 'ቢ') activeBg = 'bg-red-500 text-zinc-950 border-red-400 shadow-lg shadow-red-500/10';
                  if (cat.label === 'ን') activeBg = 'bg-sky-500 text-zinc-950 border-sky-400 shadow-lg shadow-sky-500/10';
                  if (cat.label === 'ጎ') activeBg = 'bg-amber-500 text-zinc-950 border-amber-400 shadow-lg shadow-amber-500/10';
                  if (cat.label === 'ፕ') activeBg = 'bg-purple-500 text-zinc-950 border-purple-400 shadow-lg shadow-purple-500/10';
                  if (cat.label === 'ያ') activeBg = 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-lg shadow-emerald-500/10';

                  return (
                    <div
                      key={num}
                      className={`h-9 rounded-lg border flex items-center justify-center font-mono text-[11px] font-bold transition-all duration-300 ${
                        isLast ? 'ring-2 ring-white animate-pulse' : ''
                      } ${
                        drawn
                          ? `${activeBg} border-2`
                          : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-600 hover:border-zinc-700 hover:text-zinc-500'
                      }`}
                    >
                      {num.toString().padStart(2, '0')}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
