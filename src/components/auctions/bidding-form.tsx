
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Gavel, Loader2, Hand, LogIn, Snowflake } from "lucide-react";
import { doc, runTransaction, collection, serverTimestamp, increment, addDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isPast } from "date-fns";

type BiddingFormProps = {
  itemId: string;
  category: 'alcohol' | 'iconics' | 'others' | 'art' | 'plates' | 'phoneNumbers' | 'apparels';
  currentBid: number;
  minimumBidIncrement: number;
  itemUserId: string;
  isFlashAuction?: boolean;
  auctionEndDate: string;
};

function SubmitButton({ isPending }: { isPending: boolean }) {
  return (
    <Button 
      type="submit" 
      disabled={isPending} 
      className={cn(
        "group w-full bg-accent text-accent-foreground hover:bg-accent/90 overflow-hidden transition-all duration-500"
      )}
    >
      {isPending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <span className="relative h-4 w-4">
            <Gavel className="absolute inset-0 transition-all duration-300 group-hover:-translate-y-5 group-hover:opacity-0" />
            <Hand className="absolute inset-0 translate-y-5 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100" />
        </span>
      )}
      <span>{isPending ? "Placing Bid..." : "Place Your Bid"}</span>
    </Button>
  );
}

export function BiddingForm({ 
    itemId, 
    category, 
    currentBid, 
    minimumBidIncrement, 
    itemUserId,
    isFlashAuction,
    auctionEndDate,
}: BiddingFormProps) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isUserLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  const endDate = new Date(auctionEndDate);
  if (isPast(endDate)) {
      return (
           <div className="text-center text-muted-foreground py-4 space-y-1">
                <p className="font-semibold text-lg">Auction Ended</p>
                <div className="text-sm">
                    This auction ended {formatDistanceToNow(endDate, { addSuffix: true })}
                </div>
            </div>
      )
  }

  if (!user) {
    return (
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">You must be logged in to place a bid.</p>
        <Button asChild className="w-full">
          <Link href="/login">
            <LogIn className="mr-2 h-4 w-4" />
            Login or Sign Up to Bid
          </Link>
        </Button>
      </div>
    );
  }

  if (user.uid === itemUserId) {
    return (
        <div className="text-center text-muted-foreground p-4 bg-muted/50 rounded-md">
            <p className="font-semibold">This is your listing.</p>
            <p className="text-sm">You cannot place bids on your own auctions.</p>
        </div>
    );
  }
  
  const nextValidBid = currentBid + minimumBidIncrement;
  const maxBid = currentBid + (10 * minimumBidIncrement);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    
    const bidValue = Number(bidAmount);

    if (isNaN(bidValue) || bidValue < nextValidBid || bidValue > maxBid) {
      setError(`Your bid must be between $${nextValidBid.toLocaleString()} and $${maxBid.toLocaleString()}.`);
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const itemRef = doc(firestore, category, itemId);
    const bidsCollectionRef = collection(firestore, category, itemId, 'bids');
    
    let previousHighestBidderId: string | null = null;
    let itemTitle = 'Untitled Item';

    try {
      await runTransaction(firestore, async (transaction) => {
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
          throw new Error("Item not found.");
        }

        const itemData = itemDoc.data();
        previousHighestBidderId = itemData.highestBidderId || null; // Capture previous highest bidder

        // Assign title for notification
        switch (category) {
            case 'alcohol': itemTitle = itemData.name; break;
            case 'art':
            case 'others':
            case 'iconics':
            case 'plates':
            case 'phoneNumbers':
            case 'apparels':
                itemTitle = itemData.itemName;
                break;
        }
        
        if (itemData.userId === user.uid) {
          throw new Error("You cannot bid on your own listing.");
        }
        
        if (new Date() > new Date(itemData.auctionEndDate)) {
            throw new Error("This auction has already ended.");
        }
        
        const currentHighestBid = itemData.currentBid || itemData.startingBid;
        const minIncrement = itemData.minimumBidIncrement || 1;
        const localMinBid = currentHighestBid + minIncrement;
        const localMaxBid = currentHighestBid + (10 * minIncrement);

        if (bidValue < localMinBid || bidValue > localMaxBid) {
          throw new Error(`Your bid must be between $${localMinBid.toLocaleString()} and $${localMaxBid.toLocaleString()}.`);
        }
        
        // 1. Add to item's public bidding history
        const newBidRef = doc(bidsCollectionRef);
        transaction.set(newBidRef, {
          userId: user.uid,
          bidderName: user.displayName || "Anonymous",
          amount: bidValue,
          timestamp: serverTimestamp(),
          itemId: itemId,
          itemCategory: category,
          itemTitle: itemTitle
        });

        // 2. Update the item's current bid, bid count, and highest bidder
        transaction.update(itemRef, {
          currentBid: bidValue,
          bidCount: increment(1),
          highestBidderId: user.uid,
        });

        // 3. Record the bid in the user's private "My Bids" collection
        const userBidsItemRef = doc(firestore, 'users', user.uid, 'bidsOnItems', itemId);
        const userBidsItemBidsCollectionRef = collection(userBidsItemRef, 'myBids');
        const newMyBidRef = doc(userBidsItemBidsCollectionRef);
        
        transaction.set(userBidsItemRef, {
            itemId: itemId,
            category: category,
            itemTitle: itemTitle,
            itemImageUrl: itemData.imageUrls ? itemData.imageUrls[0] : null,
            itemAuctionEndDate: itemData.auctionEndDate,
            lastUpdated: serverTimestamp()
        }, { merge: true });

        transaction.set(newMyBidRef, {
            amount: bidValue,
            timestamp: serverTimestamp(),
        });

        // 4. Update Leaderboard Scores
        // a) Update bidder's score
        const bidderScoreRef = doc(firestore, 'leaderboard', user.uid);
        transaction.set(bidderScoreRef, {
            score: increment(5), // +5 points for placing a bid
            displayName: user.displayName,
            photoURL: user.photoURL,
            uid: user.uid,
            lastUpdated: serverTimestamp()
        }, { merge: true });

        // b) Update seller's score
        const sellerScoreRef = doc(firestore, 'leaderboard', itemData.userId);
        transaction.set(sellerScoreRef, {
            score: increment(5), // +5 points for receiving a bid
            uid: itemData.userId,
            lastUpdated: serverTimestamp()
        }, { merge: true });
      });

      // After transaction succeeds, create notification for outbid user
      if (previousHighestBidderId && previousHighestBidderId !== user.uid) {
          const notificationsColRef = collection(firestore, 'users', previousHighestBidderId, 'notifications');
          await addDoc(notificationsColRef, {
              type: 'outbid',
              title: 'You have been outbid!',
              body: `Another user has placed a higher bid on "${itemTitle}".`,
              link: `/${category}/${itemId}`,
              isRead: false,
              timestamp: serverTimestamp(),
          });
      }


      toast({
        variant: 'success',
        title: "Bid Placed!",
        description: `Your bid of $${bidValue.toLocaleString()} is currently the highest.`,
      });
      setBidAmount(''); // Reset input

    } catch (e: any) {
      console.error("Bid transaction failed: ", e);
      toast({
        variant: "destructive",
        title: "Bid Failed",
        description: e.message || "Could not place your bid. Please try again.",
      });
      setError(e.message || "Could not place your bid.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                type="number"
                name="bidAmount"
                placeholder={`Bid ($${nextValidBid.toLocaleString()} - $${maxBid.toLocaleString()})`}
                required
                className="pl-6"
                aria-describedby="bid-error"
                min={nextValidBid}
                max={maxBid}
                step={minimumBidIncrement}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                />
            </div>
            {error && (
            <p id="bid-error" className="text-sm text-destructive mt-1">
                {error}
            </p>
            )}
        </div>
        <SubmitButton isPending={isSubmitting} />
        </form>
    </div>
  );
}
