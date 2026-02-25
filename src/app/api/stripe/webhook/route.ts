
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
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
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        default:
          throw new Error(`Unhandled relevant event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handler error:', error);
      return new NextResponse('Webhook handler failed. See server logs for details.', { status: 500 });
    }
  }

  return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const { metadata, customer, subscription } = session;
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
    const userProfile = userDoc.data()!;

    if (session.mode === 'subscription') {
        const plan = metadata?.plan as 'plus' | 'ultimate' | undefined;
        if (!plan) {
            console.error('Subscription checkout session completed without a plan in metadata.');
            return;
        }

        const subscriptionDetails = await stripe.subscriptions.retrieve(subscription as string);

        const updateData: any = {
            stripeSubscriptionId: subscription,
            stripeCustomerId: customer,
            isPlusUser: plan === 'plus',
            isUltimateUser: plan === 'ultimate',
            subscriptionBillingCycle: 'monthly', // Only monthly is supported
            subscriptionRenewalDate: Timestamp.fromDate(new Date(subscriptionDetails.current_period_end * 1000)),
        };

        // Grant initial tokens for a new subscription
        if (plan === 'plus') {
            updateData.promotionTokens = (userProfile.promotionTokens || 0) + 1;
        } else if (plan === 'ultimate') {
            updateData.promotionTokens = (userProfile.promotionTokens || 0) + 5;
            updateData.extendTokens = (userProfile.extendTokens || 0) + 10;
        }

        await userRef.update(updateData);
        console.log(`Successfully provisioned '${plan}' plan for user ${userId}`);

    } else if (session.mode === 'payment') {
        const productType = metadata?.productType as 'token' | 'boost';
        const quantity = Number(metadata?.quantity || '0');

        if (productType === 'token') {
            await userRef.update({ extendTokens: (userProfile.extendTokens || 0) + quantity });
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

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const usersQuery = db.collection('users').where('stripeCustomerId', '==', customerId).limit(1);
    const userSnapshot = await usersQuery.get();

    if (userSnapshot.empty) {
        console.error(`Webhook: No user found with Stripe customer ID ${customerId} for subscription update.`);
        return;
    }
    
    const userRef = userSnapshot.docs[0].ref;

    // This event is fired for many reasons (e.g. plan changes, payment method updates).
    // Its main job here is to ensure the renewal date is always current.
    // NOTE: This could also grant renewal tokens if invoice.paid is not used, but that can be complex.
    // For now, we only grant tokens on initial checkout.
    await userRef.update({
        subscriptionRenewalDate: Timestamp.fromDate(new Date(subscription.current_period_end * 1000)),
    });

    console.log(`Updated subscription renewal date for user ${userRef.id}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const usersQuery = db.collection('users').where('stripeCustomerId', '==', customerId).limit(1);
    const userSnapshot = await usersQuery.get();

    if (userSnapshot.empty) {
        // It's possible to get a deletion event for a customer who never fully signed up.
        console.warn(`Webhook: No user found with Stripe customer ID ${customerId} for subscription deletion.`);
        return;
    }
    
    const userRef = userSnapshot.docs[0].ref;

    // Subscription is cancelled immediately or at period end.
    // Remove all subscription benefits from the user.
    await userRef.update({
        isPlusUser: false,
        isUltimateUser: false,
        subscriptionBillingCycle: null,
        stripeSubscriptionId: null, // Set to null as it's no longer active
        subscriptionRenewalDate: null,
    });

    console.log(`Deactivated subscription for user ${userRef.id} due to status: ${subscription.status}`);
}
