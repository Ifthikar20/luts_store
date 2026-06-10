import { redirect } from "next/navigation";

// Accounts are created automatically on first Google/Apple sign-in, so there
// is no separate register form. Keep this URL as a friendly redirect to the
// unified sign-in page.
export default function RegisterPage() {
  redirect("/account/login");
}
