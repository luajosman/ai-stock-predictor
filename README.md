# 📈 Stock Predictor AI

> Professional stock market analysis powered by TradingView charts and Claude AI

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3-38bdf8)
![Claude AI](https://img.shields.io/badge/Claude-AI-7c3aed)

A modern, full-stack stock analysis application combining real-time market data with AI-powered insights. Built with Next.js 14, TypeScript, and integrated with Claude AI for intelligent market analysis.

## ✨ Current Features

### 📊 **Market Data & Visualization**
- **Real-time Stock Quotes** - Live prices via Finnhub API with sub-second updates
- **Professional TradingView Charts** - Interactive lightweight charts with smooth animations
- **Multiple Time Ranges** - View historical data across 1D, 1W, 1M, 3M, 6M, 1Y, and YTD
- **Comprehensive Stock Stats** - Real-time price, change %, daily high/low, volume

### 🤖 **AI-Powered Analysis**
- **Claude AI Integration** - Intelligent market insights powered by Anthropic's Claude Sonnet 4
- **Natural Language Q&A** - Ask questions in plain English about any stock
- **Contextual Analysis** - AI considers current price, trends, and market conditions
- **Suggested Questions** - Quick-start prompts for instant insights

### 🎨 **User Experience**
- **Modern UI Design** - Stripe & TailAdmin inspired interface with shadcn/ui components
- **Dark Mode Support** - Smooth theme transitions with system preference detection
- **Fully Responsive** - Optimized for desktop, tablet, and mobile devices
- **Smooth Animations** - Framer Motion powered micro-interactions
- **Skeleton Loading States** - Professional loading experience

### ⚡ **Technical Features**
- **Server-Side Rendering** - Fast initial page loads with Next.js 14 App Router
- **Type-Safe** - Full TypeScript implementation for better DX and reliability
- **API Rate Limiting Aware** - Smart error handling for API constraints
- **Environment Variables** - Secure API key management

## 🚀 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS + shadcn/ui
- **Charts:** TradingView Lightweight Charts
- **Animations:** Framer Motion
- **AI:** Claude AI (Anthropic API)
- **Data:** Finnhub Stock Market API
- **Deployment:** Vercel

## 🎯 Demo

🔗 **[Live Demo](https://your-deployed-url.vercel.app)** *(Add after deployment)*

### Screenshots

*Coming soon - Screenshots of dashboard, charts, and AI analysis*

## 🛠️ Installation

### Prerequisites

- Node.js 18+ and npm
- Finnhub API key (free tier available)
- Anthropic API key ($5 free credit for new users)

### Setup
```bash
# Clone repository
git clone https://github.com/luajosman/stock-predictor-ai.git
cd stock-predictor-ai

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Add your API keys to .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🔑 API Keys

### Finnhub (Stock Data)
1. Register at [finnhub.io](https://finnhub.io/register)
2. Get free API key (60 calls/minute)
3. Add to `.env.local`: `FINNHUB_API_KEY=your_key`

### Anthropic Claude (AI Analysis)
1. Sign up at [console.anthropic.com](https://console.anthropic.com/)
2. Get API key ($5 free credit)
3. Add to `.env.local`: `ANTHROPIC_API_KEY=your_key`

## 📁 Project Structure
```
stock-predictor-ai/
├── app/
│   ├── api/                    # API routes
│   │   ├── stocks/[symbol]/   # Stock data endpoint
│   │   └── analysis/          # Claude AI endpoint
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Main page
│   └── globals.css            # Global styles
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── tradingview-chart.tsx # Chart component
│   ├── stock-stats.tsx        # Stock info display
│   ├── stock-search.tsx       # Search component
│   ├── ai-analyst.tsx         # AI chat component
│   ├── time-range-selector.tsx # Time range picker
│   └── theme-toggle.tsx       # Dark mode toggle
├── lib/
│   ├── utils.ts               # Helper functions
│   └── time-range.ts          # Time range calculations
├── types/
│   └── stock.ts               # TypeScript types
└── ...
```

## 📝 Usage

1. **Search for a Stock** - Enter any ticker symbol (e.g., AAPL, GOOGL, TSLA)
2. **Select Time Range** - Choose from 1D, 1W, 1M, 3M, 6M, 1Y, or YTD
3. **View Analytics** - Explore real-time price, charts, and key metrics
4. **Ask Claude AI** - Get intelligent market analysis and insights

## 🎨 Design Philosophy

- **Stripe Dashboard** - Clean, professional layout with clear hierarchy
- **TailAdmin** - Modern card-based UI with consistent spacing
- **TradingView** - Professional financial charts with smooth interactions
- **Minimalism** - Focus on data and insights, remove unnecessary elements

## 🚧 Roadmap & Planned Features

### 🔜 **Coming Soon** (In Development)
- [ ] **News Feed Integration** - Real-time market news for selected stocks
- [ ] **Watchlist Feature** - Save and track favorite stocks with local persistence
- [ ] **Stock Comparison** - Compare 2-3 stocks side-by-side with overlayed charts

### 📅 **Future Enhancements** (Planned)
- [ ] **Portfolio Tracker** - Virtual portfolio with buy/sell tracking and P&L
- [ ] **Advanced Charts** - Candlestick charts, volume bars, technical indicators (RSI, MACD)
- [ ] **Price Alerts** - Email/push notifications for price movements
- [ ] **Real-time Updates** - WebSocket integration for live price streaming
- [ ] **Market Overview Dashboard** - Top gainers, losers, most active stocks
- [ ] **Historical Performance** - Backtesting and historical analysis tools

### 🎯 **Long-term Vision**
- [ ] **User Authentication** - Clerk/NextAuth integration for personalized experience
- [ ] **Database Integration** - Supabase for persistent user data and portfolios
- [ ] **AI-Powered Predictions** - Claude-based price forecasting with disclaimers
- [ ] **Social Features** - Share analyses, follow other investors
- [ ] **Mobile App** - React Native/Expo app with push notifications
- [ ] **API Marketplace** - Integration with multiple data providers

## 🚀 Deployment

### Deploy to Vercel (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard:
# - ANTHROPIC_API_KEY
# - FINNHUB_API_KEY
```

### Build for Production
```bash
npm run build
npm start
```

## 🤝 Contributing

Contributions are welcome! Feel free to:

- 🐛 Report bugs
- 💡 Suggest new features
- 🔧 Submit pull requests
- 📖 Improve documentation

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Luaj Osman**
- GitHub: [@luajosman](https://github.com/luajosman)
- LinkedIn: [Luaj Osman](https://linkedin.com/in/luaj-osman)
- Location: Berlin, Germany
- Portfolio: [luajosman.com](https://luajosman.com) *(if you have one)*

## 🙏 Acknowledgments

- [Anthropic](https://www.anthropic.com) for Claude AI API
- [Finnhub](https://finnhub.io) for real-time stock market data
- [TradingView](https://tradingview.com) for lightweight charts library
- [shadcn/ui](https://ui.shadcn.com) for beautiful UI components
- [Vercel](https://vercel.com) for seamless deployment

## 📊 Project Stats

- **Lines of Code:** ~3,000+
- **Components:** 15+
- **API Routes:** 2
- **Type Definitions:** 10+
- **Supported Stocks:** All US markets via Finnhub

---

<div align="center">

**Built with ❤️ for the FinTech community**

⚠️ **Disclaimer:** This application is for educational purposes only. Not financial advice. Always do your own research before making investment decisions.

[⬆ Back to Top](#-stock-predictor-ai)

</div>
