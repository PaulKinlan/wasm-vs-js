import { assertEquals } from "./assert.ts";
import { CdpClient } from "../lib/cdp-client.ts";
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
