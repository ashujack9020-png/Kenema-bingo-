import React, { useState, useEffect } from 'react';
import { BotSettings } from '../types.js';
import { Phone, CreditCard, Gift, User, Save, Settings2, Sparkles, Check, RefreshCw } from 'lucide-react';

interface BotSettingsPanelProps {
  settings: BotSettings;
  onRefresh: () => void;
}

export default function BotSettingsPanel({ settings, onRefresh }: BotSettingsPanelProps) {
  const [telebirrNumber, setTelebirrNumber] = useState(settings?.telebirrNumber || '0991515755');
  const [telebirrName, setTelebirrName] = useState(settings?.telebirrName || 'አሸናፊ (Ashenafi)');
  const [cbeAccount, setCbeAccount] = useState(settings?.cbeAccount || '1000528063512');
  const [cbeName, setCbeName] = useState(settings?.cbeName || 'አሸናፊ (Ashenafi)');
  const [contactUsername, setContactUsername] = useState(settings?.contactUsername || 'ashujack9020');
  const [welcomeBonus, setWelcomeBonus] = useState(settings?.welcomeBonus ?? 10);
  const [referralBonus, setReferralBonus] = useState(settings?.referralBonus ?? 10);
  const [forceSharedPreUrl, setForceSharedPreUrl] = useState(settings?.forceSharedPreUrl ?? true);
  const [botMode, setBotMode] = useState<'polling' | 'webhook' | 'disabled'>(settings?.botMode || 'polling');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state if prop changes (e.g. from server refresh)
  useEffect(() => {
    if (settings) {
      setTelebirrNumber(settings.telebirrNumber);
      setTelebirrName(settings.telebirrName);
      setCbeAccount(settings.cbeAccount);
      setCbeName(settings.cbeName);
      setContactUsername(settings.contactUsername);
      setWelcomeBonus(settings.welcomeBonus);
      setReferralBonus(settings.referralBonus);
      setForceSharedPreUrl(settings.forceSharedPreUrl ?? true);
      setBotMode(settings.botMode || 'polling');
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/config/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telebirrNumber,
          telebirrName,
          cbeAccount,
          cbeName,
          contactUsername,
          welcomeBonus: Number(welcomeBonus),
          referralBonus: Number(referralBonus),
          forceSharedPreUrl,
          botMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ማስተካከያውን ማስቀመጥ አልተቻለም (Failed to save)');
      }

      setSaveSuccess(true);
      onRefresh();
      
      // Clear success indicator after 3s
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'የኔትወርክ ስህተት አጋጥሟል');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="bot_settings_panel" className="bg-[#111114] border border-zinc-800 rounded-3xl p-6 shadow-xl text-zinc-100 flex flex-col gap-6">
      
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-amber-500/10 to-orange-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Settings2 size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-sans tracking-tight">የቢንጎ ቦት መቆጣጠሪያ ፓነል (Bot Config)</h2>
            <p className="text-xs text-zinc-500">የክፍያ፣ የቦነስ እና የአድራሻ ማስተካከያዎች</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-black text-amber-400 font-mono uppercase tracking-wider animate-pulse">
          <Sparkles size={11} /> Admin Active
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Section 1: Financial & Banks Configuration */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={13} className="text-sky-400" /> የገንዘብ ማስገቢያ አካውንቶች (Deposit Accounts)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Telebirr Details */}
            <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-3.5">
              <div className="flex items-center gap-2 text-sky-400 text-xs font-bold">
                <Phone size={13} /> የቴሌብር ቁጥር (Telebirr)
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 font-medium">የቴሌብር ስልክ ቁጥር</label>
                <input
                  type="text"
                  value={telebirrNumber}
                  onChange={(e) => setTelebirrNumber(e.target.value)}
                  placeholder="0991xxxxxx"
                  className="w-full bg-[#0a0a0c] border border-zinc-800 focus:border-sky-500 rounded-xl py-2 px-3 text-xs focus:outline-none font-mono text-zinc-100"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 font-medium">የሂሳብ ባለቤት ስም (Account Holder Name)</label>
                <input
                  type="text"
                  value={telebirrName}
                  onChange={(e) => setTelebirrName(e.target.value)}
                  placeholder="የባለቤት ስም"
                  className="w-full bg-[#0a0a0c] border border-zinc-800 focus:border-sky-500 rounded-xl py-2 px-3 text-xs focus:outline-none text-zinc-100"
                  required
                />
              </div>
            </div>

            {/* CBE Details */}
            <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-3.5">
              <div className="flex items-center gap-2 text-sky-400 text-xs font-bold">
                <CreditCard size={13} /> የኢትዮጵያ ንግድ ባንክ (CBE)
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 font-medium">የባንክ ሂሳብ ቁጥር (Account Number)</label>
                <input
                  type="text"
                  value={cbeAccount}
                  onChange={(e) => setCbeAccount(e.target.value)}
                  placeholder="1000xxxxxxxx"
                  className="w-full bg-[#0a0a0c] border border-zinc-800 focus:border-sky-500 rounded-xl py-2 px-3 text-xs focus:outline-none font-mono text-zinc-100"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 font-medium">የሂሳብ ባለቤት ስም (Account Holder Name)</label>
                <input
                  type="text"
                  value={cbeName}
                  onChange={(e) => setCbeName(e.target.value)}
                  placeholder="የባለቤት ስም"
                  className="w-full bg-[#0a0a0c] border border-zinc-800 focus:border-sky-500 rounded-xl py-2 px-3 text-xs focus:outline-none text-zinc-100"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Welcome / Registration & Referral Bonuses */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Gift size={13} className="text-amber-400" /> የነፃ ቦነስ ስጦታዎች (Rewards & Bonuses)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Welcome Bonus */}
            <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                  🎁 የመመዝገቢያ ስጦታ (Welcome Bonus)
                </span>
                <span className="text-xs font-black text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded">
                  {welcomeBonus} ETB
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal mb-3">
                አዲስ ተጫዋቾች በቦቱ ላይ ስልክ ቁጥራቸውን አረጋግጠው ሲመዘገቡ በነፃ የሚሰጣቸው የመነሻ ሂሳብ መጠን።
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={welcomeBonus}
                  onChange={(e) => setWelcomeBonus(Number(e.target.value))}
                  className="flex-1 accent-amber-500"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={welcomeBonus}
                  onChange={(e) => setWelcomeBonus(Number(e.target.value))}
                  className="w-16 bg-[#0a0a0c] border border-zinc-800 focus:border-amber-500 rounded-xl py-1 px-2 text-xs text-center font-mono focus:outline-none text-zinc-100 font-bold"
                />
              </div>
            </div>

            {/* Referral / Invite Bonus */}
            <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                  📢 የግብዣ ቦነስ (Referral Bonus)
                </span>
                <span className="text-xs font-black text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded">
                  {referralBonus} ETB
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal mb-3">
                አንድ ተጫዋች ሌላ አዲስ ተጫዋች በመጋበዣ ሊንኩ አማካኝነት ሲጋብዝ ወደ ቀሪ ሂሳቡ የሚገባለት የብር መጠን።
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={referralBonus}
                  onChange={(e) => setReferralBonus(Number(e.target.value))}
                  className="flex-1 accent-amber-500"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={referralBonus}
                  onChange={(e) => setReferralBonus(Number(e.target.value))}
                  className="w-16 bg-[#0a0a0c] border border-zinc-800 focus:border-amber-500 rounded-xl py-1 px-2 text-xs text-center font-mono focus:outline-none text-zinc-100 font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Contact Admin Link */}
        <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <User size={13} className="text-orange-400" /> የአስተዳዳሪ ቴሌግራም አድራሻ (Telegram Support Link)
          </h3>
          <p className="text-[10px] text-zinc-500 leading-normal">
            ተጫዋቾች በቦቱ ላይ '📞 Contact Us' የሚለውን ሲጫኑ እንዲያገኙት የሚፈልጉት ዋናው የቴሌግራም መለያ (Username - ያለ @ ምልክት)፡
          </p>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 font-mono">@</span>
            <input
              type="text"
              value={contactUsername}
              onChange={(e) => setContactUsername(e.target.value)}
              placeholder="username"
              className="w-full bg-[#0a0a0c] border border-zinc-800 focus:border-orange-500 rounded-xl py-2 pl-7 pr-4 text-xs focus:outline-none font-mono text-zinc-100 font-bold"
              required
            />
          </div>
        </div>

        {/* Section 4: Public URL Bypass Google Account */}
        <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Sparkles size={13} className="text-emerald-400" /> የጉግል አካውንት መግቢያ ማለፊያ (Google Account Bypass)
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={forceSharedPreUrl} 
                onChange={(e) => setForceSharedPreUrl(e.target.checked)} 
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-zinc-950"></div>
            </label>
          </div>
          <p className="text-[10px] text-zinc-500 leading-normal">
            ይህ ሲበራ ተጫዋቾች በቴሌግራም ቦት ላይ <b>🎮 Play</b> ሲጫኑ <b>ያለ ምንም የጉግል አካውንት (Google Account)</b> በቀጥታ ወደ ጨዋታው ይገባሉ! (ይህን ለማብራት መጀመሪያ AI Studio ላይ <b>'Share'</b> ያድርጉት)።
          </p>
        </div>

        {/* Section 5: Telegram Bot Connection Mode */}
        <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <Settings2 size={13} className="text-amber-400" /> የቴሌግራም ቦት ግንኙነት ዘዴ (Bot Connection Mode)
          </h3>
          <p className="text-[10px] text-zinc-500 leading-normal">
            በአንድ ጊዜ አንድ መተግበሪያ ብቻ ከቴሌግራም ጋር መገናኘት ይችላል (Conflict ለማስቀረት)። በ Render ላይ ሲጭኑ ወደ <b>Webhook</b> ይቀይሩት፤ በ AI Studio ሲሞክሩ ወደ <b>Long Polling</b> ያድርጉት።
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setBotMode('polling')}
              className={`py-2 px-3 text-xs font-bold rounded-xl border transition flex flex-col items-center gap-1 ${
                botMode === 'polling'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-bold'
                  : 'bg-[#0a0a0c] border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-xs">Long Polling</span>
              <span className="text-[9px] opacity-70">AI Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setBotMode('webhook')}
              className={`py-2 px-3 text-xs font-bold rounded-xl border transition flex flex-col items-center gap-1 ${
                botMode === 'webhook'
                  ? 'bg-sky-500/10 border-sky-500 text-sky-400 font-bold'
                  : 'bg-[#0a0a0c] border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-xs">Webhook (Render)</span>
              <span className="text-[9px] opacity-70">ለቀጥታ ስርጭት</span>
            </button>
            <button
              type="button"
              onClick={() => setBotMode('disabled')}
              className={`py-2 px-3 text-xs font-bold rounded-xl border transition flex flex-col items-center gap-1 ${
                botMode === 'disabled'
                  ? 'bg-red-500/10 border-red-500 text-red-400 font-bold'
                  : 'bg-[#0a0a0c] border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="text-xs">Disabled</span>
              <span className="text-[9px] opacity-70">ቦት ግንኙነት አጥፋ</span>
            </button>
          </div>
        </div>

        {/* Error Messages */}
        {errorMsg && (
          <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-400 text-xs rounded-xl flex items-center gap-2">
            <span>⚠️ ስህተት: {errorMsg}</span>
          </div>
        )}

        {/* Action Button Area */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-zinc-500 max-w-[70%] leading-relaxed">
            እነዚህን ማስተካከያዎች ሲያስቀምጡ በቴሌግራም ቦቱ ላይ ያሉ መመሪያዎች እና ክፍያዎች በራስ-ሰር ወዲያውኑ ይቀየራሉ።
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className={`px-5 py-2.5 font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shrink-0 ${
              saveSuccess
                ? 'bg-emerald-500 text-zinc-950 shadow-emerald-500/10'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-zinc-950 shadow-orange-500/10'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw size={13} className="animate-spin" /> በመቆጠብ ላይ...
              </>
            ) : saveSuccess ? (
              <>
                <Check size={13} /> ተቀምጧል! (Saved)
              </>
            ) : (
              <>
                <Save size={13} /> ማስተካከያውን አስቀምጥ
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
}
