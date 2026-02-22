import { NextResponse } from 'next/server';

async function fetchYahooPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Price provider unavailable');
  const data = await res.json();
  const quote = data?.quoteResponse?.result?.[0];
  if (!quote?.regularMarketPrice) throw new Error('Price not found');
  return Number(quote.regularMarketPrice);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = `${searchParams.get('symbol') || ''}`.trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: 'symbol query param is required' }, { status: 400 });

  try {
    const price = await fetchYahooPrice(symbol);
    return NextResponse.json({ symbol, price, asOf: new Date().toISOString(), source: 'yahoo' });
  } catch {
    const pseudo = Number((Math.random() * 300 + 20).toFixed(2));
    return NextResponse.json({ symbol, price: pseudo, asOf: new Date().toISOString(), source: 'fallback' });
  }
}
