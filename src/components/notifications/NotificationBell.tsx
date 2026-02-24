'use client';

import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch } from 'firebase/firestore';
import { useUnreadNotificationsCount } from '@/hooks/useUnreadNotificationsCount';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Card } from '../ui/card';
import { AuctionDetailView } from '../auctions/AuctionDetailView';

type Notification = {
    id: string;
    type: string;
    title: string;
    body: string;
    link: string;
    isRead: boolean;
    timestamp: any;
};

const TimeAgo = ({ timestamp }: { timestamp: any }) => {
    const [time, setTime] = useState('');
    useEffect(() => {
        let date;
        if (timestamp?.toDate) {
            date = timestamp.toDate();
        } else if (timestamp) {
            date = new Date(timestamp);
        }

        if (date) {
            setTime(formatDistanceToNow(date, { addSuffix: true }));
        }
    }, [timestamp]);

    if (!time) return <Skeleton className="h-3 w-20 inline-block" />;
    return <>{time}</>;
}


export function NotificationBell() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const unreadCount = useUnreadNotificationsCount();
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [isFullListOpen, setIsFullListOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<{itemId: string, category: string} | null>(null);

    const notificationsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, user]);

    const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);
    
    const handleMarkOneAsRead = async (notificationId: string) => {
        if (!user || !firestore) return;
        const notifRef = doc(firestore, 'users', user.uid, 'notifications', notificationId);
        await writeBatch(firestore).update(notifRef, { isRead: true }).commit().catch(()=>{});
    };

    const handlePopoverOpenChange = async (open: boolean) => {
        setPopoverOpen(open);
        if (open && notifications && firestore && user) {
            const unreadNotifications = notifications.filter(n => !n.isRead);
            if (unreadNotifications.length === 0) return;

            const batch = writeBatch(firestore);
            unreadNotifications.forEach(notification => {
                const notifRef = doc(firestore, 'users', user.uid, 'notifications', notification.id);
                batch.update(notifRef, { isRead: true });
            });
            await batch.commit().catch(console.error);
        }
    };
    
    const handleViewAllClick = () => {
        setPopoverOpen(false);
        setIsFullListOpen(true);
    };

    const handleNotificationClick = (e: React.MouseEvent, notification: Notification) => {
        e.preventDefault();
        setPopoverOpen(false);
        setIsFullListOpen(false);
        
        handleMarkOneAsRead(notification.id);

        const link = notification.link;
        if (link.startsWith('/messages')) {
            router.push(link);
            return;
        }

        const pathSegments = link.split('/').filter(Boolean);
        if (pathSegments.length === 2) {
            const [category, itemId] = pathSegments;
            setSelectedItem({ category, itemId });
        } else {
            router.push(link);
        }
    };

    return (
        <>
        <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
            <PopoverTrigger asChild>
                 <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "relative h-8 w-8 rounded-md p-0",
                    "text-primary border-primary font-bold hover:text-primary hover:bg-primary/10",
                    "md:rounded-full md:h-10 md:w-10 md:bg-card md:hover:bg-muted md:border-border md:text-foreground md:font-normal"
                  )}
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                         <span className="absolute -top-1 -right-1 flex h-4 w-4 transform items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Toggle notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2">
                <div className="grid gap-2">
                    <div className="flex items-center justify-between px-2">
                        <h4 className="font-medium leading-none">Notifications</h4>
                        <Button variant="link" className="text-xs h-auto p-0" onClick={handleViewAllClick}>
                            View all
                        </Button>
                    </div>
                    {isLoading && (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/>
                        </div>
                    )}
                    {!isLoading && (!notifications || notifications.length === 0) && (
                        <div className="text-center text-sm text-muted-foreground p-6">
                            <p>You have no notifications yet.</p>
                        </div>
                    )}
                     {!isLoading && notifications && notifications.length > 0 && (
                        <ScrollArea className="h-80">
                             <div className="space-y-2 p-2">
                            {notifications.map((notification) => (
                                <div onClick={(e) => handleNotificationClick(e, notification)} key={notification.id} className="block rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                    <div className="p-2">
                                        <div className="flex items-start gap-3">
                                            {!notification.isRead && <span className="flex h-2 w-2 translate-y-1 rounded-full bg-primary" />}
                                            <div className="grid gap-1 flex-1">
                                                <p className="text-sm font-medium leading-none">
                                                    {notification.title}
                                                </p>
                                                <p className="text-sm text-muted-foreground line-clamp-2">
                                                    {notification.body}
                                                </p>
                                                <div className="text-xs text-muted-foreground">
                                                    <TimeAgo timestamp={notification.timestamp} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </ScrollArea>
                     )}
                </div>
            </PopoverContent>
        </Popover>

        <Dialog open={isFullListOpen} onOpenChange={setIsFullListOpen}>
            <DialogContent className="p-0 sm:max-w-md">
                <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-2 border-b">
                    <DialogTitle className="text-xl">All Notifications</DialogTitle>
                </DialogHeader>
                <div className="max-h-[80vh] sm:max-h-[70vh] overflow-hidden">
                    {isLoading && (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {!isLoading && (!notifications || notifications.length === 0) && (
                        <div className="text-center text-sm text-muted-foreground p-8">
                            <p>You have no notifications.</p>
                        </div>
                    )}
                     {!isLoading && notifications && notifications.length > 0 && (
                        <ScrollArea className="h-full">
                            <div className="space-y-2 p-4 sm:p-6">
                                {notifications.map((notification) => (
                                    <div onClick={(e) => { handleNotificationClick(e, notification); }} key={notification.id} className="cursor-pointer">
                                        <Card className={cn(
                                            "p-4 transition-all hover:shadow-md border-0 shadow-sm",
                                            !notification.isRead && "bg-secondary"
                                        )}>
                                            <div className="flex items-start gap-4">
                                                {!notification.isRead && <span className="flex h-2.5 w-2.5 translate-y-1.5 rounded-full bg-primary" />}
                                                <div className="grid gap-1 flex-1">
                                                <p className="font-semibold leading-none">
                                                    {notification.title}
                                                </p>
                                                <p className="text-sm text-muted-foreground line-clamp-2">
                                                    {notification.body}
                                                </p>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    <TimeAgo timestamp={notification.timestamp} />
                                                </div>
                                            </div>
                                            </div>
                                        </Card>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </DialogContent>
        </Dialog>

        <Dialog open={!!selectedItem} onOpenChange={(isOpen) => !isOpen && setSelectedItem(null)}>
            <DialogContent className="p-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Auction Details</DialogTitle>
                    <DialogDescription>
                        Viewing the details for the selected auction item.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[90vh]">
                    <div className="p-4 pt-8 sm:p-6 sm:pt-6">
                        {selectedItem && (
                            <AuctionDetailView itemId={selectedItem.itemId} category={selectedItem.category} />
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
      </>
    );
}
