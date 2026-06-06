import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout, PolicySection } from "@/components/PolicyLayout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms and conditions governing your use of The Looks Lab store and the purchase of digital LUT products.",
};

export default function TermsPage() {
  return (
    <PolicyLayout
      title="Terms of Service"
      lastUpdated="June 6, 2026"
      intro="These Terms of Service (“Terms”) govern your access to and use of The Looks Lab website and your purchase of our digital products. By using the site or buying a product, you agree to these Terms."
    >
      <PolicySection heading="1. The products">
        <p>
          We sell digital color-grading LUT packs delivered as downloadable
          files. All products are intangible digital goods provided “as is”. The
          specific files included with each product are described on its product
          page.
        </p>
      </PolicySection>

      <PolicySection heading="2. Accounts">
        <p>
          You are responsible for maintaining the confidentiality of your account
          credentials and for all activity under your account. Notify us promptly
          of any unauthorized use. You must provide accurate information and be
          old enough to form a binding contract in your jurisdiction.
        </p>
      </PolicySection>

      <PolicySection heading="3. Orders, pricing and payment">
        <p>
          Prices are listed at checkout and may change at any time. By placing an
          order you authorize us (and our payment processor) to charge your
          chosen payment method. We may refuse or cancel orders we believe are
          fraudulent or in breach of these Terms.
        </p>
      </PolicySection>

      <PolicySection heading="4. License to use products">
        <p>
          Your purchase grants you a license to use the LUT files under the terms
          of our{" "}
          <Link
            href="/policies/license"
            className="text-grade-teal underline-offset-4 hover:underline"
          >
            LUT License / EULA
          </Link>
          . You do not acquire ownership of the underlying intellectual property,
          and you may not redistribute or resell the files.
        </p>
      </PolicySection>

      <PolicySection heading="5. Refunds">
        <p>
          Because our products are instantly delivered digital goods, our refund
          terms are set out in the{" "}
          <Link
            href="/policies/refund"
            className="text-grade-teal underline-offset-4 hover:underline"
          >
            Refund Policy
          </Link>
          , which forms part of these Terms.
        </p>
      </PolicySection>

      <PolicySection heading="6. Acceptable use">
        <p>
          You agree not to misuse the site, attempt to gain unauthorized access,
          interfere with its operation, or use it for any unlawful purpose. We
          may suspend or terminate access for breach of these Terms.
        </p>
      </PolicySection>

      <PolicySection heading="7. Disclaimers and limitation of liability">
        <p>
          To the fullest extent permitted by law, our products and services are
          provided without warranties of any kind, and our total liability for
          any claim relating to your purchase is limited to the amount you paid
          for the relevant product. We are not liable for indirect or
          consequential losses.
        </p>
      </PolicySection>

      <PolicySection heading="8. Changes to these Terms">
        <p>
          We may update these Terms from time to time. Material changes will be
          reflected by updating the “Last updated” date above. Your continued use
          of the site after changes take effect constitutes acceptance.
        </p>
      </PolicySection>

      <PolicySection heading="9. Contact">
        <p>
          Questions about these Terms? Email{" "}
          <a
            href="mailto:support@thelookslab.com"
            className="text-grade-teal underline-offset-4 hover:underline"
          >
            support@thelookslab.com
          </a>
          .
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
