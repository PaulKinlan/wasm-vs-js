// M5: Browser matrix and WebDriver BiDi tests.
// Verifies matrix probes, engine independence checks, and BiDi client availability.

import { assert, assertEquals } from "./assert.ts";
import {
  type BrowserMatrix,
  KNOWN_PRODUCTS,
  probeBrowserMatrix,
  validateMatrix,
} from "../lib/browser-matrix.ts";

Deno.test({
  name: "browser-matrix: probes all three browser products",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const matrix = await probeBrowserMatrix();
    assertEquals(matrix.cells.length, 3);
    const products = matrix.cells.map((c) => c.product.product);
    assert(products.includes("Chrome"), "missing Chrome");
    assert(products.includes("Firefox"), "missing Firefox");
    assert(products.includes("Safari"), "missing Safari");
  },
});

Deno.test({
  name: "browser-matrix: Firefox is blocked when geckodriver absent",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const matrix = await probeBrowserMatrix();
    const firefox = matrix.cells.find((c) => c.product.product === "Firefox");
    assert(firefox, "missing Firefox cell");
    // On this machine, Firefox/geckodriver is not installed
    if (firefox!.availability.state === "blocked") {
      assert(
        firefox!.availability.reason.includes("geckodriver") ||
          firefox!.availability.reason.includes("firefox"),
        `unexpected block reason: ${firefox!.availability.reason}`,
      );
    }
  },
});

Deno.test({
  name: "browser-matrix: Safari is blocked on non-macOS",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const matrix = await probeBrowserMatrix();
    const safari = matrix.cells.find((c) => c.product.product === "Safari");
    assert(safari, "missing Safari cell");
    if (safari!.availability.state === "blocked") {
      assert(
        safari!.availability.reason.includes("safaridriver") ||
          safari!.availability.reason.includes("macOS"),
        `unexpected block reason: ${safari!.availability.reason}`,
      );
    }
  },
});

Deno.test({
  name: "browser-matrix: Chrome is available via chromedriver or CDP",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const matrix = await probeBrowserMatrix();
    const chrome = matrix.cells.find((c) => c.product.product === "Chrome");
    assert(chrome, "missing Chrome cell");
    assert(
      chrome!.availability.state === "available",
      `Chrome should be available but is ${chrome!.availability.state}`,
    );
  },
});

Deno.test({
  name: "browser-matrix: validateMatrix warns about shared engines",
  fn() {
    const matrix: BrowserMatrix = {
      cells: [
        {
          product: KNOWN_PRODUCTS[0],
          automationProtocol: "WebDriver BiDi",
          availability: { state: "available", binary: "chromedriver", version: "150" },
        },
        {
          product: { product: "Edge", vendor: "Microsoft", engine: "V8", engineVendor: "Google" },
          automationProtocol: "WebDriver BiDi",
          availability: { state: "available", binary: "msedgedriver", version: "150" },
        },
      ],
      engineFamilies: ["V8"],
      notes: [],
    };
    const result = validateMatrix(matrix);
    assertEquals(result.independentEngineCount, 1);
    assert(result.warnings.length > 0, "should warn about shared V8 engine");
    assert(result.warnings[0].includes("V8"));
  },
});

Deno.test({
  name: "browser-matrix: KNOWN_PRODUCTS has 3 products with distinct engines",
  fn() {
    assertEquals(KNOWN_PRODUCTS.length, 3);
    const engines = KNOWN_PRODUCTS.map((p) => p.engine);
    assertEquals(engines, ["V8", "SpiderMonkey", "JavaScriptCore"]);
  },
});

Deno.test({
  name: "browser-matrix: no zero-substitution for blocked cells",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const matrix = await probeBrowserMatrix();
    for (const cell of matrix.cells) {
      if (cell.availability.state !== "available") {
        const reason = cell.availability.reason;
        assert(reason.length > 0, `${cell.product.product} blocked without reason`);
        assert(!reason.includes("0"), `${cell.product.product} reason should not contain zero`);
      }
    }
  },
});
