export function unavailable(status, reason) {
  return { status, reason };
}

export function supported(value, extra = {}) {
  return { status: "supported-value", value, ...extra };
}

export function positiveNumberHint(owner, key, unavailableReason) {
  if (!owner || !(key in owner)) return unavailable("unsupported", unavailableReason);
  const value = owner[key];
  return Number.isFinite(value) && value > 0
    ? supported(value)
    : unavailable("failed", `${key} was present without a positive finite value.`);
}

export function captureLegacyChromiumHeap(performanceLike) {
  if (!performanceLike || !("memory" in performanceLike) || !performanceLike.memory) {
    return unavailable("unsupported", "Chromium's non-standard performance.memory API is absent.");
  }
  const fields = ["jsHeapSizeLimit", "totalJSHeapSize", "usedJSHeapSize"];
  const value = {};
  for (const field of fields) {
    const fieldValue = performanceLike.memory[field];
    if (!Number.isFinite(fieldValue) || fieldValue < 0) {
      return unavailable(
        "failed",
        `performance.memory.${field} was not a finite non-negative byte value.`,
      );
    }
    value[field] = fieldValue;
  }
  return supported(value, {
    scope: "chromium-shared-js-heap-legacy",
    caveat:
      "Non-standard shared JavaScript heap estimate; excludes reliable page RSS and must not be treated as total page, Wasm, process, or machine memory.",
  });
}

export async function captureUaClientHints(navigatorLike) {
  const uaData = navigatorLike?.userAgentData;
  if (!uaData) {
    return unavailable("unsupported", "User-Agent Client Hints are not exposed by this browser.");
  }
  const lowEntropy = {
    brands: supported(Array.isArray(uaData.brands) ? structuredClone(uaData.brands) : []),
    mobile: typeof uaData.mobile === "boolean"
      ? supported(uaData.mobile)
      : unavailable("unsupported", "UA-CH mobile was absent."),
    platform: typeof uaData.platform === "string"
      ? supported(uaData.platform, uaData.platform === "" ? { note: "empty-valid" } : {})
      : unavailable("unsupported", "UA-CH platform was absent."),
  };
  if (typeof uaData.getHighEntropyValues !== "function") {
    return supported({
      lowEntropy,
      highEntropy: unavailable("unsupported", "getHighEntropyValues is not exposed."),
    });
  }
  const requested = [
    "architecture",
    "bitness",
    "model",
    "platformVersion",
    "wow64",
    "fullVersionList",
  ];
  try {
    const response = await uaData.getHighEntropyValues(requested);
    const fields = {};
    for (const key of requested) {
      if (!Object.hasOwn(response, key)) {
        fields[key] = unavailable(
          "not-allowed",
          "The requested high-entropy field was omitted by browser policy.",
        );
      } else {
        fields[key] = supported(
          structuredClone(response[key]),
          response[key] === "" ? { note: "empty-valid" } : {},
        );
      }
    }
    return supported({ lowEntropy, highEntropy: supported(fields, { requested }) });
  } catch (error) {
    return supported({
      lowEntropy,
      highEntropy: unavailable(
        "api-rejected",
        error instanceof Error ? `${error.name}: ${error.message}` : "UA-CH request rejected.",
      ),
    });
  }
}

export async function captureUaSpecificMemory(performanceLike, environment) {
  if (typeof performanceLike?.measureUserAgentSpecificMemory !== "function") {
    return unavailable("unsupported", "measureUserAgentSpecificMemory is not exposed.");
  }
  if (!environment?.isSecureContext) {
    return unavailable("insecure-context", "The memory API requires a secure context.");
  }
  if (!environment?.crossOriginIsolated) {
    return unavailable(
      "not-cross-origin-isolated",
      "The memory API is present but this page is not cross-origin isolated.",
    );
  }
  try {
    const result = await performanceLike.measureUserAgentSpecificMemory();
    if (!Number.isFinite(result?.bytes) || result.bytes < 0 || !Array.isArray(result.breakdown)) {
      return unavailable("failed", "The memory API returned an invalid result shape.");
    }
    return supported(structuredClone(result), {
      scope: "user-agent-specific-memory-estimate",
      caveat:
        "Experimental estimate with implementation-defined attribution; it may trigger GC and is not exact RSS or machine memory.",
    });
  } catch (error) {
    return unavailable(
      "api-rejected",
      error instanceof Error ? `${error.name}: ${error.message}` : "Memory measurement rejected.",
    );
  }
}

export async function measureRefreshEstimate(requestFrame, cancelFrame, sampleCount = 20) {
  if (typeof requestFrame !== "function") {
    return unavailable("unsupported", "requestAnimationFrame is unavailable.");
  }
  const timestamps = [];
  let handle;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (handle !== undefined && typeof cancelFrame === "function") cancelFrame(handle);
        reject(new Error("Animation-frame sampling timed out."));
      }, 2_000);
      const sample = (timestamp) => {
        timestamps.push(timestamp);
        if (timestamps.length >= sampleCount + 1) {
          clearTimeout(timeout);
          resolve();
        } else {
          handle = requestFrame(sample);
        }
      };
      handle = requestFrame(sample);
    });
    const deltas = timestamps.slice(1).map((value, index) => value - timestamps[index])
      .filter((value) => Number.isFinite(value) && value > 0);
    if (deltas.length < sampleCount / 2) {
      return unavailable("failed", "Too few positive animation-frame intervals were observed.");
    }
    const sorted = deltas.toSorted((left, right) => left - right);
    const medianIntervalMs = sorted[Math.floor(sorted.length / 2)];
    return supported({
      estimatedHz: 1_000 / medianIntervalMs,
      medianIntervalMs,
      observedIntervals: deltas.length,
    }, {
      scope: "page-animation-frame-estimate",
      caveat: "An observed presentation cadence estimate, not a physical display inventory claim.",
    });
  } catch (error) {
    return unavailable(
      "failed",
      error instanceof Error ? error.message : "Animation-frame sampling failed.",
    );
  }
}

export function startResponsivenessObservation(globalLike) {
  const supportedTypes = Array.isArray(globalLike?.PerformanceObserver?.supportedEntryTypes)
    ? [...globalLike.PerformanceObserver.supportedEntryTypes]
    : [];
  if (!supportedTypes.includes("long-animation-frame")) {
    return {
      supportedEntryTypes: supported(supportedTypes),
      longAnimationFrames: unavailable(
        "unsupported",
        "PerformanceObserver does not advertise long-animation-frame entries.",
      ),
      stop() {},
      snapshot() {
        return this.longAnimationFrames;
      },
    };
  }
  const entries = [];
  const observer = new globalLike.PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      entries.push({
        startTime: entry.startTime,
        duration: entry.duration,
        blockingDuration: Number.isFinite(entry.blockingDuration) ? entry.blockingDuration : null,
      });
    }
  });
  observer.observe({ type: "long-animation-frame", buffered: true });
  return {
    supportedEntryTypes: supported(supportedTypes),
    stop() {
      observer.disconnect();
    },
    snapshot() {
      return supported({
        count: entries.length,
        maxDurationMs: entries.length ? Math.max(...entries.map((entry) => entry.duration)) : null,
        entries: structuredClone(entries),
      }, {
        scope: "page-main-thread-long-animation-frames",
        caveat:
          "Page responsiveness diagnostic; worker execution time is not attributed as page jank.",
      });
    },
  };
}
