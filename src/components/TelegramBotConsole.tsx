import React, { useState } from 'react';
import { Send, Terminal, Settings, HelpCircle, Cpu, Check, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import { TelegramBotConfig, TelegramLog } from '../types.js';

interface TelegramBotConsoleProps {
  config: TelegramBotConfig & { hasToken?: boolean };
  logs: TelegramLog[];
  onRefresh: () => void;
}

export default function TelegramBotConsole({ config, logs, onRefresh }: TelegramBotConsoleProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // Simulator State
  const [simUser, setSimUser] = useState('Dawit_A');
  const [simName, setSimName] = useState('ዳዊት');
  const [simText, setSimText] = useState('/join');
  const [isSimulating, setIsSimulating] = useState(false);

  // Saved presets
  const simUsers = [
    { username: 'Dawit_A', name: 'ዳዊት' },
    { username: 'Selam_K', name: 'ሰላም' },
    { username: 'Abebe_B', name: 'አበበ' },
    { username: 'Aster_M', name: 'አስቴር' },
  ];

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/config/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to connect bot');
      }
      setTokenInput('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/config/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simText.trim()) return;
    setIsSimulating(true);
    try {
      const res = await fetch('/api/game/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: simUser,
          firstName: simName,
          text: simText,
        }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      setSimText('');
      onRefresh();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div id="bot_console" className="bg-[#111114] border border-zinc-800 rounded-3xl p-6 shadow-xl text-zinc-100 flex flex-col gap-6">
      
      {/* Bot Connection status & config */}
      <div className="border-b border-zinc-800/60 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl">
              <Cpu size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold font-sans tracking-tight">የአገልጋይ ቦት መቆጣጠሪያ</h2>
              <p className="text-xs text-zinc-500">Telegram Bot API Core</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${config.isActive ? 'bg-sky-400 animate-pulse' : 'bg-zinc-700'}`} />
            <span className={`text-xs font-semibold uppercase ${config.isActive ? 'text-sky-400' : 'text-zinc-500'}`}>
              {config.isActive ? 'የሚሰራ (Active)' : 'ያልተገናኘ (Disconnected)'}
            </span>
          </div>
        </div>

        {/* Bot Token Inputs */}
        {!config.isActive ? (
          <form onSubmit={handleConnectToken} className="space-y-3">
            <div className="text-xs text-zinc-400 leading-relaxed mb-1">
              ጨዋታውን በቴሌግራም ላይ በእውነተኛ ተጫዋቾች ለማጫወት የእርስዎን <b>የቴሌግራም ቦት ቶክን (Bot Token)</b> ያስገቡ፡
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-sky-500 font-mono text-zinc-100"
              />
              <button
                type="submit"
                disabled={isConnecting || !tokenInput}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-xs font-bold rounded-xl transition flex items-center gap-1 shrink-0 text-zinc-950"
              >
                {isConnecting ? 'በማገናኘት...' : 'አገናኝ (Connect)'}
              </button>
            </div>
            {errorMsg && (
              <div className="p-2.5 bg-red-950/20 border border-red-900/50 text-red-400 text-[11px] rounded-lg flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}
            {config.error && !errorMsg && (
              <div className="p-2.5 bg-red-950/20 border border-red-900/50 text-red-400 text-[11px] rounded-lg flex items-center gap-2">
                <AlertCircle size={14} />
                <span>ቀዳሚ ስህተት: {config.error}</span>
              </div>
            )}
          </form>
        ) : (
          <div className="space-y-3">
            <div className="bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500">የተገናኘው ቦት ተጠቃሚ ስም (Bot Username):</div>
                <div className="text-sm font-bold text-sky-400 font-mono">@{config.botUsername}</div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={isConnecting}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-[11px] font-semibold rounded-xl transition border border-zinc-800 text-zinc-300"
              >
                ግንኙነት አቋርጥ (Disconnect)
              </button>
            </div>
          </div>
        )}

        {/* Tutorial Button Toggle */}
        <button
          onClick={() => setShowTutorial(!showTutorial)}
          className="mt-3 text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-sans"
        >
          <HelpCircle size={13} /> ቦት እንዴት ይፈጠራል? (How to create a Bot?)
        </button>

        {showTutorial && (
          <div className="mt-3 bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl p-4 text-xs text-zinc-300 space-y-2.5 leading-relaxed font-sans animate-fade-in">
            <p className="font-bold text-amber-400">📌 ቦት ለመፍጠር እነዚህን ቀላል ደረጃዎች ይከተሉ፡</p>
            <ol className="list-decimal pl-4 space-y-2">
              <li>በቴሌግራምዎ ላይ <a href="https://t.me/BotFather" target="_blank" className="text-sky-400 underline">@BotFather</a> ፈልገው <b>/start</b> ይበሉ።</li>
              <li>አዲስ ቦት ለመፍጠር <code>/newbot</code> ብለው ይጻፉ።</li>
              <li>ለቦቱ ስም እና መለያ (username) ይስጡ (ለምሳሌ፡ <code>BingoAmharicBot</code>)።</li>
              <li>BotFather የሚሰጥዎትን <b>HTTP API Token</b> ኮፒ አድርገው ከላይ ባለው ሳጥን ውስጥ ያስገቡ።</li>
              <li>ከተገናኘ በኋላ ተጫዋቾች የእርስዎን ቦት በቴሌግራም አግኝተው <b>/start</b> ወይም <b>/join</b> ብለው እንዲጫወቱ ይጋብዙ!</li>
            </ol>
          </div>
        )}
      </div>

      {/* Live Logs Terminal */}
      <div className="flex-1 flex flex-col min-h-[180px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Terminal size={14} /> የቦት እንቅስቃሴዎች (Bot Activity Logs)
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono">Latest 150</span>
        </div>
        
        <div className="flex-1 bg-zinc-950 rounded-2xl p-3 font-mono text-[11px] overflow-y-auto max-h-[190px] border border-zinc-800 space-y-2 select-text custom-scrollbar">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic text-center py-4">እንቅስቃሴዎች እዚህ ይታያሉ (No logs generated yet)</div>
          ) : (
            logs.map((log) => {
              let color = 'text-zinc-400';
              let label = 'SYS';
              if (log.type === 'incoming') {
                color = 'text-sky-400';
                label = '📩 IN';
              } else if (log.type === 'outgoing') {
                color = 'text-emerald-400';
                label = '🤖 OUT';
              } else if (log.type === 'error') {
                color = 'text-red-400 font-semibold';
                label = '⚠️ ERR';
              }

              return (
                <div key={log.id} className="border-b border-zinc-900/45 pb-1.5 last:border-0">
                  <div className="flex items-center gap-1.5 text-[9px] text-zinc-500">
                    <span>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={`font-bold ${color}`}>{label}</span>
                    <span className="text-zinc-400">@{log.username}</span>
                  </div>
                  <div className={`mt-0.5 whitespace-pre-wrap leading-normal pl-2 border-l border-zinc-800 ${log.type === 'system' ? 'text-zinc-300' : 'text-zinc-200'}`}>
                    {log.message}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Offline Telegram Simulator Chat Box */}
      <div className="bg-[#0a0a0c] border border-zinc-800/60 rounded-2xl p-4 mt-auto">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          💬 የቴሌግራም ማስመሰያ (offline Simulator)
        </h3>
        <p className="text-[10px] text-zinc-500 mb-3 leading-relaxed">
          ቦቱ በቴሌግራም ላይ እንዴት እንደሚሰራ እዚህ ላይ መሞከር ይችላሉ። ተጠቃሚ መርጠው ትዕዛዞችን ይላኩ።
        </p>

        <form onSubmit={handleSimulate} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1">ተጫዋች (Username):</label>
              <select
                value={simUser}
                onChange={(e) => {
                  setSimUser(e.target.value);
                  const selected = simUsers.find(u => u.username === e.target.value);
                  if (selected) setSimName(selected.name);
                }}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs focus:outline-none focus:border-sky-500 text-zinc-200"
              >
                {simUsers.map(u => (
                  <option key={u.username} value={u.username}>@{u.username} ({u.name})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 mb-1">ትዕዛዞች (Commands):</label>
              <select
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs focus:outline-none focus:border-sky-500 text-zinc-200 font-mono"
              >
                <option value="/start">/start (ሰላምታ)</option>
                <option value="/play">/play (በዌብአፕ ለመጫወት)</option>
                <option value="play">play (የአማራጭ ጽሁፍ)</option>
                <option value="/join">/join (ቀላቅል)</option>
                <option value="/card">/card (ካርታዬ)</option>
                <option value="/bingo">/bingo (ቢንጎ!)</option>
                <option value="/leave">/leave (ውጣ)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={simText}
              onChange={(e) => setSimText(e.target.value)}
              placeholder="ትዕዛዝ ወይም መልዕክት ይጻፉ..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:border-sky-500 text-zinc-200"
            />
            <button
              type="submit"
              disabled={isSimulating || !simText}
              className="px-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-xs font-semibold rounded-lg text-zinc-950 transition flex items-center justify-center"
            >
              <Send size={12} />
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
