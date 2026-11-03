export const DB_KEY = "auricle-vto-v1";

export const STYLES = ["stud", "hoop", "drop", "cuff", "chandelier"];
export const MATERIALS = ["gold", "silver", "rose", "pearl"];
export const SIZES = ["small", "medium", "large"];

export const DEFAULT_PRODUCTS = [
  {
    id: "solitaire",
    name: "Solitaire Stud",
    style: "stud",
    material: "gold",
    metal: "gold",
    size: "small",
    price: 148,
    sku: "AU-ST-001",
    stock: 14,
    gem: "#e7eefc",
    radiusMm: 2.4,
    tubeMm: 0.8,
    dropMm: 0,
    shape: "round",
    description: "A round stone on a gold post. It is fixed to the lobule and rolls with the head.",
  },
  {
    id: "pearl-stud",
    name: "Pearl Stud",
    style: "stud",
    material: "pearl",
    metal: "pearl",
    size: "small",
    price: 96,
    sku: "AU-ST-014",
    stock: 20,
    gem: "#f4ece3",
    radiusMm: 4.2,
    tubeMm: 0.6,
    dropMm: 0,
    shape: "round",
    description: "A freshwater pearl. The shader treats it as a soft sphere rather than polished metal.",
  },
  {
    id: "onyx-bar",
    name: "Onyx Bar",
    style: "stud",
    material: "silver",
    metal: "silver",
    size: "medium",
    price: 88,
    sku: "AU-ST-022",
    stock: 9,
    gem: "#1c1d21",
    radiusMm: 2.1,
    tubeMm: 1.5,
    dropMm: 8,
    shape: "bar",
    description: "A short bar with a dark stone. Turning the head foreshortens the bar.",
  },
  {
    id: "classic-hoop",
    name: "Classic Hoop",
    style: "hoop",
    material: "gold",
    metal: "gold",
    size: "medium",
    price: 120,
    sku: "AU-HP-004",
    stock: 18,
    gem: "#f0d7a2",
    radiusMm: 14,
    tubeMm: 1.5,
    dropMm: 0,
    shape: "hoop",
    description: "A 28 mm gold hoop. Front-on it is a narrow ellipse. The near ear opens as the head turns.",
  },
  {
    id: "slim-hoop",
    name: "Slim Silver Hoop",
    style: "hoop",
    material: "silver",
    metal: "silver",
    size: "small",
    price: 74,
    sku: "AU-HP-011",
    stock: 22,
    gem: "#d5dbe3",
    radiusMm: 10,
    tubeMm: 0.85,
    dropMm: 0,
    shape: "hoop",
    description: "A thin silver hoop, 20 mm across, for a closer read of scale against the lobule.",
  },
  {
    id: "rose-hoop",
    name: "Rose Bold Hoop",
    style: "hoop",
    material: "rose",
    metal: "rose",
    size: "large",
    price: 136,
    sku: "AU-HP-019",
    stock: 7,
    gem: "#f0d2cb",
    radiusMm: 20,
    tubeMm: 2.1,
    dropMm: 0,
    shape: "hoop",
    description: "A heavier rose-gold hoop, 40 mm across. The inner half is hidden where it crosses the cheek.",
  },
  {
    id: "pearl-drop",
    name: "Pearl Drop",
    style: "drop",
    material: "pearl",
    metal: "gold",
    size: "medium",
    price: 160,
    sku: "AU-DR-006",
    stock: 11,
    gem: "#f6f0e8",
    radiusMm: 4.6,
    tubeMm: 0.7,
    dropMm: 28,
    shape: "pearl",
    description: "Gold wire and a pearl pendant. The pendant hangs with gravity and swings after a quick move.",
  },
  {
    id: "sapphire-drop",
    name: "Sapphire Drop",
    style: "drop",
    material: "gold",
    metal: "gold",
    size: "medium",
    price: 210,
    sku: "AU-DR-017",
    stock: 6,
    gem: "#2c4f86",
    radiusMm: 3.4,
    tubeMm: 0.55,
    dropMm: 36,
    shape: "gem",
    description: "A blue stone on a fine gold chain. Length is measured from the piercing.",
  },
  {
    id: "helix-cuff",
    name: "Helix Cuff",
    style: "cuff",
    material: "gold",
    metal: "gold",
    size: "medium",
    price: 118,
    sku: "AU-CF-003",
    stock: 8,
    gem: "#e7d7a4",
    radiusMm: 16,
    tubeMm: 1.25,
    dropMm: 0,
    shape: "cuff",
    description: "An ear cuff along the helix. It is locked to the upper ear and rolls with the head.",
  },
  {
    id: "jade-cuff",
    name: "Jade Climber",
    style: "cuff",
    material: "gold",
    metal: "gold",
    size: "small",
    price: 142,
    sku: "AU-CF-008",
    stock: 5,
    gem: "#2f7a62",
    radiusMm: 13,
    tubeMm: 1.05,
    dropMm: 0,
    shape: "cuff",
    description: "A short climber with jade beads, anchored above the lobule rather than through it.",
  },
  {
    id: "chandelier",
    name: "Crystal Chandelier",
    style: "chandelier",
    material: "silver",
    metal: "silver",
    size: "large",
    price: 188,
    sku: "AU-CH-002",
    stock: 4,
    gem: "#dbe7ff",
    radiusMm: 2.5,
    tubeMm: 0.5,
    dropMm: 42,
    shape: "gem",
    description: "Three silver strands of different lengths. They swing slightly out of phase.",
  },
];

export function cloneProducts() {
  return JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
}

export function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "HK$0";
  return `HK$${Math.round(amount)}`;
}

export function filterProducts(products, { q = "", style = "all", material = "all", size = "all" } = {}) {
  const query = q.trim().toLowerCase();
  return products.filter((product) => {
    if (style !== "all" && product.style !== style) return false;
    if (material !== "all" && product.material !== material) return false;
    if (size !== "all" && product.size !== size) return false;
    if (!query) return true;
    const haystack = [product.name, product.style, product.material, product.metal, product.sku, product.description]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function normalizeProduct(input, id) {
  const style = STYLES.includes(input.style) ? input.style : "stud";
  const material = MATERIALS.includes(input.material) ? input.material : "gold";
  const metal = MATERIALS.includes(input.metal) ? input.metal : material === "pearl" ? "gold" : material;
  const size = SIZES.includes(input.size) ? input.size : "medium";
  const gem = /^#[0-9a-fA-F]{6}$/.test(input.gem || "") ? input.gem : "#e7eefc";
  const image = typeof input.imageDataUrl === "string" && input.imageDataUrl.startsWith("data:image/")
    ? input.imageDataUrl
    : "";
  return {
    id: id || input.id || `custom-${Date.now()}`,
    name: String(input.name || "Untitled earring").trim().slice(0, 60),
    style,
    material,
    metal,
    size,
    price: clampNumber(input.price, 0, 99999, 0),
    sku: String(input.sku || "").trim().slice(0, 24),
    stock: Math.round(clampNumber(input.stock, 0, 9999, 0)),
    gem,
    radiusMm: clampNumber(input.radiusMm, 1, 36, 4),
    tubeMm: clampNumber(input.tubeMm, 0.3, 4, 1),
    dropMm: clampNumber(input.dropMm, 0, 80, style === "drop" || style === "chandelier" ? 30 : 0),
    shape: input.shape || (style === "cuff" ? "cuff" : style === "hoop" ? "hoop" : "round"),
    description: String(input.description || "").trim().slice(0, 280),
    imageDataUrl: image,
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

export function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { products: cloneProducts(), comments: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
      return { products: cloneProducts(), comments: [] };
    }
    return {
      products: parsed.products.map((product) => normalizeProduct(product, product.id)),
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
    };
  } catch {
    return { products: cloneProducts(), comments: [] };
  }
}

export function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}
