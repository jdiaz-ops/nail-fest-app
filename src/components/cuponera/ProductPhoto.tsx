import ProductIcon from "./ProductIcon";
import type { CuponeraProduct } from "@/lib/cuponera/shared";

// The product's photo from its store, or — in the sample preview, or for a
// product without one — the line drawing in its category's colors.
export default function ProductPhoto({ product, size }: { product: CuponeraProduct; size: number }) {
  if (product.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- photo hosted by the brand's store (Marcolini, Shopify…)
    return <img className="cup-photo-img" src={product.imageUrl} alt="" loading="lazy" decoding="async" />;
  }
  return <ProductIcon kind={product.icon} color={product.color} size={size} />;
}
