import type { CuponeraCategoryTile } from "@/lib/cuponera/browse";
import type { CuponeraCategory, ProductIconKind } from "@/lib/cuponera/shared";

// The drawing a category's tile shows until the admin uploads a picture
// for it ("Explora ahorros por categoría"): one object that stands for it,
// in colors from the cuponera's palette.
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

// The other tiles that can close the last row: what sells, what's new, a
// list of the admin's, the brands, everything.
export const TILE_ART: Record<CuponeraCategoryTile["art"], { icon: ProductIconKind; color: string; background: string }> = {
  ...CATEGORY_ART,
  "lo-mas-comprado": { icon: "flame", color: "#ff8a65", background: "#fff1ec" },
  "lo-nuevo": { icon: "sparkle", color: "#00beb5", background: "#e6f9f7" },
  lista: { icon: "star", color: "#f2b01e", background: "#fdf3d6" },
  marcas: { icon: "tag", color: "#c9b8ff", background: "#f3efff" },
  todo: { icon: "grid", color: "#7bc89a", background: "#eaf6ee" },
};
