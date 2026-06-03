import LoginForm from "./LoginForm";

// Server component: reads the server-side env at request time (no build-time
// inlining gotcha). The email magic-link form shows whenever Resend is configured.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const emailEnabled = !!process.env.AUTH_RESEND_KEY;
  return <LoginForm emailEnabled={emailEnabled} />;
}
