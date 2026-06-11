import React, { useRef, useEffect, useState } from 'react';
import { OrderBookState, MarketStats, DisplaySettings, AssetSymbol } from '../types';
import { SUPPORTED_ASSETS } from '../constants';

interface OrderBookCanvasProps {
  orderBook: OrderBookState;
  stats: MarketStats;
  symbol: AssetSymbol;
  displaySettings: DisplaySettings;
}

export const OrderBookCanvas: React.FC<OrderBookCanvasProps> = ({
  orderBook,
  stats,
  symbol,
  displaySettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Smooth scroll interpolation variables
  const targetPriceRef = useRef<number>(0);
  const currentScrollPriceRef = useRef<number>(0);

  // Cached orderbook in lookups for instant O(1) rendering access on canvas frames
  const bidsLookupRef = useRef<Record<string, number>>({});
  const asksLookupRef = useRef<Record<string, number>>({});
  const bidsCumLookupRef = useRef<Record<string, number>>({});
  const asksCumLookupRef = useRef<Record<string, number>>({});

  // Mouse hover state
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
  const [cumulativeHoverSize, setCumulativeHoverSize] = useState<number | null>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  // Dynamic Heatmap delta tracking database (stores changes per tick grouped level)
  const deltasRef = useRef<Record<string, { delta: number; type: 'buildup' | 'depletion'; timestamp: number; peakSize: number }>>({});

  const asset = SUPPORTED_ASSETS[symbol] || SUPPORTED_ASSETS.BTCUSDT;

  // Sync state data to refs for 60 FPS thread safety and calculate delta buildup events
  useEffect(() => {
    // Current target price is the execution price, or spread mid-point as safety
    if (stats.lastPrice > 0) {
      targetPriceRef.current = stats.lastPrice;
    } else if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
      targetPriceRef.current = (orderBook.bids[0].price + orderBook.asks[0].price) / 2;
    }

    if (currentScrollPriceRef.current === 0) {
      currentScrollPriceRef.current = targetPriceRef.current;
    }

    const now = Date.now();
    const newDeltas = { ...deltasRef.current };
    const processedKeys = new Set<string>();

    // Compare new bids to record liquidity delta changes
    orderBook.bids.forEach(level => {
      const k = level.price.toFixed(8);
      processedKeys.add(k);
      const prevSize = bidsLookupRef.current[k] ?? 0;
      const delta = level.size - prevSize;
      
      // Calculate delta relative size change threshold of 2.5% to filter minor system noise
      const deltaRatio = prevSize > 0 ? Math.abs(delta) / prevSize : 1.0;
      if (Math.abs(delta) > 0.0001 && deltaRatio > 0.025) {
        newDeltas[k] = {
          delta,
          type: delta > 0 ? 'buildup' : 'depletion',
          timestamp: now,
          peakSize: Math.max(level.size, prevSize),
        };
      }
    });

    // Compare asks
    orderBook.asks.forEach(level => {
      const k = level.price.toFixed(8);
      processedKeys.add(k);
      const prevSize = asksLookupRef.current[k] ?? 0;
      const delta = level.size - prevSize;
      
      const deltaRatio = prevSize > 0 ? Math.abs(delta) / prevSize : 1.0;
      if (Math.abs(delta) > 0.0001 && deltaRatio > 0.025) {
        newDeltas[k] = {
          delta,
          type: delta > 0 ? 'buildup' : 'depletion',
          timestamp: now,
          peakSize: Math.max(level.size, prevSize),
        };
      }
    });

    // Track dissolved/fully deleted bid levels (sizes moved to 0)
    Object.keys(bidsLookupRef.current).forEach(k => {
      if (!processedKeys.has(k)) {
        const prevSize = bidsLookupRef.current[k];
        if (prevSize > 0.01) {
          newDeltas[k] = {
            delta: -prevSize,
            type: 'depletion',
            timestamp: now,
            peakSize: prevSize,
          };
        }
      }
    });

    // Track dissolved/fully deleted ask levels (sizes moved to 0)
    Object.keys(asksLookupRef.current).forEach(k => {
      if (!processedKeys.has(k)) {
        const prevSize = asksLookupRef.current[k];
        if (prevSize > 0.01) {
          newDeltas[k] = {
            delta: -prevSize,
            type: 'depletion',
            timestamp: now,
            peakSize: prevSize,
          };
        }
      }
    });

    // Periodic sweep of stale deltas older than 4 seconds
    Object.keys(newDeltas).forEach(k => {
      if (now - newDeltas[k].timestamp > 4000) {
        delete newDeltas[k];
      }
    });

    deltasRef.current = newDeltas;

    // Refresh O(1) lookup tables for current cycle
    const bLookup: Record<string, number> = {};
    const bCumLookup: Record<string, number> = {};
    orderBook.bids.forEach(level => {
      const k = level.price.toFixed(8);
      bLookup[k] = level.size;
      bCumLookup[k] = level.cumulativeSize;
    });
    bidsLookupRef.current = bLookup;
    bidsCumLookupRef.current = bCumLookup;

    const aLookup: Record<string, number> = {};
    const aCumLookup: Record<string, number> = {};
    orderBook.asks.forEach(level => {
      const k = level.price.toFixed(8);
      aLookup[k] = level.size;
      aCumLookup[k] = level.cumulativeSize;
    });
    asksLookupRef.current = aLookup;
    asksCumLookupRef.current = aCumLookup;

  }, [orderBook, stats.lastPrice, symbol]);

  // Reset scroll on asset symbol change
  useEffect(() => {
    currentScrollPriceRef.current = 0;
  }, [symbol]);

  // Primary animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const dpr = window.devicePixelRatio || 1;

      // Clear the canvas
      ctx.fillStyle = '#0a0d14'; // Theme Background: Black-Slate
      ctx.fillRect(0, 0, width, height);

      const targetPrice = targetPriceRef.current;
      if (targetPrice === 0) {
        // Draw loading screen if websocket is initializing
        ctx.fillStyle = '#475569';
        ctx.font = `14px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('WAITING FOR EXCHANGES FEED SNAPSHOT...', width / 2, height / 2);
        animId = requestAnimationFrame(render);
        return;
      }

      // Smooth scroll interpolation (glides ledger smoothly on price fluctuation)
      if (displaySettings.autoCenter) {
        const diff = targetPrice - currentScrollPriceRef.current;
        // Dampen with 0.08 scaling factor for organic mix feel
        currentScrollPriceRef.current += diff * 0.08;
      } else {
        // Manual clamp or default follow
        currentScrollPriceRef.current = targetPrice;
      }

      const activeScrollPrice = currentScrollPriceRef.current;
      const tickG = displaySettings.tickGrouping;

      // Layout columns dimensions
      const colWidth = width / 5;
      const bidsCumColX = 0;
      const bidsColX = colWidth;
      const priceColX = colWidth * 2;
      const asksColX = colWidth * 3;
      const asksCumColX = colWidth * 4;

      const rowHeight = 32 * dpr; // responsive row height

      // Render grid rows
      const totalRowsToRender = Math.ceil(height / rowHeight) + 2;
      const centerRowIndex = Math.floor(totalRowsToRender / 2);

      // Determine the base rounded price at the exact center vertical position
      const centerPriceFloat = Math.round(activeScrollPrice / tickG) * tickG;

      // Draw horizontal guidelines & price slots
      for (let i = -centerRowIndex; i <= centerRowIndex; i++) {
        const rowPrice = centerPriceFloat + i * tickG;
        const rowPriceStr = rowPrice.toFixed(asset.decimals);

        // Find Y coord based on fractional offset from scroll price
        const priceDiff = rowPrice - activeScrollPrice;
        const offsetInTicks = priceDiff / tickG;
        const rowY = (height / 2) - (offsetInTicks * rowHeight);

        // Clip anything out of physical bounds
        if (rowY < -rowHeight || rowY > height + rowY) continue;

        const isLastTradedPrice = Math.abs(rowPrice - stats.lastPrice) < (tickG * 0.49);
        const isSpreadMidPrice = orderBook.bids.length > 0 && orderBook.asks.length > 0 &&
          rowPrice > orderBook.bids[0].price && rowPrice < orderBook.asks[0].price;

        const lookupKey = rowPrice.toFixed(8);
        const bidSize = bidsLookupRef.current[lookupKey] || 0;
        const askSize = asksLookupRef.current[lookupKey] || 0;
        const bidCum = bidsCumLookupRef.current[lookupKey] || 0;
        const askCum = asksCumLookupRef.current[lookupKey] || 0;

        // Hover checking on this row
        const mouse = mouseRef.current;
        const isRowHovered = mouse && mouse.y >= rowY - rowHeight/2 && mouse.y < rowY + rowHeight/2;
        if (isRowHovered) {
          if (hoveredPrice !== rowPrice) {
            setHoveredPrice(rowPrice);
            setCumulativeHoverSize(bidCum > 0 ? bidCum : (askCum > 0 ? askCum : 0));
          }
        }

        // Draw row background stripe (Execution LTP Highlighting or thermographic heat deltas)
        if (isLastTradedPrice) {
          // Glow background for last traded execution price row
          const gradient = ctx.createLinearGradient(0, rowY - rowHeight/2, width, rowY + rowHeight/2);
          if (stats.priceChangeDirection === 'up') {
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
            gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.18)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.08)');
          } else if (stats.priceChangeDirection === 'down') {
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
            gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.18)');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0.08)');
          } else {
            gradient.addColorStop(0, 'rgba(245, 158, 11, 0.05)');
            gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.12)');
            gradient.addColorStop(1, 'rgba(245, 158, 11, 0.05)');
          }
          ctx.fillStyle = gradient;
          ctx.fillRect(0, rowY - rowHeight/2 + 1, width, rowY + rowHeight/2 - (rowY - rowHeight/2) - 1);
        } else {
          // Heatmap Delta Indicator background overlays
          const deltaInfo = deltasRef.current[lookupKey];
          let drawnHeat = false;
          if (displaySettings.showHeatmap && deltaInfo) {
            const nowTime = Date.now();
            const age = nowTime - deltaInfo.timestamp;
            if (age < 4000) {
              drawnHeat = true;
              const ageOpacity = (1 - age / 4000);
              const sizeRatio = Math.min(1.0, Math.abs(deltaInfo.delta) / (orderBook.maxSize || 0.1));
              const intensity = Math.pow(sizeRatio, 0.45) * ageOpacity;
              
              const gradient = ctx.createLinearGradient(0, rowY - rowHeight/2, width, rowY + rowHeight/2);
              if (deltaInfo.type === 'buildup') {
                // Gold / Fire warmth glow for liquidity additions
                gradient.addColorStop(0, 'rgba(245, 158, 11, 0.01)');
                gradient.addColorStop(0.2, `rgba(245, 158, 11, ${intensity * 0.12})`);
                gradient.addColorStop(0.5, `rgba(251, 191, 36, ${intensity * 0.32})`);
                gradient.addColorStop(0.8, `rgba(245, 158, 11, ${intensity * 0.12})`);
                gradient.addColorStop(1, 'rgba(245, 158, 11, 0.01)');
              } else {
                // Deep Purple / Magenta glow when liquidity dissolves or is filled
                gradient.addColorStop(0, 'rgba(139, 92, 246, 0.01)');
                gradient.addColorStop(0.2, `rgba(139, 92, 246, ${intensity * 0.10})`);
                gradient.addColorStop(0.5, `rgba(236, 72, 153, ${intensity * 0.26})`);
                gradient.addColorStop(0.8, `rgba(139, 92, 246, ${intensity * 0.10})`);
                gradient.addColorStop(1, 'rgba(139, 92, 246, 0.01)');
              }
              ctx.fillStyle = gradient;
              ctx.fillRect(0, rowY - rowHeight/2 + 1, width, rowHeight - 1);
            }
          }

          if (isRowHovered) {
            ctx.fillStyle = drawnHeat ? 'rgba(255, 255, 255, 0.025)' : 'rgba(255, 255, 255, 0.03)';
            ctx.fillRect(0, rowY - rowHeight/2 + 1, width, rowHeight - 1);
          }
        }

        if (displaySettings.showHorizontalGrid) {
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, rowY - rowHeight/2);
          ctx.lineTo(width, rowY - rowHeight/2);
          ctx.stroke();
        }

        // --- DRAW BIDS COLUMN ---
        if (bidSize > 0) {
          // Normalize bar width
          const sizeRatio = Math.min(1.0, bidSize / (orderBook.maxSize || 1));
          const barW = sizeRatio * colWidth;

          // Compute if it's a Volume Wall (e.g. size occupies upper 30% percentile of book)
          const isVolumeWall = sizeRatio > 0.45;

          // Draw Fill Bar
          ctx.save();
          if (isVolumeWall) {
            // Neon glowing emerald wall gradient
            const grad = ctx.createLinearGradient(priceColX, 0, priceColX - barW, 0);
            grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
            grad.addColorStop(0.8, 'rgba(16, 185, 129, 0.15)');
            grad.addColorStop(1, 'rgba(52, 211, 153, 0.7)'); // bright glow edge
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
          }
          // Bid bars grow Left-ward from the Price Column (priceColX)
          ctx.fillRect(priceColX - barW, rowY - rowHeight/2 + 2, barW, rowHeight - 4);
          ctx.restore();

          // Render Bid Size text
          ctx.fillStyle = isVolumeWall ? '#6ee7b7' : '#10b981';
          ctx.font = `${isVolumeWall ? 'bold' : 'normal'} ${11 * dpr}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'right';
          ctx.fillText(bidSize.toFixed(3), priceColX - 8 * dpr, rowY + 4 * dpr);

          // Add liquid alert marker for massive size walls
          if (isVolumeWall) {
            ctx.fillStyle = '#fbbf24'; // warning amber
            ctx.font = `bold ${8 * dpr}px sans-serif`;
            ctx.fillText('WALL', priceColX - colWidth + 28 * dpr, rowY + 3 * dpr);
          }
        }

        // --- DRAW ASKS COLUMN ---
        if (askSize > 0) {
          // Normalize bar width
          const sizeRatio = Math.min(1.0, askSize / (orderBook.maxSize || 1));
          const barW = sizeRatio * colWidth;

          const isVolumeWall = sizeRatio > 0.45;

          // Draw Fill Bar
          ctx.save();
          if (isVolumeWall) {
            // Neon glowing crimson wall gradient
            const grad = ctx.createLinearGradient(priceColX + colWidth, 0, priceColX + colWidth + barW, 0);
            grad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
            grad.addColorStop(0.8, 'rgba(239, 68, 68, 0.15)');
            grad.addColorStop(1, 'rgba(248, 113, 113, 0.7)'); // bright neon edge
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
          }
          // Ask bars grow Right-ward from the Asks Column (priceColX + colWidth)
          ctx.fillRect(priceColX + colWidth, rowY - rowHeight/2 + 2, barW, rowHeight - 4);
          ctx.restore();

          // Render Ask Size text
          ctx.fillStyle = isVolumeWall ? '#fca5a5' : '#ef4444';
          ctx.font = `${isVolumeWall ? 'bold' : 'normal'} ${11 * dpr}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'left';
          ctx.fillText(askSize.toFixed(3), priceColX + colWidth + 8 * dpr, rowY + 4 * dpr);

          // Add liquid alert marker for massive size walls
          if (isVolumeWall) {
            ctx.fillStyle = '#fbbf24'; // warning amber
            ctx.font = `bold ${8 * dpr}px sans-serif`;
            ctx.fillText('WALL', priceColX + colWidth + colWidth - 28 * dpr, rowY + 3 * dpr);
          }
        }

        // --- DRAW CUMULATIVE VOLUMES (OUTER CHANNELS) ---
        // Cumulative Bid Overlay on left-most column
        if (bidCum > 0) {
          const cumRatio = Math.min(0.9, bidCum / (orderBook.maxCumulativeSize || 1));
          const lineW = cumRatio * colWidth;
          ctx.fillStyle = 'rgba(16, 185, 129, 0.03)';
          ctx.fillRect(0, rowY - rowHeight/2 + 1, lineW, rowHeight - 1);

          ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(lineW, rowY - rowHeight/2);
          ctx.lineTo(lineW, rowY + rowHeight/2);
          ctx.stroke();

          // Draw cumulative value text
          ctx.fillStyle = '#6b7280';
          ctx.font = `${8 * dpr}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'left';
          ctx.fillText(Math.round(bidCum).toLocaleString(), 6 * dpr, rowY + 3 * dpr);
        }

        // Cumulative Ask Overlay on right-most column
        if (askCum > 0) {
          const cumRatio = Math.min(0.9, askCum / (orderBook.maxCumulativeSize || 1));
          const lineW = cumRatio * colWidth;
          const startX = width - lineW;

          ctx.fillStyle = 'rgba(239, 68, 68, 0.03)';
          ctx.fillRect(startX, rowY - rowHeight/2 + 1, lineW, rowHeight - 1);

          ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(startX, rowY - rowHeight/2);
          ctx.lineTo(startX, rowY + rowHeight/2);
          ctx.stroke();

          // Draw cumulative value text
          ctx.fillStyle = '#6b7280';
          ctx.font = `${8 * dpr}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'right';
          ctx.fillText(Math.round(askCum).toLocaleString(), width - 6 * dpr, rowY + 3 * dpr);
        }

        // --- DRAW CENTRAL PRICE COLUMN ---
        let priceColor = '#9ca3af'; // Slate neutral
        if (isLastTradedPrice) {
          priceColor = stats.priceChangeDirection === 'up' ? '#34d399' : (stats.priceChangeDirection === 'down' ? '#f87171' : '#fbbf24');
        } else if (isSpreadMidPrice) {
          priceColor = '#4b5563'; // muted spread row
        } else if (rowPrice < stats.lastPrice) {
          priceColor = '#10b981'; // Bid region
        } else if (rowPrice > stats.lastPrice) {
          priceColor = '#ef4444'; // Ask region
        }

        ctx.fillStyle = priceColor;
        ctx.font = `${isLastTradedPrice ? 'bold' : 'normal'} ${12 * dpr}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';

        // Add special details if LTP is drawn
        if (isLastTradedPrice) {
          // Draw bright side badges for trade ticker presence
          ctx.save();
          ctx.fillStyle = stats.priceChangeDirection === 'up' ? '#10b981' : (stats.priceChangeDirection === 'down' ? '#ef4444' : '#f59e0b');
          ctx.fillRect(priceColX + 2 * dpr, rowY - rowHeight/3, 3 * dpr, rowHeight * 0.6);
          ctx.fillRect(priceColX + colWidth - 5 * dpr, rowY - rowHeight/3, 3 * dpr, rowHeight * 0.6);
          ctx.restore();

          // Value print
          ctx.fillText(`${rowPriceStr} ⚡`, priceColX + colWidth / 2, rowY + 4 * dpr);
        } else if (isSpreadMidPrice) {
          ctx.font = `italic ${10 * dpr}px sans-serif`;
          ctx.fillText('SPREAD', priceColX + colWidth / 2, rowY + 3 * dpr);
        } else {
          ctx.fillText(rowPriceStr, priceColX + colWidth / 2, rowY + 4 * dpr);
        }
      }

      // Draw Center Header labels
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, 24 * dpr);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 24 * dpr);
      ctx.lineTo(width, 24 * dpr);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = `bold ${8.5 * dpr}px "JetBrains Mono", monospace`;
      
      ctx.textAlign = 'left';
      ctx.fillText('CUMULATIVE BIDS', 8 * dpr, 16 * dpr);

      ctx.textAlign = 'right';
      ctx.fillText('BID DEPTH', priceColX - 8 * dpr, 16 * dpr);

      ctx.textAlign = 'center';
      ctx.fillText('PRICE (USDT)', priceColX + colWidth/2, 16 * dpr);

      ctx.textAlign = 'left';
      ctx.fillText('ASK DEPTH', priceColX + colWidth + 8 * dpr, 16 * dpr);

      ctx.textAlign = 'right';
      ctx.fillText('CUMULATIVE ASKS', width - 8 * dpr, 16 * dpr);

      // Render vertical lane division lines
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bidsColX, 0); ctx.lineTo(bidsColX, height);
      ctx.moveTo(priceColX, 0); ctx.lineTo(priceColX, height);
      ctx.moveTo(asksColX, 0); ctx.lineTo(asksColX, height);
      ctx.moveTo(asksCumColX, 0); ctx.lineTo(asksCumColX, height);
      ctx.stroke();

      // Render dynamic crosshair if user is hovering
      if (hoveredPrice !== null && mouseRef.current) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)'; // amber dashed line
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;

        // Horiz alignment
        ctx.beginPath();
        ctx.moveTo(0, mouseRef.current.y);
        ctx.lineTo(width, mouseRef.current.y);
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [orderBook, stats, symbol, displaySettings, hoveredPrice]);

  // Handle high DPI mouse movements
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    mouseRef.current = {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
    };
  };

  const handleMouseLeave = () => {
    mouseRef.current = null;
    setHoveredPrice(null);
    setCumulativeHoverSize(null);
  };

  // Resize handler using ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handleResize = (entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (!entry) return;

      const dpr = window.devicePixelRatio || 1;
      const { width, height } = entry.contentRect;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div id="DOM-ladder-stage" className="relative w-full h-full flex flex-col bg-slate-950 rounded-xl border border-slate-900 overflow-hidden shadow-inner flex-1">
      
      {/* Custom micro header with metadata status */}
      <div className="flex justify-between items-center px-4 py-2 bg-slate-950/90 border-b border-slate-900 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono font-medium text-slate-300">DOM L2 CANVAS ENGINE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            Grouping: <span className="text-slate-100 font-bold">${displaySettings.tickGrouping.toFixed(asset.decimals)}</span>
          </span>
          <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
            60 FPS GLIDE
          </span>
        </div>
      </div>

      {/* Primary Canvas Container stage */}
      <div ref={containerRef} className="relative w-full flex-1">
        <canvas
          id="DOM-canvas"
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="block cursor-crosshair h-full w-full"
        />

        {/* Floating crosshair HUD overlay tool */}
        {hoveredPrice !== null && cumulativeHoverSize !== null && (
          <div 
            id="crosshair-HUD"
            className="absolute bottom-4 left-4 bg-slate-950/95 border border-amber-500/40 px-3 py-2 rounded-lg pointer-events-none font-mono flex flex-col gap-1 shadow-lg z-20 backdrop-blur"
          >
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">CROSSHAIR DETECTOR</div>
            <div className="text-xs text-slate-300">
              Price: <span className="text-amber-400 font-bold">${hoveredPrice.toFixed(asset.decimals)}</span>
            </div>
            <div className="text-xs text-slate-300">
              Size Depth: <span className="text-emerald-400 font-bold">{cumulativeHoverSize.toFixed(2)} {symbol.replace('USDT', '')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Mini Spread Banner */}
      <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-900 font-mono text-xs flex justify-between items-center text-slate-400">
        <div>
          <span>Mid: </span>
          <span className="text-slate-200">${stats.lastPrice ? stats.lastPrice.toLocaleString(undefined, { minimumFractionDigits: asset.decimals }) : '---'}</span>
        </div>
        <div className="flex gap-4">
          <span>
            Bids Total: <span className="text-emerald-500 font-bold">{Math.round(stats.bidsTotal).toLocaleString()}</span>
          </span>
          <span>
            Asks Total: <span className="text-crimson text-red-500 font-bold">{Math.round(stats.asksTotal).toLocaleString()}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
