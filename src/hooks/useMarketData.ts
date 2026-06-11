import { useState, useEffect, useRef, useCallback } from 'react';
import { AssetSymbol, OrderBookLevel, OrderBookState, Trade, MarketStats, AudioSettings, DisplaySettings } from '../types';
import { SUPPORTED_ASSETS } from '../constants';
import { marketAudio } from '../utils/AudioEngine';

interface UseMarketDataProps {
  symbol: AssetSymbol;
  displaySettings: DisplaySettings;
  audioSettings: AudioSettings;
}

export function useMarketData({ symbol, displaySettings, audioSettings }: UseMarketDataProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [messageRate, setMessageRate] = useState<number>(0);

  // High performance: store streaming data in Refs to avoid React render flood
  const bidsRef = useRef<Record<number, number>>({});
  const asksRef = useRef<Record<number, number>>({});
  const tradesBufferRef = useRef<Trade[]>([]);
  const rollingMinuteTradesRef = useRef<Trade[]>([]);
  const rollingFiveMinuteTradesRef = useRef<Trade[]>([]);
  const lastPriceRef = useRef<number>(0);
  const prevPriceRef = useRef<number>(0);

  // Metrics tracking
  const messageCounterRef = useRef<number>(0);
  const rollingTradeTimesRef = useRef<number[]>([]);
  const totalBuyVolumeRef = useRef<number>(0);
  const totalSellVolumeRef = useRef<number>(0);
  const tradesCountRef = useRef<number>(0);

  // Throttled UI status states
  const [orderBook, setOrderBook] = useState<OrderBookState>({ bids: [], asks: [], maxSize: 0, maxCumulativeSize: 0 });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [minuteTrades, setMinuteTrades] = useState<Trade[]>([]);
  const [fiveMinuteTrades, setFiveMinuteTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<MarketStats>({
    bidsTotal: 0,
    asksTotal: 0,
    imbalance: 0.5,
    tradesCount: 0,
    buyVolume: 0,
    sellVolume: 0,
    tradeVelocity: 0,
    highVolumeSpeed: 0,
    lastPrice: 0,
    priceChangeDirection: 'neutral',
    priceVelocity: 0,
  });

  const activeAssetRef = useRef<AssetSymbol>(symbol);
  useEffect(() => {
    activeAssetRef.current = symbol;
  }, [symbol]);

  // Aggregate and group orderbook levels by tickGrouping price increments
  const aggregateOrderBook = useCallback((
    bidsMap: Record<number, number>,
    asksMap: Record<number, number>,
    grouping: number
  ): OrderBookState => {
    const groupedBids: Record<string, number> = {};
    const groupedAsks: Record<string, number> = {};

    const bidKeys = Object.keys(bidsMap);
    for (let i = 0; i < bidKeys.length; i++) {
      const price = parseFloat(bidKeys[i]);
      const size = bidsMap[price as any];
      if (size <= 0) continue;

      // Classifying Bid buckets: floor aggregation
      // e.g. price Grouping of 5.0, a bid at 9924.50 is clustered down to 9920.00
      const bucketPrice = Math.floor(price / grouping) * grouping;
      const bucketKey = bucketPrice.toFixed(8); // Avoid floating point index errors
      groupedBids[bucketKey] = (groupedBids[bucketKey] || 0) + size;
    }

    const askKeys = Object.keys(asksMap);
    for (let i = 0; i < askKeys.length; i++) {
      const price = parseFloat(askKeys[i]);
      const size = asksMap[price as any];
      if (size <= 0) continue;

      // Classifying Ask buckets: ceil aggregation
      // e.g. price Grouping of 5.0, an ask at 9925.50 is clustered up to 9930.00
      const bucketPrice = Math.ceil(price / grouping) * grouping;
      const bucketKey = bucketPrice.toFixed(8);
      groupedAsks[bucketKey] = (groupedAsks[bucketKey] || 0) + size;
    }

    // Sort bids descending
    const sortedBids: OrderBookLevel[] = Object.keys(groupedBids)
      .map(priceStr => ({ price: parseFloat(priceStr), size: groupedBids[priceStr], cumulativeSize: 0 }))
      .sort((a, b) => b.price - a.price);

    // Sort asks ascending
    const sortedAsks: OrderBookLevel[] = Object.keys(groupedAsks)
      .map(priceStr => ({ price: parseFloat(priceStr), size: groupedAsks[priceStr], cumulativeSize: 0 }))
      .sort((a, b) => a.price - b.price);

    // Filter out extreme rows that could bloat memory
    // Take a healthy subset for UI DOM presentation
    const slicedBids = sortedBids.slice(0, Math.min(100, displaySettings.maxLevels));
    const slicedAsks = sortedAsks.slice(0, Math.min(100, displaySettings.maxLevels));

    // Calculate accumulation
    let cumBid = 0;
    for (let i = 0; i < slicedBids.length; i++) {
      cumBid += slicedBids[i].size;
      slicedBids[i].cumulativeSize = cumBid;
    }

    let cumAsk = 0;
    for (let i = 0; i < slicedAsks.length; i++) {
      cumAsk += slicedAsks[i].size;
      slicedAsks[i].cumulativeSize = cumAsk;
    }

    const maxBidsTotal = slicedBids.length > 0 ? slicedBids[slicedBids.length - 1].cumulativeSize : 0;
    const maxAsksTotal = slicedAsks.length > 0 ? slicedAsks[slicedAsks.length - 1].cumulativeSize : 0;

    let maxSize = 0;
    slicedBids.forEach(x => { if (x.size > maxSize) maxSize = x.size; });
    slicedAsks.forEach(x => { if (x.size > maxSize) maxSize = x.size; });

    let maxCumulativeSize = Math.max(maxBidsTotal, maxAsksTotal);

    return {
      bids: slicedBids,
      asks: slicedAsks,
      maxSize,
      maxCumulativeSize
    };
  }, [displaySettings.maxLevels]);

  // Clean buffers when changing selected symbol
  const resetBuffers = useCallback(() => {
    bidsRef.current = {};
    asksRef.current = {};
    tradesBufferRef.current = [];
    rollingMinuteTradesRef.current = [];
    rollingFiveMinuteTradesRef.current = [];
    messageCounterRef.current = 0;
    rollingTradeTimesRef.current = [];
    totalBuyVolumeRef.current = 0;
    totalSellVolumeRef.current = 0;
    tradesCountRef.current = 0;
    lastPriceRef.current = 0;
    prevPriceRef.current = 0;

    setOrderBook({ bids: [], asks: [], maxSize: 0, maxCumulativeSize: 0 });
    setTrades([]);
    setMinuteTrades([]);
    setFiveMinuteTrades([]);
    setLatencyMs(0);
    setMessageRate(0);
  }, []);

  // Primary WebSocket logic
  useEffect(() => {
    resetBuffers();

    const asset = SUPPORTED_ASSETS[symbol];
    if (!asset) return;

    // Binance websocket endpoints for high volumes
    // Combines level-2 depth snapshot at 100ms update rate and live trade tape feeds
    const lowercaseSymbol = symbol.toLowerCase();
    const isWSSSupported = true;

    // Use Binance combined streams
    const streamUrl = `wss://stream.binance.com:9443/stream?streams=${lowercaseSymbol}@depth20@100ms/${lowercaseSymbol}@trade`;
    
    let socket: WebSocket;
    let keepAliveInterval: any;
    let isTerminated = false;

    const connectWS = () => {
      if (isTerminated) return;

      socket = new WebSocket(streamUrl);

      socket.onopen = () => {
        setIsConnected(true);
        console.log(`Connected to WebSocket stream for ${symbol}`);
      };

      socket.onmessage = (event) => {
        if (isTerminated) return;
        messageCounterRef.current++;

        try {
          const payload = JSON.parse(event.data);
          const streamName = payload.stream;
          const data = payload.data;

          if (!data) return;

          const now = Date.now();
          // Calculate latency
          if (data.E) {
            setLatencyMs(now - data.E);
          }

          // Depth channel
          if (streamName && streamName.includes('depth')) {
            // "bids" and "asks" come as list of [priceString, quantityString]
            const rawBids = data.bids || [];
            const rawAsks = data.asks || [];

            const newBids: Record<number, number> = {};
            for (let i = 0; i < rawBids.length; i++) {
              newBids[parseFloat(rawBids[i][0])] = parseFloat(rawBids[i][1]);
            }
            // Replace local bid cache
            bidsRef.current = newBids;

            const newAsks: Record<number, number> = {};
            for (let i = 0; i < rawAsks.length; i++) {
              newAsks[parseFloat(rawAsks[i][0])] = parseFloat(rawAsks[i][1]);
            }
            // Replace local ask cache
            asksRef.current = newAsks;
          }

          // Trade channel
          if (streamName && streamName.includes('trade')) {
            const rawPrice = parseFloat(data.p);
            const rawSize = parseFloat(data.q);
            const isBuyerMaker = data.m; // true = Buyer was maker (Sell Trade), false = Buyer was taker (Buy Trade)
            const side = isBuyerMaker ? 'sell' : 'buy';
            const tradeId = String(data.t);
            const tradeTime = data.T || now;
            const usdValue = rawPrice * rawSize;

            if (lastPriceRef.current !== 0) {
              prevPriceRef.current = lastPriceRef.current;
            } else {
              prevPriceRef.current = rawPrice;
            }
            lastPriceRef.current = rawPrice;

            // Increment totals
            tradesCountRef.current++;
            if (side === 'buy') {
              totalBuyVolumeRef.current += usdValue;
            } else {
              totalSellVolumeRef.current += usdValue;
            }

            // Track rolling timestamp to calculate trades per second
            rollingTradeTimesRef.current.push(now);

            // Audio prompt
            if (audioSettings.isEnabled) {
              marketAudio.playTrade(side, rawSize, usdValue);
            }

            // High Volume Trade identification (Threshold triggers visual/auditory cues)
            // e.g. > $10,000 for altcoins, > $50,000 for Bitcoin
            let highVolumeThreshold = 25000;
            if (symbol === 'BTCUSDT') highVolumeThreshold = 100000;
            else if (symbol === 'ETHUSDT') highVolumeThreshold = 50000;
            else if (symbol === 'SOLUSDT' || symbol === 'BNBUSDT') highVolumeThreshold = 20000;
            else if (symbol === 'XRPUSDT') highVolumeThreshold = 10000;

            const isHighVolume = usdValue >= highVolumeThreshold;

            const newTrade: Trade = {
              id: tradeId,
              price: rawPrice,
              size: rawSize,
              side,
              time: tradeTime,
              usdValue,
              isHighVolume
            };

            // Maintain trade array buffer
            const newTrades = [newTrade, ...tradesBufferRef.current];
            if (newTrades.length > 50) {
              newTrades.splice(50); // limit to 50 active trades to prevent browser memory leaks
            }
            tradesBufferRef.current = newTrades;

            // Also track rolling minute's trades (capped at 3000 to prevent growth in heavy waves)
            const updatedMinuteTrades = [...rollingMinuteTradesRef.current, newTrade];
            if (updatedMinuteTrades.length > 3000) {
              updatedMinuteTrades.shift();
            }
            rollingMinuteTradesRef.current = updatedMinuteTrades;

            // Track rolling 5-minute's trades (capped at 15000 to prevent growth in heavy waves)
            const updatedFiveMinuteTrades = [...rollingFiveMinuteTradesRef.current, newTrade];
            if (updatedFiveMinuteTrades.length > 15000) {
              updatedFiveMinuteTrades.shift();
            }
            rollingFiveMinuteTradesRef.current = updatedFiveMinuteTrades;
          }

        } catch (err) {
          console.error('Error parsing streaming event:', err);
        }
      };

      socket.onerror = (err) => {
        console.error('Websocket connection error for', symbol, err);
        setIsConnected(false);
      };

      socket.onclose = () => {
        setIsConnected(false);
        console.log(`Websocket closed for ${symbol}`);
        // Auto reconnect after interval unless terminated
        if (!isTerminated) {
          setTimeout(connectWS, 4000);
        }
      };
    };

    connectWS();

    // Secondary Telemetry timer (runs every second for clean metric ticks)
    let lastTime = Date.now();
    const telemetryInterval = setInterval(() => {
      // Calculate messages/sec rate
      setMessageRate(messageCounterRef.current);
      messageCounterRef.current = 0;

      // Filter rolling trades timestamp window (1 second)
      const now = Date.now();
      rollingTradeTimesRef.current = rollingTradeTimesRef.current.filter(t => now - t < 1000);
    }, 1000);

    // KeepAlive ping to prevent silent container proxies dropping connection
    keepAliveInterval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        // Binance socket likes keepalives via standard text ping frames or random sends
        // (but usually respects open socket as long as traffic continues)
      }
    }, 30000);

    return () => {
      isTerminated = true;
      clearInterval(telemetryInterval);
      clearInterval(keepAliveInterval);
      if (socket) {
        socket.close();
      }
    };
  }, [symbol, audioSettings.isEnabled, resetBuffers]);

  // Throttled UI React State Synchronizer
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const groupedBook = aggregateOrderBook(
        bidsRef.current,
        asksRef.current,
        displaySettings.tickGrouping
      );

      // Total volumes of book sides
      let bidsTotalVol = 0;
      let asksTotalVol = 0;
      groupedBook.bids.forEach(b => { bidsTotalVol += b.size; });
      groupedBook.asks.forEach(a => { asksTotalVol += a.size; });

      // Calculate imbalance [0 (entirely bid heavy) to 1 (entirely ask heavy)]
      const denominator = bidsTotalVol + asksTotalVol;
      const imbalance = denominator > 0 ? bidsTotalVol / denominator : 0.5;

      // Propagate balance to audio engine drone modulation
      if (audioSettings.isEnabled && audioSettings.enableDrone) {
        marketAudio.updateImbalance(imbalance);
      }

      // Filter older trade times to compute trades per sec
      const now = Date.now();
      const rawVelocity = rollingTradeTimesRef.current.length;

      // Calculate Price Change momentum
      const dir = lastPriceRef.current > prevPriceRef.current 
        ? 'up' 
        : (lastPriceRef.current < prevPriceRef.current ? 'down' : 'neutral');

      const usdVelocity = lastPriceRef.current - prevPriceRef.current;
      prevPriceRef.current = lastPriceRef.current; // sync

      // Filter rolling minute trades to keep only those within the last 60 seconds (60000ms)
      const nowcutoff = Date.now() - 60000;
      rollingMinuteTradesRef.current = rollingMinuteTradesRef.current.filter(t => t.time >= nowcutoff);
      setMinuteTrades([...rollingMinuteTradesRef.current]);

      // Filter rolling 5-minute trades to keep only those within the last 5 minutes (300000ms)
      const fiveMinCutoff = Date.now() - 300000;
      rollingFiveMinuteTradesRef.current = rollingFiveMinuteTradesRef.current.filter(t => t.time >= fiveMinCutoff);
      setFiveMinuteTrades([...rollingFiveMinuteTradesRef.current]);

      setOrderBook(groupedBook);
      setTrades([...tradesBufferRef.current]);
      setStats({
        bidsTotal: bidsTotalVol,
        asksTotal: asksTotalVol,
        imbalance,
        tradesCount: tradesCountRef.current,
        buyVolume: totalBuyVolumeRef.current,
        sellVolume: totalSellVolumeRef.current,
        tradeVelocity: rawVelocity,
        highVolumeSpeed: tradesBufferRef.current.filter(t => t.isHighVolume && (now - t.time < 3000)).length,
        lastPrice: lastPriceRef.current,
        priceChangeDirection: dir as any,
        priceVelocity: usdVelocity,
      });

    }, 100); // 100ms throttle is comfortable & perfect for humans to read, while keeping CPU ultra-low

    return () => {
      clearInterval(syncInterval);
    };
  }, [aggregateOrderBook, displaySettings.tickGrouping, audioSettings.isEnabled, audioSettings.enableDrone]);

  return {
    orderBook,
    trades,
    minuteTrades,
    fiveMinuteTrades,
    stats,
    isConnected,
    latencyMs,
    messageRate,
  };
}
