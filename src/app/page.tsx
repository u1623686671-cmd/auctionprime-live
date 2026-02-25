import { redirect } from 'next/navigation';

// This function now uses a server-side redirect, which is more reliable
// for the root page of a Next.js application in a production environment.
// It directly tells the server to send the user to the /login page
// without waiting for the client-side code to load, fixing the 404 error.
export default function WelcomeRedirectPage() {
  redirect('/login');
}
