// Feature flags — flip to enable/disable functionality
// To turn Google OAuth back on: set GOOGLE_OAUTH to true AND enable Google provider in Supabase Dashboard

export const FEATURES = {
  // Shows the "Continue with Google" buttons on Login + Signup.
  // For these to actually succeed, the Google provider must be enabled in the
  // Supabase dashboard (Auth → Providers → Google) with a Google Cloud OAuth
  // client, and the redirect URL allow-listed. See DEPLOYMENT.md §Google sign-in.
  // Until then the button shows a friendly "not available yet" message on click.
  GOOGLE_OAUTH: true,
}
