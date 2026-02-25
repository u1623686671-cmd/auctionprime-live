'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { createCheckoutSession } from '@/lib/stripe/actions';
import { doc } from 'firebase/firestore';

const plans = {
    plus: {
        name: 'AuctionPrime Plus',
        monthlyPrice: 4.99,
        yearlyPrice: 49.99,
        monthlyTokens: 1,
        yearlyTokens: 12,
    },
    ultimate: {
        name: 'AuctionPrime Ultimate',
        monthlyPrice: 9.99,
        yearlyPrice: 99.99,
        monthlyPromoTokens: 5,
        yearlyPromoTokens: 60,
        monthlyExtendTokens: 10,
        yearlyExtendTokens: 120,
    }
}

export default function BillingPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const [isProcessing, setIsProcessing] = useState(false);

    const planId = searchParams.get('plan') as 'plus' | 'ultimate' | null;
    const planDetails = planId ? plans[planId] : null;

    const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile, isLoading: isUserProfileLoading } = useDoc(userProfileRef);

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/login');
        }
        if (!isUserLoading && user && !planId) {
             router.replace('/profile/subscription');
        }
    }, [isUserLoading, user, planId, router]);

    const handleConfirm = async () => {
        if (!user || !user.email || !planId) return;

        setIsProcessing(true);

        try {
            await createCheckoutSession(user.uid, user.email, planId);
            // The user will be redirected to Stripe by the server action.
            // If it fails, the catch block will handle it.
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Checkout Error',
                description: error.message || 'Could not redirect you to checkout. Please try again.',
            });
            setIsProcessing(false);
        }
    }

    if (isUserLoading || isUserProfileLoading || !planDetails) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    const price = planDetails.monthlyPrice;

    return (
        <div className="container mx-auto max-w-2xl px-4 py-12 md:py-16">
            <div className="mb-6">
                <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
                    <Link href="/profile/subscription">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Confirm Your Subscription</CardTitle>
                    <CardDescription>You are subscribing to the <span className={cn("font-semibold", planId === 'plus' ? 'text-sky-500' : 'text-purple-500')}>{planDetails.name}</span> plan.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="p-4 rounded-lg bg-secondary space-y-3">
                         <div className="flex justify-between items-center text-sm">
                            <p className="text-muted-foreground">{planDetails.name} (Monthly)</p>
                            <p className="font-semibold">${price.toFixed(2)}</p>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center text-lg">
                            <p className="font-bold">Total Due Today</p>
                            <p className="font-bold">${price.toFixed(2)}</p>
                        </div>
                    </div>

                </CardContent>
                <CardFooter>
                    <Button onClick={handleConfirm} disabled={isProcessing} className="w-full">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        {isProcessing ? 'Redirecting to Checkout...' : 'Proceed to Payment'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
