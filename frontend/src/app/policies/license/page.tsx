import type { Metadata } from "next";
import { PolicyLayout, PolicySection } from "@/components/PolicyLayout";

export const metadata: Metadata = {
  title: "LUT License / EULA",
  description:
    "The end-user license agreement for The Looks Lab LUT packs, covering personal and commercial use and non-redistribution terms.",
};

export default function LicensePage() {
  return (
    <PolicyLayout
      title="LUT License / EULA"
      lastUpdated="June 6, 2026"
      intro="This End-User License Agreement (“License”) governs your use of any LUT files (“Looks”) purchased or downloaded from The Looks Lab. By downloading or using the Looks, you agree to this License."
    >
      <PolicySection heading="1. License granted">
        <p>
          Subject to your compliance with this License, we grant you a
          worldwide, non-exclusive, non-transferable, perpetual license to use
          the Looks you have purchased for both personal and commercial projects,
          including client work, films, advertisements, social media and similar
          productions.
        </p>
      </PolicySection>

      <PolicySection heading="2. Permitted uses">
        <ul className="list-disc space-y-1 pl-5">
          <li>Use the Looks to grade your own video and photo projects.</li>
          <li>
            Use the Looks in paid client and commercial work and in monetized
            content.
          </li>
          <li>
            Install the Looks on the computers you personally own or control to
            do your own work.
          </li>
        </ul>
      </PolicySection>

      <PolicySection heading="3. Restrictions">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            You may not resell, sublicense, share, lend, give away or otherwise
            redistribute the Looks themselves, whether modified or unmodified.
          </li>
          <li>
            You may not include the Looks (as files) in any product, template,
            bundle, preset pack or stock library offered to others.
          </li>
          <li>
            You may not claim authorship of the Looks or represent them as your
            own product.
          </li>
          <li>
            You may not use the Looks to train, fine-tune or build automated or
            machine-learning systems that reproduce or generate comparable LUTs.
          </li>
        </ul>
        <p>
          The output of applying a Look to your own footage (your graded video or
          images) is yours to use freely — the restrictions apply to the LUT
          files, not to the work you create with them.
        </p>
      </PolicySection>

      <PolicySection heading="4. Ownership">
        <p>
          The Looks are licensed, not sold. We and our licensors retain all
          intellectual property rights in the Looks. This License does not
          transfer any ownership of the underlying files to you.
        </p>
      </PolicySection>

      <PolicySection heading="5. Updates">
        <p>
          Where we publish updates to a pack you own, those updated files are
          covered by this same License at no additional charge.
        </p>
      </PolicySection>

      <PolicySection heading="6. Termination">
        <p>
          This License terminates automatically if you breach any of its terms,
          in which case you must stop using and delete the affected files. Your
          right to keep any work already created with the Looks survives
          termination.
        </p>
      </PolicySection>

      <PolicySection heading="7. Warranty disclaimer">
        <p>
          The Looks are provided “as is” without warranties of any kind. We do
          not guarantee any particular result with your specific footage, camera
          or workflow.
        </p>
      </PolicySection>

      <PolicySection heading="8. Contact">
        <p>
          Need an extended or team license, or unsure whether your use is
          permitted? Email{" "}
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
