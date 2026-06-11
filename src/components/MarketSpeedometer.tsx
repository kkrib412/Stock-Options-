import React from 'react';
import { MarketStats, AssetSymbol } from '../types';
import { SUPPORTED_ASSETS } from '../constants';
import { Gauge, ArrowUpRight, ArrowDownRight, Percent, Award } from 'lucide-react';

interface MarketSpeedometerProps {
  stats: MarketStats;
  symbol: AssetSymbol;
}

export const MarketSpeedometer: React.FC<MarketSpeedometerProps> = ({ stats, symbol }) => {
  const asset = SUPPORTED_ASSETS[symbol] || SUPPORTED_ASSETS.BTCUSDT;

  // Calculate Imbalance percentage
  const bidPercentage = Math.round(stats.imbalance * 100);
  const askPercentage = 100 - bidPercentage;

  // Speedometer mapping metrics
  // Max sensible speed limit = 50 trades/sec for normal display saturation
  const tradesSec = stats.tradeVelocity;
  const rawPercentage = Math.min(100, (tradesSec / 40) * 100);

  // SVG parameters for speedometer gauge
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  // Arc represents 270 degrees (3/4 of the circle)
  const strokeDashoffset = circumference - (rawPercentage / 100) * (circumference * 0.75);

  const formatVolume = (val: number) => {
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(2)}M`;
    }
    if (val >= 1000) {
      return `$${(val / 1000).toFixed(1)}k`;
    }
    return `$${val.toFixed(0)}`;
  };

  return (
    <div id="pulse-metrics-rack" className="w-full flex flex-col gap-4 p-5 bg-slate-950/60 border border-slate-900 rounded-xl shadow-xl">
      
      {/* SECTION HEADER */}
      <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
        <Gauge className="w-4 h-4 text-amber-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">MARKET VELOCITY & PRESSURE</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
        
        {/* 1. TRADE VELOCITY SPEEDOMETER (SVG GAUGE) */}
        <div id="velocity-speedometer" className="flex flex-col items-center justify-center p-4 bg-slate-950 rounded-lg border border-slate-900 text-center relative overflow-hidden">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            TRADE VELOCITY
          </div>

          <div className="relative w-32 h-24 flex items-center justify-center">
            {/* Speedometer ring back */}
            <svg className="w-full h-full transform -rotate-225" viewBox="0 0 120 120">
              {/* Arc background tracker */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-slate-800"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={`${circumference * 0.75} ${circumference}`}
                strokeLinecap="round"
              />
              {/* Highlight active level */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-amber-400 transition-all duration-300"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={`${circumference * 0.75} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>

            {/* Inner text values */}
            <div className="absolute inset-x-0 bottom-4 flex flex-col items-center">
              <span className="text-2xl font-black font-mono text-slate-100 leading-none">
                {tradesSec}
              </span>
              <span className="text-[9px] text-slate-500 font-mono font-bold uppercase mt-1">
                Ticks / Sec
              </span>
            </div>
          </div>

          {/* Sizing status label */}
          <div className="mt-2 text-xs font-semibold font-mono">
            {tradesSec > 25 ? (
              <span className="text-red-400 animate-pulse font-bold">⚡ HYPER SPEED ACTIVITY</span>
            ) : tradesSec > 10 ? (
              <span className="text-amber-400">⚡ ELEVATED TICKS</span>
            ) : (
              <span className="text-slate-500">STABLE FLOW</span>
            )}
          </div>
        </div>

        {/* 2. PRICE MOMENTUM ACCELERATION */}
        <div id="momentum-speed" className="flex flex-col justify-between p-4 bg-slate-950 rounded-lg border border-slate-900 font-mono">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2.5">
              PRICE MOMENTUM (1S)
            </div>
            
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold ${
                stats.priceVelocity > 0 ? 'text-emerald-400' : (stats.priceVelocity < 0 ? 'text-red-400' : 'text-slate-400')
              }`}>
                {stats.priceVelocity >= 0 ? '+' : ''}
                ${stats.priceVelocity.toFixed(asset.decimals)}
              </span>
              <span className="text-[9px] text-slate-500 font-normal">USDT / S</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-900/60">
            {stats.priceVelocity > 0 ? (
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            ) : stats.priceVelocity < 0 ? (
              <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                <Percent className="w-4 h-4" />
              </div>
            )}
            <div className="flex flex-col text-[10px]">
              <span className="text-slate-400 font-bold">VELOCITY RATE</span>
              <span className="text-slate-500">Acceleration profile</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. ORDER BOOK LIQUIDITY IMBALANCE */}
      <div id="orderbook-imbalance-meter" className="flex flex-col gap-2 p-4 bg-slate-950 rounded-lg border border-slate-900">
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 font-mono">
          <span className="uppercase tracking-widest">LIQUIDITY PRESSURE</span>
          <span className="text-indigo-400">Bids Imbalance</span>
        </div>

        {/* Dynamic Horizontal imbalance split */}
        <div className="h-6 w-full rounded-lg overflow-hidden flex border border-slate-900 p-0.5 bg-slate-950 font-mono">
          <div
            id="bid-pressure-bar"
            style={{ width: `${bidPercentage}%` }}
            className="bg-gradient-to-r from-emerald-950 to-emerald-600 transition-all duration-300 flex items-center pl-2 text-[10px] font-bold text-emerald-100"
          >
            {bidPercentage > 15 ? `${bidPercentage}%` : ''}
          </div>
          <div
            id="ask-pressure-bar"
            style={{ width: `${askPercentage}%` }}
            className="bg-gradient-to-l from-red-950 to-red-600 transition-all duration-300 flex items-center justify-end pr-2 text-[10px] font-bold text-red-100"
          >
            {askPercentage > 15 ? `${askPercentage}%` : ''}
          </div>
        </div>

        {/* Imbalance footnotes legend layout */}
        <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
          <span className="text-emerald-500 font-semibold flex items-center gap-1">🟢 Buying (BIDS) Size</span>
          <span className="text-red-500 font-semibold flex items-center gap-1">Red Sell (ASKS) Size 🔴</span>
        </div>
      </div>

      {/* 4. TOTAL VOLUME TRACKERS */}
      <div id="trade-volume-totals" className="grid grid-cols-2 gap-2 mt-1">
        <div className="p-3 bg-emerald-950/10 border border-emerald-900/30 rounded-lg font-mono">
          <div className="text-[8px] font-bold text-emerald-500/75 uppercase tracking-widest">
            ACCUM BUY VOL (USDT)
          </div>
          <p className="text-sm font-bold text-emerald-300 mt-1">
            {formatVolume(stats.buyVolume)}
          </p>
        </div>
        <div className="p-3 bg-red-950/10 border border-red-900/30 rounded-lg font-mono">
          <div className="text-[8px] font-bold text-red-500/75 uppercase tracking-widest">
            ACCUM SELL VOL (USDT)
          </div>
          <p className="text-sm font-bold text-red-300 mt-1">
            {formatVolume(stats.sellVolume)}
          </p>
        </div>
      </div>

    </div>
  );
};
