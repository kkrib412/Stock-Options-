import React, { useState, useMemo } from 'react';
import { Trade, AssetSymbol, OrderBookState } from '../types';
import { SUPPORTED_ASSETS } from '../constants';
import { Activity, Landmark, ArrowUpDown, ChevronDown, ChevronUp, HelpCircle, ShieldAlert } from 'lucide-react';

interface FlowDeltaChartProps {
  fiveMinuteTrades: Trade[];
  orderBook: OrderBookState;
  symbol: AssetSymbol;
  tickGrouping: number;
  lastPrice: number;
}

type SizeUnit = 'usd' | 'token';

export const FlowDeltaChart: React.FC<FlowDeltaChartProps> = ({
  fiveMinuteTrades,
  orderBook,
  symbol,
  tickGrouping,
  lastPrice,
}) => {
  const [unit, setUnit] = useState<SizeUnit>('usd');
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const asset = SUPPORTED_ASSETS[symbol] || SUPPORTED_ASSETS.BTCUSDT;

  // Aggregate trades over the last 5 minutes grouped by rounded tickGrouping levels
  const aggregatedProfile = useMemo(() => {
    if (lastPrice === 0) return { levels: [], maxAbsDelta: 0.001, totalBuys: 0, totalSells: 0 };

    // Determine the current mid price rounded to grouping
    const centerPrice = Math.round(lastPrice / tickGrouping) * tickGrouping;

    // Generate 12 levels: 6 above center, 6 below center, and the center level
    const levelPrices: number[] = [];
    for (let i = 5; i >= -5; i--) {
      levelPrices.push(centerPrice + i * tickGrouping);
    }

    // Prepare container for level data
    // Map of rounded price key => volume metrics
    const bucketMap: Record<string, { buySize: number; buyUsd: number; sellSize: number; sellUsd: number }> = {};
    levelPrices.forEach(p => {
      bucketMap[p.toFixed(8)] = { buySize: 0, buyUsd: 0, sellSize: 0, sellUsd: 0 };
    });

    // Populate using rolling 5-minute trades
    let totalBuys = 0;
    let totalSells = 0;

    fiveMinuteTrades.forEach(t => {
      // Find the closest bucket
      const roundedPrice = Math.round(t.price / tickGrouping) * tickGrouping;
      const key = roundedPrice.toFixed(8);

      // Accumulate global stats
      if (t.side === 'buy') {
        totalBuys += unit === 'usd' ? t.usdValue : t.size;
      } else {
        totalSells += unit === 'usd' ? t.usdValue : t.size;
      }

      // If this bucket is within our generated 11-row visual window, accumulate
      if (bucketMap[key]) {
        if (t.side === 'buy') {
          bucketMap[key].buySize += t.size;
          bucketMap[key].buyUsd += t.usdValue;
        } else {
          bucketMap[key].sellSize += t.size;
          bucketMap[key].sellUsd += t.usdValue;
        }
      }
    });

    // Match each price row with passive orderbook data for direct aggressive vs passive comparisons
    // Bids and asks lookups
    const bookBidLookup: Record<string, number> = {};
    const bookAskLookup: Record<string, number> = {};
    orderBook.bids.forEach(b => {
      const k = Math.round(b.price / tickGrouping) * tickGrouping;
      bookBidLookup[k.toFixed(8)] = (bookBidLookup[k.toFixed(8)] || 0) + b.size;
    });
    orderBook.asks.forEach(a => {
      const k = Math.round(a.price / tickGrouping) * tickGrouping;
      bookAskLookup[k.toFixed(8)] = (bookAskLookup[k.toFixed(8)] || 0) + a.size;
    });

    let maxAbsDelta = 0.0001;

    const rowItems = levelPrices.map(price => {
      const key = price.toFixed(8);
      const data = bucketMap[key];

      const buys = unit === 'usd' ? data.buyUsd : data.buySize;
      const sells = unit === 'usd' ? data.sellUsd : data.sellSize;
      const netDelta = buys - sells;
      const absDelta = Math.abs(netDelta);

      if (absDelta > maxAbsDelta) {
        maxAbsDelta = absDelta;
      }

      // Grab passive limit depth at this exact level (representing passive supply/demand)
      const bidBookDepth = bookBidLookup[key] || 0;
      const askBookDepth = bookAskLookup[key] || 0;
      const passiveLimitVolume = bidBookDepth + askBookDepth;
      const passiveBookValue = passiveLimitVolume * price;
      const passiveDisplay = unit === 'usd' ? passiveBookValue : passiveLimitVolume;

      return {
        price,
        buys,
        sells,
        netDelta,
        totalVolume: buys + sells,
        passiveDisplay,
        hasBookBid: bidBookDepth > 0,
        hasBookAsk: askBookDepth > 0,
      };
    });

    return {
      levels: rowItems,
      maxAbsDelta,
      totalBuys,
      totalSells,
    };
  }, [fiveMinuteTrades, orderBook, tickGrouping, lastPrice, unit]);

  const formatValue = (val: number) => {
    if (unit === 'usd') {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
      return `$${val.toFixed(0)}`;
    } else {
      if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
      return val.toFixed(2);
    }
  };

  const getPriceColor = (price: number) => {
    if (Math.abs(price - lastPrice) < tickGrouping * 0.5) return 'text-amber-400 font-bold';
    return price < lastPrice ? 'text-emerald-500' : 'text-red-500';
  };

  const deltaRatio = aggregatedProfile.totalBuys + aggregatedProfile.totalSells > 0
    ? (aggregatedProfile.totalBuys / (aggregatedProfile.totalBuys + aggregatedProfile.totalSells)) * 100
    : 50;

  return (
    <div className="w-full flex flex-col gap-3 p-4 bg-slate-950/80 border border-slate-900 rounded-xl shadow-xl font-mono">
      
      {/* 1. COMPONENT TITLE LINE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              5M VOLUMETRIC FLOW PROFILE
            </h4>
            <p className="text-[9px] text-slate-500 uppercase">
              Taker Aggressors vs passive limit walls
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Unit Toggle */}
          <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setUnit('usd')}
              className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${
                unit === 'usd'
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              USD ($)
            </button>
            <button
              onClick={() => setUnit('token')}
              className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${
                unit === 'token'
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {symbol.replace('USDT', '')}
            </button>
          </div>
        </div>
      </div>

      {/* 2. GLOBAL 5M ACCUMULATED TAKER RATIO SLIDER */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[9px] font-bold">
          <span className="text-emerald-400">AGGR BUYS: {formatValue(aggregatedProfile.totalBuys)} ({deltaRatio.toFixed(1)}%)</span>
          <span className="text-red-400">AGGR SELLS: {formatValue(aggregatedProfile.totalSells)} ({(100 - deltaRatio).toFixed(1)}%)</span>
        </div>
        <div className="h-1.5 w-full bg-slate-9000 bg-slate-900 rounded-full overflow-hidden flex">
          <div style={{ width: `${deltaRatio}%` }} className="h-full bg-emerald-500/80 transition-all duration-300" />
          <div style={{ width: `${100 - deltaRatio}%` }} className="h-full bg-red-400/80 transition-all duration-300" />
        </div>
      </div>

      {/* 3. ROW DISTRIBUTION GRID */}
      <div className="flex flex-col gap-1 mx-0.5 text-[10px]">
        {/* Header Indicators row */}
        <div className="grid grid-cols-12 gap-1 text-[8px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-900/40 pb-1">
          <div className="col-span-3">PRICE ({symbol.replace('USDT', '')})</div>
          <div className="col-span-3 text-right">NET DELTA</div>
          <div className="col-span-4 text-center">FLOW PRESSURE (- / +)</div>
          <div className="col-span-2 text-right">BOOK LIMITS</div>
        </div>

        {/* Level Rows */}
        {aggregatedProfile.levels.length === 0 ? (
          <div className="text-center text-slate-600 py-4 text-[9px]">
            WAITING FOR LIVE MARKET TRADE TICK TAPES...
          </div>
        ) : (
          aggregatedProfile.levels.map(row => {
            const hasActivity = row.totalVolume > 0;
            const netVal = Math.abs(row.netDelta);
            const relativeBarWidth = (netVal / aggregatedProfile.maxAbsDelta) * 50; // Max 50% on either side

            // Contrast check: Is aggressive flow high relative to passive book?
            // "Absorption" = book depth absorbs massive active delta (passive is victorious)
            // "Sweep" = low book depth unable to hold active flow
            const isHeavyAbsorption = hasActivity && row.passiveDisplay > 0 && 
              (row.totalVolume > row.passiveDisplay * 0.6);

            return (
              <div 
                key={row.price} 
                className="grid grid-cols-12 gap-1 py-1 border-b border-slate-900/30 items-center hover:bg-slate-900/20"
              >
                {/* Price Display */}
                <span className={`col-span-3 text-[10px] font-bold ${getPriceColor(row.price)}`}>
                  ${row.price.toLocaleString(undefined, { minimumFractionDigits: asset.decimals })}
                </span>

                {/* Net Delta Value */}
                <span className={`col-span-3 text-right text-[10px] font-bold ${
                  row.netDelta > 0 
                    ? 'text-emerald-400' 
                    : (row.netDelta < 0 ? 'text-red-400' : 'text-slate-500')
                }`}>
                  {row.netDelta > 0 ? '+' : ''}
                  {formatValue(row.netDelta)}
                </span>

                {/* Double-Sided Delta Chart segment */}
                <div className="col-span-4 h-3 bg-slate-950 border border-slate-900/40 rounded p-0.5 relative overflow-hidden flex items-center">
                  {/* Center vertical hairline tick */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-800 pointer-events-none" />

                  {hasActivity ? (
                    row.netDelta > 0 ? (
                      // Positive Delta: extends to the right from the center
                      <div
                        style={{
                          left: '50%',
                          width: `${relativeBarWidth}%`
                        }}
                        className="absolute h-1.5 bg-emerald-500/80 rounded-r-sm hover:bg-emerald-400 transition-all duration-300"
                        title={`Aggressive buys dominate this level by ${formatValue(row.netDelta)}`}
                      />
                    ) : (
                      // Negative Delta: extends to the left from the center
                      <div
                        style={{
                          right: '50%',
                          width: `${relativeBarWidth}%`
                        }}
                        className="absolute h-1.5 bg-red-400/80 rounded-l-sm hover:bg-red-300 transition-all duration-300"
                        title={`Aggressive sells dominate this level by ${formatValue(Math.abs(row.netDelta))}`}
                      />
                    )
                  ) : null}
                </div>

                {/* Passive Book Limit Depth */}
                <div className="col-span-2 text-right text-[10px] pr-0.5 flex items-center justify-end gap-1 font-mono">
                  <span className={`${row.hasBookBid ? 'text-emerald-500/60' : (row.hasBookAsk ? 'text-red-400/60' : 'text-slate-600')}`}>
                    {row.passiveDisplay > 0 ? formatValue(row.passiveDisplay) : '0'}
                  </span>
                  
                  {isHeavyAbsorption && (
                    <div 
                      className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse border border-amber-300" 
                      title="Absorption Detected: High trade activity colliding with passive limit book blockades."
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. EXPLANATION TOGGLE BUTTONS */}
      <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-900/80 pt-2 pb-0.5">
        <span className="flex items-center gap-1">
          <span className="text-amber-500 text-[10px]">●</span> Absorption Warn Light
        </span>
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold uppercase"
        >
          <HelpCircle className="w-3.5 h-3.5" /> What is Aggressive vs Passive?
        </button>
      </div>

      {showExplanation && (
        <div className="bg-slate-950 border border-slate-900 rounded-lg p-3 text-[10px] text-slate-400 leading-relaxed mt-1 animate-fade-in flex flex-col gap-2">
          <p>
            <span className="text-amber-400 font-bold uppercase">Aggressive Flow</span> is driven by Takers entering via market orders which immediate clip and deplete existing limit order volumes inside the ledger (green = market buys hitting asks; red = market sells filling bids).
          </p>
          <p>
            <span className="text-indigo-300 font-bold uppercase">Passive Flow</span> is represented by Limit traders posting volumes inside the order book (Book Limits column). When market orders collide with huge limit blocks, the <span className="text-amber-500 font-bold">Absorption Warning</span> triggers, indicating that limit order buffers is absorbing market buying/selling.
          </p>
        </div>
      )}

    </div>
  );
};
