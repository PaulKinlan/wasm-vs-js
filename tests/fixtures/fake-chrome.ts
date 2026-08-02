const profile = Deno.args.find((value) => value.startsWith("--user-data-dir="))?.slice(16);
if (!profile) throw new Error("fake Chrome requires exact profile");
await Deno.mkdir(profile, { recursive: true });
if (Deno.env.get("FAKE_CHROME_MODE") === "wrong-profile") throw new Error("wrong profile");
if (Deno.env.get("FAKE_CHROME_MODE") !== "startup-timeout") {
  await Deno.writeTextFile(`${profile}/DevToolsActivePort`, "9222\n/devtools/browser/fake\n");
}
if (Deno.env.get("FAKE_CHROME_MODE") === "normal") Deno.exit(0);
await new Promise(() => {});
