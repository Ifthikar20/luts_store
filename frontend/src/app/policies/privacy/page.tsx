import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/PolicyLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Luts.store collects, uses and protects your personal information when you browse and buy cinematic LUT packs.",
};

export default function PrivacyPage() {
  return (
    <PolicyLayout
      title="Privacy Policy"
      lastUpdated="June 6, 2026"
      intro="This Privacy Policy describes how Luts.store (“we”, “us”, “our”) collects, uses and shares information when you visit our store, create an account, or purchase a LUT pack."
    >
      <PolicySection heading="1. Information we collect">
        <p>
          We collect information you provide directly — such as your name, email
          address and the contents of messages you send us — and information
          collected automatically, such as your IP address, browser type, pages
          viewed and similar usage data. Payment details are processed by our
          payment provider; we do not store full card numbers on our servers.
        </p>
      </PolicySection>

      <PolicySection heading="2. How we use information">
        <p>
          We use your information to process orders and deliver downloads,
          provide customer support, send transactional emails (such as receipts
          and download links), and — where you have opted in — send newsletters
          and product updates. We also use aggregated, de-identified data to
          improve our products and store.
        </p>
      </PolicySection>

      <PolicySection heading="3. Marketing communications">
        <p>
          If you subscribe to our newsletter, we will email you about new
          releases, tips and offers. You can unsubscribe at any time using the
          link in any marketing email; this does not affect transactional emails
          related to your purchases.
        </p>
      </PolicySection>

      <PolicySection heading="4. Cookies and analytics">
        <p>
          We use cookies and similar technologies to operate the store, remember
          your cart and session, and understand how the site is used. You can
          control cookies through your browser settings, though some features may
          not function without them.
        </p>
      </PolicySection>

      <PolicySection heading="5. Sharing your information">
        <p>
          We share information with service providers who help us operate the
          business — for example payment processors, email delivery services and
          hosting providers — under agreements that require them to protect your
          data. We may also disclose information where required by law or to
          protect our rights.
        </p>
      </PolicySection>

      <PolicySection heading="6. Data retention">
        <p>
          We retain personal information for as long as needed to provide our
          services, comply with legal obligations, resolve disputes and enforce
          our agreements. You may request deletion of your data subject to those
          obligations.
        </p>
      </PolicySection>

      <PolicySection heading="7. Your rights">
        <p>
          Depending on where you live, you may have rights to access, correct,
          delete or port your personal information, and to object to or restrict
          certain processing. To exercise these rights, contact us using the
          details below.
        </p>
      </PolicySection>

      <PolicySection heading="8. Contact us">
        <p>
          Questions about this policy? Email us at{" "}
          <a
            href="mailto:support@luts.store"
            className="text-grade-teal underline-offset-4 hover:underline"
          >
            support@luts.store
          </a>
          .
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
