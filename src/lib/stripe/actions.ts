'use server';

import { stripe } from '@/lib/stripe';
import { db } from '@/firebase/server-init';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';

type Plan = 'plus' | 'ultimate' | 'free';
type BillingCycle = 'monthly';

const SUBSCRIPTION_PRICE_IDS: Record<Exclude<Plan, 'free'>, Record<BillingCycle, string>> = {
    plus: {
        monthly: process.env.STRIPE_PLUS_MONTHLY_ID!,
    },
    ultimate: {
        monthly: process.env.STRIPE_ULTIMATE_MONTHLY_ID!,
    },
};

const TOKEN_PRICE_ID = process.env.STRIPE_TOKEN_PRICE_ID!; 
const BOOST_PRICE_ID = process.env.STRIPE_BOOST_PRICE_ID!; 


async function getOrCreateStripeCustomerId(userId: string, email: string): Promise<string> {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        throw new Error("User profile not found.");
    }

    const userData = userSnap.data()!;
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
    await userRef.update({
        stripeCustomerId: customer.id,
    });

    return customer.id;
}


export async function createCheckoutSession(
    userId: string,
    email: string,
    plan: 'plus' | 'ultimate',
    billingCycle: 'monthly'
): Promise<void> {

    const priceId = SUBSCRIPTION_PRICE_IDS[plan][billingCycle];

    if (!priceId || !priceId.startsWith('price_')) {
        throw new Error('Stripe monthly subscription price IDs are not configured correctly in your environment variables.');
    }

    const customerId = await getOrCreateStripeCustomerId(userId, email);

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
            firebaseUID: userId,
        }
    });

    if (checkoutSession.url) {
        redirect(checkoutSession.url);
    } else {
        throw new Error("Could not create Stripe checkout session.");
    }
}

export async function createOneTimeCheckoutSession(
    userId: string,
    email: string,
    product: 'token' | 'boost',
    quantity: number = 1,
    boostMetadata?: { itemId: string; itemCategory: string }
): Promise<void> {

    const priceId = product === 'token' ? TOKEN_PRICE_ID : BOOST_PRICE_ID;
    const successPath = product === 'token' 
        ? '/retailer/dashboard?payment_success=true'
        : `/${boostMetadata?.itemCategory}/${boostMetadata?.itemId}?boost_success=true`;
    
    if (product === 'boost' && !boostMetadata) {
        throw new Error("Item information is required to boost a listing.");
    }

    if (!priceId || !priceId.startsWith('price_')) {
        throw new Error('Stripe one-time product price IDs are not configured correctly in your environment variables.');
    }
    
    const customerId = await getOrCreateStripeCustomerId(userId, email);

    const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer: customerId,
        line_items: [{
            price: priceId,
            quantity: quantity,
        }],
        success_url: `${process.env.NEXT_PUBLIC_URL}${successPath}`,
        cancel_url: `${process.env.NEXT_PUBLIC_URL}${product === 'token' ? '/profile/buy-tokens' : `/${boostMetadata?.itemCategory}/${boostMetadata?.itemId}`}`,
         metadata: {
            firebaseUID: userId,
            productType: product,
            quantity: String(quantity),
            ...(product === 'boost' && boostMetadata ? {
                itemId: boostMetadata.itemId,
                itemCategory: boostMetadata.itemCategory,
            } : {}),
        }
    });
     if (checkoutSession.url) {
        redirect(checkoutSession.url);
    } else {
        throw new Error("Could not create Stripe checkout session.");
    }
}


export async function createCustomerPortalSession(userId: string, email: string): Promise<void> {
    const customerId = await getOrCreateStripeCustomerId(userId, email);

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
