'use server';

import { stripe } from '@/lib/stripe';
import { db } from '@/firebase/server-init';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';

/**
 * Robustly retrieves or creates a Stripe Customer ID for a given user.
 * It is designed to be "self-healing": if a Customer ID exists in Firestore
 * but not in the current Stripe account (e.g. after switching from test to live),
 * it will automatically create a new one and update the database.
 */
async function getOrCreateStripeCustomerId(userId: string, email: string): Promise<string> {
    const userRef = db.collection('users').doc(userId);

    // 1. Get the current profile from Firestore
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new Error("User profile not found in database.");
    }

    const userData = userDoc.data()!;
    let existingId = userData.stripeCustomerId;

    // 2. If an ID exists, verify it with the current Stripe account
    if (existingId && typeof existingId === 'string' && existingId.startsWith('cus_')) {
        try {
            const customer = await stripe.customers.retrieve(existingId);
            // If retrieval succeeds and it's not a 'deleted' placeholder, return it.
            if (!(customer as Stripe.DeletedCustomer).deleted) {
                return existingId;
            }
        } catch (error: any) {
            // If the customer isn't found (e.g. account switch), we'll create a new one.
            const isNotFoundError = 
                error.code === 'resource_missing' || 
                (error.message && error.message.toLowerCase().includes('no such customer'));

            if (!isNotFoundError) {
                console.error("Stripe retrieval error:", error);
                throw error;
            }
            // Customer not found, proceed to create
        }
    }

    // 3. Create a new Customer ID atomically using a transaction
    try {
        const newCustomerId = await db.runTransaction(async (transaction) => {
            const tUserSnap = await transaction.get(userRef);
            if (!tUserSnap.exists) throw new Error("User profile not found during transaction.");
            
            const tUserData = tUserSnap.data()!;
            
            // Re-verify existingId inside transaction
            if (tUserData.stripeCustomerId && tUserData.stripeCustomerId !== existingId) {
                // Another process might have updated it already, check if it's different
                return tUserData.stripeCustomerId;
            }

            const customer = await stripe.customers.create({
                email: email,
                name: tUserData.displayName || 'AuctionPrime User',
                metadata: {
                    firebaseUID: userId,
                },
            });

            transaction.update(userRef, { stripeCustomerId: customer.id });
            return customer.id;
        });

        return newCustomerId;
    } catch (error: any) {
        console.error("Critical Error creating Stripe Customer:", error);
        throw new Error(`Billing connection failed: ${error.message || 'Please try again.'}`);
    }
}


export async function createCheckoutSession(
    userId: string,
    email: string,
    plan: 'plus' | 'ultimate'
): Promise<void> {

    const origin = headers().get('origin') || process.env.NEXT_PUBLIC_URL;
    
    if (!origin) {
        throw new Error("Application origin not found.");
    }

    const priceIdEnvVarName = plan === 'plus' ? 'STRIPE_PLUS_MONTHLY_ID' : 'STRIPE_ULTIMATE_MONTHLY_ID';
    const priceId = process.env[priceIdEnvVarName];

    if (!priceId || !priceId.startsWith('price_')) {
        throw new Error(`Configuration Error: Missing Price ID for ${plan}.`);
    }

    const customerId = await getOrCreateStripeCustomerId(userId, email);

    let sessionUrl: string | null = null;

    try {
        const checkoutSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer: customerId,
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            success_url: `${origin}/profile/subscription?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/profile/subscription`,
            metadata: {
                firebaseUID: userId,
                plan: plan,
            }
        });
        sessionUrl = checkoutSession.url;
    } catch (error: any) {
        console.error("Stripe Checkout Session Error:", error);
        throw new Error(`Failed to initiate checkout: ${error.message}`);
    }

    if (sessionUrl) {
        redirect(sessionUrl);
    } else {
        throw new Error("Stripe did not return a valid checkout URL.");
    }
}

export async function createOneTimeCheckoutSession(
    userId: string,
    email: string,
    product: 'token' | 'boost',
    quantity: number = 1,
    boostMetadata?: { itemId: string; itemCategory: string }
): Promise<void> {

    const origin = headers().get('origin') || process.env.NEXT_PUBLIC_URL;

    if (!origin) {
        throw new Error("Application origin not found.");
    }

    const priceIdEnvVarName = product === 'token' ? 'STRIPE_TOKEN_PRICE_ID' : 'STRIPE_BOOST_PRICE_ID';
    const priceId = process.env[priceIdEnvVarName];

    const successPath = product === 'token' 
        ? '/retailer/dashboard?payment_success=true'
        : `/${boostMetadata?.itemCategory}/${boostMetadata?.itemId}?boost_success=true`;
    
    if (product === 'boost' && !boostMetadata) {
        throw new Error("Item information is required to boost a listing.");
    }

    if (!priceId || !priceId.startsWith('price_')) {
        throw new Error(`Configuration Error: Missing Price ID for ${product}.`);
    }
    
    const customerId = await getOrCreateStripeCustomerId(userId, email);

    let sessionUrl: string | null = null;

    try {
        const checkoutSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer: customerId,
            line_items: [{
                price: priceId,
                quantity: quantity,
            }],
            success_url: `${origin}${successPath}`,
            cancel_url: `${origin}${product === 'token' ? '/profile/buy-tokens' : `/${boostMetadata?.itemCategory}/${boostMetadata?.itemId}`}`,
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
        sessionUrl = checkoutSession.url;
    } catch (error: any) {
        console.error("Stripe One-Time Purchase Error:", error);
        throw new Error(`Checkout failed: ${error.message}`);
    }

    if (sessionUrl) {
        redirect(sessionUrl);
    } else {
        throw new Error("Stripe did not return a valid checkout URL.");
    }
}


export async function createCustomerPortalSession(userId: string, email: string): Promise<void> {
    const origin = headers().get('origin') || process.env.NEXT_PUBLIC_URL;
    
    if (!origin) throw new Error("Origin not found.");

    const customerId = await getOrCreateStripeCustomerId(userId, email);

    let portalUrl: string | null = null;

    try {
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${origin}/profile`,
        });
        portalUrl = portalSession.url;
    } catch (error: any) {
        console.error("Stripe Portal Error:", error);
        throw new Error(`Could not access billing portal: ${error.message}`);
    }

    if (portalUrl) {
        redirect(portalUrl);
    } else {
        throw new Error("Stripe did not return a valid portal URL.");
    }
}
