// M5: WebDriver BiDi client for cross-browser orchestration.
// Connects via chromedriver (Chrome) or geckodriver (Firefox) using the W3C WebDriver BiDi protocol.
// Provides the same navigate/evaluate/screenshot capabilities as CDP but via the standardized protocol.

export type BiDiSession = {
  sessionId: string;
  webSocketUrl: string;
  browsingContext: string;
  browserVersion: string;
  browserName: string;
};

export type BiDiEvidence = {
  browserVersion: string;
  browserName: string;
  automationProtocol: "WebDriver BiDi";
  driverVersion: string;
  launchArguments: string[];
  screenshots: string[];
  consoleMessages: Array<{ level: string; text: string; timestamp: number }>;
  navigationUrls: string[];
};

/**
 * WebDriver BiDi client that connects to chromedriver or geckodriver.
 * Uses WebDriver classic for session creation, then upgrades to BiDi WebSocket.
 */
export class WebDriverBiDi {
  #ws: WebSocket | null = null;
  #nextId = 1;
  #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  #browsingContext = "";
  #consoleMessages: Array<{ level: string; text: string; timestamp: number }> = [];
  #navigationUrls: string[] = [];

  constructor(
    readonly driverUrl: string,
    readonly driverVersion: string,
  ) {}

  /** Create a WebDriver session with BiDi enabled. */
  async createSession(
    browserBinary?: string,
    extraOptions: Record<string, unknown> = {},
  ): Promise<BiDiSession> {
    const capabilities: Record<string, unknown> = {
      alwaysMatch: {
        webSocketUrl: true,
        ...extraOptions,
      },
    };

    if (browserBinary) {
      (capabilities.alwaysMatch as Record<string, unknown>)["goog:chromeOptions"] = {
        binary: browserBinary,
        args: ["--headless=new", "--no-sandbox", "--disable-gpu"],
      };
    }

    const resp = await fetch(`${this.driverUrl}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ capabilities }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`WebDriver session creation failed (${resp.status}): ${text.slice(0, 200)}`);
    }

    const data = await resp.json();
    const sessionId = data.value?.sessionId ?? data.sessionId;
    const caps = data.value?.capabilities ?? data.capabilities ?? {};
    const webSocketUrl = caps.webSocketUrl;

    if (!webSocketUrl) {
      throw new Error("Driver did not return webSocketUrl — BiDi not supported");
    }

    this.#browsingContext = sessionId; // Top-level browsing context

    // Connect BiDi WebSocket
    this.#ws = new WebSocket(webSocketUrl);
    await new Promise<void>((resolve, reject) => {
      this.#ws!.addEventListener("open", () => resolve(), { once: true });
      this.#ws!.addEventListener(
        "error",
        () => reject(new Error("BiDi WebSocket connection failed")),
        { once: true },
      );
      setTimeout(() => reject(new Error("BiDi WebSocket timeout")), 5000);
    });

    this.#ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.#pending.has(msg.id)) {
        const { resolve, reject } = this.#pending.get(msg.id)!;
        this.#pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === "log.entryAdded") {
        this.#consoleMessages.push({
          level: msg.params?.level ?? "info",
          text: msg.params?.text ?? "",
          timestamp: msg.params?.timestamp ?? Date.now(),
        });
      }
    });

    // Subscribe to log and navigation events
    await this.send("session.subscribe", {
      events: ["log.entryAdded"],
    });

    // Get the actual top-level browsing context (not the session ID)
    try {
      const tree = await this.send("browsingContext.getTree", {}) as Record<string, unknown>;
      const contexts = tree?.contexts as Array<Record<string, unknown>>;
      if (contexts && contexts.length > 0) {
        this.#browsingContext = String(contexts[0].context);
      }
    } catch {
      // Fallback: keep session ID as context
    }

    return {
      sessionId,
      webSocketUrl,
      browsingContext: this.#browsingContext,
      browserVersion: caps.browserVersion ?? "unknown",
      browserName: caps.browserName ?? "unknown",
    };
  }

  /** Send a BiDi command and await the response. */
  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) {
      throw new Error("BiDi WebSocket not connected");
    }
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws!.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.#pending.has(id)) {
          this.#pending.delete(id);
          reject(new Error(`BiDi command timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  /** Navigate to a URL. */
  async navigate(url: string): Promise<void> {
    this.#navigationUrls.push(url);
    const result = await this.send("browsingContext.navigate", {
      context: this.#browsingContext,
      url,
      wait: "complete",
    }) as Record<string, unknown>;
    // Update browsing context from result
    if (result?.navigation) {
      // Navigation started successfully
    }
  }

  /** Evaluate JavaScript in the page. */
  async evaluate(expression: string, awaitPromise = true): Promise<unknown> {
    const result = await this.send("script.evaluate", {
      expression,
      target: { context: this.#browsingContext },
      awaitPromise,
    }) as Record<string, unknown>;
    const type = (result?.result as Record<string, unknown>)?.type;
    if (type === "undefined") return undefined;
    return (result?.result as Record<string, unknown>)?.value;
  }

  /** Capture a screenshot. */
  async screenshot(): Promise<string> {
    const result = await this.send("browsingContext.captureScreenshot", {
      context: this.#browsingContext,
      format: { type: "png" },
    }) as Record<string, unknown>;
    return result?.data as string;
  }

  /** Collect evidence for the run record. */
  collectEvidence(launchArguments: string[]): BiDiEvidence {
    return {
      browserVersion: "", // Filled by caller from session
      browserName: "",
      automationProtocol: "WebDriver BiDi",
      driverVersion: this.driverVersion,
      launchArguments,
      screenshots: [],
      consoleMessages: [...this.#consoleMessages],
      navigationUrls: [...this.#navigationUrls],
    };
  }

  /** Close the session and clean up. */
  async close(): Promise<void> {
    if (this.#ws) {
      this.#ws.close();
      this.#ws = null;
    }
    try {
      await fetch(`${this.driverUrl}/session`, { method: "DELETE" });
    } catch { /* ignore */ }
  }
}

/**
 * Launch chromedriver as a subprocess on a random port.
 */
export async function launchChromeDriver(
  binary = "chromedriver",
): Promise<{ process: Deno.ChildProcess; url: string }> {
  const port = 9600 + Math.floor(Math.random() * 100);
  const process = new Deno.Command(binary, {
    args: [`--port=${port}`],
    stdout: "null",
    stderr: "null",
  }).spawn();

  const url = `http://127.0.0.1:${port}`;

  // Wait for driver to be ready
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const resp = await fetch(`${url}/status`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.value?.ready) return { process, url };
      }
    } catch { /* retry */ }
  }

  process.kill("SIGTERM");
  throw new Error("chromedriver did not start within 5s");
}
