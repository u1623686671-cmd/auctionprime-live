import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("Webhook secret or signature not found.");
    return new NextResponse('Webhook secret not configured', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;
        default:
          throw new Error(`Unhandled relevant event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handler error:', error);
      return new NextResponse('Webhook handler failed. See logs.', { status: 500 });
    }
  }

  return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const { metadata } = session;
    const userId = metadata?.firebaseUID;

    if (!userId) {
        console.error("No firebaseUID in checkout session metadata");
        return;
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        console.error(`User ${userId} not found in Firestore.`);
        return;
    }
    
    if (session.mode === 'subscription') {
        const subscriptionId = session.subscription as string;
        await userRef.update({
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: session.customer as string,
        });
        // Subscription benefits are handled by `customer.subscription.created/updated`
    } else if (session.mode === 'payment') {
        const productType = metadata?.productType as 'token' | 'boost';
        const quantity = Number(metadata?.quantity || '0');

        if (productType === 'token') {
            const currentTokens = userDoc.data()?.extendTokens || 0;
            await userRef.update({ extendTokens: currentTokens + quantity });
        } else if (productType === 'boost') {
            const currentTokens = userDoc.data()?.promotionTokens || 0;
            await userRef.update({ promotionTokens: currentTokens + quantity });
        }
        console.log(`Provisioned ${quantity} ${productType}(s) for user ${userId}`);
    }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const usersQuery = db.collection('users').where('stripeCustomerId', '==', customerId).limit(1);
    const userSnapshot = await usersQuery.get();

    if (userSnapshot.empty) {
        console.error(`No user found with Stripe customer ID ${customerId}`);
        return;
    }
    
    const userDoc = userSnapshot.docs[0];
    const userRef = userDoc.ref;

    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
        await userRef.update({
            isPlusUser: false,
            isUltimateUser: false,
            subscriptionBillingCycle: null,
            stripeSubscriptionId: null,
        });
        return;
    }
    
    const priceId = subscription.items.data[0].price.id;

    const priceIdToPlan: Record<string, { plan: 'plus' | 'ultimate', cycle: 'monthly' | 'yearly' }> = {
        [process.env.STRIPE_PLUS_MONTHLY_ID || '']: { plan: 'plus', cycle: 'monthly' },
        [process.env.STRIPE_PLUS_YEARLY_ID || '']: { plan: 'plus', cycle: 'yearly' },
        [process.env.STRIPE_ULTIMATE_MONTHLY_ID || '']: { plan: 'ultimate', cycle: 'monthly' },
        [process.env.STRIPE_ULTIMATE_YEARLY_ID || '']: { plan: 'ultimate', cycle: 'yearly' },
    };
    
    const planInfo = priceIdToPlan[priceId];

    if (!planInfo) {
        console.error(`Could not map price ID ${priceId} to a plan. Make sure env vars are set.`);
        return;
    }

    const renewalDate = new Date(subscription.current_period_end * 1000);
    
    const updateData: any = {
        isPlusUser: planInfo.plan === 'plus',
        isUltimateUser: planInfo.plan === 'ultimate',
        subscriptionBillingCycle: planInfo.cycle,
        stripeSubscriptionId: subscription.id,
        subscriptionRenewalDate: Timestamp.fromDate(renewalDate)
    };

    // Grant tokens on new subscriptions or renewals
    const userProfile = userDoc.data();
    if (!userProfile?.stripeSubscriptionId || subscription.id !== userProfile.stripeSubscriptionId) {
        // This is a new subscription or a plan change, grant tokens
        if(planInfo.plan === 'plus'){
            updateData.promotionTokens = (userProfile.promotionTokens || 0) + (planInfo.cycle === 'monthly' ? 1 : 12);
        }
        else if (planInfo.plan === 'ultimate'){
            updateData.promotionTokens = (userProfile.promotionTokens || 0) + (planInfo.cycle === 'monthly' ? 5 : 60);
            updateData.extendTokens = (userProfile.extendTokens || 0) + (planInfo.cycle === 'monthly' ? 10 : 120);
        }
    }
    
    await userRef.update(updateData);
}
