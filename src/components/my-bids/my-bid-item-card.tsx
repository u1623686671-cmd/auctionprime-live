
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { collection, query, orderBy, getDocs, where, addDoc, serverTimestamp, getDoc, setDoc, doc } from "firebase/firestore";
import { isPast } from "date-fns";
import { useRouter } from "next/navigation";

import type { MyBidItem } from "@/app/my-bids/page";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, TrendingUp, TrendingDown, Award, CircleHelp, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AuctionTimerBar } from "@/components/auctions/AuctionTimerBar";
import { LebanesePlateDisplay } from "../auctions/lebanese-plate-display";
import { PhoneNumberDisplay } from "../auctions/phone-number-display";

export type BidStatus = 'Winning' | 'Outbid' | 'Won' | 'Lost' | 'Ended' | 'Loading' | 'Deleted';

type MyBidItemCardProps = {
    item: MyBidItem;
    onStatusUpdate: (itemId: string, status: BidStatus) => void;
    onItemSelect: () => void;
    className?: string;
}

type BidHistory = {
    id: string;
    amount: number;
    timestamp: any;
}

type LiveItemData = {
    currentBid: number;
    bidCount: number;
    userId: string;
    winnerId?: string;
    highestBidderId?: string;
    isPromoted?: boolean;
}

async function getOrCreateChat(
  firestore: any,
  currentUser: any,
  partnerId: string,
  itemId: string,
  itemCategory: string
): Promise<string> {
  const currentUserId = currentUser.uid;
  const chatQuery = query(
    collection(firestore, 'chats'),
    where('participants', 'array-contains', currentUserId)
  );

  const querySnapshot = await getDocs(chatQuery);
  let existingChatId: string | null = null;
  
  querySnapshot.forEach((doc) => {
    const chat = doc.data();
    if (chat.participants.includes(partnerId) && chat.itemId === itemId) {
      existingChatId = doc.id;
    }
  });

  if (existingChatId) {
    return existingChatId;
  }

  const currentUserDocRef = doc(firestore, 'users', currentUserId);
  const currentUserSnap = await getDoc(currentUserDocRef);
  if (!currentUserSnap.exists()) {
    throw new Error('Failed to find current user profile.');
  }
  const currentUserInfo = currentUserSnap.data();

  const partnerUserDoc = await getDoc(doc(firestore, 'users', partnerId));

  if (!partnerUserDoc.exists()) {
    throw new Error("Could not find the seller's profile information to start the chat.");
  }

  const partnerUserInfo = partnerUserDoc.data();

  const itemDoc = await getDoc(doc(firestore, itemCategory, itemId));
  if (!itemDoc.exists()) {
      throw new Error("Could not find the item information to start the chat.");
  }
  const itemInfo = itemDoc.data();

  const partnerDisplayName = partnerUserInfo?.displayName || 'Unknown Seller';
  const partnerPhotoURL = partnerUserInfo?.photoURL || null;

  const newChatData = {
    participants: [currentUserId, partnerId],
    participantInfo: {
      [currentUserId]: {
        displayName: currentUserInfo.displayName || 'You',
        photoURL: currentUserInfo.photoURL || null,
      },
      [partnerId]: {
        displayName: partnerDisplayName,
        photoURL: partnerPhotoURL,
      },
    },
    itemId: itemId,
    itemCategory: itemCategory,
    itemTitle: itemInfo.name || itemInfo.itemName || 'Item',
    itemImageUrl: (itemInfo.imageUrls && itemInfo.imageUrls[0]) || null,
    lastMessage: {
      text: 'Auction won! Chat started.',
      timestamp: serverTimestamp(),
      senderId: currentUserId,
    },
    readBy: [currentUserId],
    type: 'item'
  };

  const chatDocRef = await addDoc(collection(firestore, 'chats'), newChatData);
  return chatDocRef.id;
}


const StatusDisplay = ({ status }: { status: BidStatus }) => {
    const statusInfo = {
        'Winning': { icon: TrendingUp, text: 'Winning', color: 'text-green-600' },
        'Outbid': { icon: TrendingDown, text: 'Outbid', color: 'text-destructive' },
        'Won': { icon: Award, text: 'You Won!', color: 'text-amber-500' },
        'Lost': { icon: CircleHelp, text: 'Lost', color: 'text-muted-foreground' },
        'Ended': { icon: CircleHelp, text: 'Ended', color: 'text-muted-foreground' },
        'Loading': { icon: Loader2, text: 'Loading...', color: 'text-muted-foreground' }
    }[status];

    if (!statusInfo) return null;

    const Icon = statusInfo.icon;
    return (
        <div className={cn("flex items-center gap-2 font-semibold", statusInfo.color, "text-sm sm:text-base")}>
            <Icon className={cn("h-5 w-5", status === 'Loading' && 'animate-spin')} />
            <span>{statusInfo.text}</span>
        </div>
    );
};

const validCategories = ['alcohol', 'iconics', 'casuals', 'art', 'plates', 'phoneNumbers', 'apparels'];

export function MyBidItemCard({ item, onStatusUpdate, onItemSelect, className }: MyBidItemCardProps) {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const [status, setStatus] = useState<BidStatus>('Loading');


    const isValidCategory = validCategories.includes(item.category);

    const myBidsHistoryQuery = useMemoFirebase(() => {
        if (!firestore || !user || !isValidCategory) return null;
        return query(collection(firestore, `users/${user.uid}/bidsOnItems/${item.id}/myBids`), orderBy('timestamp', 'desc'));
    }, [firestore, user, item.id, isValidCategory]);

    const { data: myBidsHistory, isLoading: isLoadingHistory } = useCollection<BidHistory>(myBidsHistoryQuery);

    const itemRef = useMemoFirebase(() => {
        if (!firestore || !isValidCategory) return null;
        return doc(firestore, item.category, item.id);
    }, [firestore, item.category, item.id, isValidCategory]);
    
    const { data: liveItemData, isLoading: isLoadingLiveItem } = useDoc<LiveItemData>(itemRef);
    
    useEffect(() => {
        if (!isValidCategory) {
            onStatusUpdate(item.id, 'Ended');
            setStatus('Ended');
            return;
        }

        if (isLoadingHistory || isLoadingLiveItem || !user) {
            return;
        }

        if (!liveItemData) {
            onStatusUpdate(item.id, 'Deleted');
            setStatus('Deleted');
            return;
        }

        const auctionEndDate = new Date(item.itemAuctionEndDate);
        const hasEnded = isPast(auctionEndDate);
        
        const winnerId = liveItemData?.winnerId;
        const highestBidderId = liveItemData?.highestBidderId;

        let newStatus: BidStatus;

        if (hasEnded) {
            if (winnerId) {
                newStatus = winnerId === user.uid ? 'Won' : 'Lost';
            } 
            else if (highestBidderId) {
                newStatus = highestBidderId === user.uid ? 'Won' : 'Lost';
            } 
            else {
                newStatus = 'Lost';
            }
        } else {
            if (highestBidderId === user.uid) {
                newStatus = 'Winning';
            } else {
                newStatus = 'Outbid';
            }
        }
        
        onStatusUpdate(item.id, newStatus);
        setStatus(newStatus);

    }, [liveItemData, item.itemAuctionEndDate, onStatusUpdate, item.id, user, isValidCategory, isLoadingHistory, isLoadingLiveItem]);

    const handleChatClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!firestore || !user || !liveItemData?.userId) return;

        if (user.uid === liveItemData.userId) {
            toast({
                variant: 'default',
                title: 'This is you!',
                description: "You can't start a chat with yourself."
            });
            return;
        }

        setIsCreatingChat(true);
        try {
            const chatId = await getOrCreateChat(firestore, user, liveItemData.userId, item.id, item.category);
            router.push(`/messages/${chatId}`);
        } catch (error: any) {
            console.error("Failed to create or get chat:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Could not start chat. ${error.message}`
            })
        } finally {
            setIsCreatingChat(false);
        }
    };
    
    if (!isValidCategory) {
        return null;
    }

    const isPlate = item.category === 'plates';
    const isPhoneNumber = item.category === 'phoneNumbers';
    
    const myHighestBid = myBidsHistory?.[0]?.amount;
    const currentHighestBid = liveItemData?.currentBid;

    const currentStatus = status;
    const isPromoted = liveItemData?.isPromoted;

    if (currentStatus === 'Loading') {
        return (
             <Card className={cn("overflow-hidden shadow-lg", className)}>
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
        );
    }

    return (
        <Card onClick={onItemSelect} className={cn(
            "shadow-lg bg-card cursor-pointer",
            !isPromoted && "overflow-hidden",
            isPromoted && "ring-2 ring-accent bg-accent/10",
            className
        )}>
            <CardContent className="p-4 pb-0">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:w-24 shrink-0">
                        {isPlate || isPhoneNumber ? (
                            <div className={cn(
                                "relative rounded-md group bg-muted aspect-square flex items-center justify-center",
                                !isPromoted && "overflow-hidden"
                            )}>
                                {isPlate ? (
                                    <LebanesePlateDisplay plateNumber={item.itemTitle} />
                                ) : (
                                    <PhoneNumberDisplay phoneNumber={item.itemTitle} />
                                )}
                            </div>
                        ) : (
                            <div className={cn(
                                "aspect-square relative rounded-md group",
                                !isPromoted && "overflow-hidden"
                            )}>
                                <Image
                                    src={item.itemImageUrl}
                                    alt={item.itemTitle}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex-grow flex flex-col">
                         <div className='flex-1 mb-2'>
                            <div className="flex justify-between items-start gap-1 mb-2">
                                <h3 className="font-bold text-base sm:text-lg font-headline leading-tight hover:underline flex-1">{item.itemTitle}</h3>
                                <div className="shrink-0 -mr-1 sm:ml-0">
                                    <StatusDisplay status={currentStatus} />
                                </div>
                            </div>
                            <AuctionTimerBar startDate={item.itemAuctionStartDate} endDate={item.itemAuctionEndDate} isCard />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mt-auto pt-2 border-t mt-2">
                             <div>
                                <p className="text-xs text-muted-foreground">Your Last Bid</p>
                                <p className="text-base font-semibold">${myHighestBid?.toLocaleString() || 'N/A'}</p>
                            </div>
                             <div>
                                <p className="text-xs text-muted-foreground">Highest Bid</p>
                                <p className="text-base font-semibold">${currentHighestBid?.toLocaleString() || 'N/A'}</p>
                            </div>
                       </div>
                    </div>
                </div>
            </CardContent>

             <CardFooter className="p-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                {currentStatus === 'Won' && (
                   <Button onClick={handleChatClick} disabled={isCreatingChat} size="sm" className="w-full sm:w-auto">
                       {isCreatingChat ? (
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       ) : (
                           <MessageSquare className="mr-2 h-4 w-4" />
                       )}
                       <span>{isCreatingChat ? 'Starting...' : 'Chat with Seller'}</span>
                   </Button>
               )}
                <Button onClick={(e) => { e.stopPropagation(); onItemSelect() }} size="sm" variant="outline" className="w-full sm:w-auto">
                    <LogIn className="mr-2 h-4 w-4"/>
                    View Auction
                </Button>
            </CardFooter>
        </Card>
    );
}
