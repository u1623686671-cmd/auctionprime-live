
'use client';

import * as React from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, query, orderBy, doc, collectionGroup, limit } from "firebase/firestore";
import Image from "next/image";
import { Loader2, ArrowLeft, Trophy, Medal, Gavel, Crown, Award, TrendingUp, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import Loading from "./loading";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LebanesePlateDisplay } from "@/components/auctions/lebanese-plate-display";
import { PhoneNumberDisplay } from "@/components/auctions/phone-number-display";

// --- Types ---
type UserProfile = {
    displayName: string;
    photoURL?: string;
}

type BaseListing = {
    id: string;
    userId: string; // Seller's ID
    bidCount: number;
    imageUrls?: string[];
    name?: string; 
    itemName?: string; 
    subcategory?: string; 
    category?: string; 
};

type AnyListing = BaseListing & {
    collection: 'alcohol' | 'art' | 'apparels' | 'others' | 'iconics' | 'plates' | 'phoneNumbers';
}

type BidDoc = {
    id: string;
    userId: string; // Bidder's ID
    bidderName: string;
    amount: number;
};

// --- Sub-components ---

// Generic component for user rankings
const UserLineItem = ({ rank, user, value, valueLabel }: { rank: number; user: { uid: string, displayName?: string, photoURL?: string }, value: number, valueLabel: string }) => {
    let rankContent;
    if (rank === 1) rankContent = <Medal className="h-7 w-7 text-amber-400" />;
    else if (rank === 2) rankContent = <Medal className="h-7 w-7 text-slate-400" />;
    else if (rank === 3) rankContent = <Medal className="h-7 w-7 text-amber-700" />;
    else rankContent = <span className="font-bold text-lg">{rank}</span>;

    const getInitials = (name: string | undefined) => {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length > 1 && names[0] && names[names.length - 1]) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return name ? name.substring(0, 2).toUpperCase() : 'U';
    }

    return (
        <div className={cn("flex items-center justify-between gap-4 p-4")}>
            <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center font-bold text-muted-foreground shrink-0">{rankContent}</div>
                <Avatar>
                    {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName} />}
                    <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-foreground">{user.displayName?.split(' ')[0] || 'Anonymous'}</p>
                </div>
            </div>
            <div className="text-right">
                <p className="font-bold text-lg text-primary">{value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{valueLabel}</p>
            </div>
        </div>
    )
}

const TopListingItem = ({ listing, rank }: { listing: AnyListing, rank: number }) => {
    const getTitleAndCategory = useCallback(() => {
        let title, catDisplay;
        switch (listing.collection) {
            case 'alcohol': title = listing.name; catDisplay = "Alcohol"; break;
            case 'art': title = listing.itemName; catDisplay = "Art"; break;
            case 'iconics': title = listing.itemName; catDisplay = "Iconic"; break;
            case 'others': title = listing.itemName; catDisplay = "Other"; break;
            case 'apparels': title = listing.itemName; catDisplay = "Apparel"; break;
            case 'plates': title = listing.itemName; catDisplay = "Car Plate"; break;
            case 'phoneNumbers': title = listing.itemName; catDisplay = "Phone Number"; break;
            default: title = 'Item'; catDisplay = 'General';
        }
        return { title, catDisplay };
    }, [listing]);

    const { title, catDisplay } = getTitleAndCategory();
    const isPlate = listing.collection === 'plates';
    const isPhoneNumber = listing.collection === 'phoneNumbers';
    const imageUrl = !isPlate && !isPhoneNumber ? (listing.imageUrls?.[0] || '') : '';

    let rankContent;
    if (rank === 1) rankContent = <Medal className="h-7 w-7 text-amber-400" />;
    else if (rank === 2) rankContent = <Medal className="h-7 w-7 text-slate-400" />;
    else if (rank === 3) rankContent = <Medal className="h-7 w-7 text-amber-700" />;
    else rankContent = <span className="font-bold text-lg">{rank}</span>;

    return (
        <div className={cn("flex items-center justify-between gap-4 p-4")}>
            <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center font-bold text-muted-foreground shrink-0">{rankContent}</div>
                <Link href={`/${listing.collection}/${listing.id}`} className="flex items-center gap-4 group">
                    <div className="relative w-12 h-12 rounded-md overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                        {isPlate ? <LebanesePlateDisplay plateNumber={title || ''} />
                         : isPhoneNumber ? <PhoneNumberDisplay phoneNumber={title || ''} />
                         : imageUrl ? <Image src={imageUrl} alt={title || ''} fill className="object-cover" />
                         : <Gavel className="w-6 h-6 text-muted-foreground m-auto" />}
                    </div>
                    <div>
                        <p className="font-semibold text-foreground group-hover:underline">{title}</p>
                        <p className="text-sm text-muted-foreground">{catDisplay}</p>
                    </div>
                </Link>
            </div>
            <div className="text-right">
                <p className="font-bold text-lg text-primary">{listing.bidCount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Bids</p>
            </div>
        </div>
    );
};

const SellerLineItem = ({ rank, sellerData }: { rank: number; sellerData: { uid: string, totalBids: number } }) => {
    const firestore = useFirestore();
    const userProfileRef = useMemoFirebase(() => firestore ? doc(firestore, 'users', sellerData.uid) : null, [firestore, sellerData.uid]);
    const { data: userProfile, isLoading } = useDoc<UserProfile>(userProfileRef);

    if (isLoading || !userProfile) {
        return (
            <div className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 shrink-0" />
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="space-y-1">
                        <Skeleton className="h-5 w-24" />
                    </div>
                </div>
                <div className="text-right">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-3 w-12 mt-1 ml-auto" />
                </div>
            </div>
        )
    }

    const userForDisplay = {
        uid: sellerData.uid,
        displayName: userProfile.displayName.split(' ')[0], // first name
        photoURL: userProfile.photoURL,
    }

    return (
        <UserLineItem rank={rank} user={userForDisplay} value={sellerData.totalBids} valueLabel="Total Bids" />
    )
}

// --- Main Page Component ---
export default function HallOfFamePage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isAllowed, setIsAllowed] = useState(false);
    
    const fromProfile = searchParams.get('from') === 'profile';

    useEffect(() => {
        if (isUserLoading) return;
        if (!user) {
            router.replace('/login');
            return;
        }
        setIsAllowed(true);
    }, [isUserLoading, user, router]);

    // Queries for all listing types
    const alcoholQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'alcohol')) : null, [firestore]);
    const { data: alcohol, isLoading: areAlcoholLoading } = useCollection<BaseListing>(alcoholQuery);
    const artQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'art')) : null, [firestore]);
    const { data: art, isLoading: areArtLoading } = useCollection<BaseListing>(artQuery);
    const apparelsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'apparels')) : null, [firestore]);
    const { data: apparels, isLoading: areApparelsLoading } = useCollection<BaseListing>(apparelsQuery);
    const othersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'others')) : null, [firestore]);
    const { data: others, isLoading: areOthersLoading } = useCollection<BaseListing>(othersQuery);
    const iconicsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'iconics')) : null, [firestore]);
    const { data: iconics, isLoading: areIconicsLoading } = useCollection<BaseListing>(iconicsQuery);
    const platesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'plates')) : null, [firestore]);
    const { data: plates, isLoading: arePlatesLoading } = useCollection<BaseListing>(platesQuery);
    const phoneNumbersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'phoneNumbers')) : null, [firestore]);
    const { data: phoneNumbers, isLoading: arePhoneNumbersLoading } = useCollection<BaseListing>(phoneNumbersQuery);

    // Query for all bids
    const allBidsQuery = useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'bids')) : null, [firestore]);
    const { data: allBids, isLoading: areBidsLoading } = useCollection<BidDoc>(allBidsQuery);

    const areListingsLoading = areAlcoholLoading || areArtLoading || areApparelsLoading || areOthersLoading || areIconicsLoading || arePlatesLoading || arePhoneNumbersLoading;
    const isStatLoading = areListingsLoading || areBidsLoading;
    
    const [topSellers, setTopSellers] = useState<{uid: string, totalBids: number}[]>([]);
    
    // --- Data Processing ---
    const allListings = useMemo(() => {
        if (areListingsLoading) return [];
        const combined: AnyListing[] = [
            ...(alcohol?.map(item => ({ ...item, collection: 'alcohol' as const })) || []),
            ...(art?.map(item => ({ ...item, collection: 'art' as const })) || []),
            ...(apparels?.map(item => ({ ...item, collection: 'apparels' as const })) || []),
            ...(others?.map(item => ({ ...item, collection: 'others' as const })) || []),
            ...(iconics?.map(item => ({ ...item, collection: 'iconics' as const })) || []),
            ...(plates?.map(item => ({ ...item, collection: 'plates' as const })) || []),
            ...(phoneNumbers?.map(item => ({ ...item, collection: 'phoneNumbers' as const })) || []),
        ];
        return combined;
    }, [alcohol, art, apparels, others, iconics, plates, phoneNumbers, areListingsLoading]);

     useEffect(() => {
        if (areListingsLoading) return;
        const sellerStats: Record<string, number> = {};
        allListings.forEach(listing => {
            if(listing.userId) {
                sellerStats[listing.userId] = (sellerStats[listing.userId] || 0) + (listing.bidCount || 0);
            }
        });
        const sortedSellers = Object.entries(sellerStats)
            .sort(([, aBids], [, bBids]) => bBids - aBids)
            .slice(0, 10)
            .map(([uid, totalBids]) => ({
                uid,
                totalBids,
            }));
        setTopSellers(sortedSellers);
    }, [allListings, areListingsLoading]);

    const topListings = useMemo(() => {
        return allListings
            .sort((a, b) => (b.bidCount || 0) - (a.bidCount || 0))
            .slice(0, 10);
    }, [allListings]);

    const topBidders = useMemo(() => {
        if (areBidsLoading) return [];
        const bidderStats: Record<string, { count: number; name: string }> = {};
        allBids?.forEach(bid => {
            if(bid.userId) {
                if (!bidderStats[bid.userId]) {
                    bidderStats[bid.userId] = { count: 0, name: bid.bidderName || 'Anonymous' };
                }
                bidderStats[bid.userId].count++;
            }
        });
        return Object.entries(bidderStats)
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 10)
            .map(([uid, data]) => ({
                uid,
                displayName: data.name.split(' ')[0],
                photoURL: undefined, 
                bidCount: data.count,
            }));
    }, [allBids, areBidsLoading]);


    // --- Render Logic ---

    if (!isAllowed || isUserLoading) {
        return <Loading />;
    }

    const renderList = (
        data: any[] | null | undefined, 
        isLoading: boolean, 
        CardIcon: React.ElementType, 
        cardTitle: string, 
        cardDescription: string,
        emptyIcon: React.ElementType,
        emptyTitle: string,
        emptyDescription: string,
        renderItem: (item: any, index: number) => React.ReactNode
    ) => (
         <Card className="shadow-lg border-0 bg-card">
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-headline"><CardIcon className="w-6 h-6 text-primary"/>{cardTitle}</CardTitle>
                <CardDescription>{cardDescription}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading && <div className="p-4"><Skeleton className="h-40 w-full" /></div>}
                 {!isLoading && data && data.length > 0 && (
                     <div className="divide-y">
                        {data.map(renderItem)}
                     </div>
                 )}
                  {!isLoading && (!data || data.length === 0) && (
                     <div className="text-center text-muted-foreground py-20 px-4">
                        {React.createElement(emptyIcon, { className: "mx-auto h-24 w-24 text-muted-foreground/20 mb-4" })}
                        <h3 className="text-xl font-semibold text-foreground">{emptyTitle}</h3>
                        <p>{emptyDescription}</p>
                    </div>
                )}
            </CardContent>
         </Card>
    );

    return (
        <div className="container mx-auto max-w-4xl px-4 py-12 md:py-16">
             {fromProfile && (
                <div className="mb-6">
                    <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
                        <Link href="/profile">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            )}
            <header className="mb-12">
                <h1 className="text-4xl md:text-5xl font-bold font-headline mb-2">
                    Leaderboards
                </h1>
                <p className="text-lg text-muted-foreground">
                    Tracking this week's top performers. All scores are refreshed weekly.
                </p>
            </header>

            <div className="space-y-12">
                 {renderList(
                    topSellers,
                    areListingsLoading,
                    Award,
                    "Top 10 Vendors",
                    "Vendors whose items have received the most bids.",
                    Award,
                    "No Vendors Yet",
                    "When vendors' items get popular, they'll appear here.",
                    (seller, index) => (
                        <SellerLineItem key={seller.uid} rank={index + 1} sellerData={seller} />
                    )
                )}
                {renderList(
                    topListings,
                    areListingsLoading,
                    Crown,
                    "Top 10 Listings",
                    "The most popular items based on the total number of bids.",
                    Gavel,
                    "No Bids Yet",
                    "Once auctions start getting bids, the most popular ones will appear here.",
                    (listing, index) => (
                        <TopListingItem key={listing.id} listing={listing} rank={index + 1} />
                    )
                )}
                {renderList(
                    topBidders,
                    isStatLoading,
                    TrendingUp,
                    "Top 10 Bidders",
                    "Users who have placed the most bids across all auctions.",
                    TrendingUp,
                    "No Bidders Yet",
                    "When users start bidding, the most active ones will show up here.",
                    (bidder, index) => (
                        <UserLineItem key={bidder.uid} rank={index + 1} user={bidder} value={bidder.bidCount} valueLabel="Bids Placed" />
                    )
                )}
            </div>
        </div>
    );
}

    