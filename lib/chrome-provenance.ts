import { CdpClient } from "./cdp-client.ts";
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
export async function collectChromeProvenance(
  browser: CdpClient,
  page: CdpClient,
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
      "gpu-and-platform",
      () => browser.send("SystemInfo.getInfo"),
    ),
    processInfo: await typed(
      "cdp-browser",
      "chrome-process-cpu-time",
      () => browser.send("SystemInfo.getProcessInfo"),
    ),
    performance: await typed(
      "cdp-target",
      "renderer-cumulative-metrics",
      () => page.send("Performance.getMetrics", {}, sessionId),
    ),
    heap: await typed(
      "cdp-target",
      "v8-heap-not-rss",
      () => page.send("Runtime.getHeapUsage", {}, sessionId),
    ),
    dom: await typed(
      "cdp-target",
      "dom-counters-not-bytes",
      () => page.send("Memory.getDOMCounters", {}, sessionId),
    ),
    pageHints: await typed(
      "page",
      "browser-exposed-privacy-limited-hints",
      () =>
        page.send("Runtime.evaluate", {
          returnByValue: true,
          awaitPromise: true,
          expression:
            `(async()=>({hardwareConcurrency:navigator.hardwareConcurrency??null,deviceMemory:('deviceMemory'in navigator)?navigator.deviceMemory:null,userAgent:navigator.userAgent,platform:navigator.platform,uaCH:navigator.userAgentData?.getHighEntropyValues?await navigator.userAgentData.getHighEntropyValues(['architecture','bitness','model','platformVersion','wow64','fullVersionList']):null,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},secureContext:isSecureContext,crossOriginIsolated,serviceWorkerControlled:Boolean(navigator.serviceWorker?.controller),legacyHeap:performance.memory?{jsHeapSizeLimit:performance.memory.jsHeapSizeLimit,totalJSHeapSize:performance.memory.totalJSHeapSize,usedJSHeapSize:performance.memory.usedJSHeapSize}:null}))()`,
        }, sessionId),
    ),
  };
}
