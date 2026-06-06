import { redirect } from "next/navigation";

// The auth form lives on /account/login with a "Sign up" tab. /account/register
// is kept as a friendly URL that lands directly on that tab.
export default function RegisterPage() {
  redirect("/account/login?mode=register");
}
