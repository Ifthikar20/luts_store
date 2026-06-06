import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, getProducts, getRelatedProducts } from "@/lib/api";
import { ProductDetail } from "@/components/ProductDetail";
import { SectionHeading } from "@/components/SectionHeading";
import { ProductGrid } from "@/components/ProductGrid";

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

  return (
    <div className="pb-28">
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
