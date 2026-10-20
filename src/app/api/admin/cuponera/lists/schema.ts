import { z } from "zod";
import { MAX_LIST_PRODUCTS } from "@/lib/cuponera/lists";
import { isCategory, isSubcategoryOf } from "@/lib/cuponera/shared";

// A front page list as Editar cuponera sends it (create and edit).
export const listSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    subtitle: z
      .string()
      .max(140)
      .nullable()
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    kind: z.enum(["category", "products"]),
    category: z.string().nullable(),
    subcategory: z.string().nullable(),
    productIds: z.array(z.string().min(1)).max(MAX_LIST_PRODUCTS),
  })
  .refine((v) => v.kind === "products" || isCategory(v.category), { message: "category_required", path: ["category"] })
  .refine((v) => v.kind === "category" || v.productIds.length > 0, { message: "products_required", path: ["productIds"] })
  .refine((v) => v.subcategory === null || (isCategory(v.category) && isSubcategoryOf(v.category, v.subcategory)), {
    message: "subcategory_outside_category",
    path: ["subcategory"],
  })
  .transform((v) => ({ ...v, category: isCategory(v.category) ? v.category : null }));
