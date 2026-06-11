import React, { useState, useMemo } from 'react';
import { Trade, AssetSymbol } from '../types';
import { BarChart3, TrendingUp, ShieldAlert, Users, Coins, HelpCircle } from 'lucide-react';

interface WhaleHistogramProps {
  minuteTrades: Trade[];
  symbol: AssetSymbol;
}

type AggregationMode = 'volume' | 'count';

interface BucketDefinition {
  id: string;
  name: string;
  rangeLabel: string;
  minUsd: number;
  maxUsd: number;
  icon: React.ReactNode;
  colorClass: string;
}

export const WhaleHistogram: React.FC<WhaleHistogramProps> = ({ minuteTrades, symbol }) => {
  const [mode, setMode] = useState<AggregationMode>('volume');
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Define buckets by USD value
  const buckets: BucketDefinition[] = useMemo(() => [
    {
      id: 'microlight',
      name: 'Retail / Micro',
      rangeLabel: '< $1k',
      minUsd: 0,
      maxUsd: 1000,
      icon: <Users className="w-3.5 h-3.5 text-blue-400" />,
      colorClass: 'text-blue-400 bg-blue-500',
    },
    {
      id: 'small',
      name: 'Small Orders',
      rangeLabel: '$1k - $10k',
      minUsd: 1000,
      maxUsd: 10000,
      icon: <Coins className="w-3.5 h-3.5 text-slate-400" />,
      colorClass: 'text-slate-400 bg-slate-500',
    },
    {
      id: 'medium',
      name: 'Medium / Private',
      rangeLabel: '$10k - $50k',
      minUsd: 10000,
      maxUsd: 50000,
      icon: <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />,
      colorClass: 'text-indigo-400 bg-indigo-500',
    },
    {
      id: 'large',
      name: 'Large / Institution',
      rangeLabel: '$50k - $250k',
      minUsd: 50000,
      maxUsd: 250000,
      icon: <TrendingUp className="w-3.5 h-3.5 text-amber-400 animate-pulse" />,
      colorClass: 'text-amber-400 bg-amber-500',
    },
    {
      id: 'whale',
      name: 'Whales / Systemic',
      rangeLabel: '> $250k',
      minUsd: 250000,
      maxUsd: Infinity,
      icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-bounce" />,
      colorClass: 'text-rose-500 bg-rose-500',
    }
  ], []);

  // Compute live bucket values for trades in the last 60 seconds
  const bucketData = useMemo(() => {
    // Initialize results
    const results = buckets.map(b => ({
      ...b,
      buysCount: 0,
      sellsCount: 0,
      buysVolume: 0,
      sellsVolume: 0,
      totalCount: 0,
      totalVolume: 0,
    }));

    minuteTrades.forEach(trade => {
      const val = trade.usdValue;
      // Find matching bucket
      const bucket = results.find(b => val >= b.minUsd && val < b.maxUsd);
      if (bucket) {
        if (trade.side === 'buy') {
          bucket.buysCount++;
          bucket.buysVolume += val;
        } else {
          bucket.sellsCount++;
          bucket.sellsVolume += val;
        }
        bucket.totalCount++;
        bucket.totalVolume += val;
      }
    });

    // Find the maximum bar total weight across all buckets to standardize widths
    let maxWeight = 0.0001;
    results.forEach(b => {
      const weight = mode === 'volume' ? b.totalVolume : b.totalCount;
      if (weight > maxWeight) {
        maxWeight = weight;
      }
    });

    return {
      results,
      maxWeight,
    };
  }, [minuteTrades, buckets, mode]);

  // Compute total rolling volume & active large prints (Whales / Institutional)
  const currentSummary = useMemo(() => {
    let totVol = 0;
    let whaleTradeCount = 0;
    const now = Date.now();
    let latestWhaleAgeSec: number | null = null;

    minuteTrades.forEach(t => {
      totVol += t.usdValue;
      if (t.usdValue >= 50000) {
        whaleTradeCount++;
        const age = (now - t.time) / 1000;
        if (latestWhaleAgeSec === null || age < latestWhaleAgeSec) {
          latestWhaleAgeSec = age;
        }
      }
    });

    return {
      totalRollingVolume: totVol,
      whaleTradeCount,
      latestWhaleAgeSec,
    };
  }, [minuteTrades]);

  const formatUsd = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="w-full flex flex-col gap-4 p-5 bg-slate-950/60 border border-slate-900 rounded-xl shadow-xl font-mono">
      
      {/* PANEL TITLE BAR */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            1M FLOW HISTOGRAM
          </h3>
        </div>

        {/* Dynamic Aggregation Toggles */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setMode('volume')}
            className={`px-2.5 py-1 rounded text-[9px] font-black transition-all ${
              mode === 'volume'
                ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            VOLUME ($)
          </button>
          <button
            onClick={() => setMode('count')}
            className={`px-2.5 py-1 rounded text-[9px] font-black transition-all ${
              mode === 'count'
                ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            TAPE COUNT
          </button>
        </div>
      </div>

      {/* WHALE ALERT NOTIFICATION STRIPE */}
      {currentSummary.latestWhaleAgeSec !== null && currentSummary.latestWhaleAgeSec < 15 ? (
        <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] px-3 py-2 rounded-lg flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 animate-bounce" />
            <span className="font-bold uppercase tracking-wider">
              WHALE DETECTED IN LAST 15S!
            </span>
          </div>
          <span className="bg-rose-950 px-1.5 py-0.5 rounded font-black text-[9px]">
            {currentSummary.latestWhaleAgeSec.toFixed(1)}S AGO
          </span>
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-900 text-slate-500 text-[10px] px-3 py-2 rounded-lg text-center font-semibold">
          No institutional prints ( &gt; $50k) in the last 15 seconds.
        </div>
      )}

      {/* HISTOGRAM DISTRIBUTION BLOCK */}
      <div className="flex flex-col gap-3.5 my-1">
        {bucketData.results.map(b => {
          const totalWeight = mode === 'volume' ? b.totalVolume : b.totalCount;
          // Calculate overall width of this bar relative to maximum bucket
          const relativeWidthPercentage = (totalWeight / bucketData.maxWeight) * 100;

          // Inside the active width percentage, calculate splits between buying and selling pressure
          const valBuy = mode === 'volume' ? b.buysVolume : b.buysCount;
          const valSell = mode === 'volume' ? b.sellsVolume : b.sellsCount;
          const localSum = valBuy + valSell;
          const buyRatio = localSum > 0 ? valBuy / localSum : 0.5;
          const sellRatio = 1 - buyRatio;

          return (
            <div key={b.id} className="flex flex-col gap-1 text-[11px]">
              {/* Labels & numeric values */}
              <div className="flex justify-between items-center text-[10px]">
                <span className="flex items-center gap-1.5 font-bold text-slate-300">
                  {b.icon}
                  <span>{b.name}</span>
                  <span className="text-slate-500 text-[9px] font-medium">({b.rangeLabel})</span>
                </span>
                
                {/* Mode value display */}
                <span className="font-bold flex items-center gap-2">
                  <span className="text-emerald-400">
                    {mode === 'volume' ? formatUsd(b.buysVolume) : b.buysCount}
                  </span>
                  <span className="text-slate-700">|</span>
                  <span className="text-red-400">
                    {mode === 'volume' ? formatUsd(b.sellsVolume) : b.sellsCount}
                  </span>
                </span>
              </div>

              {/* Graphical representation slider */}
              <div className="h-4 w-full bg-slate-950 rounded border border-slate-900/60 p-0.5 overflow-hidden flex relative">
                {relativeWidthPercentage > 1 ? (
                  <div
                    style={{ width: `${relativeWidthPercentage}%` }}
                    className="h-full rounded-sm overflow-hidden flex transition-all duration-300"
                  >
                    {/* Buy pressure section */}
                    <div
                      style={{ width: `${buyRatio * 100}%` }}
                      className="h-full bg-emerald-500/80 hover:bg-emerald-400 border-r border-emerald-950 transition-all duration-300"
                      title={`Buys: ${mode === 'volume' ? formatUsd(b.buysVolume) : b.buysCount}`}
                    />
                    {/* Sell pressure section */}
                    <div
                      style={{ width: `${sellRatio * 100}%` }}
                      className="h-full bg-red-400/80 hover:bg-red-400 transition-all duration-300"
                      title={`Sells: ${mode === 'volume' ? formatUsd(b.sellsVolume) : b.sellsCount}`}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-600 font-bold uppercase tracking-widest pl-2">
                    Zero Activity
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER METRIC INFO */}
      <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1 border-t border-slate-900/80 pt-3">
        <span className="flex items-center gap-1 font-bold">
          <span className="text-emerald-400">■</span> Buys Vol
          <span className="text-slate-700 mx-1">/</span>
          <span className="text-red-400">■</span> Sells Vol
        </span>
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
        >
          <HelpCircle className="w-3.5 h-3.5" /> HOW TO READ THIS?
        </button>
      </div>

      {showExplanation && (
        <div className="bg-slate-950 border border-slate-900 rounded-lg p-3 text-[10px] text-slate-400 leading-relaxed mt-2 animate-fade-in">
          <p className="mb-2">
            The width of each bar indicates the <span className="text-indigo-300 font-bold">relative size scale</span> of that segment relative to other segments.
          </p>
          <p>
            The green and red colors inside the bar represent the <span className="text-emerald-400 font-bold">Buyer Pressure</span> vs <span className="text-red-400 font-bold">Seller Liquidity Draw downs</span> inside that exact volume tier.
          </p>
        </div>
      )}
    </div>
  );
};
