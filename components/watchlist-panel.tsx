"use client";

import { Bookmark, BookmarkCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface WatchlistItem {
  symbol: string;
  name: string;
  addedAt: number;
}

interface WatchlistPanelProps {
  items: WatchlistItem[];
  activeSymbol?: string;
  activeName?: string;
  onToggleActive?: () => void;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

export function WatchlistPanel({
  items,
  activeSymbol,
  activeName,
  onToggleActive,
  onSelect,
  onRemove,
}: WatchlistPanelProps) {
  const isActiveInWatchlist = Boolean(
    activeSymbol && items.some((item) => item.symbol === activeSymbol)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Watchlist</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} saved {items.length === 1 ? "stock" : "stocks"}
          </p>
        </div>

        {activeSymbol && onToggleActive && (
          <Button variant={isActiveInWatchlist ? "secondary" : "default"} size="sm" onClick={onToggleActive}>
            {isActiveInWatchlist ? (
              <BookmarkCheck className="h-4 w-4 mr-2" />
            ) : (
              <Bookmark className="h-4 w-4 mr-2" />
            )}
            {isActiveInWatchlist ? "Remove Current" : "Save Current"}
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {!items.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Save stocks to your watchlist for quick access.{" "}
            {activeSymbol ? `Current: ${activeSymbol}${activeName ? ` (${activeName})` : ""}.` : ""}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.symbol}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <button
                  type="button"
                  className="min-w-0 text-left flex-1"
                  onClick={() => onSelect(item.symbol)}
                >
                  <p className="font-semibold truncate">{item.symbol}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(item.symbol)}
                  aria-label={`Remove ${item.symbol} from watchlist`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
