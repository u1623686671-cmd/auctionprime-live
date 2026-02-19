'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, collection, query, where, getDocs, writeBatch, serverTimestamp, addDoc, Timestamp } from "firebase/firestore";
import { Loader2, ArrowLeft, Trash2, Sparkles, Beaker, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { addDays, addMinutes } from "date-fns";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const now = new Date();

const mockAuctionItems = [
  {
    category: 'art',
    itemName: 'Cosmic Dream',
    description: 'A vibrant abstract piece exploring the cosmos.',
    imageUrls: ['https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=2000&auto=format&fit=crop'],
    startingBid: 400,
    currentBid: 400,
    bidCount: 0,
    minimumBidIncrement: 10,
    auctionStartDate: addDays(now, -1).toISOString(),
    auctionEndDate: addDays(now, 3).toISOString(),
    status: 'live',
    artist: 'Jane Doe',
    subcategory: 'Painting',
  },
  {
    category: 'iconics',
    itemName: 'Galaxy Quest Original Script',
    description: 'An original, signed script from the classic sci-fi comedy.',
    imageUrls: ['https://images.unsplash.com/photo-1614849286521-4a16248a7252?q=80&w=1887&auto=format&fit=crop'],
    startingBid: 1200,
    currentBid: 1200,
    bidCount: 0,
    minimumBidIncrement: 50,
    auctionStartDate: addDays(now, -2).toISOString(),
    auctionEndDate: addDays(now, 1).toISOString(),
    status: 'live',
    celebrity: 'Sigourney Weaver',
  },
  {
    category: 'plates',
    itemName: 'T 333',
    startingBid: 5000,
    currentBid: 5000,
    bidCount: 0,
    minimumBidIncrement: 100,
    auctionStartDate: addDays(now, -4).toISOString(),
    auctionEndDate: addDays(now, 2).toISOString(),
    status: 'live',
    region: 'Beirut',
  },
  {
    category: 'apparels',
    itemName: 'Vintage Leather Jacket',
    description: 'A classic leather jacket in pristine condition.',
    imageUrls: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=1887&auto=format&fit=crop'],
    startingBid: 80,
    currentBid: 80,
    bidCount: 0,
    minimumBidIncrement: 5,
    auctionStartDate: now.toISOString(),
    auctionEndDate: addMinutes(now, 45).toISOString(),
    status: 'live',
    isFlashAuction: true,
    subcategory: 'Outerwear',
  },
  {
    category: 'alcohol',
    name: 'Yamazaki 18 Year',
    description: 'A rare and highly sought-after Japanese single malt whisky.',
    imageUrls: ['https://images.unsplash.com/photo-1527281400683-1aae777175f8?q=80&w=1887&auto=format&fit=crop'],
    startingBid: 1500,
    currentBid: 1500,
    bidCount: 0,
    minimumBidIncrement: 50,
    auctionStartDate: addDays(now, 1).toISOString(),
    auctionEndDate: addDays(now, 8).toISOString(),
    status: 'upcoming',
    age: 18,
    subcategory: 'Whiskey',
  },
  {
    category: 'phoneNumbers',
    itemName: '03 100 200',
    startingBid: 1000,
    currentBid: 1000,
    bidCount: 0,
    minimumBidIncrement: 50,
    auctionStartDate: addDays(now, 2).toISOString(),
    auctionEndDate: addDays(now, 9).toISOString(),
    status: 'upcoming',
    provider: 'Alfa',
  },
   {
    category: 'others',
    itemName: 'Retro Polaroid Camera',
    description: 'A fully functional vintage Polaroid 600 camera.',
    imageUrls: ['https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=2070&auto=format&fit=crop'],
    startingBid: 20,
    currentBid: 20,
    bidCount: 0,
    minimumBidIncrement: 5,
    auctionStartDate: addDays(now, 3).toISOString(),
    auctionEndDate: addDays(now, 10).toISOString(),
    status: 'upcoming',
  },
];


const collectionNames = ['alcohol', 'art', 'apparels', 'others', 'iconics', 'plates', 'phoneNumbers'];

function DataToolsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const [isClearing, setIsClearing] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);

    const handleClearListings = async () => {
        if (!user || !firestore) return;
        setIsClearing(true);
        let deletedCount = 0;

        try {
            const batch = writeBatch(firestore);
            
            for (const collectionName of collectionNames) {
                const q = query(collection(firestore, collectionName), where("userId", "==", user.uid));
                const querySnapshot = await getDocs(q);
                
                querySnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                    deletedCount++;
                });
            }

            if (deletedCount > 0) {
                await batch.commit();
            }
            
            toast({
                variant: 'success',
                title: "Listings Cleared",
                description: `Successfully deleted ${deletedCount} of your listings.`,
            });
            
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Clearing Failed",
                description: error.message || "An error occurred while clearing your listings.",
            });
        } finally {
            setIsClearing(false);
        }
    };
    
    const handleSeedData = async () => {
        if (!user || !firestore) return;
        setIsSeeding(true);

        try {
            const batch = writeBatch(firestore);

            for (const item of mockAuctionItems) {
                const collectionName = item.category;
                const newDocRef = doc(collection(firestore, collectionName));
                
                const dataToSeed: any = {
                    ...item,
                    userId: user.uid,
                };
                
                // Adjust field names for specific categories
                if (item.category === 'iconics' && (item as any).celebrity) {
                    dataToSeed.category = (item as any).celebrity;
                    delete dataToSeed.celebrity;
                } else if (item.category === 'art' && (item as any).artist) {
                    dataToSeed.category = (item as any).artist;
                    delete dataToSeed.artist;
                } else if (item.category === 'plates' && (item as any).region) {
                    dataToSeed.category = (item as any).region;
                    delete dataToSeed.region;
                } else if (item.category === 'phoneNumbers' && (item as any).provider) {
                    dataToSeed.category = (item as any).provider;
                    delete dataToSeed.provider;
                }

                batch.set(newDocRef, dataToSeed);
            }

            await batch.commit();
            
            toast({
                variant: 'success',
                title: "Sample Data Seeded",
                description: `Added ${mockAuctionItems.length} new example listings.`,
            });
            router.refresh();

        } catch (error: any) {
             toast({
                variant: "destructive",
                title: "Seeding Failed",
                description: error.message || "An error occurred while seeding data.",
            });
        } finally {
            setIsSeeding(false);
        }
    }


    return (
        <div className="container mx-auto px-4 py-12 md:py-16 space-y-8">
            <div className="mb-0 -mt-6">
                <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
                    <Link href="/admin/dashboard">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
            </div>

            <header className="!mt-0">
                <h1 className="text-3xl md:text-4xl font-bold font-headline">Data Tools</h1>
                <p className="text-lg text-muted-foreground mt-1">Clear your listings or seed new examples for testing.</p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary"/>Seed Example Listings</CardTitle>
                    <CardDescription>Populate your database with a set of diverse example auction items to test the application's UI and features. This will add items under your user account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleSeedData} disabled={isSeeding}>
                        {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Beaker className="mr-2 h-4 w-4" />}
                        {isSeeding ? 'Seeding Data...' : 'Seed Example Items'}
                    </Button>
                </CardContent>
            </Card>

             <Card className="border-destructive/50 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5"/>Clear Your Listings</CardTitle>
                    <CardDescription className="text-destructive/80">Permanently delete all active and upcoming auction listings created by you. This action cannot be undone.</CardDescription>
                </CardHeader>
                <CardContent>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isClearing}>
                                {isClearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                                Clear My Listings
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete all listings associated with your account ({user?.email}). This action cannot be undone.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearListings} className="bg-destructive hover:bg-destructive/90">
                                Yes, delete all my listings
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    );
}

// This parent component acts as a strict authorization gate.
export default function AdminDataToolsPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    const adminRef = useMemoFirebase(() => user ? doc(firestore, 'admins', user.uid) : null, [firestore, user]);
    const { data: admin, isLoading: isAdminLoading } = useDoc(adminRef);

    const isAuthorizationCheckLoading = isUserLoading || isAdminLoading;

    useEffect(() => {
        if (isAuthorizationCheckLoading) return;

        if (!user) {
            router.replace('/login');
            return;
        }

        if (admin) {
            setIsAuthorized(true);
        } else {
            router.replace('/profile');
        }
    }, [user, admin, isAuthorizationCheckLoading, router]);

    if (!isAuthorized) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return <DataToolsPage />;
}
