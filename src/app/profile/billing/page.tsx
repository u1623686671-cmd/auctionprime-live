
'use client';

import Link from 'next/link';
import { ArrowLeft, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { createCustomerPortalSession } from '@/lib/stripe/actions';
import { doc } from 'firebase/firestore';

export default function BillingPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc(userProfileRef);
  
  const isSubscribed = userProfile?.isPlusUser || userProfile?.isUltimateUser;

  const handleManageBilling = async () => {
    if (!user || !user.email) return;
    setIsProcessing(true);
    try {
        await createCustomerPortalSession(user.uid, user.email);
        // User is redirected by the server action
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'Could not open the billing portal.',
        });
        setIsProcessing(false);
    }
  }
  
  if (isUserLoading || isUserProfileLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12 md:py-16">
        <div className="mb-6">
            <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
                <Link href="/profile">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
            </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <CreditCard className="w-8 h-8 text-primary"/>
              <span>Billing</span>
            </CardTitle>
            <CardDescription>
              Manage your subscription and payment details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSubscribed ? (
                <div className="space-y-2">
                    <p className="font-semibold">Current Plan</p>
                    <div className="flex items-center gap-2">
                        {userProfile?.isUltimateUser ? (
                            <Badge className="bg-purple-500 text-white hover:bg-purple-500">ULTIMATE</Badge>
                        ) : (
                            <Badge className="bg-sky-500 text-white hover:bg-sky-500">PLUS</Badge>
                        )}
                         <span className="text-sm text-muted-foreground capitalize">({userProfile?.subscriptionBillingCycle})</span>
                    </div>
                </div>
            ) : (
                <div className="text-center text-muted-foreground p-8">
                    <p>You are not currently subscribed to any plan.</p>
                     <Button asChild variant="link">
                        <Link href="/profile/subscription">View Plans</Link>
                    </Button>
                </div>
            )}
          </CardContent>
           {isSubscribed && (
            <CardFooter>
                <Button onClick={handleManageBilling} disabled={isProcessing} className="w-full">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Manage Billing
                </Button>
            </CardFooter>
           )}
        </Card>
    </div>
  );
}
