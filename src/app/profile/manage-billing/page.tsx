'use client';

import Link from 'next/link';
import { ArrowLeft, CreditCard, Loader2, Wallet, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { createCustomerPortalSession } from '@/lib/stripe/actions';
import { doc } from 'firebase/firestore';

export default function ManageBillingPage() {
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
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'Could not open the billing portal.',
        });
        setIsProcessing(false);
    }
  }
  
  useEffect(() => {
    if (!isUserLoading && !user) {
        router.replace('/login');
    }
  }, [isUserLoading, user, router]);

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
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Wallet className="w-8 h-8 text-primary"/>
              <span>Wallet &amp; Billing</span>
            </CardTitle>
            <CardDescription className="text-base pt-1">
              Manage your saved cards and view your billing history securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <div className="p-6 rounded-xl bg-secondary/30 border border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <p className="font-semibold text-lg">Saved Payment Methods</p>
                        <p className="text-sm text-muted-foreground">Add or remove cards for future purchases.</p>
                    </div>
                </div>
                {isSubscribed && (
                    <div className="hidden sm:block">
                        {userProfile?.isUltimateUser ? (
                            <Badge className="bg-purple-500 text-white">ULTIMATE</Badge>
                        ) : (
                            <Badge className="bg-sky-500 text-white">PLUS</Badge>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <span>Your payment information is encrypted and stored securely by Stripe.</span>
            </div>
          </CardContent>
          <CardFooter className="p-6">
                <Button onClick={handleManageBilling} disabled={isProcessing} className="w-full h-12 text-base font-semibold">
                    {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <CreditCard className="mr-2 h-5 w-5" />}
                    Manage Cards &amp; Billing
                </Button>
          </CardFooter>
        </Card>
    </div>
  );
}
