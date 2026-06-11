export type AssetSymbol = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT' | 'XRPUSDT' | 'BNBUSDT';

export interface AssetConfig {
  symbol: AssetSymbol;
  name: string;
  decimals: number;
  tickSize: number;
  defaultTickGrouping: number;
  icon: string;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  cumulativeSize: number;
}

export interface OrderBookState {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  maxSize: number;
  maxCumulativeSize: number;
}

export interface Trade {
  id: string;
  price: number;
  size: number;
  side: 'buy' | 'sell'; // buy = ask hit (grows ask), sell = bid hit (depletes bid)
  time: number;
  usdValue: number;
  isHighVolume: boolean;
}

export interface MarketStats {
  bidsTotal: number;
  asksTotal: number;
  imbalance: number; // 0 to 1, where 0.5 is perfectly balanced
  tradesCount: number;
  buyVolume: number;
  sellVolume: number;
  tradeVelocity: number; // trades per second
  highVolumeSpeed: number; // trades/sec of size > threshold
  lastPrice: number;
  priceChangeDirection: 'up' | 'down' | 'neutral';
  priceVelocity: number; // change rate in USD/sec
}

export interface AudioSettings {
  isEnabled: boolean;
  masterVolume: number;
  enableClicks: boolean;
  enableDrone: boolean;
  droneFrequency: number;
  scaleType: 'pentatonic' | 'chromatic' | 'drone';
  dynamicFilter: boolean;
}

export interface DisplaySettings {
  tickGrouping: number;
  autoCenter: boolean;
  maxLevels: number;
  showHeatmap: boolean;
  showHorizontalGrid: boolean;
  colorScheme: 'default' | 'high-contrast' | 'amber-terminal';
}
