import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getProducts, getRelatedProducts } from "@/lib/api";
import { ProductDetail } from "@/components/ProductDetail";
import { SectionHeading } from "@/components/SectionHeading";
import { ProductGrid } from "@/components/ProductGrid";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) return { title: "Look not found" };
  return {
    title: product.title,
    description: product.description,
    openGraph: {
      title: product.title,
      description: product.description,
      images: [{ url: product.featuredImage.url }],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

  const related = await getRelatedProducts(product);

  const anyAvailable = product.variants.some((v) => v.availableForSale);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: [product.featuredImage.url, ...product.images.map((i) => i.url)],
    sku: product.handle,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/luts/${product.handle}`),
      price: product.priceRange.min.amount,
      priceCurrency: product.priceRange.min.currencyCode,
      availability: anyAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="pb-28">
      <JsonLd data={productJsonLd} />
      <ProductDetail product={product} />

      {related.length > 0 && (
        <section className="container-xl mt-28">
          <SectionHeading eyebrow="Keep grading" title="You might also like" />
          <div className="mt-10">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </div>
  );
}
