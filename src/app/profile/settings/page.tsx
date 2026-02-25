
import { redirect } from 'next/navigation';

/**
 * This page is deprecated. We now use Stripe's secure Billing Portal 
 * to manage payment methods. Users are redirected to the billing management view.
 */
export default function SettingsRedirectPage() {
  redirect('/profile/manage-billing');
}
