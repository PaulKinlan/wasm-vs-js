import { CdpClient } from "./lib/cdp-client.ts";
const CHROME = "/usr/bin/chromium";
const probe = Deno.listen({ hostname: "127.0.0.1", port: 0 });
const PORT = (probe.addr as Deno.NetAddr).port;
probe.close();
const server = new Deno.Command(Deno.execPath(), {
  args: ["task", "public"],
  env: { PORT: String(PORT), HOST: "127.0.0.1" },
  stdout: "piped",
  stderr: "piped",
}).spawn();
await new Promise((r) => setTimeout(r, 4000));
const profile = await Deno.makeTempDir({ prefix: "cdp-diag-" });
const browser = new Deno.Command(CHROME, {
  args: [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-sync",
    "--disable-crash-reporter", "--disable-breakpad", "--window-size=1280,900", "about:blank",
  ],
  stdout: "piped",
  stderr: "piped",
}).spawn();
const stderr = browser.stderr.getReader();
let wsUrl = "";
let buf = "";
(async () => {
  while (true) {
    const { value, done } = await stderr.read();
    if (done) break;
    buf += new TextDecoder().decode(value);
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) wsUrl = m[1];
  }
})();
for (let i = 0; i < 100 && !wsUrl; i++) await new Promise((r) => setTimeout(r, 100));
const cdp = new CdpClient(wsUrl!);
const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
const s = { send: (m: string, p: unknown = {}, t = 60000) => cdp.send(m, p, sessionId, t) };
await s.send("Page.enable");
await s.send("Runtime.enable");
await s.send("Network.enable");
const failed: string[] = [];
cdp.on("Network.responseReceived", (p: unknown) => {
  const r = (p as { params?: { response?: { status?: number; url?: string } } }).params?.response;
  if (r && r.status === 404) failed.push("404 " + r.url);
});
cdp.on("Network.loadingFailed", (p: unknown) => {
  failed.push("FAILED " + (p as { params?: { errorText?: string } }).params?.errorText);
});
const consoleErrs: string[] = [];
cdp.on("Runtime.consoleAPICalled", (p: unknown) => {
  const params = (p as { params?: { type?: string; args?: Array<{ value?: string; description?: string }> } }).params;
  if (params?.type === "error") consoleErrs.push(params.args?.map((a) => String(a.value ?? a.description ?? "")).join(" ") ?? "");
});
cdp.on("Log.entryAdded", (p: unknown) => {
  const e = (p as { params?: { entry?: { level?: string; text?: string; url?: string } } }).params?.entry;
  if (e?.level === "error") consoleErrs.push("LOG " + (e.text ?? "") + " @" + (e.url ?? ""));
});
await s.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/` });
await new Promise((r) => setTimeout(r, 3500));
await s.send("Runtime.evaluate", {
  expression: `(() => { const card = document.querySelector('[data-slug="sum-u32"]'); const btn = card?.querySelector('.btn-pg-run'); if (btn) { btn.click(); return 'clicked'; } return 'no run btn'; })()`,
});
await new Promise((r) => setTimeout(r, 6000));
const status = await s.send('Runtime.evaluate', { expression: 'document.querySelector(\'[data-slug="sum-u32"] .playground-status\')?.textContent ?? ""', returnByValue: true });
console.log('DIAG_STATUS:', JSON.stringify(status));
const perf = await s.send('Runtime.evaluate', { expression: 'JSON.stringify(performance.getEntriesByType("resource").map(e => ({name: e.name.slice(-60), dur: Math.round(e.duration), size: e.transferSize})).filter(e => e.size === 0 && !e.name.endsWith("about:blank")))', returnByValue: true });
console.log('DIAG_RESOURCES:', JSON.stringify(perf));
console.log("DIAG_FAILED_URLS:", JSON.stringify(failed, null, 1));
console.log("DIAG_CONSOLE_ERRORS:", JSON.stringify(consoleErrs, null, 1));
browser.kill("SIGKILL");
server.kill("SIGKILL");
Deno.exit(0);
