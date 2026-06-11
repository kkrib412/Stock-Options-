import React from 'react';
import { Trade, AssetSymbol } from '../types';
import { SUPPORTED_ASSETS } from '../constants';
import { Sparkles, TrendingUp, TrendingDown, Layers } from 'lucide-react';

interface TapeListProps {
  trades: Trade[];
  symbol: AssetSymbol;
}

export const TapeList: React.FC<TapeListProps> = ({ trades, symbol }) => {
  const asset = SUPPORTED_ASSETS[symbol] || SUPPORTED_ASSETS.BTCUSDT;

  return (
    <div id="trade-tape-widget" className="w-full flex-1 flex flex-col bg-slate-950/40 rounded-xl border border-slate-900 overflow-hidden shadow-xl max-h-[400px] lg:max-h-none lg:h-full">
      {/* Tape Header */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-900 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">REAL-TIME TAPE INDEX</h3>
        </div>
        <div className="font-mono text-[10px] text-slate-500">
          MAX BUFFER: 50
        </div>
      </div>

      {/* Tape Rows Container */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 p-2 flex flex-col gap-1 min-h-[180px]">
        {trades.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-2 p-4">
            <span className="animate-spin text-xs">⌛</span>
            <span className="text-[10px] font-mono">WAITING FOR NETWORK TICKETS...</span>
          </div>
        ) : (
          trades.map((trade) => {
            const sizeFormatted = trade.size.toLocaleString(undefined, {
              minimumFractionDigits: symbol === 'XRPUSDT' ? 1 : 3,
              maximumFractionDigits: 4,
            });
            const valueFormatted = Math.round(trade.usdValue).toLocaleString();
            const timeStr = new Date(trade.time).toLocaleTimeString(undefined, {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }) + '.' + String(trade.time % 1000).padStart(3, '0');

            return (
              <div
                key={trade.id + '-' + trade.time}
                id={`trade-tick-${trade.id}`}
                className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-mono transition-all duration-300 ${
                  trade.isHighVolume
                    ? trade.side === 'buy'
                      ? 'bg-emerald-950/35 border-emerald-500/50 text-emerald-200 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.15)] font-bold'
                      : 'bg-red-950/35 border-red-500/50 text-red-200 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.15)] font-bold'
                    : 'bg-slate-950/50 border-slate-900/60 hover:bg-slate-900/40 text-slate-300 hover:border-slate-800'
                }`}
              >
                {/* Left side: Time & Price Direction */}
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-slate-500 font-medium">
                    {timeStr}
                  </span>
                  <div className={`flex items-center gap-1 font-semibold ${
                    trade.side === 'buy' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {trade.side === 'buy' ? (
                      <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    <span>
                      ${trade.price.toLocaleString(undefined, { minimumFractionDigits: asset.decimals })}
                    </span>
                  </div>
                </div>

                {/* Right side: Size & Value details */}
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-mono">
                    {sizeFormatted}
                  </span>
                  
                  {/* USD Value block */}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    trade.isHighVolume
                      ? trade.side === 'buy'
                        ? 'bg-emerald-500/40 text-emerald-50'
                        : 'bg-red-500/40 text-red-50'
                      : 'bg-slate-900 text-slate-400'
                  }`}>
                    ${valueFormatted}
                  </span>

                  {/* Liquid alerts tag */}
                  {trade.isHighVolume && (
                    <span className="text-amber-400 flex items-center justify-center animate-bounce">
                      <Sparkles className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
