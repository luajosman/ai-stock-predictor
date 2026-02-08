'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AIAnalysis } from '@/types/stock';

interface AIAnalystProps {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
}

const SUGGESTED_QUESTIONS = [
  'Why is the price changing?',
  'What are the key trends?',
  'Should I consider this stock?',
  'What factors affect the price?',
];

export function AIAnalyst({ symbol, currentPrice, change, changePercent }: AIAnalystProps) {
  const [question, setQuestion] = useState('');
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAsk = async (customQuestion?: string) => {
    const questionToAsk = customQuestion || question;
    if (!questionToAsk.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          currentPrice,
          change,
          changePercent,
          question: questionToAsk,
        }),
      });

      const data = await response.json();
      setAnalysis({
        analysis: data.analysis,
        timestamp: Date.now(),
      });
      setQuestion('');
    } catch (error) {
      console.error('Error getting analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle>AI Market Analyst</CardTitle>
            <CardDescription className="mt-1">
              Powered by Claude - Ask questions about {symbol}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Suggested Questions */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Quick questions:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q, index) => (
              <motion.div
                key={q}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors px-3 py-1.5"
                  onClick={() => handleAsk(q)}
                >
                  {q}
                </Badge>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Ask a custom question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isLoading}
            className="h-12"
          />
          <Button type="submit" disabled={isLoading || !question.trim()} size="lg">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        {/* Analysis Result */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Claude is analyzing...</span>
              </div>
            </motion.div>
          )}

          {!isLoading && analysis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 p-6 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-semibold">AI Analysis</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(analysis.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-sm leading-relaxed whitespace-pre-wrap"
              >
                {analysis.analysis}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}