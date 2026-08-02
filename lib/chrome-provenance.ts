type CdpSender = {
  send(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
  ): Promise<Record<string, unknown>>;
};
const typed = async (source: string, scope: string, fn: () => Promise<unknown>) => {
  const collectedAt = new Date().toISOString();
  try {
    return { status: "supported-value", value: await fn(), source, scope, collectedAt };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
      source,
      scope,
      collectedAt,
    };
  }
};
/** Headline-safe provenance only. No Performance, Memory, Heap, process CPU/RSS/PSS, tracing, or forced GC. */
export async function collectChromeProvenance(
  browser: CdpSender,
  page: CdpSender,
  sessionId?: string,
): Promise<Record<string, unknown>> {
  return {
    browserVersion: await typed(
      "cdp-browser",
      "browser-version",
      () => browser.send("Browser.getVersion"),
    ),
    commandLine: await typed(
      "cdp-browser",
      "exact-effective-argv",
      () => browser.send("Browser.getBrowserCommandLine"),
    ),
    systemInfo: await typed(
      "cdp-browser",
      "static-gpu-and-platform",
      () => browser.send("SystemInfo.getInfo"),
    ),
    pageHints: await typed(
      "page",
      "browser-exposed-privacy-limited-hints",
      () =>
        page.send("Runtime.evaluate", {
          returnByValue: true,
          awaitPromise: true,
          expression:
            `(async()=>({hardwareConcurrency:navigator.hardwareConcurrency??null,deviceMemory:('deviceMemory'in navigator)?navigator.deviceMemory:null,userAgent:navigator.userAgent,platform:navigator.platform,uaCH:navigator.userAgentData?.getHighEntropyValues?await navigator.userAgentData.getHighEntropyValues(['architecture','bitness','model','platformVersion','wow64','fullVersionList']):null,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},secureContext:isSecureContext,crossOriginIsolated,serviceWorkerControlled:Boolean(navigator.serviceWorker?.controller)}))()`,
        }, sessionId),
    ),
    excludedDiagnostics: {
      status: "unavailable",
      reason:
        "Headline permit forbids CDP Performance/Memory/Heap/DOM/process metrics, process RSS/PSS/CPU, tracing, profiling, forced GC, and perturbing probes; use a separate diagnostic permit.",
      source: "frozen-preregistration",
      scope: "headline-launch",
      collectedAt: new Date().toISOString(),
    },
  };
}
export function diagnosticCollectionStub(): never {
  throw new Error(
    "diagnostic collection requires a separate unimplemented permit and launch family",
  );
}
