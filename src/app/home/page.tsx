
'use client';

import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { DollarSign, Calendar, Loader2, ShoppingBag, Gavel, Hand, Search, Wine, Gem, Palette, CreditCard, Phone, Home, LayoutGrid, Plus, ChevronRight, Shirt, Zap, User, LogOut, X, LogIn, Star } from "lucide-react";
import { format, isPast } from "date-fns";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { collection, query, where, doc, orderBy } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { WatchlistButton } from "@/components/auctions/watchlist-button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LebanesePlateDisplay } from "@/components/auctions/lebanese-plate-display";
import { PhoneNumberDisplay } from "@/components/auctions/phone-number-display";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUnreadChatsCount } from "@/hooks/useUnreadChatsCount";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { AuctionDetailView } from "@/components/auctions/AuctionDetailView";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { AuctionTimerBar } from "@/components/auctions/AuctionTimerBar";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { NewListingFlow } from "@/components/retailer/NewListingFlow";
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
  viewCount?: number;
};

type AlcoholDoc = BaseAuctionDoc & {
  name: string;
  subcategory: string;
  age: number;
};

type CasualDoc = BaseAuctionDoc & {
    itemName: string;
    category: string;
};

type IconicDoc = BaseAuctionDoc & {
    itemName: string;
    category: string;
}

type ArtDoc = BaseAuctionDoc & {
    itemName: string;
    category: string;
}

type PlateDoc = BaseAuctionDoc & {
    itemName: string;
    category: string;
};

type PhoneNumberDoc = BaseAuctionDoc & {
    itemName: string;
    category: string;
};

type ApparelDoc = BaseAuctionDoc & {
    itemName: string;
    category: string;
};

export default function HomePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  
  const [selectedItem, setSelectedItem] = useState<{ id: string, category: string } | null>(null);
  const [isListingDialogOpen, setIsListingDialogOpen] = useState(false);

  const unreadChatsCount = useUnreadChatsCount();
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'home');
  
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc(userProfileRef);

  const [suggestedItems, setSuggestedItems] = useState<any[]>([]);

  const handleLogout = () => {
    signOut(auth);
    router.push('/login');
    toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
    })
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1 && names[0] && names[names.length - 1]) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }


  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleItemSelect = (item: {id: string, category: string}) => {
    if (isMobile) {
      setSelectedItem(item);
    } else {
      router.push(`/${item.category}/${item.id}`);
    }
  }

  const watchlistQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/watchlist`);
    }, [firestore, user]);
  const { data: watchlistItems, isLoading: isWatchlistLoading } = useCollection<{id: string}>(watchlistQuery);

  const alcoholQuery = useMemoFirebase(() => firestore ? collection(firestore, 'alcohol') : null, [firestore]);
  const { data: allAlcohol, isLoading: isLoadingAlcohol } = useCollection<AlcoholDoc>(alcoholQuery);

  const casualsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'casuals') : null, [firestore]);
  const { data: allCasuals, isLoading: isLoadingCasuals } = useCollection<CasualDoc>(casualsQuery);

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

  const areAllListingsLoading = isLoadingAlcohol || isLoadingCasuals || isLoadingIconics || isLoadingArt || isLoadingPlates || isLoadingPhoneNumbers || isLoadingApparels;
  
  const auctionCategories = useMemo(() => [
    { title: 'Alcohol', icon: Wine, data: allAlcohol, isLoading: isLoadingAlcohol, type: 'alcohol' },
    { title: 'Art', icon: Palette, data: allArt, isLoading: isLoadingArt, type: 'art' },
    { title: 'Apparel', icon: Shirt, data: allApparels, isLoading: isLoadingApparels, type: 'apparels' },
    { title: 'Iconic Items', icon: Gem, data: allIconics, isLoading: isLoadingIconics, type: 'iconics' },
    { title: 'Casual Items', icon: ShoppingBag, data: allCasuals, isLoading: isLoadingCasuals, type: 'casuals' },
    { title: 'Car Plates', icon: CreditCard, data: allPlates, isLoading: isLoadingPlates, type: 'plates' },
    { title: 'Phone Numbers', icon: Phone, data: allPhoneNumbers, isLoading: isLoadingPhoneNumbers, type: 'phoneNumbers' },
  ], [allAlcohol, isLoadingAlcohol, allArt, isLoadingArt, allApparels, isLoadingApparels, allIconics, isLoadingIconics, allCasuals, isLoadingCasuals, allPlates, isLoadingPlates, allPhoneNumbers, isLoadingPhoneNumbers]);

  const allItems = useMemo(() => {
    if (areAllListingsLoading) return [];
    const items: any[] = [];
    const now = new Date();

    auctionCategories.forEach(cat => {
        const validItems = cat.data?.filter(item => {
            const endDate = new Date(item.auctionEndDate);
            return endDate > now; // Not completed
        }) || [];
        validItems.forEach(item => items.push({ ...item, category: cat.type }));
    });
    
    return items.sort((a, b) => {
        // Promoted items first
        if (a.isPromoted && !b.isPromoted) return -1;
        if (!a.isPromoted && b.isPromoted) return 1;
        
        const nowTime = now.getTime();
        const aIsLive = new Date(a.auctionStartDate).getTime() <= nowTime;
        const bIsLive = new Date(b.auctionStartDate).getTime() <= nowTime;

        if (aIsLive && !bIsLive) return -1; // a (live) first
        if (!aIsLive && bIsLive) return 1;  // b (live) first

        // both live, sort by end date ascending (soonest to end first)
        if (aIsLive && bIsLive) {
            return new Date(a.auctionEndDate).getTime() - new Date(b.auctionEndDate).getTime();
        }

        // both upcoming, sort by start date ascending (soonest to start first)
        return new Date(a.auctionStartDate).getTime() - new Date(b.auctionStartDate).getTime();
    });
  }, [areAllListingsLoading, auctionCategories]);
  
  const allLiveItems = useMemo(() => {
    return allItems.filter(item => new Date(item.auctionStartDate) <= new Date());
  }, [allItems]);

  const promotedItems = useMemo(() => {
    return allLiveItems.filter(item => item.isPromoted);
  }, [allLiveItems]);
  
  const topPicks = useMemo(() => {
    return [...allLiveItems]
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  }, [allLiveItems]);

  const upcomingItems = useMemo(() => {
    const now = new Date();
    return allItems
      .filter(item => new Date(item.auctionStartDate) > now);
  }, [allItems]);

  const flashAuctionItems = useMemo(() => {
    return allLiveItems
      .filter(item => item.isFlashAuction)
      .sort((a, b) => {
        if (a.isPromoted && !b.isPromoted) return -1;
        if (!a.isPromoted && b.isPromoted) return 1;
        return (b.bidCount || 0) - (a.bidCount || 0)
      });
  }, [allLiveItems]);

  const getItemTitleSubtitle = useCallback((item: any, type: string) => {
    let title, subtitle;
    const category = type;

    switch (category) {
        case 'alcohol':
            title = item.name;
            subtitle = item.subcategory;
            break;
        case 'casuals':
            title = item.itemName;
            subtitle = "Casual";
            break;
        case 'iconics':
            title = item.itemName;
            subtitle = `From ${item.category}`;
            break;
        case 'art':
            title = item.itemName;
            subtitle = item.category;
            break;
        case 'plates':
            title = item.itemName;
            subtitle = item.category;
            break;
        case 'phoneNumbers':
            title = item.itemName;
            subtitle = item.category;
            break;
        case 'apparels':
            title = item.itemName;
            subtitle = item.category;
            break;
        default:
            title = 'Untitled';
            subtitle = '';
    }
    return { title, subtitle };
  }, []);

  const filteredCategoryItems = useMemo(() => {
    let items = allItems;

    if (categoryFilter !== 'all') {
        items = items.filter(item => item.category === categoryFilter);
    }

    if (categorySearchTerm) {
        items = items.filter(item =>
            getItemTitleSubtitle(item, item.category).title.toLowerCase().includes(categorySearchTerm.toLowerCase())
        );
    }

    return items;
  }, [allItems, categoryFilter, categorySearchTerm, getItemTitleSubtitle]);


  const watchlistSet = useMemo(() => {
      if (!watchlistItems) return new Set();
      return new Set(watchlistItems.map(item => item.id));
  }, [watchlistItems]);

  // Effect to log user view for personalization
  useEffect(() => {
    if (areAllListingsLoading || !allItems.length || !user) return;

    try {
      const viewedCategories: string[] = JSON.parse(localStorage.getItem('viewedCategories') || '[]');
      const viewedItemIds: string[] = JSON.parse(localStorage.getItem('viewedItemIds') || '[]');
      
      if (viewedCategories.length === 0) {
        setSuggestedItems([]);
        return;
      }

      // Count category frequency
      const categoryCounts = viewedCategories.reduce((acc, category) => {
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Get top 3 most frequent categories
      const topCategories = Object.keys(categoryCounts)
        .sort((a, b) => categoryCounts[b] - categoryCounts[a])
        .slice(0, 3);
        
      const suggestions = allItems
        .filter(item => 
            topCategories.includes(item.category) && // Is in a preferred category
            !viewedItemIds.includes(item.id) &&      // Has not been viewed recently
            item.userId !== user.uid &&             // Not the user's own item
            new Date(item.auctionStartDate) <= new Date() && // Is live
            new Date(item.auctionEndDate) > new Date()
        )
        // Shuffle and take top 10
        .sort(() => 0.5 - Math.random())
        .slice(0, 10);
        
      setSuggestedItems(suggestions);

    } catch (e) {
      console.error("Could not generate suggestions from localStorage:", e);
      setSuggestedItems([]);
    }
  }, [allItems, areAllListingsLoading, user]);
  
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    const isAlcoholCategoryView = activeTab === 'categories' && categoryFilter === 'alcohol';
    const htmlElement = document.documentElement;

    if (isAlcoholCategoryView) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }

    // Cleanup on unmount
    return () => {
        htmlElement.classList.remove('dark');
    };
  }, [activeTab, categoryFilter]);

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
                <Search className="w-16 h-16 mx-auto text-primary/10 mb-4" />
                <h3 className="text-xl font-bold font-headline text-foreground">No Items Found</h3>
                <p>Try adjusting your search or filters.</p>
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
                    <Card key={item.id} onClick={() => handleItemSelect({ id: item.id, category: collectionName })} className={cn("shadow-lg bg-card cursor-pointer hover:bg-muted/50 transition-colors", !item.isPromoted && "overflow-hidden")}>
                        <CardContent className="p-4 pb-0">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="w-full sm:w-24 shrink-0">
                                    <div className={cn("aspect-square relative rounded-md group", isPlate || isPhoneNumber ? '' : 'bg-muted', !item.isPromoted && "overflow-hidden")}>
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

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const renderAuctionRow = (items: any[], isLoading: boolean, viewAllLink?: string) => {
    const displayItems = items.slice(0, 12);
    
     if (isLoading) {
        return (
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index} className="w-[45vw] sm:w-48 shrink-0 overflow-hidden">
                        <CardContent className="p-0">
                           <Skeleton className="w-full h-auto aspect-square rounded-none"/>
                        </CardContent>
                        <div className="p-3 space-y-2">
                             <Skeleton className="h-4 w-3/4" />
                             <Skeleton className="h-3 w-1/2" />
                             <Skeleton className="h-3 w-16" />
                             <div className="grid grid-cols-2 gap-2 pt-2 border-t mt-2">
                                <div><Skeleton className="h-3 w-12" /><Skeleton className="h-4 w-16 mt-1" /></div>
                                <div><Skeleton className="h-3 w-12" /><Skeleton className="h-4 w-16 mt-1" /></div>
                             </div>
                        </div>
                         <CardFooter className="p-3 pt-0">
                            <Skeleton className="h-9 w-full" />
                         </CardFooter>
                    </Card>
                ))}
            </div>
        )
    }
    if (items.length === 0) {
        return (
            <div className="flex items-center justify-center text-center py-16 bg-muted rounded-lg w-full">
                <p className="text-muted-foreground">No items in this section yet.</p>
            </div>
        )
    }
    return (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
            {displayItems.map((item) => {
                const collectionName = item.category;
                const { title, subtitle } = getItemTitleSubtitle(item, collectionName);
                const isPlate = collectionName === 'plates';
                const isPhoneNumber = collectionName === 'phoneNumbers';
                const imageUrl = !isPlate && !isPhoneNumber ? ((item.imageUrls && item.imageUrls[0]) || `https://picsum.photos/seed/${item.id}/600/800`) : '';

                const now = new Date();
                const startDate = new Date(item.auctionStartDate);
                const endDate = new Date(item.auctionEndDate);
                let status: 'upcoming' | 'live' | 'completed';

                if (now > endDate) {
                    status = 'completed';
                } else if (now > startDate) {
                    status = 'live';
                } else {
                    status = 'upcoming';
                }

                return (
                    <Card key={item.id} onClick={() => handleItemSelect({ id: item.id, category: collectionName })} className={cn("w-[45vw] sm:w-48 shrink-0 flex flex-col cursor-pointer group h-full shadow-lg transition-colors", !item.isPromoted && "overflow-hidden")}>
                        <CardContent className="p-0">
                           <div className={cn("relative group/image flex items-center justify-center", 'aspect-square', isPlate || isPhoneNumber ? '' : 'bg-muted', !item.isPromoted && "overflow-hidden")}>
                                {isPlate ? (
                                <div className="w-full h-full flex items-center justify-center">
                                    <LebanesePlateDisplay plateNumber={item.itemName} />
                                </div>
                            ) : isPhoneNumber ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                    <PhoneNumberDisplay phoneNumber={item.itemName} />
                                </div>
                            ) : (
                                <Image src={imageUrl} alt={title || 'Auction item'} data-ai-hint={collectionName} fill className="object-cover" />
                            )}
                            {item.isPromoted && (
                                <Badge className="absolute bottom-2 left-2 z-10 flex items-center gap-1 border-transparent bg-accent text-accent-foreground text-xs hover:bg-accent/80">
                                    <Star className="h-3 w-3" />
                                    Sponsored
                                </Badge>
                            )}
                            <Badge variant="outline" className="absolute bottom-2 right-2 z-10 flex items-center gap-1 bg-black/50 text-white backdrop-blur-sm border-none text-xs">
                                <Gavel className="h-3 w-3" />
                                {item.bidCount || 0}
                            </Badge>
                            {item.isFlashAuction && (
                                <Badge className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-accent text-accent-foreground border border-accent-darker">
                                    <Zap className="h-3 w-3" />
                                    FLASH
                                </Badge>
                            )}
                            <WatchlistButton
                                itemId={item.id}
                                category={collectionName}
                                title={title || ''}
                                imageUrl={imageUrl}
                                auctionStartDate={item.auctionStartDate}
                                auctionEndDate={item.auctionEndDate}
                                className="absolute top-2 right-2 z-10"
                                isWatched={watchlistSet.has(item.id)}
                                isWatchlistLoading={isWatchlistLoading || isUserLoading}
                            />
                            </div>
                        </CardContent>
                        <div className="flex-1 flex flex-col p-3 space-y-2">
                            <div>
                                <h3 className="font-headline text-base font-bold mb-1 leading-tight truncate group-hover:underline">{title}</h3>
                                <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                            </div>
                            
                            <div className="flex-grow" />

                            <div className="space-y-3">
                                <AuctionTimerBar startDate={item.auctionStartDate} endDate={item.auctionEndDate} isCard />

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-left">
                                     <div>
                                        <p className="text-xs text-muted-foreground">Starting Bid</p>
                                        <p className="text-sm font-semibold">${(item.startingBid ?? 0).toLocaleString()}</p>
                                    </div>
                                     <div>
                                        <p className="text-xs text-muted-foreground">Current Bid</p>
                                        <p className="text-sm font-semibold">${(item.currentBid ?? 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <CardFooter className="p-3 pt-0">
                             <Button
                                onClick={(e) => { e.stopPropagation(); handleItemSelect({ id: item.id, category: collectionName })}}
                                size="sm"
                                variant="outline"
                                className="w-full"
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
            {items.length > 12 && viewAllLink && (
                <div key="view-all" className="w-[45vw] sm:w-48 shrink-0">
                    <Link href={viewAllLink} className="h-full flex flex-col group">
                        <div className="p-0">
                            <div className="relative w-full aspect-square flex items-center justify-center">
                                {items.slice(0, 3).reverse().map((item, index) => {
                                    const collectionName = item.category;
                                    const isPlate = collectionName === 'plates';
                                    const isPhoneNumber = collectionName === 'phoneNumbers';
                                    let imageUrl = '';
                                    if (!isPlate && !isPhoneNumber) {
                                        imageUrl = (item.imageUrls && item.imageUrls[0]) || `https://picsum.photos/seed/${item.id}/200/200`;
                                    }

                                    return (
                                        <div
                                            key={item.id}
                                            className="absolute w-2/3 aspect-square rounded-md overflow-hidden bg-muted border transition-transform duration-300 ease-in-out group-hover:rotate-0"
                                            style={{
                                                transform: `rotate(${index * 8 - 8}deg)`,
                                                zIndex: 3 - index,
                                            }}
                                        >
                                            {isPlate ? (
                                                <div className="flex items-center justify-center h-full">
                                                    <LebanesePlateDisplay plateNumber={item.itemName} />
                                                </div>
                                            ) : isPhoneNumber ? (
                                                <div className="flex items-center justify-center h-full">
                                                    <PhoneNumberDisplay phoneNumber={item.itemName} size="small" />
                                                </div>
                                            ) : (
                                                <Image
                                                    src={imageUrl}
                                                    alt="" // Decorative
                                                    fill
                                                    className="object-cover"
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-3">
                            <h3 className="font-headline text-base font-bold mb-1 leading-tight truncate group-hover:underline flex items-center gap-1">
                                See More
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">&nbsp;</p>
                        </div>
                    </Link>
                </div>
            )}
        </div>
    );
  };
  
  return (
    <div className="w-full">
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
      <Dialog open={isListingDialogOpen} onOpenChange={setIsListingDialogOpen}>
        <DialogContent className="p-0 flex flex-col h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl">
            <DialogHeader className="p-6 pb-0 shrink-0">
                <DialogTitle className="text-2xl font-bold">Create a New Listing</DialogTitle>
                <DialogDescription>Select a category and fill in the details for your auction.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 px-6">
                <ScrollArea className="h-full w-full pr-6 -mr-6">
                    <NewListingFlow
                        initialCategory={(activeTab === 'categories' && categoryFilter !== 'all') ? categoryFilter : undefined}
                        onSuccess={() => {
                            setIsListingDialogOpen(false);
                        }}
                    />
                </ScrollArea>
            </div>
        </DialogContent>
      </Dialog>

       <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="sticky top-0 z-30 w-full border-b bg-card">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center mr-6 pr-4">
                    <Link href="/home" className="flex items-center space-x-2 mr-6">
                        <span className="font-extrabold tracking-tight font-headline text-2xl text-primary">Ubid</span>
                    </Link>
                </div>
                 <div className="hidden md:block">
                     <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                        <TabsTrigger value="home">Home</TabsTrigger>
                        <TabsTrigger value="categories">Categories</TabsTrigger>
                    </TabsList>
                </div>
                <div className="flex flex-1 items-center justify-end gap-2">
                    {/* Mobile Actions */}
                    <div className="flex items-center gap-2 md:hidden">
                        <Button size="sm" variant="outline" className="text-primary border-primary font-bold hover:text-primary hover:bg-primary/10 gap-1 px-2" onClick={() => setIsListingDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add item
                        </Button>
                        <NotificationBell />
                    </div>
                    
                    {/* Desktop items */}
                    <div className="hidden md:flex items-center gap-2">
                        <Button asChild size="sm" variant="outline" className="text-primary border-primary font-bold hover:text-primary hover:bg-primary/10 gap-1 px-2">
                            <Link href="/retailer/new-listing?from=home">
                                <Plus className="h-4 w-4" />
                                Add item
                            </Link>
                        </Button>
                        <NotificationBell />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                    <Avatar className="h-9 w-9">
                                        {(userProfile?.photoURL || user.photoURL) && <AvatarImage src={userProfile?.photoURL || user.photoURL!} />}
                                        <AvatarFallback>{user.displayName ? getInitials(user.displayName) : 'U'}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{user.displayName}</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                    {user.email}
                                    </p>
                                </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuItem asChild>
                                        <Link href="/profile"><User className="mr-2 h-4 w-4" /><span>Profile</span></Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/my-bids"><Gavel className="mr-2 h-4 w-4" /><span>My Bids</span></Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/retailer/dashboard"><LayoutGrid className="mr-2 h-4 w-4" /><span>My Listings</span></Link>
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
            <div className="md:hidden">
                <TabsList className="grid w-full grid-cols-2 rounded-none">
                    <TabsTrigger value="home">Home</TabsTrigger>
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                </TabsList>
            </div>
        </div>
        
        <TabsContent value="home">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-12">
                    <section>
                        <Link href="/top-picks" className="flex justify-between items-center mb-6 group">
                            <h2 className="text-xl font-bold font-headline group-hover:text-primary transition-colors">Top Picks For Today</h2>
                            <ChevronRight className="w-5 h-5 text-foreground transition-colors group-hover:text-primary" />
                        </Link>
                        {renderAuctionRow(topPicks, areAllListingsLoading, "/top-picks")}
                    </section>
                    <section>
                        <Link href="/promoted" className="flex justify-between items-center mb-6 group">
                            <h2 className="text-xl font-bold font-headline group-hover:text-primary transition-colors">Promoted Listings</h2>
                            <ChevronRight className="w-5 h-5 text-foreground transition-colors group-hover:text-primary" />
                        </Link>
                        {renderAuctionRow(promotedItems, areAllListingsLoading, "/promoted")}
                    </section>
                    <section>
                        <Link href="/upcoming-auctions" className="flex justify-between items-center mb-6 group">
                            <h2 className="text-xl font-bold font-headline group-hover:text-primary transition-colors">Upcoming Auctions</h2>
                            <ChevronRight className="w-5 h-5 text-foreground transition-colors group-hover:text-primary" />
                        </Link>
                        {renderAuctionRow(upcomingItems, areAllListingsLoading, "/upcoming-auctions")}
                    </section>
                    <section>
                        <Link href="/flash-auctions" className="flex justify-between items-center mb-6 group">
                            <h2 className="text-xl font-bold font-headline group-hover:text-primary transition-colors">Flash Auctions</h2>
                            <ChevronRight className="w-5 h-5 text-foreground transition-colors group-hover:text-primary" />
                        </Link>
                        {renderAuctionRow(flashAuctionItems, areAllListingsLoading, "/flash-auctions")}
                    </section>
                    <section>
                        <Link href="/suggested" className="flex justify-between items-center mb-6 group">
                            <h2 className="text-xl font-bold font-headline group-hover:text-primary transition-colors">Suggested For You</h2>
                            <ChevronRight className="w-5 h-5 text-foreground transition-colors group-hover:text-primary" />
                        </Link>
                        {suggestedItems.length > 0 ? (
                            renderAuctionRow(suggestedItems, areAllListingsLoading, "/suggested")
                        ) : (
                            !areAllListingsLoading && (
                                <div className="flex overflow-x-auto pb-4 -mx-4 px-4">
                                    <div className="flex-shrink-0 w-full text-center py-16 bg-muted rounded-lg">
                                        <p className="text-muted-foreground">View some items to get personalized suggestions!</p>
                                    </div>
                                </div>
                            )
                        )}
                        {areAllListingsLoading && suggestedItems.length === 0 && (
                            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={index} className="w-[45vw] sm:w-48 shrink-0 flex flex-col cursor-pointer group h-full">
                                        <div className="p-0">
                                            <Skeleton className="w-full h-auto aspect-square rounded-lg"/>
                                        </div>
                                        <div className="p-3 space-y-2">
                                            <Skeleton className="h-5 w-3/4" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </TabsContent>

        <TabsContent value="categories">
            <div className="container mx-auto px-4 pt-8 pb-12">
                <div className="space-y-8">
                    <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center pt-4">
                        <h2 className="text-2xl font-bold font-headline">Explore Listings</h2>
                        <div className="relative w-full md:max-w-xs">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search all live items..."
                                className="w-full bg-background pl-10"
                                value={categorySearchTerm}
                                onChange={(e) => setCategorySearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant={categoryFilter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCategoryFilter('all')}
                            className="rounded-full px-4"
                        >
                            All
                        </Button>
                        {auctionCategories.map(cat => (
                            <Button
                                key={cat.type}
                                variant={categoryFilter === cat.type ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCategoryFilter(cat.type)}
                                className="rounded-full px-4"
                            >
                                <cat.icon className="mr-2 h-4 w-4" />
                                {cat.title === 'Iconic Items' ? 'Iconic' : cat.title === 'Casual Items' ? 'Casual' : cat.title}
                            </Button>
                        ))}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                        {renderAuctionGrid(filteredCategoryItems, areAllListingsLoading)}
                    </div>
                </div>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

    
