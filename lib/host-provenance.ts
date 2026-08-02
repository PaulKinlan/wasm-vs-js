export type EvidenceValue = {
  status: "supported-value" | "unavailable";
  value?: unknown;
  reason?: string;
  source: string;
  collectedAt: string;
  scope: string;
};
const now = () => new Date().toISOString();
const ok = (value: unknown, source: string, scope: string): EvidenceValue => ({
  status: "supported-value",
  value,
  source,
  scope,
  collectedAt: now(),
});
const no = (reason: string, source: string, scope: string): EvidenceValue => ({
  status: "unavailable",
  reason,
  source,
  scope,
  collectedAt: now(),
});
async function text(path: string): Promise<string | undefined> {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return undefined;
  }
}
export async function collectProcessMemory(
  pids: number[],
): Promise<EvidenceValue> {
  if (!pids.length) {
    return no(
      "no owned Chrome process IDs were available",
      "/proc/<owned-pid>",
      "owned-chrome-process-rss-pss",
    );
  }
  const processes = [];
  for (const pid of [...new Set(pids)].sort((a, b) => a - b)) {
    if (!Number.isSafeInteger(pid) || pid < 2) throw new Error("invalid owned PID");
    const status = await text(`/proc/${pid}/status`);
    const smaps = await text(`/proc/${pid}/smaps_rollup`);
    const rssKiB = Number(status?.match(/^VmRSS:\s+(\d+)\s+kB$/m)?.[1]);
    const pssKiB = Number(smaps?.match(/^Pss:\s+(\d+)\s+kB$/m)?.[1]);
    processes.push({
      pid,
      rssBytes: Number.isFinite(rssKiB)
        ? { status: "supported-value", value: rssKiB * 1024 }
        : { status: "unavailable", reason: `/proc/${pid}/status did not expose VmRSS` },
      pssBytes: Number.isFinite(pssKiB)
        ? { status: "supported-value", value: pssKiB * 1024 }
        : { status: "unavailable", reason: `/proc/${pid}/smaps_rollup did not expose Pss` },
    });
  }
  return ok(processes, "/proc/<owned-pid>/status+smaps_rollup", "owned-chrome-process-rss-pss");
}

export async function collectHostProvenance(): Promise<Record<string, EvidenceValue>> {
  const osRelease = await text("/etc/os-release"),
    cpuinfo = await text("/proc/cpuinfo"),
    meminfo = await text("/proc/meminfo");
  const uname = async (flag: string) => {
    try {
      const o = await new Deno.Command("uname", { args: [flag], stdout: "piped", stderr: "null" })
        .output();
      return new TextDecoder().decode(o.stdout).trim();
    } catch {
      return undefined;
    }
  };
  const cpuModel = cpuinfo?.match(/^model name\s*:\s*(.+)$/m)?.[1];
  const logical = cpuinfo?.match(/^processor\s*:/gm)?.length;
  const physicalPairs = new Set<string>();
  if (cpuinfo) {
    for (const block of cpuinfo.split(/\n\n/)) {
      const p = block.match(/^physical id\s*:\s*(.+)$/m)?.[1],
        c = block.match(/^core id\s*:\s*(.+)$/m)?.[1];
      if (p && c) physicalPairs.add(`${p}:${c}`);
    }
  }
  const memKiB = Number(meminfo?.match(/^MemTotal:\s+(\d+)\s+kB$/m)?.[1]);
  const affinity = await text("/proc/self/status");
  const cgroup: Record<
    string,
    { status: "supported-value"; value: string } | { status: "unavailable"; reason: string }
  > = {};
  for (
    const name of [
      "cpu.max",
      "cpuset.cpus.effective",
      "memory.max",
      "memory.current",
      "memory.high",
    ]
  ) {
    const value = (await text(`/sys/fs/cgroup/${name}`))?.trim();
    cgroup[name] = value
      ? { status: "supported-value", value }
      : { status: "unavailable", reason: `${name} is not exposed in this cgroup` };
  }
  return {
    os: osRelease
      ? ok(
        Object.fromEntries(
          osRelease.split("\n").filter((x) => x.includes("=")).map((x) => {
            const i = x.indexOf("=");
            return [x.slice(0, i), x.slice(i + 1).replace(/^\"|\"$/g, "")];
          }),
        ),
        "/etc/os-release",
        "guest-os",
      )
      : no("os-release unavailable", "/etc/os-release", "guest-os"),
    kernel:
      ((v) =>
        v
          ? ok(v, "uname -r", "guest-kernel")
          : no("uname unavailable", "uname -r", "guest-kernel"))(await uname("-r")),
    architecture:
      ((v) =>
        v
          ? ok(v, "uname -m", "process-guest-architecture")
          : no("uname unavailable", "uname -m", "process-guest-architecture"))(await uname("-m")),
    cpuModel: cpuModel
      ? ok(cpuModel, "/proc/cpuinfo", "guest-visible-cpu-model")
      : no("CPU model unavailable", "/proc/cpuinfo", "guest-visible-cpu-model"),
    logicalProcessors: logical
      ? ok(logical, "/proc/cpuinfo", "guest-visible-logical-processors")
      : no("logical count unavailable", "/proc/cpuinfo", "guest-visible-logical-processors"),
    physicalCores: physicalPairs.size
      ? ok(physicalPairs.size, "/proc/cpuinfo", "guest-visible-physical-core-pairs")
      : no("physical topology unavailable", "/proc/cpuinfo", "guest-visible-physical-core-pairs"),
    totalRamBytes: Number.isFinite(memKiB) && memKiB > 0
      ? ok(memKiB * 1024, "/proc/meminfo", "guest-total-ram")
      : no("RAM unavailable", "/proc/meminfo", "guest-total-ram"),
    affinity: affinity?.match(/^Cpus_allowed_list:\s*(.+)$/m)?.[1]
      ? ok(
        affinity.match(/^Cpus_allowed_list:\s*(.+)$/m)![1],
        "/proc/self/status",
        "benchmark-process-affinity",
      )
      : no("affinity unavailable", "/proc/self/status", "benchmark-process-affinity"),
    cgroup: ok(cgroup, "/sys/fs/cgroup", "benchmark-allocation-limits"),
  };
}
