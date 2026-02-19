'use client';

import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, collection, updateDoc, query, where, DocumentData, deleteDoc, orderBy, writeBatch, collectionGroup, getDocs, getDoc } from "firebase/firestore";
import { Loader2, ShieldCheck, ShieldAlert, UserCheck, Package, Trash2, Search, Database, XCircle, Beaker } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";


// --- Type Definitions ---
type BaseListing = {
    id: string;
    userId: string;
    status: 'upcoming' | 'live' | 'completed';
    auctionStartDate: string;
    auctionEndDate: string;
    startingBid: number;
    currentBid: number;
    winnerId?: string;
};

type AlcoholListingData = { name: string; };
type OtherListingData = { itemName: string; };
type IconicListingData = { itemName: string; category: string; };
type ArtListingData = { itemName: string; category: string; };
type PlateListingData = { itemName: string; category: string; };
type PhoneNumberListingData = { itemName: string; category: string; };
type ApparelListingData = { itemName: string; category: string; };

type AnyListing = (
    (BaseListing & AlcoholListingData & { category: 'alcohol' }) |
    (BaseListing & OtherListingData & { category: 'others' }) |
    (BaseListing & IconicListingData & { category: 'iconics' }) |
    (BaseListing & ArtListingData & { category: 'art' }) |
    (BaseListing & PlateListingData & { category: 'plates' }) |
    (BaseListing & PhoneNumberListingData & { category: 'phoneNumbers' }) |
    (BaseListing & ApparelListingData & { category: 'apparels' })
);

type DBCollection = {
    name: string;
    data: DocumentData[] | null;
    isLoading: boolean;
};


// --- Database Browser Component ---
function DatabaseBrowser({ collections, onDeleteClick }: { collections: DBCollection[], onDeleteClick: (item: {id: string, collection: string, name: string}) => void }) {
    const [selectedCollectionName, setSelectedCollectionName] = useState(collections[0]?.name || '');
    const [dbSearchTerm, setDbSearchTerm] = useState('');

    // Reset search when collection changes
    useEffect(() => {
        setDbSearchTerm('');
    }, [selectedCollectionName]);

    const getDocName = (doc: DocumentData, collection: string) => {
        if (collection === 'users') return doc.displayName || doc.email || doc.id;
        return doc.name || doc.itemName || doc.subject || doc.id;
    }

    const renderDocumentTable = () => {
        const selectedCollection = collections.find(c => c.name === selectedCollectionName);

        if (!selectedCollection) {
            return <div className="text-center text-muted-foreground py-12"><p>Please select a collection.</p></div>;
        }

        const { data, isLoading, name } = selectedCollection;

        if (isLoading) {
            return <div className="flex justify-center items-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
        }
        if (!data || data.length === 0) {
            return <div className="text-center text-muted-foreground py-12"><p>No documents in the "{name}" collection.</p></div>;
        }
        
        const lowerCaseSearch = dbSearchTerm.toLowerCase();
        const filteredData = dbSearchTerm
            ? data.filter(doc => {
                // Check for common name/identifier fields
                const name = doc.name || doc.itemName || doc.displayName || doc.subject || doc.title || '';
                const email = doc.email || '';
                const id = doc.id || '';

                return name.toLowerCase().includes(lowerCaseSearch) ||
                       email.toLowerCase().includes(lowerCaseSearch) ||
                       id.toLowerCase().includes(lowerCaseSearch);
            })
            : data;
            
        if (filteredData.length === 0) {
            return <div className="text-center text-muted-foreground py-12"><p>No documents found matching your search.</p></div>;
        }

        return (
            <ScrollArea className="h-[600px] border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                        <TableRow>
                            <TableHead className="w-[250px]">Document ID</TableHead>
                            <TableHead>Data</TableHead>
                             <TableHead className="w-[100px] text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.map(doc => (
                            <TableRow key={doc.id}>
                                <TableCell className="font-mono text-xs align-top pt-3">{doc.id}</TableCell>
                                <TableCell>
                                    <pre className="text-xs bg-muted/30 p-2 rounded-md whitespace-pre-wrap break-all">
                                        {JSON.stringify(doc, null, 2)}
                                    </pre>
                                </TableCell>
                                <TableCell className="text-right align-top pt-3">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => onDeleteClick({ id: doc.id, collection: name, name: getDocName(doc, name) })}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="w-6 h-6" />
                    <span>Firestore Database</span>
                </CardTitle>
                <CardDescription>
                    Browse and delete raw data from your Firestore collections. Use with caution.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:max-w-xs">
                        <Select value={selectedCollectionName} onValueChange={setSelectedCollectionName}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a collection" />
                            </SelectTrigger>
                            <SelectContent>
                                {collections.map(c => (
                                    <SelectItem key={c.name} value={c.name} className="capitalize">
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email, ID..."
                            className="w-full bg-background shadow-sm pl-10"
                            value={dbSearchTerm}
                            onChange={(e) => setDbSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                {renderDocumentTable()}
            </CardContent>
        </Card>
    );
}

// This is the full dashboard component. It is ONLY rendered when admin status is confirmed.
function AdminDashboard({
    allListings, areAllListingsLoading,
    dbCollections
} : {
    allListings: AnyListing[], areAllListingsLoading: boolean,
    dbCollections: DBCollection[],
}) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [itemToDelete, setItemToDelete] = useState<{id: string, collection: string, name: string} | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [liveListings, setLiveListings] = useState<AnyListing[]>([]);
    const [upcomingListings, setUpcomingListings] = useState<AnyListing[]>([]);
    const [completedListings, setCompletedListings] = useState<AnyListing[]>([]);

    useEffect(() => {
        if (areAllListingsLoading) return;

        const now = new Date();
        const processedListings = allListings.map(listing => {
            const startDate = new Date(listing.auctionStartDate);
            const endDate = new Date(listing.auctionEndDate);
            let dynamicStatus: 'upcoming' | 'live' | 'completed' = listing.status;

            if (endDate <= now && listing.status !== 'completed') dynamicStatus = 'completed';
            else if (startDate <= now && endDate > now && listing.status !== 'live') dynamicStatus = 'live';
            
            return { ...listing, status: dynamicStatus };
        });

        setLiveListings(processedListings.filter(l => l.status === 'live').sort((a, b) => new Date(a.auctionEndDate).getTime() - new Date(b.auctionEndDate).getTime()));
        setUpcomingListings(processedListings.filter(l => l.status === 'upcoming').sort((a, b) => new Date(b.auctionStartDate).getTime() - new Date(b.auctionStartDate).getTime()));
        setCompletedListings(processedListings.filter(l => l.status === 'completed').sort((a, b) => new Date(b.auctionEndDate).getTime() - new Date(a.auctionEndDate).getTime()));
        
    }, [allListings, areAllListingsLoading]);
    
    const listingCollections = ['alcohol', 'others', 'iconics', 'art', 'plates', 'phoneNumbers', 'apparels'];

    // --- Handler functions ---
    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);

        const { collection, id, name } = itemToDelete;

        try {
            if (listingCollections.includes(collection)) {
                await handleDeleteListing(id, collection, name);
            } else if (collection === 'users') {
                await handleDeleteUser(id, name);
            } else {
                await deleteDoc(doc(firestore, collection, id));
                toast({ title: "Document Deleted", description: `Document ${id} from ${collection} has been deleted.` });
            }
        } catch (error: any) {
             toast({ variant: "destructive", title: "Deletion Failed", description: error.message || "An error occurred." });
        } finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
    }

    const handleDeleteListing = async (id: string, category: string, name: string) => {
        if (!firestore) return;
        
        let batch = writeBatch(firestore);
        let writeCount = 0;
        const commitBatch = async () => {
            await batch.commit();
            batch = writeBatch(firestore);
            writeCount = 0;
        };
        const addToBatch = (ref: DocumentData) => {
            batch.delete(ref);
            writeCount++;
            if (writeCount >= 499) commitBatch();
        };
        
        const bidsSnap = await getDocs(collection(firestore, category, id, 'bids'));
        for (const doc of bidsSnap.docs) addToBatch(doc.ref);
        
        const watchlistQuery = query(collectionGroup(firestore, 'watchlist'), where('itemId', '==', id));
        const watchlistSnap = await getDocs(watchlistQuery);
        for (const doc of watchlistSnap.docs) addToBatch(doc.ref);

        const bidsOnItemsQuery = query(collectionGroup(firestore, 'bidsOnItems'), where('itemId', '==', id));
        const bidsOnItemsSnap = await getDocs(bidsOnItemsQuery);
        for (const doc of bidsOnItemsSnap.docs) {
            const myBidsSnap = await getDocs(collection(firestore, doc.ref.path, 'myBids'));
            for (const myBidDoc of myBidsSnap.docs) addToBatch(myBidDoc.ref);
            addToBatch(doc.ref);
        }
        
        addToBatch(doc(firestore, category, id));
        if (writeCount > 0) await commitBatch();

        toast({ title: "Listing Removed", description: `"${name}" and all associated data have been removed.` });
    };

    const handleDeleteUser = async (userId: string, name: string) => {
        if (!firestore) return;

        let batch = writeBatch(firestore);
        let writeCount = 0;
        const commitBatch = async () => {
            if (writeCount > 0) {
                await batch.commit();
                batch = writeBatch(firestore);
                writeCount = 0;
            }
        };
        const addToBatch = (ref: DocumentData) => {
            batch.delete(ref);
            writeCount++;
            if (writeCount >= 499) commitBatch();
        };

        // 1. Delete core user documents
        const userDocRef = doc(firestore, 'users', userId);
        addToBatch(userDocRef);
        addToBatch(doc(firestore, 'leaderboard', userId));
        
        // 2. Delete other simple subcollections
        const otherSubcollections = ['watchlist', 'notifications', 'supportTickets'];
        for (const sub of otherSubcollections) {
            const subcollectionRef = collection(firestore, 'users', userId, sub);
            const subcollectionSnap = await getDocs(subcollectionRef);
            for (const doc of subcollectionSnap.docs) {
                addToBatch(doc.ref);
            }
        }

        // 3. Handle complex bidding data
        const bidsOnItemsRef = collection(firestore, 'users', userId, 'bidsOnItems');
        const bidsOnItemsSnap = await getDocs(bidsOnItemsRef);

        for (const bidsOnItemDoc of bidsOnItemsSnap.docs) {
            const itemData = bidsOnItemDoc.data();
            const itemId = bidsOnItemDoc.id;
            const category = itemData.category;

            // 3a. Delete public bids on the corresponding item
            if (category) {
                const userBidsOnItemQuery = query(collection(firestore, category, itemId, 'bids'), where('userId', '==', userId));
                const userBidsSnap = await getDocs(userBidsOnItemQuery);
                userBidsSnap.forEach(bidDoc => {
                    addToBatch(bidDoc.ref);
                });
            }
            
            // 3b. Delete the user's private records of their bids on this item
            const myBidsRef = collection(bidsOnItemDoc.ref, 'myBids');
            const myBidsSnap = await getDocs(myBidsRef);
            for (const myBidDoc of myBidsSnap.docs) {
                addToBatch(myBidDoc.ref);
            }
            // 3c. Delete the parent doc in bidsOnItems
            addToBatch(bidsOnItemDoc.ref);
        }

        // Commit any remaining writes in the batch
        await commitBatch();

        toast({ title: "User Data Deleted", description: `All Firestore data for ${name} has been deleted.` });
    };

    // --- JSX Rendering logic ---
    const getListingTitle = (listing: AnyListing) => {
        switch (listing.category) {
            case 'alcohol': return listing.name;
            case 'others': return listing.itemName;
            case 'iconics': return listing.itemName;
            case 'art': return listing.itemName;
            case 'plates': return listing.itemName;
            case 'phoneNumbers': return listing.itemName;
            case 'apparels': return listing.itemName;
            default: return 'Item';
        }
    }
    
    const filterListings = (listings: AnyListing[], search: string) => 
        listings.filter(listing =>
            getListingTitle(listing).toLowerCase().includes(search.toLowerCase())
    );

    const filteredLiveListings = filterListings(liveListings, searchTerm);
    const filteredUpcomingListings = filterListings(upcomingListings, searchTerm);
    const filteredCompletedListings = filterListings(completedListings, searchTerm);
    
    const renderListingTable = (listings: AnyListing[], emptyMessage: string) => {
        if (areAllListingsLoading) {
            return <div className="flex justify-center items-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
        }
        if (listings.length === 0) {
            return <div className="text-center text-muted-foreground py-12"><p>{searchTerm ? "No listings found for your search." : emptyMessage}</p></div>;
        }
        const getCategoryDisplayName = (category: string) => {
            if (category === 'phoneNumbers') return 'Phone Number';
            if (category === 'plates') return 'Car Plate';
            if (category.endsWith('s')) return category.charAt(0).toUpperCase() + category.slice(1, -1);
            return category.charAt(0).toUpperCase() + category.slice(1);
        }
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {listings.map(listing => {
                        const title = getListingTitle(listing);
                        return (
                            <TableRow key={`${listing.category}-${listing.id}`}>
                                <TableCell className="font-medium">{title}</TableCell>
                                <TableCell><Badge variant="outline" className="capitalize">{getCategoryDisplayName(listing.category)}</Badge></TableCell>
                                <TableCell>
                                    <Badge variant={listing.status === 'live' ? 'default' : listing.status === 'upcoming' ? 'secondary' : 'outline'} className="capitalize">{listing.status}</Badge>
                                </TableCell>
                                <TableCell>{format(new Date(listing.auctionEndDate), 'PP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setItemToDelete({id: listing.id, collection: listing.category, name: title})}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    }

    const renderAlertDialog = () => {
        if (!itemToDelete) return null;
        
        let title = "Are you absolutely sure?";
        let description, actionText = "Yes, delete it";

        if (itemToDelete.collection === 'users') {
            title = `Delete all data for ${itemToDelete.name}?`
            description = (
                <>
                This will permanently delete the user's profile, all bids, watchlist, and notifications.
                <span className="block mt-2 font-semibold text-destructive">
                    This does NOT delete their listings or authentication account.
                </span>
                 Listings must be deleted separately from the panel above. The user must be deleted from the Firebase Console to prevent them from logging in again. This action cannot be undone.
                </>
            );
            actionText = "Yes, delete user data";
        } else if (listingCollections.includes(itemToDelete.collection)) {
             description = `This action cannot be undone. This will permanently delete the listing for "${itemToDelete.name}" and all of its associated bids and watchlist data.`;
        } else {
             description = `This will permanently delete the document with ID "${itemToDelete.id}" from the "${itemToDelete.collection}" collection. This action cannot be undone.`;
        }


        return (
             <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                       {description}
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        {actionText}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )
    }
    
    return (
        <>
            {renderAlertDialog()}

            <div className="container mx-auto px-4 py-12 md:py-16 space-y-8">
                <header>
                    <h1 className="text-3xl md:text-4xl font-bold font-headline">Admin Dashboard</h1>
                    <p className="text-lg text-muted-foreground mt-1">Manage applications, approvals, and platform data.</p>
                </header>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Beaker className="w-6 h-6" />
                            <span>Developer Tools</span>
                        </CardTitle>
                        <CardDescription>
                            Tools for clearing and seeding test data. Use with caution.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/admin/data-tools">
                                Open Data Tools
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-6 h-6"/><span>Manage All Listings</span></CardTitle><CardDescription>Review, manage, and remove any listing on the platform.</CardDescription></CardHeader>
                    <CardContent>
                        <Tabs defaultValue="live" className="w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <TabsList className="grid w-full sm:w-auto grid-cols-3"><TabsTrigger value="live">Live</TabsTrigger><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger></TabsList>
                                <div className="relative w-full sm:max-w-xs">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search all listings..." className="w-full rounded-full bg-background shadow-sm pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                            <TabsContent value="live" className="mt-4">{renderListingTable(filteredLiveListings, "There are no live auctions.")}</TabsContent>
                            <TabsContent value="upcoming" className="mt-4">{renderListingTable(filteredUpcomingListings, "There are no upcoming listings.")}</TabsContent>
                            <TabsContent value="completed" className="mt-4">{renderListingTable(filteredCompletedListings, "There are no completed auctions yet.")}</TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                 <DatabaseBrowser collections={dbCollections} onDeleteClick={setItemToDelete} />
            </div>
        </>
    );
}

// This is the main page component. It ONLY handles auth and admin checks.
export default function AdminDashboardPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
    
    // Step 1: Perform auth and admin checks.
    const adminRef = useMemoFirebase(() => user ? doc(firestore, 'admins', user.uid) : null, [firestore, user]);
    const { data: admin, isLoading: isAdminLoading } = useDoc(adminRef);

    useEffect(() => {
        // Wait until all loading is false.
        if (isUserLoading || isAdminLoading) return;

        if (!user) {
            router.replace('/login');
        } else if (admin) {
            // Only if the user exists AND the admin doc exists, set verification to true.
            setIsVerifiedAdmin(true);
        } else {
            // If user exists but is not an admin, redirect.
            router.replace('/profile');
        }
    }, [user, admin, isUserLoading, isAdminLoading, router]);

    // Step 2: Conditionally define queries ONLY if the user is a verified admin.
    // All Listings Queries
    const allAlcoholQuery = useMemoFirebase(() => isVerifiedAdmin ? collection(firestore, 'alcohol') : null, [firestore, isVerifiedAdmin]);
    const { data: allAlcohol, isLoading: areAllAlcoholLoading } = useCollection(allAlcoholQuery);
    const allOthersQuery = useMemoFirebase(() => isVerifiedAdmin ? collection(firestore, 'others') : null, [firestore, isVerifiedAdmin]);
    const { data: allOthers, isLoading: areAllOthersLoading } = useCollection(allOthersQuery);
    const allIconicsQuery = useMemoFirebase(() => isVerifiedAdmin ? collection(firestore, 'iconics') : null, [firestore, isVerifiedAdmin]);
    const { data: allIconics, isLoading: areAllIconicsLoading } = useCollection(allIconicsQuery);
    const allArtQuery = useMemoFirebase(() => isVerifiedAdmin ? collection(firestore, 'art') : null, [firestore, isVerifiedAdmin]);
    const { data: allArt, isLoading: areAllArtLoading } = useCollection(allArtQuery);
    const allPlatesQuery = useMemoFirebase(() => isVerifiedAdmin ? collection(firestore, 'plates') : null, [firestore, isVerifiedAdmin]);
    const { data: allPlates, isLoading: areAllPlatesLoading } = useCollection(allPlatesQuery);
    const allPhoneNumbersQuery = useMemoFirebase(() => isVerifiedAdmin ? collection(firestore, 'phoneNumbers') : null, [firestore, isVerifiedAdmin]);
    const { data: allPhoneNumbers, isLoading: areAllPhoneNumbersLoading } = useCollection(allPhoneNumbersQuery);
    const allApparelsQuery = useMemoFirebase(() => isVerifiedAdmin ? collection(firestore, 'apparels') : null, [firestore, isVerifiedAdmin]);
    const { data: allApparels, isLoading: areAllApparelsLoading } = useCollection(allApparelsQuery);


    const [allListings, setAllListings] = useState<AnyListing[]>([]);
    const areAllListingsLoading = areAllAlcoholLoading || areAllOthersLoading || areAllIconicsLoading || areAllArtLoading || areAllPlatesLoading || areAllPhoneNumbersLoading || areAllApparelsLoading;

    // Process all listings
    useEffect(() => {
        if (!isVerifiedAdmin) return;
        if (areAllListingsLoading) return;

        const combinedListings: AnyListing[] = [];
        allAlcohol?.forEach((item: any) => combinedListings.push({ ...item, category: 'alcohol' }));
        allOthers?.forEach((item: any) => combinedListings.push({ ...item, category: 'others' }));
        allIconics?.forEach((item: any) => combinedListings.push({ ...item, category: 'iconics' }));
        allArt?.forEach((item: any) => combinedListings.push({ ...item, category: 'art' }));
        allPlates?.forEach((item: any) => combinedListings.push({ ...item, category: 'plates' }));
        allPhoneNumbers?.forEach((item: any) => combinedListings.push({ ...item, category: 'phoneNumbers' }));
        allApparels?.forEach((item: any) => combinedListings.push({ ...item, category: 'apparels' }));
        setAllListings(combinedListings);
    }, [isVerifiedAdmin, allAlcohol, allOthers, allIconics, allArt, allPlates, allPhoneNumbers, allApparels, areAllListingsLoading]);


    // Database Browser Queries
    const usersQuery = useMemoFirebase(() => isVerifiedAdmin ? collection(firestore, 'users') : null, [firestore, isVerifiedAdmin]);
    const { data: usersData, isLoading: areUsersLoading } = useCollection(usersQuery);

    const chatsQuery = useMemoFirebase(() => isVerifiedAdmin ? collection(firestore, 'chats') : null, [firestore, isVerifiedAdmin]);
    const { data: chatsData, isLoading: areChatsLoading } = useCollection(chatsQuery);

    const adminsCollectionQuery = useMemoFirebase(() => isVerifiedAdmin ? collection(firestore, 'admins') : null, [firestore, isVerifiedAdmin]);
    const { data: adminsData, isLoading: areAdminsLoading } = useCollection(adminsCollectionQuery);
    

    const dbCollections: DBCollection[] = [
        { name: 'users', data: usersData, isLoading: areUsersLoading },
        { name: 'admins', data: adminsData, isLoading: areAdminsLoading },
        { name: 'chats', data: chatsData, isLoading: areChatsLoading },
        { name: 'alcohol', data: allAlcohol, isLoading: areAllAlcoholLoading },
        { name: 'art', data: allArt, isLoading: areAllArtLoading },
        { name: 'others', data: allOthers, isLoading: areAllOthersLoading },
        { name: 'iconics', data: allIconics, isLoading: areAllIconicsLoading },
        { name: 'plates', data: allPlates, isLoading: areAllPlatesLoading },
        { name: 'phoneNumbers', data: allPhoneNumbers, isLoading: areAllPhoneNumbersLoading },
        { name: 'apparels', data: allApparels, isLoading: areAllApparelsLoading },
    ].sort((a, b) => a.name.localeCompare(b.name));


    // Step 3: Render a loader until verification is complete.
    if (!isVerifiedAdmin) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    // Step 4: Only when user is a verified admin, render the dashboard with the fetched data.
    return <AdminDashboard 
        allListings={allListings}
        areAllListingsLoading={areAllListingsLoading}
        dbCollections={dbCollections}
    />;
}

  
