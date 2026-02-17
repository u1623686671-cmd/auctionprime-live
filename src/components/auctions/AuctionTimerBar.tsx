
'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

interface AuctionTimerBarProps {
  startDate: string;
  endDate: string;
  isCard?: boolean;
}

// Helper function to calculate and format time remaining into a numerical countdown
const formatCountdown = (diff: number) => {
    if (diff <= 0) {
        return '00:00:00';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    if (days > 0) {
        return `${days}d ${hours.toString().padStart(2, '0')}h`;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};


export function AuctionTimerBar({ startDate, endDate, isCard = false }: AuctionTimerBarProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUpcoming, setIsUpcoming] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemainingMs, setTimeRemainingMs] = useState(0);

  useEffect(() => {
    const calculateState = () => {
      const now = new Date();
      const start = new Date(startDate);
      const end = new Date(endDate);

      const auctionIsUpcoming = now < start;
      const auctionHasEnded = now > end;

      setIsUpcoming(auctionIsUpcoming);
      setIsEnded(auctionHasEnded);
      
      if (auctionHasEnded) {
        setTimeLeft('Auction Ended');
        setTimeRemainingMs(0);
      } else if (auctionIsUpcoming) {
        const timeUntilStart = start.getTime() - now.getTime();
        setTimeLeft(formatCountdown(timeUntilStart));
        setTimeRemainingMs(end.getTime() - now.getTime());
      } else { // Auction is live
        const timeRemaining = end.getTime() - now.getTime();
        setTimeRemainingMs(timeRemaining);
        setTimeLeft(formatCountdown(timeRemaining));
      }
      setIsLoading(false);
    };

    calculateState();
    const interval = setInterval(calculateState, 1000); 

    return () => clearInterval(interval);
  }, [startDate, endDate]);
  
  if (isLoading) {
      if (isCard) {
        return (
            <div className="w-full bg-muted/50 rounded-md p-1.5">
                <div className="flex items-center justify-center text-xs gap-1.5 h-6">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>
        )
      }
      return (
        <div className="flex items-center justify-start gap-2">
            <Clock className="w-4 h-4 text-muted-foreground"/>
            <Skeleton className="h-5 w-24" />
        </div>
      )
  }

  const isLive = !isUpcoming && !isEnded;

  const fifteenMinutesInMs = 15 * 60 * 1000;
  const twoHoursInMs = 2 * 60 * 60 * 1000;

  let textColor = "text-muted-foreground";

  if (isLive) {
    if (timeRemainingMs < fifteenMinutesInMs) {
      textColor = "text-destructive"; // Red
    } else if (timeRemainingMs < twoHoursInMs) {
      textColor = "text-accent"; // Orange
    }
  } else if (isEnded) {
    textColor = "text-destructive";
  } else if (isUpcoming) {
    textColor = "text-blue-600";
  }

  if (isCard) {
    const prefix = isEnded ? 'Auction' : (isUpcoming ? `Starts in` : `Ends in`);
    const timeValue = isEnded ? 'Ended' : timeLeft;
    return (
      <div className="w-full bg-muted/50 rounded-md p-1.5">
          <div className="flex items-center gap-1.5 justify-center text-xs h-6">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{prefix}</span>
              <span className={cn("font-bold text-sm font-mono tracking-tight", textColor)}>
                  {timeValue}
              </span>
          </div>
      </div>
    );
  }

  // New rendering for detail view (!isCard)
  const prefix = isEnded ? 'Auction' : (isUpcoming ? `Starts in` : `Ends in`);
  const timeValue = isEnded ? 'Ended' : timeLeft;
  
  return (
    <div className="w-full flex items-center gap-2 text-sm">
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">{prefix}</span>
        <span className={cn("font-bold text-lg font-mono tracking-tight", textColor)}>
            {timeValue}
        </span>
    </div>
  )
}
