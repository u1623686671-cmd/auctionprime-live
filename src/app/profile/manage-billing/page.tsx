
'use client';

import Link from 'next/link';
import { ArrowLeft, CreditCard, Loader2, ShieldCheck, Wallet } from 'lucide-react';
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
        <Card className="border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <CreditCard className="w-8 h-8 text-primary"/>
              <span>Payment Methods & Billing</span>
            </CardTitle>
            <CardDescription className="text-base pt-1">
              Securely manage your credit cards and subscription details via Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-8">
            <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                    Automatic Subscription Renewals
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                    To ensure your <b>Plus</b> or <b>Ultimate</b> benefits never expire, we use Stripe's secure billing system. You can save your card details and manage your default payment method directly in the Stripe Portal.
                </p>
            </div>

            <div className="p-4 rounded-xl bg-secondary/50 border border-secondary flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-primary" />
                        <span className="font-medium">Current Status</span>
                    </div>
                    {isSubscribed ? (
                        <div className="flex items-center gap-2">
                            {userProfile?.isUltimateUser ? (
                                <Badge className="bg-purple-500 text-white hover:bg-purple-500">ULTIMATE</Badge>
                            ) : (
                                <Badge className="bg-sky-500 text-white hover:bg-sky-500">PLUS</Badge>
                            )}
                            <span className="text-xs text-muted-foreground capitalize">({userProfile?.subscriptionBillingCycle})</span>
                        </div>
                    ) : (
                        <Badge variant="outline">Not Subscribed</Badge>
                    )}
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
                <p>
                    <b>Note:</b> We never store your credit card information on our servers. All payment data is handled securely by Stripe, a global leader in online payments.
                </p>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 p-6">
                <Button onClick={handleManageBilling} disabled={isProcessing} className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20">
                    {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <CreditCard className="mr-2 h-5 w-5" />}
                    {isSubscribed ? 'Manage Cards & Renewals' : 'Add Payment Method in Stripe'}
                </Button>
          </CardFooter>
        </Card>
    </div>
  );
}
