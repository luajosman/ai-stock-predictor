import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toYYYYMMDD(date: Date) {
  // Immer UTC, damit es keine Zeitzonen-Probleme gibt
  return date.toISOString().slice(0, 10);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = (params.symbol || '').toUpperCase().trim();

  try {
    const API_KEY = process.env.FINNHUB_API_KEY;

    if (!API_KEY) {
      return NextResponse.json({ error: 'FINNHUB_API_KEY missing' }, { status: 500 });
    }

    // 1) Quote (must-have)
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
      symbol
    )}&token=${API_KEY}`;
    const quoteResponse = await fetch(quoteUrl, { cache: 'no-store' });
    const quoteData = await quoteResponse.json();

    if (!quoteResponse.ok || quoteData?.error || quoteData?.c === 0) {
      return NextResponse.json(
        {
          error: 'Invalid stock symbol or no quote data',
          details: quoteData?.error ?? null,
        },
        { status: 404 }
      );
    }

    // 2) Profile (nice-to-have)
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(
      symbol
    )}&token=${API_KEY}`;
    const profileResponse = await fetch(profileUrl, { cache: 'no-store' });
    const profileData = await profileResponse.json();

    // 3) Candles (best-effort)
    const to = Math.floor(Date.now() / 1000);
    const from = to - 90 * 24 * 60 * 60; // 90 days

    // 60 = 1 hour. We will still convert to YYYY-MM-DD for the chart.
    const candleUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
      symbol
    )}&resolution=60&from=${from}&to=${to}&token=${API_KEY}`;

    const candleResponse = await fetch(candleUrl, { cache: 'no-store' });
    const candleData = await candleResponse.json();

    let chartData: { time: string; value: number }[] = [];
    let chartError: string | null = null;

    if (candleResponse.ok && candleData?.s === 'ok' && Array.isArray(candleData?.t)) {
      // Convert timestamps to YYYY-MM-DD (BusinessDay string)
      chartData = candleData.t.map((timestamp: number, index: number) => ({
        time: toYYYYMMDD(new Date(timestamp * 1000)),
        value: candleData.c[index],
      }));
    } else {
      chartError = candleData?.s || candleData?.error || 'no_data';

      const basePrice = Number(quoteData.c) || 0;

      // Fallback: 30 daily points in YYYY-MM-DD
      chartData = Array.from({ length: 30 }).map((_, i) => {
        const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
        return { time: toYYYYMMDD(d), value: basePrice };
      });
    }

    return NextResponse.json({
      quote: quoteData,
      profile: profileData,
      chartData,
      chartError,
    });
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}
