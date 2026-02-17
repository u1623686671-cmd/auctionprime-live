"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gavel, User, CreditCard, KeyRound, LifeBuoy, LogOut, Package, Shield, ChevronRight, FileText, Info, Coins, PlusCircle, AlertTriangle } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from "firebase/firestore";
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Loading from './loading';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';


const accountNavItems = [
    {
        icon: Shield,
        title: "Subscription",
        href: "/profile/subscription"
    },
    {
        icon: CreditCard,
        title: "Billing",
        href: "/profile/billing"
    },
    {
        icon: KeyRound,
        title: "Password",
        href: "/profile/password"
    },
    {
        icon: LifeBuoy,
        title: "Help & Support",
        href: "/help"
    },
    {
        icon: AlertTriangle,
        title: "Delete Account",
        href: "/profile/delete-account"
    },
];

const legalNavItems = [
    {
        icon: Info,
        title: "About",
        href: "/about"
    },
    {
        icon: FileText,
        title: "Privacy Policy",
        href: "/privacy"
    },
    {
        icon: FileText,
        title: "Terms of Service",
        href: "/terms"
    },
];

export default function ProfilePage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();

    const adminRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'admins', user.uid);
      }, [firestore, user]);
      const { data: admin, isLoading: isAdminLoading } = useDoc(adminRef);
    
      const supportRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'support', user.uid);
      }, [firestore, user]);
      const { data: supportUser, isLoading: isSupportLoading } = useDoc(supportRef);
    
      const userProfileRef = useMemoFirebase(() => {
          if (!firestore || !user) return null;
          return doc(firestore, 'users', user.uid);
      }, [firestore, user]);
      const { data: userProfile, isLoading: isUserProfileLoading } = useDoc(userProfileRef);

      const getInitials = (name: string) => {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length > 1 && names[0] && names[names.length - 1]) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return name ? name.substring(0, 2).toUpperCase() : 'U';
      }

      const handleLogout = () => {
        signOut(auth);
        router.push('/login');
      };

    if (isUserLoading || !user || isAdminLoading || isSupportLoading || isUserProfileLoading) {
        return <Loading />;
    }
    
    const isProfilePage = true;


    return (
        <div className="container mx-auto max-w-2xl px-4 py-12 md:py-16">
             {isMobile && !isProfilePage && (
              <div className="fixed top-0 left-0 right-0 z-30 bg-card border-b h-16 flex items-center justify-end px-4">
              </div>
            )}
            <header className="mb-12">
                <h1 className="text-4xl md:text-5xl font-bold font-headline mb-2">
                    Profile
                </h1>
                <p className="text-lg text-muted-foreground">
                    Manage your account settings and view your activity.
                </p>
            </header>
            <div className="space-y-8">
                <Card className="relative shadow-sm">
                    {isMobile && (
                        <div className="absolute top-2 right-2">
                             <Button variant="ghost" size="icon" className="relative h-12 w-12 rounded-full bg-muted/50 hover:bg-muted">
                                <NotificationBell />
                            </Button>
                        </div>
                    )}
                    <CardContent className="pt-6 flex flex-col items-center text-center">
                      <Avatar className="w-24 h-24 mb-4">
                        {(userProfile?.photoURL || user.photoURL) && <AvatarImage src={userProfile?.photoURL || user.photoURL!} data-ai-hint="person face" />}
                        <AvatarFallback>{user.displayName ? getInitials(user.displayName) : 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold">{user.displayName || "User"}</h2>
                        {userProfile?.isUltimateUser ? (
                          <Badge className="bg-purple-500 text-white hover:bg-purple-500">ULTIMATE</Badge>
                        ) : userProfile?.isPlusUser && (
                          <Badge className="bg-[hsl(var(--info-emphasis))] text-[hsl(var(--info-emphasis-foreground))] hover:bg-[hsl(var(--info-emphasis))]">PLUS</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </CardContent>
                    <CardFooter className="flex-col gap-2">
                         <Button asChild variant="outline" className="w-full">
                            <Link href="/profile/account-details">
                                <User className="mr-2 h-4 w-4"/>
                                Edit Profile
                            </Link>
                        </Button>
                        <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4"/>
                            Logout
                        </Button>
                    </CardFooter>
                </Card>

                {admin && (
                    <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10 border border-accent/50">
                        <div className="flex items-center gap-3 text-accent-darker">
                            <Shield className="h-5 w-5" />
                            <p className="font-semibold">Admin Access</p>
                        </div>
                        <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent">
                            <Link href="/admin/dashboard">
                                Go to Dashboard
                            </Link>
                        </Button>
                    </div>
                )}
                {supportUser && !admin && (
                    <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10 border border-accent/50">
                         <div className="flex items-center gap-3 text-accent-darker">
                            <LifeBuoy className="h-5 w-5" />
                            <p className="font-semibold">Support Agent Access</p>
                        </div>
                        <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent">
                            <Link href="/support/dashboard">
                                Go to Dashboard
                            </Link>
                        </Button>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Link href="/my-bids">
                        <Card className="p-4 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors h-full shadow-sm">
                            <Gavel className="w-8 h-8 text-primary mb-2"/>
                            <p className="font-semibold">My Bids</p>
                        </Card>
                    </Link>
                    <Link href="/retailer/dashboard">
                        <Card className="p-4 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors h-full shadow-sm">
                            <Package className="w-8 h-8 text-primary mb-2"/>
                            <p className="font-semibold">My Listings</p>
                        </Card>
                    </Link>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-4 mt-8">Account Settings</h3>
                    <div>
                        {accountNavItems.map((item) => (
                            <Link href={item.href} key={item.title} className="block group">
                                <div className="flex items-center justify-between p-4 bg-transparent group-hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <item.icon className="w-5 h-5 text-primary"/>
                                        <p className="font-semibold">{item.title}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-4 mt-8">Legal</h3>
                    <div>
                        {legalNavItems.map((item) => (
                            <Link href={item.href} key={item.title} className="block group">
                                <div className="flex items-center justify-between p-4 bg-transparent group-hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <item.icon className="w-5 h-5 text-primary"/>
                                        <p className="font-semibold">{item.title}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
