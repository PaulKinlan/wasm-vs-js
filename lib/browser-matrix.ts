// M5: Browser-product × engine-family/version matrix data model.
// Prevents counting products sharing one engine as independent evidence.
// Records typed availability states — never fabricates, never zero-substitutes.

export type EngineFamily = "V8" | "SpiderMonkey" | "JavaScriptCore";

export type BrowserProduct = {
  product: string;
  vendor: string;
  engine: EngineFamily;
  engineVendor: string;
};

export type BrowserAvailability =
  | { state: "available"; binary: string; version: string }
  | { state: "blocked"; reason: string }
  | { state: "unavailable"; reason: string };

export type MatrixCell = {
  product: BrowserProduct;
  automationProtocol: "WebDriver BiDi" | "WebDriver Classic" | "CDP" | "none";
  availability: BrowserAvailability;
};

export type BrowserMatrix = {
  cells: MatrixCell[];
  engineFamilies: EngineFamily[];
  notes: string[];
};

// ── Known browser products ──

export const KNOWN_PRODUCTS: BrowserProduct[] = [
  {
    product: "Chrome",
    vendor: "Google",
    engine: "V8",
    engineVendor: "Google",
  },
  {
    product: "Firefox",
    vendor: "Mozilla",
    engine: "SpiderMonkey",
    engineVendor: "Mozilla",
  },
  {
    product: "Safari",
    vendor: "Apple",
    engine: "JavaScriptCore",
    engineVendor: "Apple",
  },
];

// ── Availability probes ──

function probeBinary(
  name: string,
): { found: boolean; path: string | null; version: string | null } {
  try {
    const result = new Deno.Command("which", { args: [name], stdout: "piped" }).outputSync();
    if (!result.success) return { found: false, path: null, version: null };
    const path = new TextDecoder().decode(result.stdout).trim();
    if (!path) return { found: false, path: null, version: null };

    let version: string | null = null;
    try {
      const vResult = new Deno.Command(name, { args: ["--version"], stdout: "piped" })
        .outputSync();
      if (vResult.success) {
        version = new TextDecoder().decode(vResult.stdout).trim();
      }
    } catch { /* version probe failed */ }

    return { found: true, path, version };
  } catch {
    return { found: false, path: null, version: null };
  }
}

// ── Build matrix from local probes ──

export async function probeBrowserMatrix(): Promise<BrowserMatrix> {
  const cells: MatrixCell[] = [];
  const notes: string[] = [];

  // Chrome
  const chrome = probeBinary("chromedriver");
  if (chrome.found && chrome.path) {
    cells.push({
      product: KNOWN_PRODUCTS[0],
      automationProtocol: "WebDriver BiDi",
      availability: {
        state: "available",
        binary: chrome.path,
        version: chrome.version ?? "unknown",
      },
    });
  } else {
    // Check for puppeteer Chrome
    const pChrome =
      "/home/paulkinlan/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome";
    try {
      const vResult = new Deno.Command(pChrome, { args: ["--version"], stdout: "piped" })
        .outputSync();
      if (vResult.success) {
        cells.push({
          product: KNOWN_PRODUCTS[0],
          automationProtocol: "CDP",
          availability: {
            state: "available",
            binary: pChrome,
            version: new TextDecoder().decode(vResult.stdout).trim(),
          },
        });
        notes.push("Chrome available via CDP only (no chromedriver); BiDi requires chromedriver");
      }
    } catch {
      cells.push({
        product: KNOWN_PRODUCTS[0],
        automationProtocol: "none",
        availability: {
          state: "unavailable",
          reason: "neither chromedriver nor Chrome binary found",
        },
      });
    }
  }

  // Firefox
  const firefox = probeBinary("firefox");
  const geckodriver = probeBinary("geckodriver");
  if (firefox.found && geckodriver.found) {
    cells.push({
      product: KNOWN_PRODUCTS[1],
      automationProtocol: "WebDriver BiDi",
      availability: {
        state: "available",
        binary: geckodriver.path!,
        version: firefox.version ?? "unknown",
      },
    });
  } else {
    const missing = [
      !firefox.found ? "firefox binary" : null,
      !geckodriver.found ? "geckodriver" : null,
    ].filter(Boolean).join(" and ");
    cells.push({
      product: KNOWN_PRODUCTS[1],
      automationProtocol: "none",
      availability: { state: "blocked", reason: `missing ${missing}` },
    });
    notes.push(`Firefox: blocked (${missing})`);
  }

  // Safari
  const safari = probeBinary("safaridriver");
  if (safari.found && safari.path) {
    cells.push({
      product: KNOWN_PRODUCTS[2],
      automationProtocol: "WebDriver Classic",
      availability: {
        state: "available",
        binary: safari.path,
        version: safari.version ?? "unknown",
      },
    });
  } else {
    cells.push({
      product: KNOWN_PRODUCTS[2],
      automationProtocol: "none",
      availability: { state: "blocked", reason: "safaridriver not found (not on macOS)" },
    });
    notes.push("Safari: blocked (not on macOS)");
  }

  // Engine families from available products
  const engineFamilies = [
    ...new Set(
      cells
        .filter((c) => c.availability.state === "available")
        .map((c) => c.product.engine),
    ),
  ];

  return { cells, engineFamilies, notes };
}

// ── Matrix validation ──

export function validateMatrix(matrix: BrowserMatrix): {
  independentEngineCount: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Group available cells by engine family
  const byEngine = new Map<EngineFamily, string[]>();
  for (const cell of matrix.cells) {
    if (cell.availability.state !== "available") continue;
    const existing = byEngine.get(cell.product.engine) ?? [];
    existing.push(cell.product.product);
    byEngine.set(cell.product.engine, existing);
  }

  // Warn if multiple products share one engine
  for (const [engine, products] of byEngine) {
    if (products.length > 1) {
      warnings.push(
        `${
          products.join(" and ")
        } share engine ${engine} — do not count as independent engine evidence`,
      );
    }
  }

  return {
    independentEngineCount: byEngine.size,
    warnings,
  };
}
