

'use client';

import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, collection, query, where, deleteDoc, runTransaction, getDoc, updateDoc } from "firebase/firestore";
import { Loader2, Plus, Package, MessageSquare, Trash2, Search, Gem, Palette, CreditCard, Phone, ArrowLeft, Shirt, X, Clock, Coins, LogIn, Info, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format, addHours } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ChatWithWinnerButton } from "@/components/retailer/chat-with-winner-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { createOneTimeCheckoutSession } from "@/lib/stripe/actions";


// --- Type Definitions for Listings ---
type BaseListing = {
    id: string;
    userId: string;
    status: 'upcoming' | 'live' | 'completed';
    auctionStartDate: string;
    auctionEndDate: string;
    startingBid: number;
    currentBid: number;
    isFlashAuction?: boolean;
    extendCount?: number;
    isPromoted?: boolean;
};

type AlcoholListingData = { name: string };
type CasualListingData = { itemName: string };
type IconicListingData = { itemName: string; };
type ArtListingData = { itemName: string; };
type PlateListingData = { itemName: string; };
type PhoneNumberListingData = { itemName: string; };
type ApparelListingData = { itemName: string; };


type AlcoholListing = BaseListing & AlcoholListingData & { category: 'alcohol'; };
type CasualListing = BaseListing & CasualListingData & { category: 'casuals'; };
type IconicListing = BaseListing & IconicListingData & { category: 'iconics'; };
type ArtListing = BaseListing & ArtListingData & { category: 'art'; };
type PlateListing = BaseListing & PlateListingData & { category: 'plates'; };
type PhoneNumberListing = BaseListing & PhoneNumberListingData & { category: 'phoneNumbers'; };
type ApparelListing = BaseListing & ApparelListingData & { category: 'apparels'; };


type AnyListing = AlcoholListing | CasualListing | IconicListing | ArtListing | PlateListing | PhoneNumberListing | ApparelListing;


export default function MyListingsPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isAllowed, setIsAllowed] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{id: string, category: string, name: string} | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [extendingItemId, setExtendingItemId] = useState<string | null>(null);
    const [boostingItemId, setBoostingItemId] = useState<string | null>(null);

    const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile, isLoading: isUserProfileLoading } = useDoc(userProfileRef);

    
    // --- Queries for all listing types ---
    const alcoholQuery = useMemoFirebase(() => user ? query(collection(firestore, 'alcohol'), where('userId', '==', user.uid)) : null, [firestore, user]);
    const { data: alcohol, isLoading: areAlcoholLoading } = useCollection<AlcoholListingData & BaseListing>(alcoholQuery);

    const casualsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'casuals'), where('userId', '==', user.uid)) : null, [firestore, user]);
    const { data: casuals, isLoading: areCasualsLoading } = useCollection<CasualListingData & BaseListing>(casualsQuery);

    const iconicsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'iconics'), where('userId', '==', user.uid)) : null, [firestore, user]);
    const { data: iconics, isLoading: areIconicsLoading } = useCollection<IconicListingData & BaseListing>(iconicsQuery);

    const artQuery = useMemoFirebase(() => user ? query(collection(firestore, 'art'), where('userId', '==', user.uid)) : null, [firestore, user]);
    const { data: art, isLoading: areArtLoading } = useCollection<ArtListingData & BaseListing>(artQuery);

    const platesQuery = useMemoFirebase(() => user ? query(collection(firestore, 'plates'), where('userId', '==', user.uid)) : null, [firestore, user]);
    const { data: plates, isLoading: arePlatesLoading } = useCollection<PlateListingData & BaseListing>(platesQuery);
    
    const phoneNumbersQuery = useMemoFirebase(() => user ? query(collection(firestore, 'phoneNumbers'), where('userId', '==', user.uid)) : null, [firestore, user]);
    const { data: phoneNumbers, isLoading: arePhoneNumbersLoading } = useCollection<PhoneNumberListingData & BaseListing>(phoneNumbersQuery);

    const apparelsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'apparels'), where('userId', '==', user.uid)) : null, [firestore, user]);
    const { data: apparels, isLoading: areApparelsLoading } = useCollection<ApparelListingData & BaseListing>(apparelsQuery);


    const areListingsLoading = areAlcoholLoading || areCasualsLoading || areIconicsLoading || areArtLoading || arePlatesLoading || arePhoneNumbersLoading || areApparelsLoading;
    
    // --- State for combined listings ---
    const [liveListings, setLiveListings] = useState<AnyListing[]>([]);
    const [upcomingListings, setUpcomingListings] = useState<AnyListing[]>([]);
    const [completedListings, setCompletedListings] = useState<AnyListing[]>([]);


    useEffect(() => {
        if (isUserLoading || isUserProfileLoading) return;

        if (!user) {
            router.replace('/login');
            return;
        }
        
        setIsAllowed(true);

    }, [isUserLoading, isUserProfileLoading, user, router]);

    // --- Effect to combine and process all listings ---
    useEffect(() => {
        if (areListingsLoading) return;

        const allListings: AnyListing[] = [];
        alcohol?.forEach(item => allListings.push({ ...item, category: 'alcohol' }));
        casuals?.forEach(item => allListings.push({ ...item, category: 'casuals' }));
        iconics?.forEach(item => allListings.push({ ...item, category: 'iconics' }));
        art?.forEach(item => allListings.push({ ...item, category: 'art' }));
        plates?.forEach(item => allListings.push({ ...item, category: 'plates' }));
        phoneNumbers?.forEach(item => allListings.push({ ...item, category: 'phoneNumbers' }));
        apparels?.forEach(item => allListings.push({ ...item, category: 'apparels' }));

        const now = new Date();
        
        const processedListings = allListings.map(listing => {
            const startDate = new Date(listing.auctionStartDate);
            const endDate = new Date(listing.auctionEndDate);
            let dynamicStatus: 'upcoming' | 'live' | 'completed' = listing.status;

            if (endDate <= now) {
                dynamicStatus = 'completed';
            } else if (startDate <= now) {
                dynamicStatus = 'live';
            } else {
                dynamicStatus = 'upcoming';
            }
            return { ...listing, status: dynamicStatus };
        });

        const live = processedListings.filter(l => l.status === 'live');
        const upcoming = processedListings.filter(l => l.status === 'upcoming');
        const completed = processedListings.filter(l => l.status === 'completed');

        setLiveListings(live.sort((a, b) => new Date(a.auctionEndDate).getTime() - new Date(b.auctionEndDate).getTime()));
        setUpcomingListings(upcoming.sort((a, b) => new Date(a.auctionStartDate).getTime() - new Date(b.auctionStartDate).getTime()));
        setCompletedListings(completed.sort((a, b) => new Date(b.auctionEndDate).getTime() - new Date(a.auctionEndDate).getTime()));
        
    }, [alcohol, casuals, iconics, art, plates, phoneNumbers, apparels, areListingsLoading]);


    const getListingTitle = (listing: AnyListing) => {
        switch (listing.category) {
            case 'alcohol': return listing.name;
            case 'casuals':
            case 'iconics':
            case 'art':
            case 'plates':
            case 'phoneNumbers':
            case 'apparels':
                return listing.itemName;
        }
    }
    
    const handleDeleteListing = async () => {
        if (!itemToDelete || !firestore) return;

        const { id, category, name } = itemToDelete;
        const docRef = doc(firestore, category, id);

        try {
            await deleteDoc(docRef);
            toast({
                title: "Listing Removed",
                description: `"${name}" has been successfully removed.`,
            });
        } catch (error: any) {
             toast({
                variant: "destructive",
                title: "Removal Failed",
                description: error.message || "Could not remove the listing.",
            });
            console.error("Error removing listing:", error);
        } finally {
            setItemToDelete(null);
        }
    };
    
    const handleExtend = async (listing: AnyListing) => {
        if (!user || !firestore || !userProfile) return;
        
        setExtendingItemId(listing.id);
        
        const userRef = doc(firestore, 'users', user.uid);
        const itemRef = doc(firestore, listing.category, listing.id);
    
        try {
            await runTransaction(firestore, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                const itemDoc = await transaction.get(itemRef);
    
                if (!userDoc.exists() || !itemDoc.exists()) throw new Error("User or item not found");
    
                const currentTokens = userDoc.data().extendTokens || 0;
                if (currentTokens <= 0) throw new Error("No Extend Tokens left.");
                
                const currentItemData = itemDoc.data();
                const extendCount = currentItemData.extendCount || 0;
                if (extendCount >= 3) throw new Error("Max extensions reached for this item.");
    
                const currentEndDate = new Date(currentItemData.auctionEndDate);
                const newEndDate = addHours(currentEndDate, 1);
    
                transaction.update(userRef, { extendTokens: currentTokens - 1 });
                transaction.update(itemRef, {
                    extendCount: extendCount + 1,
                    auctionEndDate: newEndDate.toISOString(),
                });
            });
            toast({ variant: 'success', title: "Auction Extended", description: `1 hour has been added to "${getListingTitle(listing)}".` });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Extension Failed", description: e.message });
        } finally {
            setExtendingItemId(null);
        }
    }
    
    const handleBoostListing = async (listing: AnyListing) => {
        if (!user || !firestore || !userProfile) return;
        setBoostingItemId(listing.id);

        const userRef = doc(firestore, 'users', user.uid);
        const itemRef = doc(firestore, listing.category, listing.id);

        try {
            const hasFreePromotion = (userProfile.isPlusUser || userProfile.isUltimateUser) && (userProfile.promotionTokens || 0) > 0;

            if (hasFreePromotion) {
                await runTransaction(firestore, async (transaction) => {
                    const userDoc = await transaction.get(userRef);
                    if (!userDoc.exists()) throw new Error("User not found");
                    
                    const currentPromoTokens = userDoc.data().promotionTokens || 0;
                    if (currentPromoTokens <= 0) throw new Error("No promotion tokens left.");

                    transaction.update(userRef, { promotionTokens: currentPromoTokens - 1 });
                    transaction.update(itemRef, { isPromoted: true });
                });
                toast({
                    variant: 'success',
                    title: "Listing Promoted!",
                    description: `"${getListingTitle(listing)}" is now promoted using a free token.`,
                });
            } else {
                await createOneTimeCheckoutSession('boost', 1, { itemId: listing.id, itemCategory: listing.category });
            }
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "Boost Failed",
                description: e.message || "Could not promote the listing.",
            });
        } finally {
            setBoostingItemId(null);
        }
    };


    const filterListings = (listings: AnyListing[], search: string) => 
        listings.filter(listing =>
            getListingTitle(listing).toLowerCase().includes(search.toLowerCase())
        );

    const filteredLiveListings = filterListings(liveListings, searchTerm);
    const filteredUpcomingListings = filterListings(upcomingListings, searchTerm);
    const filteredCompletedListings = filterListings(completedListings, searchTerm);

    const handleItemSelect = (item: {id: string, category: string}) => {
        router.push(`/${item.category}/${item.id}`);
    };


    if (!isAllowed || isUserProfileLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    const renderListings = (listings: AnyListing[], emptyMessage: string) => {
        if (areListingsLoading) {
            return (
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            )
        }

        if (listings.length === 0) {
            return (
                 <div className="text-center text-muted-foreground py-12">
                    <p>{searchTerm ? "No listings found for your search." : emptyMessage}</p>
                </div>
            )
        }
        
        const getCategoryDisplayName = (category: string) => {
             if (category === 'phoneNumbers') return 'Phone Number';
             if (category === 'plates') return 'Car Plate';
             if (category.endsWith('s')) {
                return category.charAt(0).toUpperCase() + category.slice(1, -1);
            }
            return category.charAt(0).toUpperCase() + category.slice(1);
        }

        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {listings.map(listing => {
                    const title = getListingTitle(listing);
                    const isExtending = extendingItemId === listing.id;
                    const extendCount = listing.extendCount || 0;
                    const canExtend = (userProfile?.extendTokens || 0) > 0 && extendCount < 3;
                    const tokensLeft = userProfile?.extendTokens || 0;
                    const isBoosting = boostingItemId === listing.id;
                    const hasFreePromotion = (userProfile?.isPlusUser || userProfile?.isUltimateUser) && (userProfile?.promotionTokens || 0) > 0;
                    const promoTokensLeft = userProfile?.promotionTokens || 0;

                    return (
                        <Card key={listing.id}>
                            <div onClick={() => handleItemSelect({ id: listing.id, category: listing.category })} className="cursor-pointer">
                                <CardHeader>
                                    <CardTitle className="flex justify-between items-start text-base">
                                        <span className="font-medium break-words w-5/6">
                                            {title}
                                        </span>
                                        {listing.status === 'upcoming' && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-muted-foreground hover:text-destructive h-8 w-8 -mt-2 -mr-2 shrink-0"
                                                onClick={(e) => { e.stopPropagation(); setItemToDelete({id: listing.id, category: listing.category, name: title})}}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </CardTitle>
                                    <CardDescription>
                                        <Badge variant="outline" className="capitalize">{getCategoryDisplayName(listing.category)}</Badge>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground">Status</p>
                                        <Badge variant={
                                            listing.status === 'live' ? 'default' : 
                                            listing.status === 'upcoming' ? 'secondary' : 'outline'
                                        } className="capitalize">
                                            {listing.status}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Current Bid</p>
                                        <p className="font-semibold">${(listing.currentBid ?? 0).toLocaleString()}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-muted-foreground">End Date</p>
                                        <p>{format(new Date(listing.auctionEndDate), 'PPp')}</p>
                                    </div>
                                </CardContent>
                            </div>
                            <CardFooter className="p-4 pt-2">
                                <div className="w-full pt-4 border-t" onClick={(e) => e.stopPropagation()}>
                                    {listing.status !== 'completed' && listing.isPromoted && (
                                        <div className="mb-2 flex items-center justify-center gap-2 text-sky-500">
                                            <Zap className="h-5 w-5" />
                                            <span className="font-semibold text-sm">Boost Active</span>
                                        </div>
                                    )}
                                    {listing.status !== 'completed' && !listing.isPromoted && (
                                        <div className="mb-2">
                                                <div className="text-center text-xs text-muted-foreground mb-2">
                                                {hasFreePromotion ? (
                                                    <p>Promotions left: <span className="font-bold">{promoTokensLeft}</span></p>
                                                ) : (
                                                    <p>Promote this listing for $1.00.</p>
                                                )}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full border-sky-500 text-sky-500 hover:bg-sky-500/10 hover:text-sky-500 disabled:opacity-50"
                                                disabled={isBoosting}
                                                onClick={(e) => {e.stopPropagation(); handleBoostListing(listing);}}
                                            >
                                                {isBoosting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Zap className="h-4 w-4"/>}
                                                Promote
                                            </Button>
                                        </div>
                                    )}
                                    {listing.status === 'live' && (
                                        <div className="flex flex-col gap-2 w-full">
                                            <>
                                                <div className="text-center text-xs text-muted-foreground">
                                                    { extendCount >= 3 ? "Maximum extensions reached for this item." : 
                                                    tokensLeft > 0 ? `You can extend this auction by 1 hour. You have ${tokensLeft} token(s) left.` :
                                                    (<>Extend auction by 1 hour. <Link href="/profile/buy-tokens"><span className="font-semibold text-purple-600 hover:underline cursor-pointer">Buy tokens to extend.</span></Link></>)
                                                    }
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1 border-purple-600 text-purple-600 hover:bg-purple-600/10 hover:text-purple-600 disabled:opacity-50"
                                                        disabled={!canExtend || isExtending}
                                                        onClick={(e) => {e.stopPropagation(); handleExtend(listing);}}
                                                    >
                                                        {isExtending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Clock className="h-4 w-4"/>}
                                                        Extend
                                                    </Button>
                                                    <Button onClick={() => handleItemSelect({ id: listing.id, category: listing.category })} variant="secondary" size="sm" className="flex-1">
                                                        <LogIn className="h-4 w-4"/> View
                                                    </Button>
                                                </div>
                                            </>
                                        </div>
                                    )}
                                    {listing.status === 'completed' && (
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <ChatWithWinnerButton itemId={listing.id} itemCategory={listing.category} />
                                            </div>
                                            <Button onClick={() => handleItemSelect({ id: listing.id, category: listing.category })} variant="secondary" size="sm" className="flex-1">
                                                <LogIn className="h-4 w-4"/> View
                                            </Button>
                                        </div>
                                    )}
                                    {listing.status === 'upcoming' && (
                                        <Button onClick={() => handleItemSelect({ id: listing.id, category: listing.category })} variant="secondary" size="sm" className="w-full">
                                            <LogIn className="h-4 w-4"/> View Item
                                        </Button>
                                    )}
                                </div>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        )
    }
    
    return (
        <>
            <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the listing for "{itemToDelete?.name}".
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteListing} className="bg-destructive hover:bg-destructive/90">
                        Yes, delete it
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        
            <div className="container mx-auto px-4 py-12 md:py-16">
                <div className="mb-6">
                    <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
                        <Link href="/profile">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                    <div className="lg:col-span-3 order-2 lg:order-1">
                        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold font-headline">
                                    My Listings
                                </h1>
                                <p className="text-lg text-muted-foreground mt-1">
                                    Manage your auctions and view performance.
                                </p>
                            </div>
                            <Button asChild>
                                <Link href="/retailer/new-listing">
                                    <Plus className="mr-2 h-5 w-5" />
                                    Add item
                                </Link>
                            </Button>
                        </header>

                        <div className="lg:hidden mb-8">
                            <Link href="/profile/buy-tokens">
                                <Card className="shadow-sm">
                                    <CardContent className="p-3">
                                        <div className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <Coins className="h-6 w-6 text-primary" />
                                                <div>
                                                    <p className="font-semibold group-hover:text-primary transition-colors">Extend Tokens</p>
                                                    <p className="text-xs text-muted-foreground">Add 1 hour to a live auction</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xl font-bold text-primary">{userProfile?.extendTokens || 0}</p>
                                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </div>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                <Package className="w-6 h-6"/> 
                                <span>My Listings</span>
                                </CardTitle>
                                <CardDescription>Manage your auctions and view their status.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="live" className="w-full">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <TabsList className="grid w-full sm:w-auto grid-cols-3">
                                            <TabsTrigger value="live">Live</TabsTrigger>
                                            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                                            <TabsTrigger value="completed">Completed</TabsTrigger>
                                        </TabsList>
                                        <div className="relative w-full sm:max-w-xs">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search your listings..."
                                                className="w-full rounded-full bg-background shadow-sm pl-10"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <TabsContent value="live" className="mt-4">
                                        {renderListings(filteredLiveListings, "You have no live auctions.")}
                                    </TabsContent>
                                    <TabsContent value="upcoming" className="mt-4">
                                        {renderListings(filteredUpcomingListings, "You have no upcoming listings.")}
                                    </TabsContent>
                                    <TabsContent value="completed" className="mt-4">
                                        {renderListings(filteredCompletedListings, "You have no completed auctions yet.")}
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    </div>
                     <div className="lg:col-span-1 order-1 lg:order-2 space-y-4 hidden lg:block">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Coins className="w-5 h-5 text-primary"/>
                                    <span>Extend Tokens</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold text-center">{userProfile?.extendTokens || 0}</p>
                            </CardContent>
                            <CardFooter>
                                <Button asChild className="w-full" size="sm">
                                    <Link href="/profile/buy-tokens">Buy More Tokens</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    )
}
