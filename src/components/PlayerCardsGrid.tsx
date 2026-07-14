import React from 'react';
import { Users, User, ArrowUpRight, Trophy } from 'lucide-react';
import { Player } from '../types.js';

interface PlayerCardsGridProps {
  players: Player[];
  drawnNumbers: number[];
}

export default function PlayerCardsGrid({ players, drawnNumbers }: PlayerCardsGridProps) {
  
  // Calculate total marked cells for a player (excluding FREE space center which is pre-marked)
  const getMarkedCount = (player: Player) => {
    let count = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) continue; // Skip FREE
        if (player.card[r][c].marked) count++;
      }
    }
    return count;
  };

  return (
    <div id="players_grid" className="bg-[#111114] border border-zinc-800 rounded-3xl p-6 shadow-xl text-zinc-100 flex flex-col gap-6">
      
      {/* Header section with players count */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl">
            <Users size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-sans tracking-tight">ተሳታፊዎች እና ካርታዎች</h2>
            <p className="text-xs text-zinc-400">Players and Live Bingo Cards</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xl font-extrabold font-mono text-sky-400">{players.length}</span>
          <span className="text-xs text-zinc-500 block">የተመዘገቡ (Joined)</span>
        </div>
      </div>

      {/* Players list and cards grid */}
      {players.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500 bg-[#0a0a0c] border border-zinc-800/60 rounded-3xl border-dashed">
          <div className="text-3xl mb-2">📥</div>
          <p className="text-sm font-bold">አንድም ተጫዋች አልተመዘገበም</p>
          <p className="text-xs text-zinc-600 mt-1 max-w-[280px]">
            ተጫዋቾችን ለመጨመር በአስተዳዳሪው ሳጥን ውስጥ <b>"ቦቶች ጨምር"</b> ይጫኑ ወይም በቴሌግራም <b>/join</b> ይበሉ።
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1 select-none custom-scrollbar">
          {players.map((player) => {
            const markedCount = getMarkedCount(player);
            const totalCells = 24; // 25 - 1 FREE
            const percent = Math.round((markedCount / totalCells) * 100);

            return (
              <div
                key={player.id}
                className={`p-4 rounded-3xl border transition-all duration-300 flex flex-col gap-3.5 relative overflow-hidden ${
                  player.hasWon
                    ? 'bg-amber-500/10 border-amber-500 shadow-xl shadow-amber-500/5'
                    : 'bg-[#0a0a0c] border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                {/* Background Winning Ribbon */}
                {player.hasWon && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-zinc-950 font-bold text-[10px] px-3 py-1 rounded-bl-lg flex items-center gap-1 z-10 animate-pulse">
                    <Trophy size={11} fill="currentColor" /> አሸናፊ (WINNER!)
                  </div>
                )}

                {/* Player Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${player.isSimulated ? 'bg-indigo-500/10 text-indigo-400' : 'bg-sky-500/10 text-sky-400'}`}>
                      <User size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-sans flex items-center gap-1.5 text-zinc-200">
                        {player.firstName}
                        <span className="text-[9px] font-mono font-normal text-zinc-500">@{player.username}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                        <span>{player.isSimulated ? '🤖 ቨርቹዋል ቦት' : '📩 የቴሌግራም ተጫዋች'}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-emerald-400 font-bold font-mono">{(player.balance !== undefined) ? player.balance : 0} Birr</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="text-right">
                    <div className="text-[11px] font-mono font-bold text-zinc-300">
                      {markedCount}/{totalCells}
                    </div>
                    <div className="text-[9px] text-zinc-500">የተገጣጠሙ (Marked)</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-950 rounded-full h-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      player.hasWon ? 'bg-amber-400' : 'bg-sky-400'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* Mini Bingo Card 5x5 */}
                <div className="grid grid-cols-5 gap-1 bg-zinc-950/80 p-2 rounded-2xl border border-zinc-900">
                  {/* Small columns headers */}
                  {['ቢ', 'ን', 'ጎ', 'ፕ', 'ያ'].map((h, i) => (
                    <div key={i} className="text-center text-[10px] font-extrabold text-zinc-500 py-0.5">
                      {h}
                    </div>
                  ))}

                  {/* 25 squares */}
                  {player.card.flatMap((row, rIdx) =>
                    row.map((cell, cIdx) => {
                      const isFree = rIdx === 2 && cIdx === 2;
                      const marked = cell.marked;

                      let cellColor = 'bg-[#0d0d10] text-zinc-500 border-zinc-900/60';
                      if (isFree) {
                        cellColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30 font-bold';
                      } else if (marked) {
                        cellColor = player.hasWon
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/30 font-bold';
                      }

                      return (
                        <div
                          key={`${rIdx}-${cIdx}`}
                          className={`h-7 rounded text-[10px] font-mono flex items-center justify-center border transition-all duration-300 ${cellColor}`}
                        >
                          {isFree ? '🆓' : cell.value.toString().padStart(2, '0')}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Cartela Number */}
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-sans border-t border-zinc-900/60 pt-2">
                  <span>ካርታ ቁጥር (Card Number):</span>
                  <span className="font-mono font-bold text-sky-400">#{player.cardNumber}</span>
                </div>

                {/* Winning details if won */}
                {player.hasWon && player.winningPattern && (
                  <div className="text-[11px] text-amber-400 font-semibold flex items-center justify-between border-t border-amber-500/20 pt-2 mt-0.5">
                    <span>🏆 አሸናፊ ቅጥ:</span>
                    <span className="font-mono">{player.winningPattern}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
