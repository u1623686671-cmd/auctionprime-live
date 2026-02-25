
'use server';

import { stripe } from '@/lib/stripe';
import { db } from '@/firebase/server-init';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';

type Plan = 'plus' | 'ultimate';

// This function remains the same, as it's robust.
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

    const customer = await stripe.customers.create({
        email: email,
        name: userData.displayName,
        metadata: {
            firebaseUID: userId,
        },
    });

    await userRef.update({
        stripeCustomerId: customer.id,
    });

    return customer.id;
}

// This function has improved error handling to be more specific.
export async function createCheckoutSession(
    userId: string,
    email: string,
    plan: 'plus' | 'ultimate'
): Promise<void> {

    const origin = headers().get('origin') || process.env.NEXT_PUBLIC_URL!;
    
    const priceIdEnvVarName = plan === 'plus' ? 'STRIPE_PLUS_MONTHLY_ID' : 'STRIPE_ULTIMATE_MONTHLY_ID';
    const priceId = process.env[priceIdEnvVarName];

    if (!priceId || !priceId.startsWith('price_')) {
        const errorMessage = `Server configuration error: The environment variable ${priceIdEnvVarName} is missing or invalid. Please check your apphosting.yaml file and ensure you have replaced the placeholder value.`;
        console.error(errorMessage);
        throw new Error(errorMessage);
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
        success_url: `${origin}/profile/subscription?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/profile/subscription`,
        metadata: {
            firebaseUID: userId,
            plan: plan,
        }
    });

    if (checkoutSession.url) {
        redirect(checkoutSession.url);
    } else {
        throw new Error("Could not create Stripe checkout session.");
    }
}

// This function also has improved error handling.
export async function createOneTimeCheckoutSession(
    userId: string,
    email: string,
    product: 'token' | 'boost',
    quantity: number = 1,
    boostMetadata?: { itemId: string; itemCategory: string }
): Promise<void> {

    const origin = headers().get('origin') || process.env.NEXT_PUBLIC_URL!;

    const priceIdEnvVarName = product === 'token' ? 'STRIPE_TOKEN_PRICE_ID' : 'STRIPE_BOOST_PRICE_ID';
    const priceId = process.env[priceIdEnvVarName];

    const successPath = product === 'token' 
        ? '/retailer/dashboard?payment_success=true'
        : `/${boostMetadata?.itemCategory}/${boostMetadata?.itemId}?boost_success=true`;
    
    if (product === 'boost' && !boostMetadata) {
        throw new Error("Item information is required to boost a listing.");
    }

    if (!priceId || !priceId.startsWith('price_')) {
        const errorMessage = `Server configuration error: The environment variable ${priceIdEnvVarName} is missing or invalid. Please check your apphosting.yaml file and ensure you have replaced the placeholder value.`;
        console.error(errorMessage);
        throw new Error(errorMessage);
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
     if (checkoutSession.url) {
        redirect(checkoutSession.url);
    } else {
        throw new Error("Could not create Stripe checkout session.");
    }
}


export async function createCustomerPortalSession(userId: string, email: string): Promise<void> {
    const origin = headers().get('origin') || process.env.NEXT_PUBLIC_URL!;
    const customerId = await getOrCreateStripeCustomerId(userId, email);

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/profile/subscription`,
    });

    if (portalSession.url) {
        redirect(portalSession.url);
    } else {
        throw new Error("Could not create Stripe customer portal session.");
    }
}
