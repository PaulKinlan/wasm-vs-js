export const DEMO_TIMEOUT_MS = 5_000;

export function clearCanvasPresentation(canvas) {
  const context = canvas.getContext("2d");
  if (context) context.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 1;
  canvas.height = 1;
  canvas.hidden = true;
}

export class ImageDemoController {
  constructor(options) {
    this.createWorker = options.createWorker;
    this.onState = options.onState;
    this.onPresentation = options.onPresentation;
    this.timeoutMs = options.timeoutMs ?? DEMO_TIMEOUT_MS;
    this.setTimer = options.setTimer ?? globalThis.setTimeout.bind(globalThis);
    this.clearTimer = options.clearTimer ?? globalThis.clearTimeout.bind(globalThis);
    this.createToken = options.createToken ?? ((sequence) => `${sequence}:${crypto.randomUUID()}`);
    this.active = null;
    this.lastPresentation = null;
    this.sequence = 0;
  }

  clearPresentation() {
    this.lastPresentation = null;
    this.onPresentation(null);
  }

  retireActive() {
    if (!this.active) return;
    this.clearTimer(this.active.timeout);
    this.active.worker.terminate();
    this.active = null;
  }

  start(request) {
    this.retireActive();
    this.clearPresentation();
    const sequence = ++this.sequence;
    const token = this.createToken(sequence);
    const worker = this.createWorker();
    const timeout = this.setTimer(() => {
      if (!this.active || this.active.token !== token) return;
      this.retireActive();
      this.sequence += 1;
      this.clearPresentation();
      this.onState({ state: "timeout", timeoutMs: this.timeoutMs });
    }, this.timeoutMs);
    this.active = { token, worker, timeout };
    this.onState({ state: "running" });
    worker.addEventListener("message", (event) => {
      if (!this.active || this.active.token !== token || event.data?.token !== token) return;
      const message = event.data;
      this.retireActive();
      if (message.type !== "result") {
        this.clearPresentation();
        this.onState({ state: "error", message: message.message ?? "unknown worker error" });
        return;
      }
      this.lastPresentation = { token, result: message.result };
      this.onPresentation(message.result);
      this.onState({ state: "completed" });
    });
    worker.addEventListener("error", () => {
      if (!this.active || this.active.token !== token) return;
      this.retireActive();
      this.clearPresentation();
      this.onState({ state: "error", message: "worker failed before returning a result" });
    });
    worker.postMessage({ type: "run", token, ...request });
    return token;
  }

  cancel() {
    if (!this.active) return false;
    this.sequence += 1;
    this.retireActive();
    this.clearPresentation();
    this.onState({ state: "canceled" });
    return true;
  }

  dispose() {
    this.sequence += 1;
    this.retireActive();
    this.clearPresentation();
  }

  getLastResult() {
    return this.lastPresentation?.result ?? null;
  }
}
