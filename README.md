# Stock Predictor

Professional stock analysis web app with resilient market-data APIs, interactive charts, and AI-assisted commentary.

## Current Status

- Search, quote, and chart pipelines are running with provider fallbacks.
- Chart ranges are available for: `24H`, `1W`, `1M`, `3M`, `6M`, `1Y`, `5Y`.
- Chart types are available for: `Area`, `Line`, `Candlestick`.

## Features

### Market Data

- Autocomplete stock search with keyboard navigation and quick-select symbols.
- Quote + profile loading with fallback chain:
  - `Finnhub` -> `Twelve Data`
- Candle/historical loading with fallback chain:
  - `Finnhub` -> `Twelve Data` -> `Alpha Vantage`
- In-memory response caching on API routes to reduce rate-limit pressure.

### Charts

- Interactive price chart powered by `lightweight-charts`.
- Area/Line/Candlestick views.
- Fullscreen mode and responsive resizing.
- Historical ranges:
  - `24H`, `1W`, `1M`, `3M`, `6M`, `1Y`, `5Y`

### AI Analysis

- Claude-powered stock Q&A in the analysis tab.
- Endpoint: `POST /api/analysis`

### UI/UX

- Next.js App Router + TypeScript.
- Tailwind + shadcn/ui components.
- Dark mode support.
- Motion transitions via Framer Motion.

## Tech Stack

- Next.js 14
- TypeScript 5
- React 18
- Tailwind CSS
- lightweight-charts
- Anthropic SDK

## Setup

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

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

### Key Requirements

- For search/quote/charts, set at least one of:
  - `FINNHUB_API_KEY`
  - `TWELVEDATA_API_KEY`
- `ALPHAVANTAGE_API_KEY` is optional and used as extra fallback for candles.
- `ANTHROPIC_API_KEY` is required only for AI analysis.

## API Overview

### App API Routes

- `GET /api/search` -> symbol suggestions
- `GET /api/stocks/[symbol]` -> quote + profile
- `GET /api/candles` -> OHLCV candles for chart ranges
- `POST /api/analysis` -> Claude analysis

### TradingView UDF-Compatible Routes

- `GET /api/tv/config`
- `GET /api/tv/search`
- `GET /api/tv/symbols`
- `GET /api/tv/history`
- `GET /api/tv/time`

These routes are available for Charting Library/UDF integration.

## Optional: TradingView Charting Library Assets

If you want to use the advanced TradingView Charting Library integration, copy vendor assets into `public/`.

Helper script:

```bash
bash setup-tradingview-assets.sh /path/to/tradingview-assets
```

Expected files after setup:

- `public/charting_library/charting_library.standalone.js`
- `public/datafeeds/udf/dist/bundle.js`

Note: the default chart in the app currently uses `lightweight-charts` and does not require these assets.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notes

- This project is for educational/informational use and is not financial advice.
