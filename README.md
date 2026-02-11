# 📈 Stock Predictor

Professional stock analysis web app with resilient market-data APIs, interactive charts, and AI-assisted commentary.

## 🚀 Current Status

- Search, quote, and chart pipelines are running with provider fallbacks.
- Chart ranges are available for: `24H`, `1W`, `1M`, `3M`, `6M`, `1Y`, `5Y`.
- Chart types are available for: `Area`, `Line`, `Candlestick`.

## ✅ Feature Checklist

- [x] Stock search with autocomplete suggestions and quick-pick symbols
- [x] Quote + profile loading with provider fallback (`Finnhub` -> `Twelve Data`)
- [x] Historical candles with fallback chain (`Finnhub` -> `Twelve Data` -> `Alpha Vantage`)
- [x] Chart modes: `Area`, `Line`, `Candlestick`
- [x] Chart ranges: `24H`, `1W`, `1M`, `3M`, `6M`, `1Y`, `5Y`
- [x] Fullscreen chart support
- [x] Dark mode
- [x] AI analysis endpoint with Claude (`POST /api/analysis`)
- [x] TradingView UDF-compatible API routes (`/api/tv/*`)

## 🎯 Goals

### Short-Term Goals

- [ ] Add stock watchlist with local persistence
- [ ] Improve API observability (provider metrics, error surface, latency)
- [ ] Add integration tests for search/quote/candle fallback behavior
- [ ] Improve chart empty/error states with clearer user guidance

### Mid-Term Goals

- [ ] Add technical indicators (SMA/EMA/RSI/MACD) to charting
- [ ] Add stock comparison mode (multiple symbols in one view)
- [ ] Add market news context for selected symbols
- [ ] Add optional realtime price refresh/polling strategy tuning

### Long-Term Goals

- [ ] Add authentication and user-specific preferences
- [ ] Add persistent portfolios and position tracking
- [ ] Add alerts/notifications for price thresholds and volatility
- [ ] Support multiple data-provider profiles and environment-based routing

## ✨ Features

### 📊 Market Data

- Autocomplete stock search with keyboard navigation and quick-select symbols.
- Quote + profile loading with fallback chain:
  - `Finnhub` -> `Twelve Data`
- Candle/historical loading with fallback chain:
  - `Finnhub` -> `Twelve Data` -> `Alpha Vantage`
- In-memory response caching on API routes to reduce rate-limit pressure.

### 📉 Charts

- Interactive price chart powered by `lightweight-charts`.
- Area/Line/Candlestick views.
- Fullscreen mode and responsive resizing.
- Historical ranges:
  - `24H`, `1W`, `1M`, `3M`, `6M`, `1Y`, `5Y`

### 🤖 AI Analysis

- Claude-powered stock Q&A in the analysis tab.
- Endpoint: `POST /api/analysis`

### 🎨 UI/UX

- Next.js App Router + TypeScript.
- Tailwind + shadcn/ui components.
- Dark mode support.
- Motion transitions via Framer Motion.

## 🧰 Tech Stack

- Next.js 14
- TypeScript 5
- React 18
- Tailwind CSS
- lightweight-charts
- Anthropic SDK

## ⚙️ Setup

### ✅ Prerequisites

- Node.js 18+
- npm

### ▶️ Install & Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 🔐 Environment Variables

Create `/Users/luajosman/Desktop/stock-predictor/.env.local` and add keys as needed:

```bash
# Market data (recommended: set at least one of these)
FINNHUB_API_KEY=
TWELVEDATA_API_KEY=

# Additional historical fallback (optional)
ALPHAVANTAGE_API_KEY=

# AI analysis
ANTHROPIC_API_KEY=
```

### ✅ Key Requirements

- For search/quote/charts, set at least one of:
  - `FINNHUB_API_KEY`
  - `TWELVEDATA_API_KEY`
- `ALPHAVANTAGE_API_KEY` is optional and used as extra fallback for candles.
- `ANTHROPIC_API_KEY` is required only for AI analysis.

## 🧩 API Overview

### 🛠️ App API Routes

- `GET /api/search` -> symbol suggestions
- `GET /api/stocks/[symbol]` -> quote + profile
- `GET /api/candles` -> OHLCV candles for chart ranges
- `POST /api/analysis` -> Claude analysis

### 📡 TradingView UDF-Compatible Routes

- `GET /api/tv/config`
- `GET /api/tv/search`
- `GET /api/tv/symbols`
- `GET /api/tv/history`
- `GET /api/tv/time`

These routes are available for Charting Library/UDF integration.

## 📦 Optional: TradingView Charting Library Assets

If you want to use the advanced TradingView Charting Library integration, copy vendor assets into `public/`.

Helper script:

```bash
bash setup-tradingview-assets.sh /path/to/tradingview-assets
```

Expected files after setup:

- `public/charting_library/charting_library.standalone.js`
- `public/datafeeds/udf/dist/bundle.js`

Note: the default chart in the app currently uses `lightweight-charts` and does not require these assets.

## 🧪 Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## ⚠️ Notes

- This project is for educational/informational use and is not financial advice.
