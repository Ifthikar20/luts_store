import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ProductCard } from "@/components/ProductCard";
import { CartProvider } from "@/context/CartContext";
import type { Product } from "@/lib/types";

// next/image renders a plain <img> under test so we can assert src/alt without
// Next's optimizer/runtime. We strip the boolean `fill` prop to avoid a React
// "non-boolean attribute" warning.
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
  }: {
    src: string;
    alt: string;
    fill?: boolean;
  }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img src={src} alt={alt} />;
  },
}));

// next/link is fine in jsdom, but we mock it to a plain anchor for stability
// (avoids depending on the App Router runtime).
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const product: Product = {
  id: "gid://shopify/Product/1",
  handle: "teal-orange",
  title: "Teal & Orange Cinematic",
  description: "A warm, filmic look.",
  descriptionHtml: "<p>A warm, filmic look.</p>",
  featuredImage: { url: "https://images.unsplash.com/p.jpg", altText: "Preview" },
  images: [],
  priceRange: {
    min: { amount: "49", currencyCode: "USD" },
    max: { amount: "49", currencyCode: "USD" },
  },
  variants: [
    {
      id: "gid://shopify/Variant/1",
      title: "Default",
      price: { amount: "49", currencyCode: "USD" },
      availableForSale: true,
    },
  ],
  tags: ["cinematic"],
  productType: "LUT Pack",
  vendor: "Luts.store",
  collections: [{ handle: "cinematic", title: "Cinematic" }],
  metafields: { lutCount: 12, formats: ["CUBE", "3DL"], compatibleApps: [] },
  featured: false,
};

function renderCard(p: Product = product) {
  return render(
    <CartProvider>
      <ProductCard product={p} />
    </CartProvider>,
  );
}

describe("ProductCard", () => {
  it("renders the title and product type", () => {
    renderCard();
    expect(
      screen.getByRole("heading", { name: "Teal & Orange Cinematic" }),
    ).toBeInTheDocument();
    expect(screen.getByText("LUT Pack")).toBeInTheDocument();
  });

  it("renders the formatted price", () => {
    renderCard();
    expect(screen.getByText("$49")).toBeInTheDocument();
  });

  it("links to the product detail page", () => {
    renderCard();
    // The title and the image both link to the detail page.
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/luts/teal-orange");
    }
  });

  it("renders the featured image with its alt text", () => {
    renderCard();
    expect(screen.getByRole("img", { name: "Preview" })).toHaveAttribute(
      "src",
      "https://images.unsplash.com/p.jpg",
    );
  });

  it("shows the LUT count and available formats", () => {
    renderCard();
    expect(screen.getByText("12 LUTs")).toBeInTheDocument();
    expect(screen.getByText("CUBE")).toBeInTheDocument();
    expect(screen.getByText("3DL")).toBeInTheDocument();
  });
});
