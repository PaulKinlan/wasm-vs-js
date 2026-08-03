import {
  assertContract,
  COUNTS,
  FIXTURE_SEED,
  IMPORT_ORDER,
} from "../benchmarks/base/sqlite-notebook/contract.js";

assertContract();
const output = new URL("../public/artifacts/sqlite-notebook/fixtures/", import.meta.url);
await Deno.mkdir(output, { recursive: true });

let state = FIXTURE_SEED >>> 0;
function nextU32() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

const regions = ["americas", "europe", "asia-pacific", "middle-east-africa"];
const customerRoots = [
  "Aurora",
  "Björk",
  "Café",
  "東京",
  "München",
  "São-Paulo",
  "Zürich",
  "Δέλτα",
];
const categories = [
  "audio",
  "books",
  "camera",
  "garden",
  "kitchen",
  "outdoor",
  "toys",
  "wearables",
];
const productRoots = ["Écho", "灯", "Nimbus", "Pico", "Québec", "Rīga", "Sol", "Übung"];

const customers = ["id,name,region"];
for (let id = 1; id <= COUNTS.customers; id++) {
  customers.push(
    `${id},${customerRoots[(id - 1) % customerRoots.length]}-${String(id).padStart(2, "0")},${
      regions[(id * 5 + 1) % regions.length]
    }`,
  );
}

const products = ["id,name,category"];
for (let id = 1; id <= COUNTS.products; id++) {
  const unit = 200 + ((id * 137) % 4800);
  products.push(
    `${id},${productRoots[(id - 1) % productRoots.length]}-${id}-${unit},${
      categories[(id * 3 + 2) % categories.length]
    }`,
  );
}

const discounts = [0, 500, 1000, 1500];
const coupons = ["", "WELCOME", "LOYAL", "SPRING", "夜市"];
const sales = [
  "id,customer_id,product_id,sale_month,sale_day,quantity,unit_cents,discount_bps,coupon_code",
];
for (let id = 1; id <= COUNTS.sales; id++) {
  const random = nextU32();
  const customerId = (random % COUNTS.customers) + 1;
  const productId = ((random >>> 8) % COUNTS.products) + 1;
  const monthIndex = (random >>> 16) % 12;
  const dayInMonth = ((random >>> 20) % 28) + 1;
  const saleMonth = 202501 + monthIndex;
  const saleDay = saleMonth * 100 + dayInMonth;
  const quantity = ((random >>> 3) % 5) + 1;
  const unitCents = 200 + ((productId * 137) % 4800);
  const discountBps = discounts[(random >>> 11) % discounts.length];
  const couponCode = id % 7 === 0 ? "" : coupons[(random >>> 24) % coupons.length];
  sales.push([
    id,
    customerId,
    productId,
    saleMonth,
    saleDay,
    quantity,
    unitCents,
    discountBps,
    couponCode,
  ].join(","));
}

const generated = {
  "customers.csv": `${customers.join("\n")}\n`,
  "products.csv": `${products.join("\n")}\n`,
  "sales.csv": `${sales.join("\n")}\n`,
};

async function sha256(bytes: Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

const encoder = new TextEncoder();
const files: Record<string, { bytes: number; sha256: string; rows: number }> = {};
for (const [name, text] of Object.entries(generated)) {
  const bytes = encoder.encode(text);
  await Deno.writeFile(new URL(name, output), bytes);
  files[name] = {
    bytes: bytes.byteLength,
    sha256: await sha256(bytes),
    rows: text.trimEnd().split("\n").length - 1,
  };
}
const combined = encoder.encode(
  IMPORT_ORDER.map((table) => generated[`${table}.csv` as keyof typeof generated]).join(""),
);
const manifest = {
  schemaVersion: 1,
  workloadId: "database.sqlite-notebook.v1",
  fixtureId: "sqlite-notebook-seeded-sales-v1",
  generator: {
    path: "scripts/generate-sqlite-notebook-fixture.ts",
    algorithm: "xorshift32",
    seed: `0x${FIXTURE_SEED.toString(16).padStart(8, "0")}`,
    deno: "2.9.0",
  },
  rights: {
    licenseSpdx: "CC0-1.0",
    provenance: "project-generated",
    redistribution: "permitted",
    notice: "fixtures/RIGHTS.md",
  },
  importOrder: IMPORT_ORDER,
  files,
  combinedSha256: await sha256(combined),
};
await Deno.writeTextFile(
  new URL("fixture-manifest.json", output),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(JSON.stringify(manifest, null, 2));
