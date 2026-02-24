
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { User, LogOut, Plus, Gavel, LayoutGrid } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import { doc } from 'firebase/firestore';
import { useUnreadChatsCount } from "@/hooks/useUnreadChatsCount";
import { NotificationBell } from "../notifications/NotificationBell";
import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NewListingFlow } from "@/components/retailer/NewListingFlow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";


const publicNavLinks = [
  { href: "/home", label: "Auctions" },
];

const privateNavLinks = [
    { href: "/watchlist", label: "Watchlist" },
    { href: "/my-bids", label: "My Bids" },
    { href: "/messages", label: "Messages" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const unreadCount = useUnreadChatsCount();
  const isMobile = useIsMobile();
  const [isListingDialogOpen, setIsListingDialogOpen] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1 && names[0] && names[names.length - 1]) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  
  const handleLogout = () => {
    signOut(auth);
    router.push('/login');
  };

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const isActive = (href === '/home' && pathname === href) || (href !== '/home' && pathname.startsWith(href));
    return (
        <Link
        href={href}
        className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            isActive ? "text-primary" : "text-foreground/60"
        )}
        >
        {label}
        </Link>
    );
  }

  // The main header does not render on the home page, which has its own custom header
  if (pathname === '/home') {
      return null;
  }
  
  const isProfilePage = pathname === '/profile';

  return (
    <>
      <Dialog open={isListingDialogOpen} onOpenChange={setIsListingDialogOpen}>
        <DialogContent className="p-0 flex flex-col h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl">
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full w-full">
               <div className="p-6">
                <DialogHeader className="pb-4">
                    <DialogTitle className="text-2xl font-bold">Create a New Listing</DialogTitle>
                    <DialogDescription>Select a category and fill in the details for your auction.</DialogDescription>
                </DialogHeader>
                <NewListingFlow onSuccess={() => setIsListingDialogOpen(false)} />
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      <header className="sticky top-0 z-50 w-full border-b bg-card">
        <div className="container flex h-16 items-center px-4">
          {/* Desktop nav */}
          <div className="mr-6 hidden md:flex">
            <Link href="/home" className="mr-6 flex items-center space-x-2">
              <span className="hidden font-extrabold tracking-tight sm:inline-block font-headline text-2xl text-primary">AuctionPrime</span>
            </Link>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              {publicNavLinks.map((link) => (
                <NavLink key={link.href} {...link} />
              ))}
               {user && privateNavLinks.map((link) => {
                   if (link.href === '/messages') {
                      const isActive = pathname.startsWith('/messages');
                      return (
                          <Link key={link.href} href={link.href} className={cn("text-sm font-medium transition-colors hover:text-primary", isActive ? "text-primary" : "text-foreground/60")}>
                              <div className="relative flex items-center">
                                  <span>{link.label}</span>
                                  {unreadCount > 0 && (
                                      <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                                          {unreadCount}
                                      </span>
                                  )}
                              </div>
                          </Link>
                      )
                   }
                   return <NavLink key={link.href} {...link} />
               })}
                <NavLink href="/about" label="About" />
            </nav>
          </div>

          {/* Mobile Logo */}
          <div className="flex items-center md:hidden">
               <Link href="/home" className="flex items-center space-x-2">
                  <span className="font-extrabold tracking-tight font-headline text-2xl text-primary">AuctionPrime</span>
               </Link>
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side actions */}
          <div className="flex items-center justify-end space-x-2">
            {isUserLoading ? (
              <div className="w-24 h-8 animate-pulse bg-muted rounded-md" />
            ) : user ? (
              <>
                {/* Mobile actions */}
                <div className="flex items-center gap-2 md:hidden">
                  {!isProfilePage && (
                    <>
                       <Button size="sm" variant="outline" className="text-primary border-primary font-bold hover:text-primary hover:bg-primary/10 gap-1 px-2" onClick={() => setIsListingDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add item
                        </Button>
                       <NotificationBell />
                    </>
                  )}
                </div>
              
                {/* Desktop items */}
                <div className="hidden md:flex items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="text-primary border-primary font-bold hover:text-primary hover:bg-primary/10 gap-1 px-2">
                        <Link href="/retailer/new-listing">
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
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                    <Link href="/login">Login</Link>
                </Button>
                <Button asChild>
                    <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
    