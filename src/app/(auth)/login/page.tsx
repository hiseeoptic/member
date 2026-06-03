import LoginForm from "./LoginForm";

// Website login is Google-only (verified). The simple "enter email" flow lives
// in the Chrome extension as a trial activation, not as a website login.
export default function LoginPage() {
  return <LoginForm emailEnabled={false} />;
}
