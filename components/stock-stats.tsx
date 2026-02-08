'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface StockStatsProps {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  isLoading?: boolean;
}

export function StockStats({
  symbol,
  name,
  currentPrice,
  change,
  changePercent,
  high,
  low,
  open,
  previousClose,
  isLoading,
}: StockStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const isPositive = change >= 0;
  const changeColor = isPositive
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
  const changeBg = isPositive
    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';

  return (
    <div className="space-y-6">
      {/* Main Price Card - Stripe Style */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden border-2">
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold mb-1">{symbol}</h2>
                <p className="text-muted-foreground">{name}</p>
              </div>
              <Badge
                variant="outline"
                className={`${changeBg} ${changeColor} border text-base px-4 py-2`}
              >
                {isPositive ? (
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                )}
                {isPositive ? '+' : ''}
                {changePercent.toFixed(2)}%
              </Badge>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold tracking-tight">
                ${currentPrice.toFixed(2)}
              </span>
              <span className={`text-2xl font-medium ${changeColor}`}>
                {isPositive ? '+' : ''}${change.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid - TailAdmin Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <StatCard label="Open" value={`$${open.toFixed(2)}`} />
        <StatCard label="High" value={`$${high.toFixed(2)}`} isPositive />
        <StatCard label="Low" value={`$${low.toFixed(2)}`} isNegative />
        <StatCard label="Previous Close" value={`$${previousClose.toFixed(2)}`} />
      </motion.div>
    </div>
  );
}

function StatCard({
  label,
  value,
  isPositive,
  isNegative,
}: {
  label: string;
  value: string;
  isPositive?: boolean;
  isNegative?: boolean;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground mb-2">{label}</p>
        <p
          className={`text-2xl font-bold ${
            isPositive
              ? 'text-green-600 dark:text-green-400'
              : isNegative
              ? 'text-red-600 dark:text-red-400'
              : ''
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}