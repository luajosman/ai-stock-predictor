export interface StockExchange {
  code: string;
  name: string;
  suffix: string;
  flag: string;
  tvExchange: string; // TradingView exchange code
}

export const EXCHANGES: StockExchange[] = [
  { code: 'US', name: 'United States', suffix: '', flag: '🇺🇸', tvExchange: 'NASDAQ' },
  { code: 'DE', name: 'Germany (XETRA)', suffix: '.DE', flag: '🇩🇪', tvExchange: 'XETR' },
  { code: 'UK', name: 'London', suffix: '.L', flag: '🇬🇧', tvExchange: 'LSE' },
  { code: 'FR', name: 'Paris', suffix: '.PA', flag: '🇫🇷', tvExchange: 'EURONEXT' },
  { code: 'CH', name: 'Swiss', suffix: '.SW', flag: '🇨🇭', tvExchange: 'SIX' },
  { code: 'JP', name: 'Tokyo', suffix: '.T', flag: '🇯🇵', tvExchange: 'TSE' },
  { code: 'HK', name: 'Hong Kong', suffix: '.HK', flag: '🇭🇰', tvExchange: 'HKEX' },
  { code: 'CN', name: 'Shanghai', suffix: '.SS', flag: '🇨🇳', tvExchange: 'SSE' },
];

export interface PopularStock {
  symbol: string;
  name: string;
  exchange: string;
  flag: string;
  tvSymbol: string; // Format for TradingView widget
}

export const POPULAR_INTERNATIONAL_STOCKS: PopularStock[] = [
  // US Stocks
  { symbol: 'AAPL', name: 'Apple Inc', exchange: 'US', flag: '🇺🇸', tvSymbol: 'NASDAQ:AAPL' },
  { symbol: 'TSLA', name: 'Tesla Inc', exchange: 'US', flag: '🇺🇸', tvSymbol: 'NASDAQ:TSLA' },
  { symbol: 'MSFT', name: 'Microsoft', exchange: 'US', flag: '🇺🇸', tvSymbol: 'NASDAQ:MSFT' },
  { symbol: 'GOOGL', name: 'Alphabet', exchange: 'US', flag: '🇺🇸', tvSymbol: 'NASDAQ:GOOGL' },
  { symbol: 'NVDA', name: 'NVIDIA', exchange: 'US', flag: '🇺🇸', tvSymbol: 'NASDAQ:NVDA' },
  { symbol: 'AMZN', name: 'Amazon', exchange: 'US', flag: '🇺🇸', tvSymbol: 'NASDAQ:AMZN' },
  
  // German Stocks
  { symbol: 'BMW.DE', name: 'BMW AG', exchange: 'DE', flag: '🇩🇪', tvSymbol: 'XETR:BMW' },
  { symbol: 'SAP.DE', name: 'SAP SE', exchange: 'DE', flag: '🇩🇪', tvSymbol: 'XETR:SAP' },
  { symbol: 'VOW3.DE', name: 'Volkswagen', exchange: 'DE', flag: '🇩🇪', tvSymbol: 'XETR:VOW3' },
  { symbol: 'SIE.DE', name: 'Siemens AG', exchange: 'DE', flag: '🇩🇪', tvSymbol: 'XETR:SIE' },
  { symbol: 'DTE.DE', name: 'Deutsche Telekom', exchange: 'DE', flag: '🇩🇪', tvSymbol: 'XETR:DTE' },
  
  // European Stocks
  { symbol: 'NESN.SW', name: 'Nestlé SA', exchange: 'CH', flag: '🇨🇭', tvSymbol: 'SIX:NESN' },
  { symbol: 'NOVN.SW', name: 'Novartis', exchange: 'CH', flag: '🇨🇭', tvSymbol: 'SIX:NOVN' },
  { symbol: 'MC.PA', name: 'LVMH', exchange: 'FR', flag: '🇫🇷', tvSymbol: 'EURONEXT:MC' },
  
  // Asian Stocks
  { symbol: '7203.T', name: 'Toyota Motor', exchange: 'JP', flag: '🇯🇵', tvSymbol: 'TSE:7203' },
  { symbol: '0700.HK', name: 'Tencent', exchange: 'HK', flag: '🇭🇰', tvSymbol: 'HKEX:0700' },
];

// Helper function to convert Finnhub symbol to TradingView format
export function getTradingViewSymbol(finnhubSymbol: string): string {
  const stock = POPULAR_INTERNATIONAL_STOCKS.find(s => s.symbol === finnhubSymbol);
  if (stock) return stock.tvSymbol;
  
  // Default fallback for US stocks
  if (!finnhubSymbol.includes('.')) {
    return `NASDAQ:${finnhubSymbol}`;
  }
  
  // Try to infer from suffix
  if (finnhubSymbol.endsWith('.DE')) {
    return `XETR:${finnhubSymbol.replace('.DE', '')}`;
  }
  if (finnhubSymbol.endsWith('.SW')) {
    return `SIX:${finnhubSymbol.replace('.SW', '')}`;
  }
  if (finnhubSymbol.endsWith('.PA')) {
    return `EURONEXT:${finnhubSymbol.replace('.PA', '')}`;
  }
  if (finnhubSymbol.endsWith('.T')) {
    return `TSE:${finnhubSymbol.replace('.T', '')}`;
  }
  if (finnhubSymbol.endsWith('.HK')) {
    return `HKEX:${finnhubSymbol.replace('.HK', '')}`;
  }
  
  return `NASDAQ:${finnhubSymbol}`;
}