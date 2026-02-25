

'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Gavel, Search, Award, TrendingUp, TrendingDown, CircleHelp, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { collection, query, orderBy, doc } from "firebase/firestore";
import Loading from "./loading";
import { MyBidItemCard, type BidStatus } from "@/components/my-bids/my-bid-item-card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuctionDetailView } from "@/components/auctions/AuctionDetailView";
import { useIsMobile } from "@/hooks/use-mobile";

export type MyBidItem = {
    id: string; // this will be the itemId
    category: string;
    itemTitle: string;
    itemImageUrl: string;
    itemAuctionEndDate: string;
    lastUpdated: any;
};

const filterOptions = [
    { value: 'all', label: 'All Bids' },
    { value: 'winning', label: 'Winning' },
    { value: 'outbid', label: 'Outbid' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' },
];

export default function MyBidsPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const isMobile = useIsMobile();
    const [isAllowed, setIsAllowed] = useState(false);
    const [activeFilter, setActiveFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [itemStatuses, setItemStatuses] = useState<{[itemId: string]: BidStatus}>({});
    const [selectedItem, setSelectedItem] = useState<{ id: string, category: string } | null>(null);

    const myBidsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, `users/${user.uid}/bidsOnItems`), orderBy('lastUpdated', 'desc'));
    }, [firestore, user]);

    const { data: myBidItems, isLoading: areBidsLoading } = useCollection<MyBidItem>(myBidsQuery);

    const handleStatusUpdate = useCallback((itemId: string, status: BidStatus) => {
        setItemStatuses(prev => {
            if (prev[itemId] === status) return prev;
            return {...prev, [itemId]: status};
        });
    }, []);

    useEffect(() => {
        if (isUserLoading) return;

        if (!user) {
            router.replace('/login');
            return;
        }
        
        setIsAllowed(true);
    }, [isUserLoading, user, router]);

    const itemsToRender = useMemo(() => {
      if (!myBidItems) return [];
      // This is now the source of truth for rendering.
      return myBidItems.map(item => ({...item, status: itemStatuses[item.id] || 'Loading'}));
    }, [myBidItems, itemStatuses]);

    const filteredItems = useMemo(() => {
        return itemsToRender.filter(item => {
            // Never show deleted items
            if (item.status === 'Deleted') {
                return false;
            }

            // Filter by search term
            const titleMatch = item.itemTitle.toLowerCase().includes(searchTerm.toLowerCase());
            if (!titleMatch) return false;

            // If filter is 'all', show everything that matches search
            if (activeFilter === 'all') {
                return true;
            }
            
            // If we have a specific filter, only show items with that status
            const lowerCaseStatus = item.status ? item.status.toLowerCase() : '';
            return lowerCaseStatus === activeFilter;
        });
    }, [itemsToRender, activeFilter, searchTerm]);

    const noItemsExist = !areBidsLoading && (!myBidItems || myBidItems.length === 0);
    const noMatches = !areBidsLoading && filteredItems.length === 0 && (itemsToRender.length > 0 || searchTerm);


    if (!isAllowed || isUserLoading) {
        return <Loading />;
    }
  
  const handleItemSelect = (item: {id: string, category: string}) => {
    if (isMobile) {
      setSelectedItem(item);
    } else {
      router.push(`/${item.category}/${item.id}`);
    }
  };

  return (
    <>
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
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="mb-6">
          <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
              <Link href="/profile">
                <ArrowLeft className="h-5 w-5" />
              </Link>
          </Button>
      </div>
      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold font-headline mb-2">
          My Bids
        </h1>
        <p className="text-lg text-muted-foreground">
          Track your active bids and view your bidding history. May the highest bid be yours.
        </p>
      </header>
      
      <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Search your bids..."
                      className="w-full rounded-full bg-background shadow-sm pl-10 h-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              <div className="hidden md:block flex-grow" />
              <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full md:w-auto">
                  <TabsList className="grid w-full grid-cols-5">
                       {filterOptions.map(option => (
                          <TabsTrigger key={option.value} value={option.value}>
                              {option.label}
                          </TabsTrigger>
                      ))}
                  </TabsList>
              </Tabs>
          </div>

          {(areBidsLoading && itemsToRender.length === 0) ? <Loading /> : (
            <>
              {!noItemsExist && !noMatches ? (
                  <div className="grid grid-cols-1 gap-6">
                      {itemsToRender.map(item => (
                          <MyBidItemCard 
                              key={item.id}
                              item={item} 
                              status={item.status as BidStatus}
                              onStatusUpdate={handleStatusUpdate} 
                              onItemSelect={() => handleItemSelect({ id: item.id, category: item.category })}
                              className={cn(
                                !filteredItems.some(fi => fi.id === item.id) && 'hidden',
                              )}
                          />
                      ))}
                  </div>
              ) : null}

              {noMatches && (
                  <div className="text-center text-muted-foreground flex flex-col items-center gap-6 max-w-md mx-auto py-16">
                      <Search className="w-24 h-24 text-primary/10" />
                      <h2 className="text-2xl font-bold font-headline text-foreground">No Bids Found</h2>
                      {searchTerm ? (
                          <p>No items match your search for "{searchTerm}" with the selected filter.</p>
                      ) : (
                          <p>You have no bids with the status "{filterOptions.find(o => o.value === activeFilter)?.label}".</p>
                      )}
                  </div>
              )}
            </>
          )}

          {noItemsExist && (
              <div className="text-center text-muted-foreground flex flex-col items-center gap-6 max-w-md mx-auto py-16">
                  <Gavel className="w-24 h-24 text-primary/10" />
                  <h2 className="text-2xl font-bold font-headline text-foreground">You Haven't Placed Any Bids Yet</h2>
                  <p>Once you place a bid on an item, you'll be able to track its status and your bidding activity here.</p>
                  <Button asChild className="mt-4">
                      <Link href="/home">Explore Auctions</Link>
                  </Button>
              </div>
          )}
      </div>
    </div>
    </>
  );
}
