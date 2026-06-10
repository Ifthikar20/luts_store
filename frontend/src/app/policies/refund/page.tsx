import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout, PolicySection } from "@/components/PolicyLayout";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Our refund policy for instantly delivered digital LUT packs, including when we make exceptions for corrupt or non-working files.",
};

export default function RefundPage() {
  return (
    <PolicyLayout
      title="Refund Policy"
      lastUpdated="June 6, 2026"
      intro="This Refund Policy explains when refunds are and aren’t available for purchases of our digital LUT products. Because our products are downloadable digital goods delivered instantly, special rules apply."
    >
      <PolicySection heading="1. Digital goods are delivered instantly">
        <p>
          When you complete a purchase, you receive immediate access to download
          the LUT files. Because the goods are delivered at once and cannot be
          “returned”, all sales are generally final and refunds are not offered
          for change of mind, accidental purchase, or lack of compatibility you
          could have checked before buying.
        </p>
        <p>
          By completing checkout and accessing the download, you acknowledge that
          you are receiving the product immediately and, where applicable, you
          consent to waiving any statutory cooling-off period for digital content
          that begins on download.
        </p>
      </PolicySection>

      <PolicySection heading="2. When we will make it right">
        <p>
          We stand behind our files. If a download is corrupt, the wrong file was
          delivered, or a LUT genuinely fails to load in a supported application,
          contact us within a reasonable time and we will repair the file,
          re-deliver it, or — at our discretion — issue a refund or store credit.
        </p>
      </PolicySection>

      <PolicySection heading="3. Before requesting help">
        <p>
          Many issues are quick fixes. Please check our{" "}
          <Link
            href="/help"
            className="text-grade-teal underline-offset-4 hover:underline"
          >
            Help Center
          </Link>{" "}
          for install guides and supported formats, and confirm you are loading
          the correct .cube/.3dl file for your editor before reaching out.
        </p>
      </PolicySection>

      <PolicySection heading="4. How to request a refund">
        <p>
          Email{" "}
          <a
            href="mailto:support@luts.shop"
            className="text-grade-teal underline-offset-4 hover:underline"
          >
            support@luts.shop
          </a>{" "}
          with your order number and a description of the problem. We aim to
          respond within one business day. Approved refunds are returned to your
          original payment method.
        </p>
      </PolicySection>

      <PolicySection heading="5. Statutory rights">
        <p>
          Nothing in this policy is intended to limit any non-waivable rights you
          may have under the consumer-protection laws of your jurisdiction.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
