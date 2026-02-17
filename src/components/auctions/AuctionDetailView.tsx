
'use client';

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { doc, collection, addDoc, serverTimestamp, updateDoc, increment } from "firebase/firestore";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BiddingForm } from "@/components/auctions/bidding-form";
import { AIValuation } from "@/components/alcohol/ai-valuation";
import { Gavel, Tag, Users, TrendingUp, Gem, Palette, CreditCard, Phone, Shirt, Wand2 } from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";
import { BiddingHistory } from "@/components/auctions/bidding-history";
import { LoadingGavel } from "@/components/ui/loading-gavel";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { HeatBar } from "@/components/auctions/heat-bar";
import { LiveWatchers } from "@/components/auctions/LiveWatchers";
import { LebanesePlateDisplay } from "@/components/auctions/lebanese-plate-display";
import { PhoneNumberDisplay } from "@/components/auctions/phone-number-display";
import { AuctionTimerBar } from "./AuctionTimerBar";

// Use a simple in-memory Set to track viewed items for the current session.
// This is robust against component re-mounts within the same page load.
const viewCountedInSession = new Set<string>();

type AuctionDoc = {
    // Common fields
    userId: string;
    description: string;
    imageUrls: string[];
    startingBid: number;
    currentBid: number;
    bidCount: number;
    minimumBidIncrement: number;
    auctionEndDate: string; // ISO string
    auctionStartDate: string; // ISO string
    isFlashAuction?: boolean;
    extendCount?: number;
    viewCount?: number;
    // Category-specific fields
    name?: string; // alcohol
    itemName?: string; // others
    subcategory?: string;
    age?: number;
    category?: string;
};

type BidDoc = {
    userId: string;
    bidderName: string;
    amount: number;
    timestamp: any; // Firestore Timestamp
};

type AuctionDetailViewProps = {
  itemId: string;
  category: string;
};

export function AuctionDetailView({ itemId, category }: AuctionDetailViewProps) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const itemRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, category, itemId);
  }, [firestore, itemId, category]);

  const { data: item, isLoading: isItemLoading } = useDoc<AuctionDoc>(itemRef);

  const bidsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, category, itemId, 'bids');
  }, [firestore, itemId, category]);

  const { data: bids, isLoading: areBidsLoading } = useCollection<BidDoc>(bidsRef);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc(userProfileRef);

  // Effect to log user view for personalization and increment view count
  useEffect(() => {
    if (!user || !firestore || !itemRef || isItemLoading || !item) {
        return;
    }

    // --- New View Counting Logic ---
    // Use a simple in-memory Set to track viewed items for the current session.
    // This is robust against component re-mounts within the same page load.
    if (!viewCountedInSession.has(itemId)) {
        viewCountedInSession.add(itemId); // Mark as counted for this session

        updateDoc(itemRef, {
            viewCount: increment(1)
        }).catch(err => {
            const permissionError = new FirestorePermissionError({
                path: itemRef.path,
                operation: 'update',
                requestResourceData: { viewCount: 'increment(1)' }
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }

    // --- Log for immediate client-side suggestions (still uses localStorage) ---
    try {
        const MAX_HISTORY = 50;
        const categories = JSON.parse(localStorage.getItem('viewedCategories') || '[]');
        categories.unshift(category);
        if (categories.length > MAX_HISTORY) categories.pop();
        localStorage.setItem('viewedCategories', JSON.stringify(categories));

        const itemIds = JSON.parse(localStorage.getItem('viewedItemIds') || '[]');
        if (!itemIds.includes(itemId)) {
            itemIds.unshift(itemId);
            if (itemIds.length > MAX_HISTORY) itemIds.pop();
            localStorage.setItem('viewedItemIds', JSON.stringify(itemIds));
        }
    } catch (e) {
      console.error("Could not process suggestion logging from localStorage:", e);
    }
      
    // --- Log for future server-side processing ---
    const interactionRef = collection(firestore, 'userInteractions');
    addDoc(interactionRef, {
        userId: user.uid,
        itemId: itemId,
        category: category,
        interactionType: 'view',
        timestamp: serverTimestamp(),
    }).catch(err => {
        // This is a background task, so we just log the error.
        // It won't crash the app if it fails.
        console.error("Failed to log user interaction:", err);
    });

  }, [user, firestore, itemRef, isItemLoading, item, category, itemId]);


  if (isItemLoading || isUserLoading || areBidsLoading || isUserProfileLoading || !item) {
    return <div className="p-8"><LoadingGavel /></div>;
  }

  const auctionEndDate = new Date(item.auctionEndDate);
  const auctionStartDate = new Date(item.auctionStartDate);
  const bidsData = bids || [];

  const getStatus = () => {
    if (isPast(auctionEndDate)) return 'completed';
    if (isPast(auctionStartDate)) return 'live';
    return 'upcoming';
  }
  const status = getStatus();

  const title = item.name || item.itemName || 'Auction Item';
  const isPlate = category === 'plates';
  const isPhoneNumber = category === 'phoneNumbers';

  const renderTitleAndSubtitle = () => {
    switch (category) {
        case 'alcohol': return <><p className="text-sm font-medium text-primary">{item.subcategory}</p><h1 className="text-3xl md:text-4xl font-bold font-headline">{title}</h1></>;
        case 'art': return <><p className="text-sm font-medium text-primary flex items-center gap-2"><Palette className="w-4 h-4"/> By {item.category} • {item.subcategory}</p><h1 className="text-3xl md:text-4xl font-bold font-headline">{title}</h1></>;
        case 'iconics': return <><p className="text-sm font-medium text-primary flex items-center gap-2"><Gem className="w-4 h-4"/> From {item.category}</p><h1 className="text-3xl md:text-4xl font-bold font-headline">{title}</h1></>;
        case 'apparels': return <><p className="text-sm font-medium text-primary flex items-center gap-2"><Shirt className="w-4 h-4"/> {item.category}</p><h1 className="text-3xl md:text-4xl font-bold font-headline">{title}</h1></>;
        case 'casuals': return <><h1 className="text-3xl md:text-4xl font-bold font-headline">{title}</h1></>;
        case 'plates': return <><p className="text-sm font-medium text-primary flex items-center justify-center gap-2"><CreditCard className="w-4 h-4"/> {item.category}</p><div className="my-4"><LebanesePlateDisplay plateNumber={title} size="medium" /></div></>;
        case 'phoneNumbers': return <><p className="text-sm font-medium text-primary flex items-center justify-center gap-2"><Phone className="w-4 h-4"/> {item.category}</p><div className="my-4"><PhoneNumberDisplay phoneNumber={title} className="max-w-sm mx-auto" /></div></>;
        default: return <h1 className="text-3xl md:text-4xl font-bold font-headline">{title}</h1>;
    }
  };

  const renderDetails = () => {
      const commonDetails = (
          <>
            <div className="flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground"/> Bids: <span className="font-semibold">{item.bidCount}</span></div>
            <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-muted-foreground"/> Increment: <span className="font-semibold">${item.minimumBidIncrement.toLocaleString()}</span></div>
          </>
      );
      if (category === 'alcohol') {
          return <div className="grid grid-cols-2 md:grid-cols-2 gap-4 text-sm"><div className="flex items-center gap-2"><Tag className="w-4 h-4 text-muted-foreground"/> Age: <span className="font-semibold">{item.age && item.age > 0 ? `${item.age} years` : 'N/A'}</span></div>{commonDetails}</div>
      }
      return <div className="grid grid-cols-2 md:grid-cols-2 gap-4 text-sm">{commonDetails}</div>
  }

  const renderAIValuation = () => {
    if (category === 'alcohol') {
      const characteristics = `Sub-category: ${item.subcategory}. Rarity: Limited Edition. Age: ${item.age} years.`;
      const marketTrends = "Market trends for similar items are currently unavailable.";
      return <AIValuation alcoholCharacteristics={characteristics} marketTrends={marketTrends} />;
    }
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1, -1);
    return (
        <Card className="bg-secondary/50 border-dashed">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Wand2 className="w-6 h-6 text-primary" />
                    <CardTitle className="font-headline text-lg">AI Valuation Tool</CardTitle>
                </div>
                <CardDescription>
                AI valuation for {categoryName} items is coming soon!
                </CardDescription>
            </CardHeader>
        </Card>
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Top section: Image for non-plate/phone */}
      {!(isPlate || isPhoneNumber) && (
        <div className="lg:max-w-3xl lg:mx-auto">
          <Carousel className="w-full">
            <CarouselContent>
              {item.imageUrls.map((url, index) => (
                <CarouselItem key={index}>
                  <Card className="overflow-hidden">
                    <CardContent className="flex aspect-[4/3] items-center justify-center p-0 relative">
                      <Image src={url} alt={`${title} image ${index + 1}`} fill className="object-cover" priority={index === 0} />
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      )}

      {/* Main Content Area */}
      <div className="space-y-6">
          <div className={`space-y-2 ${isPlate || isPhoneNumber ? 'text-center' : ''}`}>
              {renderTitleAndSubtitle()}
          </div>

          {item.description && !isPlate && !isPhoneNumber && category !== 'art' && <p className="text-muted-foreground">{item.description}</p>}
          {category === 'art' && <div className="space-y-2"><h2 className="text-lg font-semibold font-headline">Story</h2><p className="text-muted-foreground">{item.description}</p></div>}
          
          <div className={`${isPlate || isPhoneNumber ? 'max-w-md mx-auto' : ''}`}>
              {renderDetails()}
          </div>

          {status !== 'completed' && (
            <Card className={`${isPlate || isPhoneNumber ? 'max-w-md mx-auto' : ''}`}>
              <CardContent className="p-4 space-y-2">
                <AuctionTimerBar
                    startDate={item.auctionStartDate}
                    endDate={item.auctionEndDate}
                />
                <HeatBar bids={bidsData} auctionEndDate={auctionEndDate} />
                <LiveWatchers itemId={itemId} category={category} />
              </CardContent>
            </Card>
          )}

          <div className={`grid md:grid-cols-2 gap-6 items-start ${isPlate || isPhoneNumber ? 'max-w-md mx-auto' : ''}`}>
              <div className="space-y-6">
                  <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2"><Gavel /><span>Bidding</span></CardTitle>
                        <CardDescription>
                            {status === 'completed' ? 'The final bid was:' : status === 'live' ? 'The current bid is:' : 'The starting bid is:'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 mb-4 rounded-lg bg-muted text-center">
                            <p className="text-4xl font-bold">${(status === 'upcoming' ? item.startingBid : item.currentBid).toLocaleString()}</p>
                        </div>
                        {status === 'live' ? (
                            <BiddingForm
                            itemId={itemId}
                            category={category as any}
                            currentBid={item.currentBid}
                            minimumBidIncrement={item.minimumBidIncrement}
                            itemUserId={item.userId}
                            isFlashAuction={item.isFlashAuction}
                            auctionEndDate={item.auctionEndDate}
                            />
                        ) : status === 'upcoming' ? (
                            <div className="text-center text-muted-foreground py-4 space-y-1">
                                <p className="font-semibold text-lg text-foreground">Auction Starts Soon</p>
                                <div className="text-sm">
                                    Bidding begins {formatDistanceToNow(auctionStartDate, { addSuffix: true })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-4 space-y-1">
                                <p className="font-semibold text-lg">Auction Ended</p>
                                <div className="text-sm">
                                    This auction ended {formatDistanceToNow(auctionEndDate, { addSuffix: true })}
                                </div>
                            </div>
                        )}
                      </CardContent>
                  </Card>
                  {renderAIValuation()}
              </div>
              <div className="space-y-6">
                  <BiddingHistory history={bidsData} />
              </div>
          </div>
        </div>
    </div>
  );
}
