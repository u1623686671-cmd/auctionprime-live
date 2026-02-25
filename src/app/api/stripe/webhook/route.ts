
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
    console.error("Stripe webhook error: Signature or secret not found.");
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
          // This case should theoretically never be reached due to the `relevantEvents` check.
          throw new Error(`Unhandled relevant event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handler error:', error);
      // Return 500 to indicate an internal error to Stripe, but we've logged it.
      return new NextResponse('Webhook handler failed. See server logs for details.', { status: 500 });
    }
  } else {
    // Acknowledge receipt of an event we don't care about.
    console.log(`Received and ignored irrelevant event type: ${event.type}`);
  }

  // Return 200 OK to Stripe
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
            console.log(`Provisioned ${quantity} ${productType}(s) for user ${userId}`);
        } else if (productType === 'boost') {
            const itemId = metadata?.itemId;
            const itemCategory = metadata?.itemCategory;

            if (!itemId || !itemCategory) {
                 console.error("No itemId or itemCategory in boost checkout session metadata.");
                 return;
            }

            const itemRef = db.collection(itemCategory).doc(itemId);
            await itemRef.update({ isPromoted: true });
            console.log(`Boosted listing ${itemId} in ${itemCategory} for user ${userId}`);
        }
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

    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired' || subscription.status === 'unpaid') {
        await userRef.update({
            isPlusUser: false,
            isUltimateUser: false,
            subscriptionBillingCycle: null,
            stripeSubscriptionId: null,
            subscriptionRenewalDate: null,
        });
        console.log(`Deactivated subscription for user ${userDoc.id} due to status: ${subscription.status}`);
        return;
    }
    
    const priceId = subscription.items.data[0].price.id;

    const priceIdToPlan: Record<string, { plan: 'plus' | 'ultimate', cycle: 'monthly' }> = {
        [process.env.STRIPE_PLUS_MONTHLY_ID || '']: { plan: 'plus', cycle: 'monthly' },
        [process.env.STRIPE_ULTIMATE_MONTHLY_ID || '']: { plan: 'ultimate', cycle: 'monthly' },
    };
    
    const planInfo = priceIdToPlan[priceId];

    if (!planInfo) {
        // IMPORTANT: Log the unrecognized price ID but do not throw an error.
        // This prevents an old or invalid subscription plan from breaking the webhook for all users.
        console.warn(`Webhook received an unrecognized subscription price ID: '${priceId}'. This plan will be ignored.`);
        return; // Gracefully exit without erroring.
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
            updateData.promotionTokens = (userProfile.promotionTokens || 0) + 1;
        }
        else if (planInfo.plan === 'ultimate'){
            updateData.promotionTokens = (userProfile.promotionTokens || 0) + 5;
            updateData.extendTokens = (userProfile.extendTokens || 0) + 10;
        }
    }
    
    await userRef.update(updateData);
    console.log(`Successfully updated subscription for user ${userDoc.id} to plan: ${planInfo.plan}`);
}
