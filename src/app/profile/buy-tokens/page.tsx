
'use client';

import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Coins, Minus, Plus, HelpCircle, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { createOneTimeCheckoutSession } from "@/lib/stripe/actions";

export default function BuyTokensPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [isAllowed, setIsAllowed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const TOKEN_PRICE = 2; // $2 per token

    useEffect(() => {
        if (isUserLoading) return;

        if (!user) {
            router.replace('/login');
            return;
        }

        setIsAllowed(true);
    }, [isUserLoading, user, router]);

    const handlePurchase = async () => {
        if (!user || !user.email) return;
        setIsSubmitting(true);
        try {
            await createOneTimeCheckoutSession(user.uid, user.email, 'token', quantity);
            // The user will be redirected to Stripe by the server action.
            // If it fails, the catch block will handle it.
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Purchase Failed',
                description: error.message || 'Could not redirect you to checkout. Please try again.',
            });
            setIsSubmitting(false);
        }
    };
    
    if (!isAllowed) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    const totalPrice = quantity * TOKEN_PRICE;

    return (
        <div className="container mx-auto max-w-2xl px-4 py-12 md:py-16 space-y-8">
            <div className="mb-0 -mt-6">
                <Button asChild variant="ghost" size="icon" className="rounded-full bg-muted text-muted-foreground hover:bg-muted/80">
                    <Link href="/retailer/dashboard">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
            </div>
            
            <Card className="!mt-0 border-0 shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-2xl">
                        <Coins className="w-8 h-8 text-primary"/>
                        <span>Extend Tokens</span>
                    </CardTitle>
                    <CardDescription>
                        Give your auction a last-minute boost to attract more bids.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-secondary/50 space-y-3">
                         <div className="flex items-start gap-3">
                            <HelpCircle className="w-5 h-5 mt-1 text-primary shrink-0"/>
                            <div>
                                <h4 className="font-semibold">How it Works</h4>
                                <p className="text-sm text-muted-foreground">Using a token extends your auction's end time by <strong>1 hour</strong>, giving bidders more time to compete and drive up the final price.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <ChevronsRight className="w-5 h-5 mt-1 text-primary shrink-0"/>
                             <div>
                                <h4 className="font-semibold">Usage Limit</h4>
                                <p className="text-sm text-muted-foreground">You can extend any single auction a maximum of <strong>3 times</strong>. Use your tokens wisely!</p>
                            </div>
                        </div>
                    </div>

                    <Separator className="my-6"/>

                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-sm text-muted-foreground">Price per Token</p>
                        <p className="text-2xl font-bold">${TOKEN_PRICE.toFixed(2)}</p>
                    </div>
                     <div className="flex items-center justify-center gap-4 pt-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            disabled={quantity <= 1}
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-2xl font-bold w-12 text-center">{quantity}</span>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setQuantity(q => q + 1)}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
                 <CardFooter className="flex-col gap-4 border-t pt-6">
                    <div className="w-full flex justify-between items-center text-lg font-semibold">
                        <span>Total Price:</span>
                        <span>${totalPrice.toFixed(2)}</span>
                    </div>
                    <Button onClick={handlePurchase} disabled={isSubmitting} className="w-full">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSubmitting ? 'Processing...' : `Buy ${quantity} Token(s)`}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
