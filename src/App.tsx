import React, { useState, useEffect } from 'react';
import { Bot, Gamepad2, Layers, Cpu, Award, RefreshCw, Star, Info, Lock } from 'lucide-react';
import { AppState } from './types.js';
import ManualControlPanel from './components/ManualControlPanel.js';
import TelegramBotConsole from './components/TelegramBotConsole.js';
import BotSettingsPanel from './components/BotSettingsPanel.js';
import BingoGamePanel from './components/BingoGamePanel.js';
import PlayerCardsGrid from './components/PlayerCardsGrid.js';
import PaymentVerificationPanel from './components/PaymentVerificationPanel.js';
import PlayerMobileView from './components/PlayerMobileView.js';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'board' | 'setup' | 'player'>('player');

  // Admin authentication state for control panels
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const pinParam = urlParams.get('admin_pin');
      if (pinParam === 'kenema009020') {
        localStorage.setItem('bela_bingo_admin_auth', 'true');
        return true;
      }
      const host = window.location.hostname;
      // Auto-authenticate as admin if on dev environment
      if (host.includes('ais-dev-') || host.includes('localhost') || host.includes('127.0.0.1')) {
        return true; // Developer/Creator in AI Studio gets full admin access automatically!
      }
      return localStorage.getItem('bela_bingo_admin_auth') === 'true';
    }
    return false;
  });

  // Automatically set tab to 'board' if authenticated via URL param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('admin_pin') === 'kenema009020') {
        setActiveTab('board');
      }
    }
  }, []);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingTab, setPendingTab] = useState<'board' | 'setup' | null>(null);

  // Fetch complete state from Express server
  const fetchState = async () => {
    try {
      const res = await fetch('/api/game-state');
      if (!res.ok) throw new Error('Failed to fetch game state');
      const data: AppState = await res.json();
      setState(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('ግንኙነት ተቋርጧል - እባክዎን ሰርቨሩ እስኪነሳ ይጠብቁ (Express Server Disconnected)');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch to get instant state
    fetchState();

    // Establish WebSocket connection and reliable fallback polling
    let socket: WebSocket | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    // Start with responsive 1.5-second polling by default as a rock-solid baseline
    fallbackInterval = setInterval(fetchState, 1500);

    function connectWS() {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log('⚡ WebSocket Connected for real-time game synchronization');
          setError(null);
          // With active WebSocket, we can safely reduce REST polling overhead to 15s
          if (fallbackInterval) clearInterval(fallbackInterval);
          fallbackInterval = setInterval(fetchState, 15000);
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.event === 'state_update') {
              setState(payload.data);
              setError(null);
              setIsLoading(false);
            }
          } catch (e) {
            // Quietly ignore parsing anomalies
          }
        };

        socket.onclose = () => {
          // Re-engage fast 1.5s backup polling immediately
          if (fallbackInterval) clearInterval(fallbackInterval);
          fallbackInterval = setInterval(fetchState, 1500);

          // Attempt reconnection in the background after 5 seconds
          setTimeout(() => {
            if (!socket || socket.readyState === WebSocket.CLOSED) {
              connectWS();
            }
          }, 5000);
        };

        socket.onerror = () => {
          // Quietly handle connection errors and ensure we are in high-frequency fallback mode
          if (fallbackInterval) {
            clearInterval(fallbackInterval);
          }
          fallbackInterval = setInterval(fetchState, 1500);
        };
      } catch (err) {
        // Fallback immediately to fast REST polling
        if (fallbackInterval) clearInterval(fallbackInterval);
        fallbackInterval = setInterval(fetchState, 1500);
      }
    }

    connectWS();

    return () => {
      if (socket) {
        try {
          socket.close();
        } catch (e) {}
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans gap-4 p-4">
        <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-bold text-zinc-200">የቢንጎ ሰርቨር በመነሳት ላይ ነው...</p>
          <p className="text-xs text-zinc-500 mt-1">Starting full-stack Bingo engine & assets...</p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans p-6">
        <div className="p-5 bg-red-950/20 border border-red-900/50 rounded-3xl max-w-md text-center">
          <p className="text-sm font-bold text-red-400">⚠️ {error || 'ስህተት ተከስቷል'}</p>
          <button onClick={fetchState} className="mt-4 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 rounded-xl text-xs font-semibold">
            እንደገና ሞክር (Retry)
          </button>
        </div>
      </div>
    );
  }

  const { game, config, logs, deposits, withdrawals } = state;

  const isTgWebApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initData;

  // For any normal visitor who is not authenticated as admin (on public shared link),
  // they are instantly routed to the fullscreen mobile player screen with NO headers, footers, or admin tabs!
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[#081018] text-white font-sans p-0 m-0">
        <PlayerMobileView 
          game={game} 
          onRefresh={fetchState} 
          profiles={state.profiles} 
          isTelegramWebApp={isTgWebApp} 
          onUnlockAdmin={() => {
            setPendingTab('board');
            setShowPinModal(true);
            setPinInput('');
            setPinError('');
          }}
        />

        {/* PIN Verification Modal */}
        {showPinModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[#0e131f] border border-[#1e2d3d] rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative">
              <div className="w-12 h-12 bg-amber-500/15 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                <Lock size={22} className="animate-pulse" />
              </div>
              
              <h3 className="text-sm font-black text-white">አስተዳዳሪ ማረጋገጫ (Admin Verification) 🔒</h3>
              <p className="text-xs text-zinc-400 mt-1.5 mb-4 leading-relaxed">
                የቢንጎ ሰሌዳውን ወይም የቦት ማስተካከያውን ለመድረስ እባክዎን የባለቤት ሚስጥር ቁጥር (Admin PIN) ያስገቡ።
              </p>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (pinInput === 'kenema009020') {
                  setIsAdminAuthenticated(true);
                  localStorage.setItem('bela_bingo_admin_auth', 'true');
                  setActiveTab('board');
                  setShowPinModal(false);
                  setPinInput('');
                  setPinError('');
                } else {
                  setPinError('❌ ያስገቡት ሚስጥር ቁጥር የተሳሳተ ነው!');
                }
              }} className="space-y-3">
                <input
                  type="password"
                  placeholder="ባለቤት ሚስጥር ቁጥር (PIN)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full bg-[#070b13] border border-zinc-800 focus:border-amber-500 rounded-xl px-4 py-3 text-center text-sm font-bold text-white font-mono tracking-widest focus:outline-none"
                  autoFocus
                />

                {pinError && (
                  <p className="text-[11px] font-semibold text-red-400">{pinError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinModal(false);
                      setPendingTab(null);
                      setPinInput('');
                      setPinError('');
                    }}
                    className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 text-xs font-bold rounded-xl border border-zinc-800/80 transition"
                  >
                    አቋርጥ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 text-xs font-black rounded-xl transition shadow-md shadow-orange-500/10"
                  >
                    አረጋግጥ
                  </button>
                </div>
              </form>

              <div className="text-[10px] text-zinc-600 mt-4 font-mono">
                Bela Bingo Secure Portal
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-sky-500/30 selection:text-sky-200">
      
      {/* Decorative Top Accent Bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-sky-400 to-amber-500" />

      {/* Header Bar */}
      <header className="border-b border-zinc-800/80 bg-[#111114]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-gradient-to-tr from-blue-600 to-sky-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/10">
              <span className="text-xl font-black text-white">ቢ</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white font-sans">የቴሌግራም ቢንጎ ቦት መቆጣጠሪያ</h1>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-1.5 py-0.5 rounded uppercase">v1.2</span>
              </div>
              <p className="text-xs text-zinc-500">Telegram Bingo Bot & Live Game Center</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status indicators */}
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="bg-[#111114] border border-zinc-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${config.isActive ? 'bg-sky-400' : 'bg-zinc-600'}`} />
                <span className="text-zinc-400">ቦት ስም፡ <b className="text-zinc-200">@{config.botUsername || 'None'}</b></span>
              </div>

              <div className="bg-[#111114] border border-zinc-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
                <span className="text-zinc-400">ሽልማት፡ <b className="text-amber-400">{game.prizePool}</b></span>
              </div>
            </div>

            {/* Quick manual refresh */}
            <button
              onClick={fetchState}
              className="p-2 hover:bg-zinc-800 rounded-xl transition text-zinc-400 hover:text-zinc-200"
              title="Refresh State"
            >
              <RefreshCw size={16} />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        
        {/* Banner Announcement / Warning */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-900/50 rounded-2xl text-red-400 text-xs flex items-center gap-3 animate-pulse">
            <span className="text-base">⚠️</span>
            <div className="flex-1">
              <b>ሰርቨሩ ጋር መገናኘት አልተቻለም (Lost Connection):</b> {error}
            </div>
          </div>
        )}

        {/* Dashboard Tabs for Mobile view and Desktop overview */}
        <div className="flex items-center justify-between mb-6 border-b border-zinc-800/60 pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('player')}
              className={`pb-2 px-4 text-sm font-bold border-b-2 transition ${
                activeTab === 'player'
                  ? 'border-orange-500 text-orange-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              📱 የተጫዋች ስክሪን (Bela Bingo Mobile)
            </button>
            <button
              onClick={() => {
                if (isAdminAuthenticated) {
                  setActiveTab('board');
                } else {
                  setPendingTab('board');
                  setShowPinModal(true);
                  setPinInput('');
                  setPinError('');
                }
              }}
              className={`pb-2 px-4 text-sm font-bold border-b-2 transition ${
                activeTab === 'board'
                  ? 'border-sky-400 text-sky-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              🎮 ቢንጎ ሰሌዳ (Master Caller Board)
            </button>
            <button
              onClick={() => {
                if (isAdminAuthenticated) {
                  setActiveTab('setup');
                } else {
                  setPendingTab('setup');
                  setShowPinModal(true);
                  setPinInput('');
                  setPinError('');
                }
              }}
              className={`pb-2 px-4 text-sm font-bold border-b-2 transition ${
                activeTab === 'setup'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              🤖 የቦት ማስተካከያ (Bot Setup)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-zinc-500 font-mono hidden md:block">
              የአሁኑ ሰዓት (Local System): {state.systemTime}
            </div>
            {isAdminAuthenticated && (
              <button
                onClick={() => {
                  setIsAdminAuthenticated(false);
                  localStorage.removeItem('bela_bingo_admin_auth');
                  setActiveTab('player');
                }}
                className="bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/40 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center gap-1"
                title="Lock Admin Control Panel"
              >
                <Lock size={12} />
                <span>መቆለፊያ (Lock Admin)</span>
              </button>
            )}
          </div>
        </div>

        {/* PIN Verification Modal */}
        {showPinModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[#0e131f] border border-zinc-850 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative">
              <div className="w-12 h-12 bg-amber-500/15 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                <Lock size={22} className="animate-pulse" />
              </div>
              
              <h3 className="text-sm font-black text-white">አስተዳዳሪ ማረጋገጫ (Admin Verification) 🔒</h3>
              <p className="text-xs text-zinc-400 mt-1.5 mb-4 leading-relaxed">
                የቢንጎ ሰሌዳውን ወይም የቦት ማስተካከያውን ለመድረስ እባክዎን የባለቤት ሚስጥር ቁጥር (Admin PIN) ያስገቡ።
              </p>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (pinInput === 'kenema009020') {
                  setIsAdminAuthenticated(true);
                  localStorage.setItem('bela_bingo_admin_auth', 'true');
                  if (pendingTab) {
                    setActiveTab(pendingTab);
                  }
                  setShowPinModal(false);
                  setPinInput('');
                  setPinError('');
                } else {
                  setPinError('❌ ያስገቡት ሚስጥር ቁጥር የተሳሳተ ነው!');
                }
              }} className="space-y-3">
                <input
                  type="password"
                  placeholder="ባለቤት ሚስጥር ቁጥር (PIN)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full bg-[#070b13] border border-zinc-800 focus:border-amber-500 rounded-xl px-4 py-3 text-center text-sm font-bold text-white font-mono tracking-widest focus:outline-none"
                  autoFocus
                />

                {pinError && (
                  <p className="text-[11px] font-semibold text-red-400">{pinError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinModal(false);
                      setPendingTab(null);
                      setPinInput('');
                      setPinError('');
                    }}
                    className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 text-xs font-bold rounded-xl border border-zinc-800/80 transition"
                  >
                    አቋርጥ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 text-xs font-black rounded-xl transition shadow-md shadow-orange-500/10"
                  >
                    አረጋግጥ
                  </button>
                </div>
              </form>

              <div className="text-[10px] text-zinc-600 mt-4 font-mono">
                Bela Bingo Secure Portal
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Content Workspace */}
        <div className="relative">
          {activeTab === 'board' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Side: Bingo Caller & Board Grid (Column span 8) */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <BingoGamePanel game={game} />
                <PlayerCardsGrid players={game.players} drawnNumbers={game.drawnNumbers} />
                <PaymentVerificationPanel deposits={deposits || []} withdrawals={withdrawals || []} onRefresh={fetchState} />
              </div>

              {/* Right Side: Quick Config & Simulator Control (Column span 4) */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <ManualControlPanel game={game} onRefresh={fetchState} logs={logs} />
                
                {/* Short How-to widget */}
                <div className="bg-[#111114] border border-zinc-800 p-5 rounded-3xl">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Info size={14} className="text-amber-400" /> ፈጣን ጨዋታ መመሪያ (How to Play)
                  </h3>
                  <ul className="text-xs text-zinc-400 space-y-2.5 leading-relaxed list-disc pl-4 font-sans">
                    <li>ለጨዋታው <b>"የአስተዳዳሪ መቆጣጠሪያ"</b> ላይ ሽልማቱን ይወስኑ።</li>
                    <li>ተጫዋቾች በቴሌግራም <b>/join</b> ብለው እንዲገቡ ይጠብቁ ወይም <b>"ቦቶች ጨምር"</b>ን በመንካት ማስመሰያ ተጫዋቾችን ይጋብዙ።</li>
                    <li>ተጫዋቾች እንደገቡ <b>"ጨዋታ ጀምር"</b> ይጫኑ። ካርታዎቻቸው በራስ-ሰር ይዘጋጃሉ።</li>
                    <li><b>"ራስ-ሰር እጣ" (Auto Draw)</b> ያብሩ ወይም በእጅ <b>"እጣ አውጣ" (Draw Ball)</b> በመጫን ቁጥር ያውጡ።</li>
                    <li>ተጫዋቾች (ወይም ቨርቹዋል ቦቶች) የካርታቸው መስመር ሲሞላ <b>/bingo</b> በማለት ያሸንፋሉ!</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Side: Bot Connector Console & Live Logs (Column span 8) */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <TelegramBotConsole config={config} logs={logs} onRefresh={fetchState} />
                <BotSettingsPanel settings={state.settings} onRefresh={fetchState} />
              </div>

              {/* Right Side: Simple Host Info Panel (Column span 4) */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="bg-[#111114] border border-zinc-800 rounded-3xl p-6 shadow-xl text-zinc-100">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    ⚡️ ጠቃሚ የቦት መመሪያዎች
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="border-b border-zinc-800/60 pb-3">
                      <div className="text-xs font-bold text-amber-400 mb-1">🎯 ራስ-ሰር ምልክት (Auto Marking)</div>
                      <p className="text-[11px] text-zinc-400 leading-normal">
                        ተጫዋቾች ቁጥሮችን በእጅ መጻፍ ወይም ምልክት ማድረግ አይጠበቅባቸውም! እጣ ሲወጣ ሰርቨሩ በራሱ ምልክት ያደርጋል። ተጫዋቾቹ መስመር ሲሞላላቸው <b>/bingo</b> ብለው መጮህ ብቻ ነው የሚጠበቅባቸው።
                      </p>
                    </div>

                    <div className="border-b border-zinc-800/60 pb-3">
                      <div className="text-xs font-bold text-sky-400 mb-1">🎮 inline ቁልፎች (Inline Buttons)</div>
                      <p className="text-[11px] text-zinc-400 leading-normal">
                        ቦቱ መልዕክት ሲልክ አብረው የሚሄዱት የ <b>"ካርታዬ" (View Card)</b> እና የ <b>"ቢንጎ!" (Claim Bingo)</b> ቁልፎች ተጫዋቾች ትዕዛዞቹን በቀላሉ በአንድ ንኪኪ እንዲያከናውኑ ይረዳቸዋል።
                      </p>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-emerald-400 mb-1">🔒 ደህንነት እና ሚስጥር (Security)</div>
                      <p className="text-[11px] text-zinc-400 leading-normal">
                        የእርስዎ የቴሌግራም ቦት ቶክን (Token) ደህንነቱ በተጠበቀ ሁኔታ በሰርቨሩ ማህደረ ትውስታ ውስጥ ብቻ ይቀመጣል። መቼም ቢሆን ወደ ተጠቃሚው መመልከቻ (Browser) አይላክም።
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111114]/60 border border-zinc-800 rounded-3xl p-5 flex items-center gap-3">
                  <Award size={20} className="text-amber-400 shrink-0" />
                  <div className="text-[11px] text-zinc-400 leading-relaxed">
                    ይህ መተግበሪያ የተሰራው በከፍተኛ የእድገት ደረጃዎች ሲሆን በ <b>React 19 + Express</b> ላይ የተመሰረተ ነው።
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'player' && (
            <div className="bg-[#0b0c10] border border-zinc-800/80 p-6 md:p-8 rounded-3xl shadow-2xl">
              <PlayerMobileView game={game} onRefresh={fetchState} profiles={state.profiles} />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#050505] mt-16 py-6 text-center text-xs text-zinc-500 font-sans">
        <p className="max-w-md mx-auto px-4 leading-relaxed">
          የቴሌግራም ቢንጎ ቦት መቆጣጠሪያ መድረክ • በኢትዮጵያ ውስጥ ለሚካሄዱ የቢንጎ (Tombola) ጨዋታዎች በልዩ ጥንቃቄ የተዘጋጀ።
        </p>
        <p className="text-[10px] text-zinc-700 mt-2 font-mono">
          © 2026 Live Bingo Server. All Rights Reserved.
        </p>
      </footer>

    </div>
  );
}
