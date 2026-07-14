import React, { useState } from 'react';
import { Play, RotateCcw, Shuffle, Sparkles, Users, Clock, Flame } from 'lucide-react';
import { BingoGame } from '../types.js';

interface ManualControlPanelProps {
  game: BingoGame;
  onRefresh: () => void;
  logs: any[];
}

export default function ManualControlPanel({ game, onRefresh, logs }: ManualControlPanelProps) {
  const [prizeInput, setPrizeInput] = useState(game.prizePool);
  const [intervalInput, setIntervalInput] = useState(game.autoDrawIntervalMs / 1000);
  const [isUpdatingPrize, setIsUpdatingPrize] = useState(false);
  const [isUpdatingInterval, setIsUpdatingInterval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechEnabled, setSpeechEnabled] = useState(false);

  const updatePrize = async () => {
    setIsUpdatingPrize(true);
    setError(null);
    try {
      const res = await fetch('/api/game/prize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prize: prizeInput }),
      });
      if (!res.ok) throw new Error('Failed to update prize');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdatingPrize(false);
    }
  };

  const toggleAutoDraw = async (checked: boolean) => {
    setError(null);
    try {
      const res = await fetch('/api/game/toggle-autodraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoDraw: checked,
          intervalMs: intervalInput * 1000,
        }),
      });
      if (!res.ok) throw new Error('Failed to toggle auto draw');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateInterval = async () => {
    setIsUpdatingInterval(true);
    setError(null);
    try {
      const res = await fetch('/api/game/toggle-autodraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoDraw: game.autoDraw,
          intervalMs: intervalInput * 1000,
        }),
      });
      if (!res.ok) throw new Error('Failed to update interval');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdatingInterval(false);
    }
  };

  const addBots = async () => {
    setError(null);
    try {
      const res = await fetch('/api/game/add-bots', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to add bots');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startGame = async () => {
    setError(null);
    try {
      const res = await fetch('/api/game/start', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start game');
      }
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const drawManual = async () => {
    setError(null);
    try {
      const res = await fetch('/api/game/draw', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to draw ball');
      }
      onRefresh();

      // Audio Announcement if enabled
      if (speechEnabled) {
        const updatedRes = await fetch('/api/game-state');
        const updatedData = await updatedRes.json();
        const drawn = updatedData.game.drawnNumbers;
        if (drawn.length > 0) {
          const lastNum = drawn[drawn.length - 1];
          let letter = '';
          if (lastNum <= 15) letter = 'B';
          else if (lastNum <= 30) letter = 'I';
          else if (lastNum <= 45) letter = 'N';
          else if (lastNum <= 60) letter = 'G';
          else letter = 'O';
          
          const speakText = `${letter}, ${lastNum}`;
          const utterance = new SpeechSynthesisUtterance(speakText);
          utterance.rate = 0.85;
          window.speechSynthesis.speak(utterance);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetGame = async () => {
    setError(null);
    try {
      const res = await fetch('/api/game/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reset game');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div id="control_panel" className="bg-[#111114] border border-zinc-800 rounded-3xl p-6 shadow-xl text-zinc-100 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl">
              <Flame size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-sans tracking-tight">የአስተዳዳሪ መቆጣጠሪያ</h2>
              <p className="text-xs text-zinc-400">Game Master Panel</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
            game.status === 'idle' ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' :
            game.status === 'lobby' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
            game.status === 'playing' ? 'bg-green-500/10 text-green-400 border border-green-500/20 animate-pulse' :
            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {game.status === 'idle' ? 'ገባሪ ያልሆነ (Idle)' :
             game.status === 'lobby' ? 'በመጠባበቅ ላይ (Lobby)' :
             game.status === 'playing' ? 'በመጫወት ላይ (Playing)' : 'ተጠናቋል (Finished)'}
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/20 border border-red-900/50 text-red-400 text-xs rounded-xl flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Prize Pool Config */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              🏆 የጨዋታው ሽልማት (Prize Pool / Custom Info)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Sparkles size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={prizeInput}
                  onChange={(e) => setPrizeInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-amber-500 text-zinc-100 font-sans"
                  placeholder="ለምሳሌ፡ 100 Birr ወይም ካርድ"
                />
              </div>
              <button
                onClick={updatePrize}
                disabled={isUpdatingPrize}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-amber-400 rounded-xl transition duration-150 border border-slate-700 shrink-0"
              >
                {isUpdatingPrize ? 'ማስቀመጥ...' : 'አስቀምጥ'}
              </button>
            </div>
          </div>

          {/* Game Stake Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
              💰 የጨዋታ መክፈያ (Bet Amount / Stake)
            </label>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {[10, 20, 30, 50, 100, 200, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/game/stake', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: amt }),
                      });
                      if (res.ok) onRefresh();
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className={`py-1.5 text-xs font-bold font-mono rounded-xl transition duration-150 border ${
                    game.betAmount === amt
                      ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/10'
                      : 'bg-[#0a0a0c] border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                  }`}
                >
                  {amt} B
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 leading-normal">
              የተጫዋቾች መክፈያ ብር መምረጫ። የጨዋታው ሽልማት አሸናፊው ሲያሸንፍ የሁሉም ተጫዋቾች ድምር 80% (Derash) ሆኖ በራሱ በሂሳብ ሚዛኑ ላይ ይጨመራል።
            </p>
          </div>

          {/* Lobby Actions */}
          <div className="bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Users size={14} /> የጨዋታ አስተዳደር (Lobby Admin)
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={addBots}
                disabled={game.status !== 'lobby' || game.players.length >= game.maxPlayers}
                className="w-full py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition text-zinc-300"
              >
                🤖 ቦቶች ጨምር
              </button>

              <button
                onClick={startGame}
                disabled={game.status !== 'lobby' || game.players.length === 0}
                className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-slate-950 transition shadow-lg shadow-amber-500/10"
              >
                <Play size={14} fill="currentColor" /> ጨዋታ ጀምር
              </button>
            </div>
          </div>

          {/* Draw Settings */}
          <div className="bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Clock size={14} /> ራስ-ሰር እጣ (Auto Draw)
                </h3>
                <p className="text-[10px] text-slate-500">Draws balls automatically</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={game.autoDraw}
                  onChange={(e) => toggleAutoDraw(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-slate-950 peer-checked:after:border-amber-500"></div>
              </label>
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="2"
                max="30"
                value={intervalInput}
                onChange={(e) => setIntervalInput(Math.max(2, Number(e.target.value)))}
                className="w-18 bg-zinc-950 border border-zinc-800 rounded-xl py-1.5 px-3 text-xs text-center focus:outline-none focus:border-amber-500 text-slate-100 font-mono"
              />
              <span className="text-xs text-slate-400">ሴኮንድ (Seconds)</span>
              <button
                onClick={updateInterval}
                disabled={isUpdatingInterval}
                className="ml-auto px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold text-slate-300 rounded-lg transition"
              >
                ቀይር
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game State Control Buttons */}
      <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
        {/* Draw ball manually & voice caller */}
        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={speechEnabled}
              onChange={(e) => setSpeechEnabled(e.target.checked)}
              className="accent-amber-500 rounded focus:ring-0"
            />
            📢 ድምፅ ማጉያ (Speech Caller)
          </label>

          <button
            onClick={drawManual}
            disabled={game.status !== 'playing'}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-600 disabled:from-zinc-800 disabled:to-zinc-800 disabled:opacity-40 text-slate-950 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-sky-400/10 active:scale-98"
          >
            <Shuffle size={16} /> እጣ አውጣ (Draw Ball)
          </button>
        </div>

        <button
          onClick={resetGame}
          className="w-full py-2 px-3 hover:bg-zinc-800/60 border border-zinc-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition"
        >
          <RotateCcw size={13} /> ጨዋታውን እንደገና አስጀምር (Reset Lobby)
        </button>
      </div>
    </div>
  );
}
