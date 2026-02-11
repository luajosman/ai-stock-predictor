"use client";

import { TradingViewChart } from "@/components/tradingview-chart";

interface TradingViewWidgetProps {
  symbol: string;
  isLoading?: boolean;
}

export function TradingViewWidget({ symbol, isLoading }: TradingViewWidgetProps) {
  return <TradingViewChart symbol={symbol} isLoading={isLoading} />;
}
