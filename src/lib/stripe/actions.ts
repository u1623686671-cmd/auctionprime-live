'use server';

import { stripe } from '@/lib/stripe';
import { auth } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/server-init';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';

type Plan = 'plus' | 'ultimate' | 'free';
type BillingCycle = 'monthly' | 'yearly';

// ============================================================================
// IMPORTANT: MANUAL ACTION REQUIRED
// ============================================================================
// Create products and prices in your Stripe dashboard and replace these IDs.
// You need one product for "Ubid Plus" and one for "Ubid Ultimate".
// Each product needs a "monthly" and a "yearly" price.
// ============================================================================
const SUBSCRIPTION_PRICE_IDS: Record<Exclude<Plan, 'free'>, Record<BillingCycle, string>> = {
    plus: {
        monthly: 'price_REPLACE_WITH_YOUR_PLUS_MONTHLY_PRICE_ID',
        yearly: 'price_REPLACE_WITH_YOUR_PLUS_YEARLY_PRICE_ID',
    },
    ultimate: {
        monthly: 'price_REPLACE_WITH_YOUR_ULTIMATE_MONTHLY_PRICE_ID',
        yearly: 'price_REPLACE_WITH_YOUR_ULTIMATE_YEARLY_PRICE_ID',
    },
};

const TOKEN_PRICE_ID = 'price_REPLACE_WITH_YOUR_TOKEN_PRICE_ID'; // A one-time price for 1 token at $2.00
const BOOST_PRICE_ID = 'price_REPLACE_WITH_YOUR_BOOST_PRICE_ID'; // A one-time price for 1 boost at $1.00


async function getOrCreateStripeCustomerId(userId: string, email: string): Promise<string> {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        throw new Error("User profile not found.");
    }

    const userData = userSnap.data();
    if (userData.stripeCustomerId) {
        return userData.stripeCustomerId;
    }

    // Create a new customer in Stripe
    const customer = await stripe.customers.create({
        email: email,
        name: userData.displayName,
        metadata: {
            firebaseUID: userId,
        },
    });

    // Save the new Stripe customer ID to the user's profile in Firestore
    await updateDoc(userRef, {
        stripeCustomerId: customer.id,
    });

    return customer.id;
}


export async function createCheckoutSession(
    plan: 'plus' | 'ultimate',
    billingCycle: 'monthly' | 'yearly'
): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
        return redirect('/login');
    }

    const priceId = SUBSCRIPTION_PRICE_IDS[plan][billingCycle];

    if (!priceId.startsWith('price_')) {
        throw new Error('Stripe price IDs are not configured. Please update src/lib/stripe/actions.ts');
    }

    const customerId = await getOrCreateStripeCustomerId(user.uid, user.email!);

    const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer: customerId,
        line_items: [{
            price: priceId,
            quantity: 1,
        }],
        success_url: `${process.env.NEXT_PUBLIC_URL}/profile/subscription?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_URL}/profile/subscription`,
        metadata: {
            firebaseUID: user.uid,
        }
    });

    if (checkoutSession.url) {
        redirect(checkoutSession.url);
    } else {
        throw new Error("Could not create Stripe checkout session.");
    }
}

export async function createOneTimeCheckoutSession(
    product: 'token' | 'boost',
    quantity: number = 1
): Promise<void> {
     const user = auth.currentUser;
    if (!user) {
        return redirect('/login');
    }

    const priceId = product === 'token' ? TOKEN_PRICE_ID : BOOST_PRICE_ID;
    const successPath = product === 'token' ? '/retailer/dashboard?payment_success=true' : '/retailer/dashboard?payment_success=true';

    if (!priceId.startsWith('price_')) {
        throw new Error('Stripe price IDs for one-time products are not configured.');
    }
    
    const customerId = await getOrCreateStripeCustomerId(user.uid, user.email!);

    const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer: customerId,
        line_items: [{
            price: priceId,
            quantity: quantity,
        }],
        success_url: `${process.env.NEXT_PUBLIC_URL}${successPath}`,
        cancel_url: `${process.env.NEXT_PUBLIC_URL}${successPath.split('?')[0]}`,
         metadata: {
            firebaseUID: user.uid,
            productType: product,
            quantity: quantity,
        }
    });
     if (checkoutSession.url) {
        redirect(checkoutSession.url);
    } else {
        throw new Error("Could not create Stripe checkout session.");
    }
}


export async function createCustomerPortalSession(): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
        return redirect('/login');
    }

    const customerId = await getOrCreateStripeCustomerId(user.uid, user.email!);

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.NEXT_PUBLIC_URL}/profile/subscription`,
    });

    if (portalSession.url) {
        redirect(portalSession.url);
    } else {
        throw new Error("Could not create Stripe customer portal session.");
    }
}
