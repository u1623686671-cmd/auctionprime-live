
'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

// This type definition is a simplified version compatible with all auction pages
type BidDoc = {
    userId: string;
    bidderName: string;
    amount: number;
    timestamp: any; // Firestore Timestamp
};


interface HeatBarProps {
  bids: BidDoc[];
  auctionEndDate: Date;
}

const HEAT_DECAY_RATE = 2; // a percentage points per second
const HEAT_DECAY_INTERVAL = 100; // ms

export function HeatBar({ bids, auctionEndDate }: HeatBarProps) {
  const [heat, setHeat] = useState(0);
  const previousBidCount = useRef(bids.length);

  // Effect to add heat when a new bid comes in
  useEffect(() => {
    if (bids.length > previousBidCount.current) {
      setHeat(100);
      // Update the ref to the new bid count
      previousBidCount.current = bids.length;
    }
  }, [bids]);

  // Effect to decay heat over time
  useEffect(() => {
    if (new Date() > new Date(auctionEndDate)) {
        setHeat(0);
        return;
    }

    const decayInterval = setInterval(() => {
      setHeat((prevHeat) => {
        if (prevHeat <= 0) {
          return 0;
        }
        // Decay rate is per second, interval is faster
        const decayAmount = HEAT_DECAY_RATE * (HEAT_DECAY_INTERVAL / 1000);
        return Math.max(0, prevHeat - decayAmount);
      });
    }, HEAT_DECAY_INTERVAL);

    return () => clearInterval(decayInterval);
  }, [auctionEndDate]);
  
  const getHeatColor = () => {
    if (heat > 80) return 'text-red-500';
    if (heat > 50) return 'text-orange-500';
    if (heat > 20) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getHeatLabel = () => {
    if (heat > 80) return 'Scorching';
    if (heat > 50) return 'Hot';
    if (heat > 20) return 'Warm';
    if (heat > 0) return 'Active';
    return 'Quiet';
  };

  const heatLabel = getHeatLabel();
  
  return (
    <div className={cn("w-full flex items-center justify-start text-sm gap-1.5")}>
        <Flame className={cn("w-4 h-4", heat > 20 ? getHeatColor() : 'text-muted-foreground')} />
        <span className={cn("font-medium font-mono tracking-tighter", getHeatColor())}>
            {heatLabel}
        </span>
    </div>
  );
}

    