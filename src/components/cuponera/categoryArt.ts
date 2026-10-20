import type { CuponeraCategory, ProductIconKind } from "@/lib/cuponera/shared";

// The drawing a category's tile shows until the admin uploads a picture
// for it ("Descubre por categoría"): one object that stands for it, in
// colors from the cuponera's palette.
export const CATEGORY_ART: Record<CuponeraCategory, { icon: ProductIconKind; color: string; background: string }> = {
  esmaltes: { icon: "bottle", color: "#f06292", background: "#fde8ef" },
  construccion: { icon: "bottle", color: "#e8c4a8", background: "#fff3ea" },
  acrilico: { icon: "drop", color: "#cfe3f0", background: "#e9f3fa" },
  softgel: { icon: "tips", color: "#ffffff", background: "#e6f9f7" },
  herramientas: { icon: "lamp", color: "none", background: "#f1efea" },
  cuidado: { icon: "drop", color: "#f2b01e", background: "#fdf3d6" },
  decoracion: { icon: "star", color: "#f2b01e", background: "#fde8ef" },
  stamping: { icon: "brush", color: "#17181c", background: "#eef0ff" },
  kits: { icon: "kit", color: "#ffc5a8", background: "#fff3ea" },
};
