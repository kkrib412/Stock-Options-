import { AssetConfig, AssetSymbol } from './types';

export const SUPPORTED_ASSETS: Record<AssetSymbol, AssetConfig> = {
  BTCUSDT: {
    symbol: 'BTCUSDT',
    name: 'Bitcoin',
    decimals: 2,
    tickSize: 0.01,
    defaultTickGrouping: 1, // default grouping size in USD (e.g. integer dollar)
    icon: '₿',
  },
  ETHUSDT: {
    symbol: 'ETHUSDT',
    name: 'Ethereum',
    decimals: 2,
    tickSize: 0.01,
    defaultTickGrouping: 0.1, // default grouping size in USD (e.g. $0.10 steps)
    icon: 'Ξ',
  },
  SOLUSDT: {
    symbol: 'SOLUSDT',
    name: 'Solana',
    decimals: 3,
    tickSize: 0.005,
    defaultTickGrouping: 0.01, // $0.01 steps
    icon: '◎',
  },
  BNBUSDT: {
    symbol: 'BNBUSDT',
    name: 'Binance Coin',
    decimals: 2,
    tickSize: 0.01,
    defaultTickGrouping: 0.1,
    icon: '🔶',
  },
  XRPUSDT: {
    symbol: 'XRPUSDT',
    name: 'Ripple',
    decimals: 4,
    tickSize: 0.0001,
    defaultTickGrouping: 0.0005,
    icon: '✕',
  }
};

export const AVAILABLE_GROUPINGS: Record<AssetSymbol, number[]> = {
  BTCUSDT: [0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 25.0],
  ETHUSDT: [0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
  SOLUSDT: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5],
  BNBUSDT: [0.01, 0.05, 0.1, 0.5, 1.0, 2.0],
  XRPUSDT: [0.0001, 0.0002, 0.0005, 0.001, 0.005, 0.01]
};
