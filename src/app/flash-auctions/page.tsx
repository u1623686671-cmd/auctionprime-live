
'use client';

import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { Gavel, LogIn, Search, Users, X, Zap, ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { collection } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { WatchlistButton } from "@/components/auctions/watchlist-button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LebanesePlateDisplay } from "@/components/auctions/lebanese-plate-display";
import { PhoneNumberDisplay } from "@/components/auctions/phone-number-display";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AuctionDetailView } from "@/components/auctions/AuctionDetailView";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuctionTimerBar } from "@/components/auctions/AuctionTimerBar";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { isPast } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

type BaseAuctionDoc = {
  id: string;
  description: string;
  startingBid: number;
  currentBid: number;
  bidCount: number;
  auctionStartDate: string;
  auctionEndDate: string;
  imageUrls: string[];
  status: "upcoming" | "live" | "completed";
  minimumBidIncrement: number;
  isFlashAuction?: boolean;
  isPromoted?: boolean;
};

type AlcoholDoc = BaseAuctionDoc & { name: string; subcategory: string; age: number; };
type OtherDoc = BaseAuctionDoc & { itemName: string; category: string; };
type IconicDoc = BaseAuctionDoc & { itemName: string; category: string; };
type ArtDoc = BaseAuctionDoc & { itemName: string; category: string; };
type PlateDoc = BaseAuctionDoc & { itemName: string; category: string; };
type PhoneNumberDoc = BaseAuctionDoc & { itemName: string; category: string; };
type ApparelDoc = BaseAuctionDoc & { itemName: string; category: string; };

export default function FlashAuctionsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [selectedItem, setSelectedItem] = useState<{ id: string, category: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();
  const isMobile = useIsMobile();

  const watchlistQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/watchlist`);
    }, [firestore, user]);
  const { data: watchlistItems, isLoading: isWatchlistLoading } = useCollection<{id: string}>(watchlistQuery);

  const alcoholQuery = useMemoFirebase(() => firestore ? collection(firestore, 'alcohol') : null, [firestore]);
  const { data: allAlcohol, isLoading: isLoadingAlcohol } = useCollection<AlcoholDoc>(alcoholQuery);
  const othersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'others') : null, [firestore]);
  const { data: allOthers, isLoading: isLoadingOthers } = useCollection<OtherDoc>(othersQuery);
  const iconicsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'iconics') : null, [firestore]);
  const { data: allIconics, isLoading: isLoadingIconics } = useCollection<IconicDoc>(iconicsQuery);
  const artQuery = useMemoFirebase(() => firestore ? collection(firestore, 'art') : null, [firestore]);
  const { data: allArt, isLoading: isLoadingArt } = useCollection<ArtDoc>(artQuery);
  const platesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'plates') : null, [firestore]);
  const { data: allPlates, isLoading: isLoadingPlates } = useCollection<PlateDoc>(platesQuery);
  const phoneNumbersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'phoneNumbers') : null, [firestore]);
  const { data: allPhoneNumbers, isLoading: isLoadingPhoneNumbers } = useCollection<PhoneNumberDoc>(phoneNumbersQuery);
  const apparelsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'apparels') : null, [firestore]);
  const { data: allApparels, isLoading: isLoadingApparels } = useCollection<ApparelDoc>(apparelsQuery);

  const areAllListingsLoading = isLoadingAlcohol || isLoadingOthers || isLoadingIconics || isLoadingArt || isLoadingPlates || isLoadingPhoneNumbers || isLoadingApparels;
  
  const auctionCategories = useMemo(() => [
    { data: allAlcohol, type: 'alcohol' },
    { data: allArt, type: 'art' },
    { data: allApparels, type: 'apparels' },
    { data: allIconics, type: 'iconics' },
    { data: allOthers, type: 'others' },
    { data: allPlates, type: 'plates' },
    { data: allPhoneNumbers, type: 'phoneNumbers' },
  ], [allAlcohol, allArt, allApparels, allIconics, allOthers, allPlates, allPhoneNumbers]);

  const getItemTitleSubtitle = useCallback((item: any, type: string) => {
    let title, subtitle;
    const category = type;
    switch (category) {
        case 'alcohol': title = item.name; subtitle = item.subcategory; break;
        case 'others': title = item.itemName; subtitle = "Other"; break;
        case 'iconics': title = item.itemName; subtitle = `From ${item.category}`; break;
        case 'art': title = item.itemName; subtitle = item.category; break;
        case 'plates': title = item.itemName; subtitle = item.category; break;
        case 'phoneNumbers': title = item.itemName; subtitle = item.category; break;
        case 'apparels': title = item.itemName; subtitle = item.category; break;
        default: title = 'Untitled'; subtitle = '';
    }
    return { title, subtitle };
  }, []);

  const allItems = useMemo(() => {
    if (areAllListingsLoading) return [];
    const items: any[] = [];
    auctionCategories.forEach(cat => {
        cat.data?.forEach(item => items.push({ ...item, category: cat.type }));
    });
    return items;
  }, [areAllListingsLoading, auctionCategories]);
  
  const allLiveItems = useMemo(() => {
    const now = new Date();
    return allItems.filter(item => new Date(item.auctionStartDate) <= now && new Date(item.auctionEndDate) > now);
  }, [allItems]);

  const flashAuctionItems = useMemo(() => {
    let items = allLiveItems
      .filter(item => item.isFlashAuction)
      .sort((a, b) => {
        if (a.isPromoted && !b.isPromoted) return -1;
        if (!a.isPromoted && b.isPromoted) return 1;
        return new Date(a.auctionEndDate).getTime() - new Date(b.auctionEndDate).getTime();
      });

    if (searchTerm) {
        items = items.filter(item =>
            getItemTitleSubtitle(item, item.category).title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    return items;
  }, [allLiveItems, searchTerm, getItemTitleSubtitle]);

  const watchlistSet = useMemo(() => {
      if (!watchlistItems) return new Set();
      return new Set(watchlistItems.map(item => item.id));
  }, [watchlistItems]);
  
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/login');
    }
  }, [isUserLoading, user, router]);

  const handleItemSelect = (item: {id: string, category: string}) => {
    if (isMobile) {
      setSelectedItem(item);
    } else {
      router.push(`/${item.category}/${item.id}`);
    }
  }

  const renderAuctionGrid = (items: any[], isLoading: boolean) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-6">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index} className="overflow-hidden shadow-lg">
                        <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Skeleton className="w-full sm:w-24 h-auto aspect-square rounded-md shrink-0" />
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-4 w-1/4" />
                                    <div className="flex gap-4 pt-2 mt-auto">
                                        <Skeleton className="h-8 w-24" />
                                        <Skeleton className="h-8 w-24" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }
    if (items.length === 0) {
        return (
             <div className="col-span-full text-center py-12 text-muted-foreground">
                <Zap className="w-16 h-16 mx-auto text-primary/10 mb-4" />
                <h3 className="text-xl font-bold font-headline text-foreground">No Live Flash Auctions</h3>
                <p>Flash auctions are fast-paced events. Check back soon!</p>
            </div>
        )
    }
    return (
        <div className="grid grid-cols-1 gap-6">
            {items.map((item) => {
                const collectionName = item.category;
                const { title, subtitle } = getItemTitleSubtitle(item, collectionName);
                const isPlate = collectionName === 'plates';
                const isPhoneNumber = collectionName === 'phoneNumbers';
                
                const getStatus = () => {
                    if (isPast(new Date(item.auctionEndDate))) return 'completed';
                    if (isPast(new Date(item.auctionStartDate))) return 'live';
                    return 'upcoming';
                }
                const status = getStatus();
                
                return (
                    <Card key={item.id} onClick={() => handleItemSelect({ id: item.id, category: collectionName })} className={cn("shadow-lg bg-card cursor-pointer hover:bg-muted/50 transition-colors", item.isPromoted ? "border-accent" : "overflow-hidden")}>
                        <CardContent className="p-4 pb-0">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="w-full sm:w-24 shrink-0">
                                    <div className={cn("aspect-square relative rounded-md group", isPlate || isPhoneNumber ? '' : 'bg-muted', item.isPromoted ? "" : "overflow-hidden")}>
                                        {isPlate ? (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <LebanesePlateDisplay plateNumber={item.itemName} />
                                            </div>
                                        ) : isPhoneNumber ? (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <PhoneNumberDisplay phoneNumber={item.itemName} />
                                            </div>
                                        ) : (
                                            <Image src={(item.imageUrls && item.imageUrls[0]) || `https://picsum.photos/seed/${item.id}/800/600`} alt={title || 'Auction item'} data-ai-hint={collectionName} fill className="object-cover" />
                                        )}
                                        <WatchlistButton
                                            itemId={item.id}
                                            category={collectionName}
                                            title={title || ''}
                                            imageUrl={(item.imageUrls && item.imageUrls[0]) || ''}
                                            auctionStartDate={item.auctionStartDate}
                                            auctionEndDate={item.auctionEndDate}
                                            className="absolute top-2 right-2 z-10"
                                            isWatched={watchlistSet.has(item.id)}
                                            isWatchlistLoading={isWatchlistLoading || isUserLoading}
                                        />
                                        {item.isPromoted && (
                                            <Badge className="absolute bottom-2 left-2 z-10 flex items-center gap-1 border-transparent bg-accent text-accent-foreground text-xs hover:bg-accent/80">
                                                <Star className="h-3 w-3" />
                                                Sponsored
                                            </Badge>
                                        )}
                                        {item.isFlashAuction && (
                                            <Badge className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-accent text-accent-foreground border border-accent-darker">
                                                <Zap className="h-3 w-3" />
                                                FLASH
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                    
                                <div className="flex-grow flex flex-col">
                                    <div className='flex-1 mb-2'>
                                        <div className="flex justify-between items-start gap-1 mb-2">
                                            <h3 className="font-bold text-base sm:text-lg font-headline leading-tight hover:underline flex-1">{title}</h3>
                                            <div className="shrink-0 -mr-1 sm:ml-0">
                                                 <Badge variant={status === 'live' ? 'default' : status === 'upcoming' ? 'secondary' : 'outline'} className="capitalize">{status}</Badge>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{subtitle}</p>
                                        <div className="mt-1">
                                            <AuctionTimerBar startDate={item.auctionStartDate} endDate={item.auctionEndDate} isCard />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 mt-auto pt-2 border-t mt-2">
                                         <div>
                                            <p className="text-xs text-muted-foreground">Starting Bid</p>
                                            <p className="text-base font-semibold">${(item.startingBid ?? 0).toLocaleString()}</p>
                                        </div>
                                         <div>
                                            <p className="text-xs text-muted-foreground">Current Bid</p>
                                            <p className="text-base font-semibold">${(item.currentBid ?? 0).toLocaleString()}</p>
                                        </div>
                                   </div>
                                </div>
                            </div>
                        </CardContent>
                    
                        <CardFooter className="p-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                            <Button
                                onClick={(e) => { e.stopPropagation(); handleItemSelect({ id: item.id, category: collectionName })}}
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                                disabled={status === 'completed'}
                            >
                                {status === 'live' ? <Gavel className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
                                <span>
                                    {status === 'live' ? 'Bid Now' : status === 'upcoming' ? 'View Item' : 'Auction Ended'}
                                </span>
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
        );
    };

  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
       <Dialog open={!!selectedItem && isMobile} onOpenChange={(isOpen) => { if (!isOpen) setSelectedItem(null); }}>
        <DialogContent className="p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Auction Details</DialogTitle>
            <DialogDescription>
              Viewing the details for the selected auction item.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-full w-full">
            <div className="p-4 pt-8 sm:p-6 sm:pt-6">
              {selectedItem && (
                <AuctionDetailView itemId={selectedItem.id} category={selectedItem.category} />
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <div className="mb-8">
        <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
          <Link href="/home">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
      </div>
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold font-headline mb-2">
          Flash Auctions
        </h1>
        <p className="text-lg text-muted-foreground">
          Fast-paced auctions ending soon!
        </p>
      </header>
       <div className="relative w-full md:max-w-xs mb-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
              placeholder="Search flash auctions..."
              className="w-full bg-background pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
          />
      </div>
      {renderAuctionGrid(flashAuctionItems, areAllListingsLoading)}
    </div>
  );
}
