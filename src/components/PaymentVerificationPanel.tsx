import React, { useState } from 'react';
import { Check, X, ShieldAlert, Image as ImageIcon, Sparkles, Send, Coins, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { DepositRequest, WithdrawRequest } from '../types.js';

interface PaymentVerificationPanelProps {
  deposits: DepositRequest[];
  withdrawals: WithdrawRequest[];
  onRefresh: () => void;
}

export default function PaymentVerificationPanel({ deposits, withdrawals, onRefresh }: PaymentVerificationPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'deposits' | 'withdrawals'>('deposits');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deposit Simulation state
  const [simUsername, setSimUsername] = useState('Fitsum_A');
  const [simName, setSimName] = useState('ፍጹም');
  const [simAmount, setSimAmount] = useState('100');
  const [simMethod, setSimMethod] = useState<'telebirr' | 'bank'>('telebirr');
  const [isSimulating, setIsSimulating] = useState(false);

  // Withdrawal Simulation state
  const [simWdUsername, setSimWdUsername] = useState('Almaz_T');
  const [simWdName, setSimWdName] = useState('አልማዝ');
  const [simWdAmount, setSimWdAmount] = useState('150');
  const [simWdBank, setSimWdBank] = useState('Commercial Bank of Ethiopia (CBE)');
  const [simWdAccount, setSimWdAccount] = useState('1000123456789');

  const handleApprove = async (id: string) => {
    setIsProcessing(id);
    setError(null);
    try {
      const res = await fetch(`/api/deposits/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve deposit');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setIsProcessing(id);
    setError(null);
    try {
      const res = await fetch(`/api/deposits/${id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reject deposit');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleApproveWithdrawal = async (id: string) => {
    setIsProcessing(id);
    setError(null);
    try {
      const res = await fetch(`/api/withdrawals/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve withdrawal');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    setIsProcessing(id);
    setError(null);
    try {
      const res = await fetch(`/api/withdrawals/${id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reject withdrawal');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSimulateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simUsername || !simAmount) return;
    setIsSimulating(true);
    setError(null);
    try {
      const res = await fetch('/api/game/simulate-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: simUsername,
          firstName: simName,
          amount: Number(simAmount),
          method: simMethod,
        }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simWdUsername || !simWdAmount) return;
    setIsSimulating(true);
    setError(null);
    try {
      // Send simulation request to text-command API as if user ran /withdraw flow
      const textCommand = `/withdraw`;
      const res = await fetch('/api/game/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: simWdUsername,
          firstName: simWdName,
          text: `🏧 Withdraw`
        })
      });
      if (!res.ok) throw new Error('Withdrawal setup failed');

      // Send the selection steps
      await fetch('/api/game/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: simWdUsername, firstName: simWdName, text: simWdBank })
      });
      await fetch('/api/game/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: simWdUsername, firstName: simWdName, text: simWdAmount })
      });
      await fetch('/api/game/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: simWdUsername, firstName: simWdName, text: simWdAccount })
      });
      await fetch('/api/game/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: simWdUsername, firstName: simWdName, text: `${simWdName} Almaz` })
      });
      await fetch('/api/game/simulate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: simWdUsername, firstName: simWdName, text: '✅ አረጋግጣለሁ' })
      });

      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const pendingDeposits = deposits.filter(d => d.status === 'pending');
  const processedDeposits = deposits.filter(d => d.status !== 'pending');

  const pendingWithdrawals = withdrawals ? withdrawals.filter(w => w.status === 'pending') : [];
  const processedWithdrawals = withdrawals ? withdrawals.filter(w => w.status !== 'pending') : [];

  return (
    <div id="payment_panel" className="bg-[#111114] border border-zinc-800 rounded-3xl p-6 shadow-xl text-zinc-100 flex flex-col gap-6">
      
      {/* Header with Sub-tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800/60 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Coins size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-sans tracking-tight">የገንዘብና የደረሰኞች መቆጣጠሪያ (Finance Manager)</h2>
            <p className="text-xs text-zinc-400">Verify receipts and process withdraw requests</p>
          </div>
        </div>

        {/* Subtab Buttons */}
        <div className="flex bg-[#0a0a0c] p-1 rounded-2xl border border-zinc-800/80 self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('deposits')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'deposits'
                ? 'bg-zinc-800 text-emerald-400 border border-zinc-700/50'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ArrowDownLeft size={14} /> ገቢ ደረሰኞች ({pendingDeposits.length})
          </button>
          <button
            onClick={() => setActiveSubTab('withdrawals')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'withdrawals'
                ? 'bg-zinc-800 text-amber-400 border border-zinc-700/50'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ArrowUpRight size={14} /> ወጪ ጥያቄዎች ({pendingWithdrawals.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-400 text-xs rounded-xl flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main split layout: active tab list vs Simulation controls */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Side: Pending lists (Column 8) */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          
          {activeSubTab === 'deposits' ? (
            <>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                📥 የደረሱ የክፍያ ጥያቄዎች (Pending Screenshot Receipts)
              </h3>

              {pendingDeposits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-500 bg-[#0a0a0c] border border-zinc-800/60 rounded-3xl border-dashed">
                  <div className="text-3xl mb-2">📸</div>
                  <p className="text-sm font-bold">ምንም በመጠባበቅ ላይ ያለ ደረሰኝ የለም</p>
                  <p className="text-xs text-zinc-600 mt-1 max-w-[340px] leading-relaxed">
                    ተጫዋቾች በቴሌግራም <b>/deposit</b> ሲጫኑ በሚያገኙት መመሪያ መሰረት የደረሰኝ screenshot ሲልኩ እዚህ ጋር ይመጣል። በቀኝ በኩል ያለውን ፎርም በመጠቀም መሞከር ይችላሉ።
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                  {pendingDeposits.map((dep) => (
                    <div key={dep.id} className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div 
                          className="relative w-16 h-16 rounded-xl overflow-hidden border border-zinc-850 cursor-pointer group shrink-0 bg-zinc-900"
                          onClick={() => setSelectedImage(dep.screenshotUrl)}
                        >
                          <img src={dep.screenshotUrl} alt="Receipt Screenshot" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <ImageIcon size={14} className="text-white" />
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                            {dep.firstName}
                            <span className="text-xs text-zinc-500 font-mono">@{dep.username}</span>
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5">
                            የላከው፡ <span className="font-mono text-emerald-400 font-bold">{dep.amount} Birr</span> • ዘዴ፡ <b className="text-zinc-300 capitalize">{dep.method === 'telebirr' ? '📱 Telebirr' : '🏦 CBE Bank'}</b>
                          </div>
                          <div className="text-[10px] text-zinc-600 mt-1">
                            የደረሰበት ሰዓት፡ {new Date(dep.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                          onClick={() => handleReject(dep.id)}
                          disabled={isProcessing !== null}
                          className="flex-1 md:flex-none py-2 px-3.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 hover:border-red-800 text-red-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <X size={14} /> ውድቅ አድርግ (Reject)
                        </button>
                        <button
                          onClick={() => handleApprove(dep.id)}
                          disabled={isProcessing !== null}
                          className="flex-1 md:flex-none py-2 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
                        >
                          <Check size={14} strokeWidth={3} /> የተቀበልኩ (Approve)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processedDeposits.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    📜 የቅርብ ጊዜ የደረሰኝ ታሪኮች (Processed Log)
                  </h4>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                    {processedDeposits.slice(0, 5).map((dep) => (
                      <div key={dep.id} className="py-2 px-3 bg-zinc-950/40 rounded-xl border border-zinc-900 flex items-center justify-between text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${dep.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span>{dep.firstName} (@{dep.username})</span>
                          <span className="text-zinc-600">•</span>
                          <span className="font-mono text-[11px]">{dep.amount} Birr via {dep.method}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          dep.status === 'approved' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' : 'bg-red-950/40 text-red-400 border border-red-900/30'
                        }`}>
                          {dep.status === 'approved' ? 'የተፈቀደ (Approved)' : 'ውድቅ የሆነ (Rejected)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                🏧 በመጠባበቅ ላይ ያሉ ወጪ ጥያቄዎች (Pending Withdrawal Requests)
              </h3>

              {pendingWithdrawals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-500 bg-[#0a0a0c] border border-zinc-800/60 rounded-3xl border-dashed">
                  <div className="text-3xl mb-2">🏧</div>
                  <p className="text-sm font-bold">ምንም የገንዘብ ማውጫ ጥያቄ የለም</p>
                  <p className="text-xs text-zinc-600 mt-1 max-w-[340px] leading-relaxed">
                    ተጫዋቾች በቴሌግራም <b>🏧 Withdraw</b> የሚለውን ቁልፍ ተጭነው ጥያቄ ሲያቀርቡ እዚህ ጋር ይመጣል። በቀኝ በኩል ያለውን የውጪ ማስመሰያ በመጠቀም መሞከር ይችላሉ።
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                  {pendingWithdrawals.map((wd) => (
                    <div key={wd.id} className="p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 text-lg font-bold">
                          {wd.amount}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-zinc-200">
                            {wd.firstName} <span className="text-xs text-zinc-500 font-mono">@{wd.username}</span>
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5 space-y-0.5">
                            <p>💰 ማውጫ መጠን፡ <b className="text-amber-400">{wd.amount} Birr</b></p>
                            <p>🏦 ባንክ፡ <span className="text-zinc-300 font-semibold">{wd.bankName}</span></p>
                            <p>💳 አካውንት፡ <code className="text-zinc-300 bg-zinc-900 px-1 py-0.5 rounded text-[11px] font-mono">{wd.accountNumber}</code></p>
                            <p>👤 ስም፡ <span className="text-zinc-300">{wd.accountName}</span></p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                          onClick={() => handleRejectWithdrawal(wd.id)}
                          disabled={isProcessing !== null}
                          className="flex-1 md:flex-none py-2 px-3.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 hover:border-red-800 text-red-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <X size={14} /> ውድቅ (Reject)
                        </button>
                        <button
                          onClick={() => handleApproveWithdrawal(wd.id)}
                          disabled={isProcessing !== null}
                          className="flex-1 md:flex-none py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/10"
                        >
                          <Check size={14} strokeWidth={3} /> ልኬያለሁ (Approve)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processedWithdrawals.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                    📜 ያለፉ የወጪ ጥያቄዎች ታሪኮች (Processed Withdraw Log)
                  </h4>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                    {processedWithdrawals.slice(0, 5).map((wd) => (
                      <div key={wd.id} className="py-2 px-3 bg-zinc-950/40 rounded-xl border border-zinc-900 flex items-center justify-between text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${wd.status === 'approved' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span>{wd.firstName} (@{wd.username})</span>
                          <span className="text-zinc-600">•</span>
                          <span className="font-mono text-[11px]">{wd.amount} Birr to {wd.bankName}</span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          wd.status === 'approved' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' : 'bg-red-950/40 text-red-400 border border-red-900/30'
                        }`}>
                          {wd.status === 'approved' ? 'የተላከ (Approved)' : 'የተሰረዘ (Rejected)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Right Side: Demo Receipts Simulation (Column 4) */}
        <div className="xl:col-span-4 bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-3">
          
          {activeSubTab === 'deposits' ? (
            <>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" /> የደረሰኝ ማስመሰያ (Deposit Simulator)
              </h3>
              <p className="text-[11px] text-zinc-500 leading-normal">
                እውነተኛ የቴሌግራም ቦት ሳይጠቀሙ የደረሰኝ መላክን ለመሞከር ይህንን ፎርም ይሙሉ። ሲልኩ የደረሰኝ ጥያቄው በስተግራ በኩል ይታያል!
              </p>

              <form onSubmit={handleSimulateDeposit} className="space-y-2.5 mt-1 text-xs">
                <div>
                  <label className="block text-zinc-500 mb-1">የተጫዋች ስም (Ethiopian Name):</label>
                  <input
                    type="text"
                    value={simName}
                    onChange={(e) => setSimName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-emerald-500 font-sans"
                    placeholder="ለምሳሌ፡ ዮሐንስ"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 mb-1">የቴሌግራም መለያ (TG Username):</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 font-mono">@</span>
                    <input
                      type="text"
                      value={simUsername}
                      onChange={(e) => setSimUsername(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-7 pr-3 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                      placeholder="Yohannes_B"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-500 mb-1">የብር መጠን (Amount):</label>
                    <select
                      value={simAmount}
                      onChange={(e) => setSimAmount(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      {['10', '20', '30', '50', '100', '200', '500', '1000'].map(v => (
                        <option key={v} value={v}>{v} Birr</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-500 mb-1">የአከፋፈል ዘዴ (Method):</label>
                    <select
                      value={simMethod}
                      onChange={(e) => setSimMethod(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="telebirr">Telebirr 📱</option>
                      <option value="bank">CBE Bank 🏦</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSimulating}
                  className="w-full mt-2 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-emerald-400 font-semibold border border-zinc-700/80 rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Send size={13} /> {isSimulating ? 'በማስመሰል ላይ...' : 'የደረሰኝ ፎቶ ላክ (Upload)'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" /> ወጪ ማስመሰያ (Withdraw Simulator)
              </h3>
              <p className="text-[11px] text-zinc-500 leading-normal">
                በቴሌግራም መልዕክት በኩል የደረጃ በደረጃ የገንዘብ ማውጣት ፎርም ሲሞላ የሚፈጠረውን ፍሰት ለመሞከር ይህንን ማስመሰያ ይጠቀሙ።
              </p>

              <form onSubmit={handleSimulateWithdrawal} className="space-y-2.5 mt-1 text-xs">
                <div>
                  <label className="block text-zinc-500 mb-1">የተጫዋች ስም (Ethiopian Name):</label>
                  <input
                    type="text"
                    value={simWdName}
                    onChange={(e) => setSimWdName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-amber-500 font-sans"
                    placeholder="ለምሳሌ፡ አልማዝ"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 mb-1">የቴሌግራም መለያ (TG Username):</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 font-mono">@</span>
                    <input
                      type="text"
                      value={simWdUsername}
                      onChange={(e) => setSimWdUsername(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-7 pr-3 text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
                      placeholder="Almaz_T"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-500 mb-1">የማውጫ መጠን (Amount):</label>
                    <select
                      value={simWdAmount}
                      onChange={(e) => setSimWdAmount(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
                    >
                      {['100', '150', '200', '300', '500', '1000'].map(v => (
                        <option key={v} value={v}>{v} Birr</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-500 mb-1">የባንክ መዳረሻ (Bank):</label>
                    <select
                      value={simWdBank}
                      onChange={(e) => setSimWdBank(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-amber-500 text-[11px]"
                    >
                      <option value="Telebirr">Telebirr 📱</option>
                      <option value="Commercial Bank of Ethiopia (CBE)">CBE Bank 🏦</option>
                      <option value="Dashen Bank">Dashen Bank 🏦</option>
                      <option value="Awash Bank">Awash Bank 🏦</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-500 mb-1">አካውንት ቁጥር (Account No):</label>
                  <input
                    type="text"
                    value={simWdAccount}
                    onChange={(e) => setSimWdAccount(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
                    placeholder="1000123456789"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSimulating}
                  className="w-full mt-2 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-amber-400 font-semibold border border-zinc-700/80 rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Send size={13} /> {isSimulating ? 'በማስመሰል ላይ...' : 'የማውጫ ጥያቄ ላክ (Withdraw)'}
                </button>
              </form>
            </>
          )}

        </div>

      </div>

      {/* Screenshot Image Modal / Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-lg max-h-[85vh] w-full flex flex-col justify-center items-center">
            <button 
              className="absolute -top-10 right-0 p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-zinc-800 text-zinc-400 hover:text-white"
              onClick={() => setSelectedImage(null)}
            >
              <X size={18} />
            </button>
            <img 
              src={selectedImage} 
              alt="Enlarged Receipt Screenshot" 
              className="max-w-full max-h-[80vh] rounded-2xl object-contain border border-zinc-800 shadow-2xl"
              referrerPolicy="no-referrer"
            />
            <p className="text-center text-zinc-500 text-xs mt-3">የደረሰኝ ፎቶ እይታ • ለመዝጋት የትኛውም ቦታ ላይ ይጫኑ</p>
          </div>
        </div>
      )}

    </div>
  );
}
