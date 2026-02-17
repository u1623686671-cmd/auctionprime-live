

'use client';

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Loader2, Heart, Phone, X, Gavel, Hand, Calendar, LogIn, Star, Zap } from "lucide-react";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { WatchlistButton } from "@/components/auctions/watchlist-button";
import Loading from "./loading";
import { Button } from "@/components/ui/button";
import { LebanesePlateDisplay } from "@/components/auctions/lebanese-plate-display";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuctionDetailView } from "@/components/auctions/AuctionDetailView";
import { AuctionTimerBar } from "@/components/auctions/AuctionTimerBar";
import { isPast } from "date-fns";
import { PhoneNumberDisplay } from "@/components/auctions/phone-number-display";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";


type WatchlistItem = {
    id: string;
    itemId: string;
    category: string;
    title: string;
    imageUrl: string;
    auctionStartDate: string;
    auctionEndDate: string;
    addedAt: {
        seconds: number;
        nanoseconds: number;
    };
};

function WatchlistItemCard({ item }: { item: WatchlistItem }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [selectedItem, setSelectedItem] = useState<{ id: string, category: string } | null>(null);
    const router = useRouter();
    const isMobile = useIsMobile();

    const { data: liveItemData, isLoading: isLiveItemLoading } = useDoc<any>(
        useMemoFirebase(() => doc(firestore, item.category, item.id), [firestore, item.category, item.id])
    );

    const handleItemSelect = (item: {id: string, category: string}) => {
        if (isMobile) {
            setSelectedItem(item);
        } else {
            router.push(`/${item.category}/${item.id}`);
        }
    };
    
    if (isLiveItemLoading || isUserLoading) {
        return (
             <Card className="overflow-hidden shadow-lg">
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
        )
    }

    if (!liveItemData) {
        return null; // The item might have been deleted
    }

    const isPlate = item.category === 'plates';
    const isPhoneNumber = item.category === 'phoneNumbers';
    const getStatus = () => {
        if (isPast(new Date(item.auctionEndDate))) return 'completed';
        if (isPast(new Date(item.auctionStartDate))) return 'live';
        return 'upcoming';
    }
    const status = getStatus();

    const getSubtitle = () => {
        switch (item.category) {
            case 'alcohol': return liveItemData.subcategory;
            case 'casuals': return "Casual";
            case 'iconics': return `From ${liveItemData.category}`;
            case 'art': return liveItemData.category;
            case 'plates': return liveItemData.category;
            case 'phoneNumbers': return liveItemData.category;
            case 'apparels': return liveItemData.category;
            default: return '';
        }
    }
    const subtitle = getSubtitle();
    
    return (
        <>
            <Dialog open={!!selectedItem && isMobile} onOpenChange={(isOpen) => { if (!isOpen) setSelectedItem(null); }}>
                <DialogContent className="p-0">
                    <ScrollArea className="h-full w-full">
                        <div className="p-4 pt-8 sm:p-6 sm:pt-6">
                        {selectedItem && (
                            <AuctionDetailView itemId={selectedItem.id} category={selectedItem.category} />
                        )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        <Card onClick={() => handleItemSelect({ id: item.id, category: item.category })} className={cn("shadow-lg bg-card cursor-pointer hover:bg-muted/50 transition-colors", !liveItemData.isPromoted && "overflow-hidden", liveItemData.isPromoted && "ring-2 ring-offset-background ring-sky-500 shadow-lg shadow-sky-500/40")}>
            <CardContent className="p-4 pb-0">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:w-24 shrink-0">
                        <div className={cn("aspect-square relative rounded-md overflow-hidden group", isPlate || isPhoneNumber ? '' : 'bg-muted')}>
                            {isPlate ? (
                                <div className="w-full h-full flex items-center justify-center">
                                    <LebanesePlateDisplay plateNumber={item.title} />
                                </div>
                            ) : isPhoneNumber ? (
                                <div className="w-full h-full flex items-center justify-center">
                                    <PhoneNumberDisplay phoneNumber={item.title} />
                                </div>
                            ) : (
                                <Image src={item.imageUrl || `https://picsum.photos/seed/${item.id}/800/600`} alt={item.title} fill className="object-cover" />
                            )}
                            <WatchlistButton
                                itemId={item.id}
                                category={item.category}
                                title={item.title || ''}
                                imageUrl={item.imageUrl || ''}
                                auctionStartDate={item.auctionStartDate}
                                auctionEndDate={item.auctionEndDate}
                                className="absolute top-2 right-2 z-10"
                                isWatched={true}
                                isWatchlistLoading={false}
                            />
                            {liveItemData.isPromoted && (
                                <Badge variant="outline" className="absolute bottom-2 left-2 z-10 flex items-center gap-1 bg-black/50 text-white backdrop-blur-sm border-none text-xs">
                                    <Star className="h-3 w-3" />
                                    Sponsored
                                </Badge>
                            )}
                            {liveItemData.isFlashAuction && (
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
                                <h3 className="font-bold text-base sm:text-lg font-headline leading-tight hover:underline flex-1">{item.title}</h3>
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
                                <p className="text-base font-semibold">${(liveItemData.startingBid ?? 0).toLocaleString()}</p>
                            </div>
                             <div>
                                <p className="text-xs text-muted-foreground">Current Bid</p>
                                <p className="text-base font-semibold">${(liveItemData.currentBid ?? 0).toLocaleString()}</p>
                            </div>
                       </div>
                    </div>
                </div>
            </CardContent>
        
            <CardFooter className="p-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                <Button
                    onClick={(e) => { e.stopPropagation(); handleItemSelect({ id: item.id, category: item.category })}}
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
        </>
    );
}


export default function WatchlistPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();
    const [isAllowed, setIsAllowed] = useState(false);

    const watchlistQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `users/${user.uid}/watchlist`), orderBy("addedAt", "desc"));
    }, [firestore, user]);

    const { data: watchlistItems, isLoading: isWatchlistLoading } = useCollection<WatchlistItem>(watchlistQuery);

    useEffect(() => {
        if (isUserLoading) return;

        if (!user) {
            router.replace('/login');
            return;
        }

        setIsAllowed(true);
    }, [isUserLoading, user, router]);

    if (!isAllowed || isWatchlistLoading || isUserLoading) {
        return <Loading />;
    }

    return (
        <div className="container mx-auto px-4 py-12 md:py-16">
            <header className="mb-12">
                <h1 className="text-4xl md:text-5xl font-bold font-headline mb-2">
                    My Watchlist
                </h1>
                <p className="text-lg text-muted-foreground">
                    Items you are currently watching.
                </p>
            </header>

            {watchlistItems && watchlistItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                    {watchlistItems.map((item) => (
                        <WatchlistItemCard item={item} key={item.id} />
                    ))}
                </div>
            ) : (
                <div className="text-center text-muted-foreground flex flex-col items-center gap-6 max-w-md mx-auto py-16">
                    <Heart className="w-24 h-24 text-primary/10" />
                    <h2 className="text-2xl font-bold font-headline text-foreground">Your Watchlist is Empty</h2>
                    <p>
                        Add items to your watchlist by clicking the heart icon on any auction listing. We'll keep track of them for you here.
                    </p>
                    <Button asChild>
                        <Link href="/home">Explore Auctions</Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
