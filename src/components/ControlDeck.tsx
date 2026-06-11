import React from 'react';
import { AssetSymbol, AudioSettings, DisplaySettings } from '../types';
import { SUPPORTED_ASSETS, AVAILABLE_GROUPINGS } from '../constants';
import { Volume2, VolumeX, Sliders, Activity, Focus, Grid, HelpCircle, RefreshCw, Flame } from 'lucide-react';
import { marketAudio } from '../utils/AudioEngine';

interface ControlDeckProps {
  symbol: AssetSymbol;
  setSymbol: (symbol: AssetSymbol) => void;
  audioSettings: AudioSettings;
  setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
  displaySettings: DisplaySettings;
  setDisplaySettings: React.Dispatch<React.SetStateAction<DisplaySettings>>;
  latencyMs: number;
  messageRate: number;
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  symbol,
  setSymbol,
  audioSettings,
  setAudioSettings,
  displaySettings,
  setDisplaySettings,
  latencyMs,
  messageRate,
}) => {
  const asset = SUPPORTED_ASSETS[symbol] || SUPPORTED_ASSETS.BTCUSDT;
  const groupings = AVAILABLE_GROUPINGS[symbol] || [0.1];

  const handleToggleAudio = () => {
    const nextVal = !audioSettings.isEnabled;
    const updated = { ...audioSettings, isEnabled: nextVal };
    setAudioSettings(updated);
    
    // Unlock and trigger the Web Audio API Context lazy initialize
    if (nextVal) {
      marketAudio.init().then(() => {
        marketAudio.updateSettings(updated);
      });
    } else {
      marketAudio.updateSettings(updated);
    }
  };

  const handleUpdateVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    const updated = { ...audioSettings, masterVolume: vol };
    setAudioSettings(updated);
    marketAudio.updateSettings(updated);
  };

  const handleToggleDrone = () => {
    const nextVal = !audioSettings.enableDrone;
    const updated = { ...audioSettings, enableDrone: nextVal };
    setAudioSettings(updated);
    marketAudio.updateSettings(updated);
  };

  const handleToggleClicks = () => {
    const updated = { ...audioSettings, enableClicks: !audioSettings.enableClicks };
    setAudioSettings(updated);
    marketAudio.updateSettings(updated);
  };

  const updateTickGrouping = (groupingSize: number) => {
    setDisplaySettings(prev => ({ ...prev, tickGrouping: groupingSize }));
  };

  const activeDroneFreq = audioSettings.droneFrequency;

  const handleUpdateDroneFreq = (e: React.ChangeEvent<HTMLInputElement>) => {
    const freq = parseInt(e.target.value, 10);
    const updated = { ...audioSettings, droneFrequency: freq };
    setAudioSettings(updated);
    marketAudio.updateSettings(updated);
  };

  return (
    <div id="control-deck-section" className="w-full flex flex-col gap-5 p-5 bg-slate-950/60 border border-slate-900 rounded-xl shadow-xl backdrop-blur-md">
      {/* 1. ASSET SELECTOR SHELF */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
          <Activity className="w-3.5 h-3.5 text-indigo-400" /> ACTIVE LIQUIDITY ASSET
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
          {Object.values(SUPPORTED_ASSETS).map((item) => {
            const isSelected = item.symbol === symbol;
            return (
              <button
                key={item.symbol}
                id={`asset-btn-${item.symbol}`}
                onClick={() => {
                  setSymbol(item.symbol);
                  // Setup appropriate default grouping for chosen asset
                  setDisplaySettings(prev => ({ ...prev, tickGrouping: item.defaultTickGrouping }));
                }}
                className={`py-2 px-3 flex items-center justify-between rounded-lg border text-left font-mono font-medium transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-950 to-indigo-950/50 border-emerald-500/70 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                    : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs font-bold">{item.symbol.replace('USDT', '')}</span>
                </div>
                <span className="text-[9px] text-slate-500 font-normal">USDT</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-900 pt-5">
        
        {/* 2. TICK GROUPING SELECTOR */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" /> ORDER BOOK INTERVAL STEPS
          </span>
          <p className="text-[11px] text-slate-400">
            Aggregate individual dollar ranges in the depth vertical stack to spot systemic walls.
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {groupings.map((size) => {
              const isSelected = displaySettings.tickGrouping === size;
              return (
                <button
                  key={size}
                  id={`tick-grouping-${size}`}
                  onClick={() => updateTickGrouping(size)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono font-medium transition-all ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300'
                      : 'bg-slate-900/60 border-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ${size.toFixed(asset.decimals)}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. DISPLAY OPTIONS */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
            <Grid className="w-3.5 h-3.5 text-indigo-400" /> DESK PRESENTATION
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
            {/* Auto-Center L2 Ladder */}
            <button
              id="pref-toggle-autocenter"
              onClick={() => setDisplaySettings(p => ({ ...p, autoCenter: !p.autoCenter }))}
              className={`p-2 rounded-lg border flex items-center justify-between text-left font-mono text-[11px] transition-all ${
                displaySettings.autoCenter
                  ? 'bg-indigo-500/10 border-indigo-400/40 text-indigo-300'
                  : 'bg-slate-900/40 border-slate-900 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="font-semibold block">Auto-Center DOM</span>
              <Focus className="w-3.5 h-3.5" />
            </button>

            {/* Sharp Gridlines Toggle */}
            <button
              id="pref-toggle-gridlines"
              onClick={() => setDisplaySettings(p => ({ ...p, showHorizontalGrid: !p.showHorizontalGrid }))}
              className={`p-2 rounded-lg border flex items-center justify-between text-[11px] transition-all ${
                displaySettings.showHorizontalGrid
                  ? 'bg-indigo-500/10 border-indigo-400/40 text-indigo-300'
                  : 'bg-slate-900/40 border-slate-900 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="font-semibold block font-mono">Row Gridlines</span>
              <Grid className="w-3.5 h-3.5 text-indigo-400" />
            </button>

            {/* Heatmap Overlay Toggle */}
            <button
              id="pref-toggle-heatmap"
              onClick={() => setDisplaySettings(p => ({ ...p, showHeatmap: !p.showHeatmap }))}
              className={`p-2 rounded-lg border flex items-center justify-between text-[11px] transition-all ${
                displaySettings.showHeatmap
                  ? 'bg-amber-500/10 border-amber-400/30 text-amber-300'
                  : 'bg-slate-900/40 border-slate-900 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="font-semibold block font-mono">Depth Heatmap</span>
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            </button>
          </div>
        </div>

      </div>

      {/* 4. MASTER SONIFICATION AUDIO DECK */}
      <div id="audio-mixer-shelf" className="flex flex-col gap-3.5 border-t border-slate-900 pt-5">
        <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-900">
          <div className="flex items-center gap-3">
            <button
              id="master-audio-mute-toggle"
              onClick={handleToggleAudio}
              className={`p-3 rounded-xl border transition-all ${
                audioSettings.isEnabled
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {audioSettings.isEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-200">REAL-TIME CONCORD SONIFICATION</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {audioSettings.isEnabled ? 'Synthesizer Active - Listening to Market Depth' : 'Audio Engine Muted'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 h-full">
            <span className="text-[10px] text-slate-400 font-mono">GAIN FEEDBACK</span>
            <input
              id="mixer-master-volume-fader"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioSettings.masterVolume}
              onChange={handleUpdateVolume}
              disabled={!audioSettings.isEnabled}
              className="w-24 accent-emerald-500 cursor-pointer disabled:opacity-40"
            />
            <span className="text-[10px] text-slate-300 font-mono font-semibold w-8 text-right">
              {Math.round(audioSettings.masterVolume * 100)}%
            </span>
          </div>
        </div>

        {/* Synth Submodules Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
          {/* Active ticks click toggler */}
          <div className="flex items-center justify-between p-3 bg-slate-900/30 border border-slate-900 rounded-lg">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-300">Transaction Ticks Clip</span>
              <span className="text-[9px] text-slate-500 font-mono">Percussive click on executed trades</span>
            </div>
            <button
              id="audio-clicks-toggle"
              disabled={!audioSettings.isEnabled}
              onClick={handleToggleClicks}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-md border transition-all ${
                audioSettings.enableClicks && audioSettings.isEnabled
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-500/50'
                  : 'bg-slate-800/40 border-slate-800 text-slate-500'
              }`}
            >
              {audioSettings.enableClicks ? 'ACTIVE' : 'MUTED'}
            </button>
          </div>

          {/* Depth Imbalance Hum Drone Toggler */}
          <div className="flex items-center justify-between p-3 bg-slate-900/30 border border-slate-900 rounded-lg">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-300">Imbalance Sub-Drone</span>
              <span className="text-[9px] text-slate-500 font-mono">Continuous hum modulating on bids vs asks ratio</span>
            </div>
            <button
              id="audio-drone-toggle"
              disabled={!audioSettings.isEnabled}
              onClick={handleToggleDrone}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-md border transition-all ${
                audioSettings.enableDrone && audioSettings.isEnabled
                  ? 'bg-indigo-950 text-indigo-300 border-indigo-500/50'
                  : 'bg-slate-800/40 border-slate-800 text-slate-500'
              }`}
            >
              {audioSettings.enableDrone ? 'ACTIVE' : 'MUTED'}
            </button>
          </div>
        </div>

        {/* Drone Pitch slider under industrial synth styling */}
        {audioSettings.enableDrone && audioSettings.isEnabled && (
          <div className="p-3.5 bg-slate-900/20 border border-slate-900 rounded-lg flex flex-col gap-2 font-mono">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>DRONE SUB PITCH OSCILLATOR</span>
              <span className="text-indigo-400 font-bold">{activeDroneFreq} Hz</span>
            </div>
            <input
              id="osc-frequency-slider"
              type="range"
              min="55"
              max="220"
              step="1"
              value={activeDroneFreq}
              onChange={handleUpdateDroneFreq}
              className="w-full accent-indigo-400 cursor-pointer"
            />
            <div className="flex justify-between text-[8px] text-slate-600">
              <span>55Hz (Low Ab)</span>
              <span>110Hz (A2 Fundamental)</span>
              <span>220Hz (A3 Octave)</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. HARDWARE & LATENCY TELEMETRY CHANNEL */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/20 border border-slate-900 rounded-lg text-[10px] font-mono text-slate-500">
        <div id="telemetry-latency" className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>SOCKET LATENCY:</span>
          <span className={`font-bold ${latencyMs > 120 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {latencyMs > 0 ? `${latencyMs}ms` : '---'}
          </span>
        </div>
        <div id="telemetry-throughput">
          <span>THROUGHPUT:</span>
          <span className="text-slate-300 font-bold ml-1">{messageRate} msgs/sec</span>
        </div>
      </div>
    </div>
  );
};
