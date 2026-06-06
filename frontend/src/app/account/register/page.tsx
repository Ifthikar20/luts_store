import { redirect } from "next/navigation";

// Account creation now happens through Shopify Customer Accounts (hosted login),
// so there is no separate register form. Keep this URL as a friendly redirect to
// the unified sign-in page.
export default function RegisterPage() {
  redirect("/account/login");
}
