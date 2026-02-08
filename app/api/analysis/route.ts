import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const { symbol, currentPrice, change, changePercent, question } = await request.json();

    const API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    const anthropic = new Anthropic({
      apiKey: API_KEY,
    });

    const priceDirection = change >= 0 ? 'up' : 'down';
    const priceEmoji = change >= 0 ? '📈' : '📉';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a knowledgeable financial analyst. Analyze this stock data:

Stock: ${symbol}
Current Price: $${currentPrice.toFixed(2)}
Change: ${priceDirection} $${Math.abs(change).toFixed(2)} (${changePercent.toFixed(2)}%) ${priceEmoji}

User Question: ${question}

Provide a clear, concise analysis (2-3 paragraphs). Focus on:
- Answering the user's question directly
- Key factors that might influence this stock
- A balanced perspective for investors

Keep it professional but accessible. Don't give direct buy/sell advice, but discuss considerations.`,
        },
      ],
    });

    const analysisText = message.content
      .filter((block) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n\n');

    return NextResponse.json({
      analysis: analysisText,
    });
  } catch (error) {
    console.error('Error calling Claude API:', error);
    return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 });
  }
}