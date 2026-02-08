import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const { symbol } = params;

  try {
    const API_KEY = process.env.FINNHUB_API_KEY;

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Fetch quote data
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;
    const quoteResponse = await fetch(quoteUrl);
    const quoteData = await quoteResponse.json();

    if (quoteData.error || quoteData.c === 0) {
      return NextResponse.json({ error: 'Invalid stock symbol or no data' }, { status: 404 });
    }

    // Fetch company profile
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${API_KEY}`;
    const profileResponse = await fetch(profileUrl);
    const profileData = await profileResponse.json();

    // Fetch historical candles (last 30 days, daily)
    const to = Math.floor(Date.now() / 1000);
    const from = to - 30 * 24 * 60 * 60; // 30 days ago
    const candleUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`;
    const candleResponse = await fetch(candleUrl);
    const candleData = await candleResponse.json();

    if (candleData.s !== 'ok') {
      return NextResponse.json({ error: 'No historical data available' }, { status: 404 });
    }

    // Transform candle data for TradingView chart
    const chartData = candleData.t.map((timestamp: number, index: number) => ({
      time: new Date(timestamp * 1000).toISOString().split('T')[0],
      value: candleData.c[index],
    }));

    return NextResponse.json({
      quote: quoteData,
      profile: profileData,
      chartData,
    });
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}