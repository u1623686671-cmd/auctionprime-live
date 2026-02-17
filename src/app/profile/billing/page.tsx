'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { add, format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const plans = {
    plus: {
        name: 'Ubid Plus',
        monthlyPrice: 4.99,
        yearlyPrice: 49.99,
        monthlyTokens: 1,
        yearlyTokens: 12,
    },
    ultimate: {
        name: 'Ubid Ultimate',
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
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    const planId = searchParams.get('plan') as 'plus' | 'ultimate' | null;
    const planDetails = planId ? plans[planId] : null;

    const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile, isLoading: isUserProfileLoading } = useDoc(userProfileRef);

    const [creditAmount, setCreditAmount] = useState(0);
    const [isUpgrade, setIsUpgrade] = useState(false);

    useEffect(() => {
        if (!userProfile || !planId) return;

        const upgradeCheck = userProfile.isPlusUser && planId === 'ultimate';
        setIsUpgrade(upgradeCheck);

        if (upgradeCheck && userProfile.subscriptionRenewalDate && userProfile.subscriptionBillingCycle) {
            const plusRenewalDate = userProfile.subscriptionRenewalDate.toDate();
            const now = new Date();
            
            const wasYearly = userProfile.subscriptionBillingCycle === 'yearly';
            const pricePaid = wasYearly ? plans.plus.yearlyPrice : plans.plus.monthlyPrice;
            const startDate = wasYearly ? add(plusRenewalDate, { years: -1 }) : add(plusRenewalDate, { months: -1 });

            const totalDuration = plusRenewalDate.getTime() - startDate.getTime();
            const timeUsed = now.getTime() - startDate.getTime();
            
            let credit = 0;
            if (timeUsed < totalDuration) {
                const remainingRatio = 1 - (timeUsed / totalDuration);
                credit = pricePaid * remainingRatio;
            }
            setCreditAmount(credit > 0 ? credit : 0);
        } else {
            setCreditAmount(0);
        }
    }, [userProfile, planId]);


    useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/login');
        }
        if (!isUserLoading && user && !planId) {
             router.replace('/profile/subscription');
        }
    }, [isUserLoading, user, planId, router]);

    const handleConfirm = async () => {
        if (!user || !user.email || !userProfileRef || !userProfile || !planId || !planDetails) return;

        setIsProcessing(true);

        try {
            let proRataMessage = '';
            if (isUpgrade && creditAmount > 0) {
                proRataMessage = ` A credit of $${creditAmount.toFixed(2)} for the remainder of your Plus plan has been applied.`;
            }

            const renewalDate = billingCycle === 'monthly'
                ? add(new Date(), { months: 1 })
                : add(new Date(), { years: 1 });

            const updateData: any = {
                isPlusUser: planId === 'plus',
                isUltimateUser: planId === 'ultimate',
                subscriptionBillingCycle: billingCycle,
                stripeSubscriptionId: `sub_bypassed_${Date.now()}`,
                subscriptionRenewalDate: renewalDate,
            };

            if (planId === 'plus') {
                updateData.promotionTokens = (userProfile.promotionTokens || 0) + (billingCycle === 'monthly' ? planDetails.monthlyTokens : planDetails.yearlyTokens);
            } else if (planId === 'ultimate') {
                updateData.promotionTokens = (userProfile.promotionTokens || 0) + (billingCycle === 'monthly' ? planDetails.monthlyPromoTokens : planDetails.yearlyPromoTokens);
                updateData.extendTokens = (userProfile.extendTokens || 0) + (billingCycle === 'monthly' ? planDetails.monthlyExtendTokens : planDetails.yearlyExtendTokens);
            }

            await updateDoc(userProfileRef, updateData);

            toast({
                variant: 'success',
                title: 'Subscription Activated!',
                description: `You have successfully subscribed to the ${planDetails.name} plan.${proRataMessage}`,
            });
            
            router.push('/profile/subscription');

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Activation Error',
                description: error.message || 'Could not activate the subscription.',
            });
        } finally {
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
    
    const price = billingCycle === 'monthly' ? planDetails.monthlyPrice : planDetails.yearlyPrice;
    const finalPrice = Math.max(0, price - creditAmount);


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
                    <div>
                        <Label>Billing Cycle</Label>
                        <RadioGroup
                            value={billingCycle}
                            onValueChange={(value: 'monthly' | 'yearly') => setBillingCycle(value)}
                            className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4"
                        >
                            <Label htmlFor="monthly" className="border rounded-md p-4 flex flex-col items-start cursor-pointer data-[state=checked]:border-primary">
                                <RadioGroupItem value="monthly" id="monthly" className="mb-2"/>
                                <span className="font-bold">Billed Monthly</span>
                                <span className="text-muted-foreground">${planDetails.monthlyPrice.toFixed(2)} / month</span>
                            </Label>
                             <Label htmlFor="yearly" className="border rounded-md p-4 flex flex-col items-start cursor-pointer data-[state=checked]:border-primary">
                                <RadioGroupItem value="yearly" id="yearly" className="mb-2" />
                                <span className="font-bold">Billed Yearly</span>
                                <span className="text-muted-foreground">${planDetails.yearlyPrice.toFixed(2)} / year</span>
                                <span className="mt-1 text-xs font-semibold text-green-600">Save ~17%</span>
                            </Label>
                        </RadioGroup>
                    </div>

                    <div className="p-4 rounded-lg bg-secondary space-y-3">
                         <div className="flex justify-between items-center">
                            <p className="text-muted-foreground">{planDetails.name} ({billingCycle})</p>
                            <p className="font-semibold">${price.toFixed(2)}</p>
                        </div>
                        {isUpgrade && creditAmount > 0 && (
                            <div className="flex justify-between items-center text-green-600">
                                <p>Credit from Plus plan</p>
                                <p className="font-semibold">-${creditAmount.toFixed(2)}</p>
                            </div>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center text-lg">
                            <p className="font-bold">Total Due Today</p>
                            <p className="font-bold">${finalPrice.toFixed(2)}</p>
                        </div>
                    </div>

                </CardContent>
                <CardFooter>
                    <Button onClick={handleConfirm} disabled={isProcessing} className="w-full">
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Confirm Subscription
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
