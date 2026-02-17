
'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from '@/lib/utils';
import { createCheckoutSession, createCustomerPortalSession } from '@/lib/stripe/actions';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export default function SubscriptionPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [planToUpgrade, setPlanToUpgrade] = useState<'plus' | 'ultimate' | null>(null);

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc(userProfileRef);
  
  const handleCheckout = async (plan: 'plus' | 'ultimate', cycle: 'monthly' | 'yearly') => {
      if (!user || !user.email) return;
      setIsProcessing(true);
      setProcessingPlan(`${plan}-${cycle}`);
      try {
          await createCheckoutSession(user.uid, user.email, plan, cycle);
          // The user will be redirected to Stripe by the server action.
      } catch (error: any) {
          toast({
              variant: 'destructive',
              title: 'Checkout Error',
              description: error.message || 'Could not initiate the checkout process.',
          });
          setIsProcessing(false);
          setProcessingPlan(null);
      }
  }

  const handleManageBilling = async () => {
      if (!user || !user.email) return;
      setIsProcessing(true);
      setProcessingPlan('manage');
      try {
          await createCustomerPortalSession(user.uid, user.email);
      } catch (error: any) {
          toast({
              variant: 'destructive',
              title: 'Error',
              description: error.message || 'Could not open the billing portal.',
          });
          setIsProcessing(false);
          setProcessingPlan(null);
      }
  }


  const freeFeatures = [
    "Unlimited Bids",
    "1 Listing per 14 days",
  ];
  
  const plusFeatures = [
    "Unlimited Auction Listings",
    "1 Promoted Listing per Month",
  ];

  const ultimateFeatures = [
    "Everything in Plus",
    "5 Promoted Listings per Month",
    "10 Extend Tokens per Month",
    "Priority Support",
  ];

  if (isUserLoading || isUserProfileLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  const isPlusUser = userProfile?.isPlusUser || false;
  const isUltimateUser = userProfile?.isUltimateUser || false;
  const isSubscribed = isPlusUser || isUltimateUser;

  const currentBillingCycle = userProfile?.subscriptionBillingCycle;
  const renewalDate = userProfile?.subscriptionRenewalDate?.toDate();
  const hasStripeSubscription = !!userProfile?.stripeSubscriptionId;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
        <AlertDialog open={!!planToUpgrade} onOpenChange={(open) => !open && setPlanToUpgrade(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Choose Billing Cycle</AlertDialogTitle>
                <AlertDialogDescription>
                    You'll be redirected to Stripe to complete your purchase. You can save ~17% with a yearly plan.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <Button
                        variant="outline"
                        className="h-auto py-4 flex flex-col"
                        onClick={() => handleCheckout(planToUpgrade!, 'monthly')}
                        disabled={isProcessing}
                    >
                        <span className="font-bold text-lg">Billed Monthly</span>
                        <span className="text-muted-foreground text-sm">
                            {planToUpgrade === 'plus' ? '$4.99 / month' : '$9.99 / month'}
                        </span>
                        {isProcessing && processingPlan === `${planToUpgrade}-monthly` && <Loader2 className="mt-2 h-4 w-4 animate-spin"/>}
                    </Button>
                    <Button
                        variant="outline"
                        className="h-auto py-4 flex flex-col border-primary/50"
                        onClick={() => handleCheckout(planToUpgrade!, 'yearly')}
                        disabled={isProcessing}
                    >
                        <span className="font-bold text-lg text-primary">Billed Yearly</span>
                        <span className="text-muted-foreground text-sm">
                            {planToUpgrade === 'plus' ? '$49.99 / year' : '$99.99 / year'}
                        </span>
                        {isProcessing && processingPlan === `${planToUpgrade}-yearly` && <Loader2 className="mt-2 h-4 w-4 animate-spin"/>}
                    </Button>
                </div>
                <AlertDialogFooter className="pt-2">
                    <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <div className="mb-6">
            <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
                <Link href="/profile">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
            </Button>
        </div>
        <header className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold font-headline">Subscription Plans</h1>
            <p className="text-lg text-muted-foreground mt-2">Choose the plan that's right for you.</p>
        </header>
      
        {isSubscribed && (
          <Card className={cn("mb-12", 
            isUltimateUser ? "bg-purple-500/10 border-purple-500/20" : 
            isPlusUser ? "bg-sky-500/10 border-sky-500/20" : 
            "bg-secondary"
          )}>
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <CardTitle className="text-lg mb-2">Your Current Plan</CardTitle>
                    <div className="flex items-center gap-3">
                        {isUltimateUser ? (
                            <Badge className="bg-purple-500 text-white hover:bg-purple-500 text-base">ULTIMATE</Badge>
                        ) : isPlusUser ? (
                            <Badge className="bg-sky-500 text-white hover:bg-sky-500 text-base">PLUS</Badge>
                        ) : null}
                         {currentBillingCycle && (
                            <span className="text-sm text-muted-foreground capitalize">({currentBillingCycle})</span>
                        )}
                    </div>
                     {renewalDate ? (
                        <p className="text-sm text-muted-foreground">
                            Renews on {format(renewalDate, 'PP')}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                           Renewal date will display after payment processing.
                        </p>
                    )}
                </div>
                {hasStripeSubscription && (
                  <Button 
                      onClick={handleManageBilling} 
                      disabled={isProcessing}
                      className="w-full sm:w-auto shrink-0"
                  >
                      {isProcessing && processingPlan === 'manage' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Manage Billing
                  </Button>
                )}
            </CardContent>
          </Card>
        )}


      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Free Plan</CardTitle>
            <CardDescription>
              For casual sellers getting started.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-grow">
             <div className="text-4xl font-bold font-headline">$0<span className="text-base font-normal text-muted-foreground">/month</span></div>
             <ul className="space-y-2 text-muted-foreground">
                {freeFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start"><CheckCircle className="w-5 h-5 mr-2 text-primary shrink-0 mt-1"/><span>{feature}</span></li>
                ))}
            </ul>
          </CardContent>
          <CardFooter>
             <Button variant="outline" className="w-full" disabled={!isSubscribed}>
                Currently Active
            </Button>
          </CardFooter>
        </Card>
        
        <Card className="border-2 border-sky-500 flex flex-col">
          <CardHeader>
            <CardTitle>Ubid Plus</CardTitle>
            <CardDescription>
              For serious sellers who want more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-grow">
            <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold font-headline">$4.99</span>
                    <span className="text-muted-foreground">/month</span>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl">$49.99</span>
                    <span className="text-muted-foreground">/year</span>
                    <Badge variant="outline" className="border-green-500 text-green-600">Save ~17%</Badge>
                </div>
            </div>
            <ul className="space-y-2 text-foreground">
              {plusFeatures.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle className="w-5 h-5 mr-2 text-sky-500 shrink-0 mt-1" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
           <CardFooter>
                <Button 
                    onClick={() => setPlanToUpgrade('plus')}
                    disabled={isProcessing} 
                    className="w-full bg-sky-500 text-white hover:bg-sky-500/90"
                >
                    {isProcessing && processingPlan?.startsWith('plus') && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Upgrade to Plus
                </Button>
          </CardFooter>
        </Card>

        <Card className="border-2 border-purple-500 flex flex-col relative">
          <div className="absolute top-0 -translate-y-1/2 w-full flex justify-center">
            <Badge className="bg-purple-500 text-white hover:bg-purple-500">Ultimate</Badge>
          </div>
          <CardHeader>
            <CardTitle>Ultimate</CardTitle>
            <CardDescription>For power users who want every advantage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-grow">
             <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold font-headline">$9.99</span>
                    <span className="text-muted-foreground">/month</span>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl">$99.99</span>
                    <span className="text-muted-foreground">/year</span>
                    <Badge variant="outline" className="border-green-500 text-green-600">Save ~17%</Badge>
                </div>
            </div>
             <ul className="space-y-2 text-foreground">
              {ultimateFeatures.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle className="w-5 h-5 mr-2 text-purple-500 shrink-0 mt-1" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
                <Button 
                    onClick={() => setPlanToUpgrade('ultimate')}
                    disabled={isProcessing}
                    className="w-full bg-purple-500 text-white hover:bg-purple-500/90"
                >
                    {isProcessing && processingPlan?.startsWith('ultimate') && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Upgrade to Ultimate
                </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
