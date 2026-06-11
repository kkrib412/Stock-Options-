import { useState, useEffect } from 'react';
import { AssetSymbol, AudioSettings, DisplaySettings } from './types';
import { useMarketData } from './hooks/useMarketData';
import { ControlDeck } from './components/ControlDeck';
import { OrderBookCanvas } from './components/OrderBookCanvas';
import { TapeList } from './components/TapeList';
import { MarketSpeedometer } from './components/MarketSpeedometer';
import { WhaleHistogram } from './components/WhaleHistogram';
import { FlowDeltaChart } from './components/FlowDeltaChart';
import { Coins, ShieldCheck, Info, ExternalLink, HelpCircle } from 'lucide-react';

export default function App() {
  const [symbol, setSymbol] = useState<AssetSymbol>('BTCUSDT');
  
  // Default audio configurations (safety muted on load to comply with standard browser policies)
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    isEnabled: false,
    masterVolume: 0.25,
    enableClicks: true,
    enableDrone: false,
    droneFrequency: 110,
    scaleType: 'pentatonic',
    dynamicFilter: true,
  });

  // Default canvas display parameters
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    tickGrouping: 5.0, // default to $5 grouping for Bitcoin
    autoCenter: true,
    maxLevels: 35,
    showHeatmap: true,
    showHorizontalGrid: true,
    colorScheme: 'default'
  });

  // Primary hook connecting directly to Binance Public API high volume WS Streams
  const {
    orderBook,
    trades,
    minuteTrades,
    fiveMinuteTrades,
    stats,
    isConnected,
    latencyMs,
    messageRate,
  } = useMarketData({
    symbol,
    displaySettings,
    audioSettings,
  });

  // Live clock state to keep trading desks synchronized
  const [currentTime, setCurrentTime] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-900 antialiased">
      
      {/* 1. MASTER TRADING COCKPIT TOP NAV LINE */}
      <header className="border-b border-slate-900 bg-slate-950 px-5 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
              LIQUIDITY LADDER
              <span className="text-[9px] bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">
                DOM PRO
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              High-Frequency Market depth visualizer & spatial auditory mixer
            </p>
          </div>
        </div>

        {/* Dynamic connection and system gauges */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* Calendar Clock */}
          <div className="px-3 py-1 bg-slate-900 border border-slate-900 text-slate-400 rounded-lg text-[11px] font-semibold">
            {currentTime}
          </div>

          {/* Connection status pills */}
          <div className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 text-[11px] font-bold ${
            isConnected 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/30 text-red-500 animate-pulse'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span>{isConnected ? 'LIVE FEED ACTIVE' : 'DISCONNECTED STREAM'}</span>
          </div>
        </div>
      </header>

      {/* 2. PRIMARY SCREEN LAYOUT - THE FINANCIAL BEN-GRID COCKPIT */}
      <main className="flex-1 p-5 max-w-[1700px] w-full mx-auto flex flex-col gap-5">
        
        {/* COLLAPSIBLE QUICKSTART DOCUMENTATION BUBBLE */}
        <div className="p-4 bg-gradient-to-r from-indigo-950/20 to-slate-950/40 border border-indigo-900/30 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-slate-400 leading-relaxed">
            <span className="text-slate-200 font-bold uppercase block mb-1">PRO TRADER SYSTEM GUIDE</span>
            To listen to audio sonified order book updates (pitch-correlated trades and flow imbalances), turn on the <span className="text-emerald-400 font-bold">"Sonification Mixer"</span> switch in the control console below. Move your mouse or drag your custom cursor over the central canvas to activate the <span className="text-amber-400 font-bold">Cumulative Depth HUD tracking crosshairs</span>. Feel free to aggregate prices via the step buttons to see massive systemic walls.
          </div>
        </div>

        {/* MAIN COCKPIT SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch">
          
          {/* LANE 1: CONTROLS & NUMERIC VELOCITY METRICS (Lg Span 4) */}
          <section className="lg:col-span-4 flex flex-col gap-5 h-full">
            <ControlDeck
              symbol={symbol}
              setSymbol={setSymbol}
              audioSettings={audioSettings}
              setAudioSettings={setAudioSettings}
              displaySettings={displaySettings}
              setDisplaySettings={setDisplaySettings}
              latencyMs={latencyMs}
              messageRate={messageRate}
            />
            <MarketSpeedometer
              stats={stats}
              symbol={symbol}
            />
            <WhaleHistogram
              minuteTrades={minuteTrades}
              symbol={symbol}
            />
          </section>

          {/* LANE 2: DYNAMIC HIGH RESOLUTION INTERPOLATED L2 CANVAS (Lg Span 5) */}
          <section className="lg:col-span-5 flex flex-col gap-4">
            <div className="h-[520px] lg:h-[580px] min-h-[480px]">
              <OrderBookCanvas
                orderBook={orderBook}
                stats={stats}
                symbol={symbol}
                displaySettings={displaySettings}
              />
            </div>
            <FlowDeltaChart
              fiveMinuteTrades={fiveMinuteTrades}
              orderBook={orderBook}
              symbol={symbol}
              tickGrouping={displaySettings.tickGrouping}
              lastPrice={stats.lastPrice}
            />
          </section>

          {/* LANE 3: EXECUTED RECENT TRADES TAPE FEED (Lg Span 3) */}
          <section className="lg:col-span-3 flex flex-col h-[400px] lg:h-auto">
            <TapeList
              trades={trades}
              symbol={symbol}
            />
          </section>

        </div>
      </main>

      {/* 3. COCKPIT COMPLIANT FOOTER LINE */}
      <footer className="border-t border-slate-900 bg-slate-950 px-5 py-3.5 mt-auto flex flex-col sm:flex-row justify-between items-center gap-2.5 text-[10px] font-mono text-slate-500">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>DATA PROXIED VIA SECURE SSL CHANNELS. PUBLIC WebSocket STREAM ONLY. NO BROKER KEYS REQ.</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://stream.binance.com:9443/ws"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 flex items-center gap-1 transition-all"
          >
            Binance Websocket Stream <ExternalLink className="w-3 h-3" />
          </a>
          <span>© AI Studio Financial Engineering</span>
        </div>
      </footer>
    </div>
  );
}
