import { assertEquals } from "./assert.ts";
import { browserWebSocketUrl, CdpClient } from "../lib/cdp-client.ts";
import { assertRejects } from "./assert.ts";
class FakeSocket extends EventTarget {
  static OPEN = 1;
  readyState = 1;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];
  constructor(_url: string) {
    super();
  }
  send(value: string) {
    this.sent.push(value);
  }
  close() {
    this.readyState = 3;
  }
  reply(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}
Deno.test("CDP client correlates bounded commands and isolates session events", async () => {
  const socketHolder: { value?: FakeSocket } = {};
  class Factory extends FakeSocket {
    constructor(url: string) {
      super(url);
      socketHolder.value = this;
    }
  }
  const client = new CdpClient("ws://fake", Factory as unknown as typeof WebSocket);
  const command = client.send("Browser.getVersion");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const sent = JSON.parse(socketHolder.value!.sent[0]);
  socketHolder.value!.reply({ id: sent.id, result: { product: "FakeChrome" } });
  assertEquals((await command).product, "FakeChrome");
  let seen = false;
  client.on("Network.responseReceived", (_params, session) => {
    seen = session === "s1";
  });
  socketHolder.value!.reply({
    method: "Network.responseReceived",
    sessionId: "s1",
    params: { requestId: "1" },
  });
  assertEquals(seen, true);
  client.close();
});
Deno.test("CDP discovery binds loopback host, exact port, and browser path", async () => {
  let advertised = "";
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => {} },
    () => Response.json({ webSocketDebuggerUrl: advertised }),
  );
  const port = (server.addr as Deno.NetAddr).port;
  try {
    advertised = `ws://127.0.0.1:${port}/devtools/browser/exact`;
    assertEquals(await browserWebSocketUrl(port, "/devtools/browser/exact"), advertised);
    advertised = `ws://localhost:${port}/devtools/browser/exact`;
    await assertRejects(() => browserWebSocketUrl(port, "/devtools/browser/exact"), "identity");
    advertised = `ws://127.0.0.1:${port}/devtools/browser/foreign`;
    await assertRejects(() => browserWebSocketUrl(port, "/devtools/browser/exact"), "identity");
  } finally {
    await server.shutdown();
  }
});
