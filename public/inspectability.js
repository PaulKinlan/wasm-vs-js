const REQUIRED_ROLES = [
  "executed-javascript",
  "authored-wasm",
  "build-recipe",
  "lockfile",
  "build-manifest",
  "compiled-wasm",
];

const LOCAL_DOWNLOADS = new Map([
  [
    "public/artifacts/sum-u32/build-manifest.json|6f34f7aee7ccbd11a1af431c2cdcd5d1ba1c9d4dfdd2cd3fd8f4201e226497a8",
    "/artifacts/sum-u32/build-manifest.9c309c49.json",
  ],
  [
    "public/artifacts/sum-u32/sum-u32.wasm|9c4ce5f0d9e32cdd364b73b2697566e7396368d9867d9bc3d939bb2063583a6d",
    "/artifacts/sum-u32/sum-u32.wasm",
  ],
  [
    `public/artifacts/audio-fft/build-manifest.json|3d7a6a54b33e1007a6594c698398fd9011c898abd7aa44fce9efb56a6a620cd1`,
    "/artifacts/audio-fft/build-manifest.json",
  ],
  [
    "public/artifacts/audio-fft/audio-fft.wasm|dbbcfd28be4411357844ae7f444bf3f9f705477d289a42bde9646a0f19a45bd0",
    "/artifacts/audio-fft/audio-fft.wasm",
  ],
  [
    "public/artifacts/audio-fft/reference-output.f32le|0432b81e06b48343754d26ae074cad984524cdbeb73bea0ba0539d8a726b9498",
    "/artifacts/audio-fft/reference-output.f32le",
  ],
  [
    `public/artifacts/audio-fir/build-manifest.json|30c8b7424b1fddaae2214c1096ff4c62f617c4b0ac0f7e4452ee1072ca2f41ed`,
    "/artifacts/audio-fir/build-manifest.json",
  ],
  [
    "public/artifacts/audio-fir/audio-fir.wasm|c61254df057f3d15d933a738012a3ee3c9d133a87a3a3e28c924e105b82cc335",
    "/artifacts/audio-fir/audio-fir.wasm",
  ],
  [
    "public/artifacts/audio-fir/reference-output.f32le|3146faf58d2eecd43b74d4297fcc575b0a688cb2e2b2d9ab1b1c9f3d1e21a564",
    "/artifacts/audio-fir/reference-output.f32le",
  ],
  [
    `public/artifacts/audio-stft/build-manifest.json|511586d13fdaf95df17d0d9d7771685dcc1b9a187cce9d3f485b7b7531e15091`,
    "/artifacts/audio-stft/build-manifest.json",
  ],
  [
    "public/artifacts/audio-stft/audio-stft.wasm|00beb1f7b6de580c4b2c0b9e32950b8fc85a1b82baf5021d075004f6585ed45c",
    "/artifacts/audio-stft/audio-stft.wasm",
  ],
  [
    "public/artifacts/audio-stft/reference-output.f32le|3bae7479e79489d8f97d07bcbd31439e338f7f7f2978d6acfc2cc46cb8412d7a",
    "/artifacts/audio-stft/reference-output.f32le",
  ],
]);

const MANIFEST_ROUTE = "/data/sum-u32-inspectability.v1.json";
const REPOSITORY = "https://github.com/PaulKinlan/wasm-vs-js";
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OID = /^[a-f0-9]{40}$/;
const REPO_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/;

function unavailableResource(role, label, reason, detail) {
  return { role, label, availability: { state: "unavailable", reason, detail } };
}

function localDownloadRoute(path, sha256) {
  return LOCAL_DOWNLOADS.get(`${path}|${sha256}`);
}

function availableResource(role, label, reference, fallbackMediaType) {
  if (!reference?.path || !reference?.sha256 || !reference?.immutableUrl) {
    return unavailableResource(
      role,
      label,
      "unknown-provenance",
      "The result record does not contain a complete path, hash, and immutable link.",
    );
  }
  const resource = {
    role,
    label,
    availability: { state: "available" },
    path: reference.path,
    sha256: reference.sha256,
    mediaType: reference.mediaType ?? fallbackMediaType,
    immutableUrl: reference.immutableUrl,
  };
  const route = localDownloadRoute(resource.path, resource.sha256);
  if (route) resource.localDownloadRoute = route;
  return resource;
}

function inferredMediaType(path) {
  if (path.endsWith(".wasm")) return "application/wasm";
  if (path.endsWith(".json") || path.endsWith(".lock")) return "application/json";
  if (path.endsWith(".js")) return "text/javascript";
  if (path.endsWith(".ts")) return "text/typescript";
  return "text/plain";
}

function immutableReference(repository, commit, reference) {
  if (!reference?.path || !reference?.sha256) return reference;
  return {
    ...reference,
    immutableUrl: `${repository}/blob/${commit}/${reference.path}`,
    mediaType: reference.mediaType ?? inferredMediaType(reference.path),
  };
}

function normalizeV2Result(record) {
  const repository = record.source?.repository;
  const commit = record.source?.commit;
  const provenance = record.provenance ?? {};
  const sources = Array.isArray(provenance.sources) ? provenance.sources : [];
  const build = provenance.build ?? {};
  const artifacts = Array.isArray(provenance.artifacts) ? provenance.artifacts : [];
  const jsSource = sources.find((source) => source.role === "javascript-authored");
  const wasmSource = sources.find((source) => source.role === "wasm-authored");
  const buildManifest = provenance.manifests?.build;
  const wasmArtifacts = artifacts.filter((artifact) =>
    artifact.mediaType === "application/wasm" || artifact.path?.endsWith(".wasm")
  );
  const otherArtifacts = artifacts.filter((artifact) => !wasmArtifacts.includes(artifact)).map(
    (artifact) =>
      availableResource(
        "result-artifact",
        artifact.id ? `Result artifact: ${artifact.id}` : "Result artifact",
        artifact,
        "application/octet-stream",
      ),
  );
  const locks = Array.isArray(build.locks) && build.locks.length > 0
    ? build.locks.map((lock) =>
      availableResource("lockfile", "Build lockfile", lock, "application/json")
    )
    : [
      unavailableResource(
        "lockfile",
        "Build lockfile",
        "unknown-provenance",
        "The result record contains no lockfile reference.",
      ),
    ];
  const compiled = wasmArtifacts.length > 0
    ? wasmArtifacts.map((artifact) =>
      availableResource("compiled-wasm", "Compiled WebAssembly", artifact, "application/wasm")
    )
    : [
      unavailableResource(
        "compiled-wasm",
        "Compiled WebAssembly",
        "not-applicable",
        "This result record contains no compiled WebAssembly artifact.",
      ),
    ];
  const command = Array.isArray(build.command) ? JSON.stringify(build.command) : String(
    build.command ?? "unavailable",
  );
  const toolchains = Array.isArray(build.toolchain)
    ? build.toolchain.map((tool) => `${tool.name} ${tool.version}`)
    : [];
  const flags = build.flags && typeof build.flags === "object"
    ? Object.entries(build.flags).flatMap(([group, values]) =>
      Array.isArray(values) ? values.map((value) => `${group}: ${value}`) : []
    )
    : [];
  return {
    schemaVersion: 1,
    manifestId: "result-source-inspectability-v1",
    benchmarkId: record.workload?.entryId ?? record.workload?.benchmarkSlug ?? "unknown-result",
    evidenceStatus: "result-provenance",
    performanceResult: {
      state: "unavailable",
      reason: "not-published",
      detail: "This panel exposes provenance only; it does not add a performance claim.",
    },
    source: { repository, commit, treeUrl: `${repository}/tree/${commit}` },
    build: { command, toolchains, flags },
    resources: [
      jsSource
        ? availableResource(
          "executed-javascript",
          "Executed JavaScript",
          jsSource,
          "text/javascript",
        )
        : unavailableResource(
          "executed-javascript",
          "Executed JavaScript",
          "unknown-provenance",
          "The result record contains no JavaScript source reference.",
        ),
      wasmSource
        ? availableResource("authored-wasm", "Authored WebAssembly", wasmSource, "text/plain")
        : unavailableResource(
          "authored-wasm",
          "Authored WebAssembly",
          "not-applicable",
          "The result record contains no authored WebAssembly source reference.",
        ),
      build.recipe
        ? availableResource("build-recipe", "Build recipe", build.recipe, "text/plain")
        : unavailableResource(
          "build-recipe",
          "Build recipe",
          "unknown-provenance",
          "The result record contains no build-recipe file reference.",
        ),
      ...locks,
      buildManifest
        ? availableResource(
          "build-manifest",
          "Build manifest",
          buildManifest,
          "application/json",
        )
        : unavailableResource(
          "build-manifest",
          "Build manifest",
          "unknown-provenance",
          "This result record contains no distinct build-manifest reference.",
        ),
      ...compiled,
      ...otherArtifacts,
    ],
  };
}

function normalizeV1Run(record) {
  const build = record.build ?? {};
  const repository = build.sourceRepository;
  const commit = build.sourceCommit;
  const artifacts = Array.isArray(build.artifacts) ? build.artifacts : [];
  const refs = artifacts.map((artifact) =>
    immutableReference(repository, commit, {
      path: artifact.name,
      sha256: artifact.sha256,
      mediaType: inferredMediaType(artifact.name ?? ""),
    })
  );
  const jsArtifact = refs.find((artifact) => artifact.path?.endsWith(".js"));
  const wasmArtifacts = refs.filter((artifact) => artifact.path?.endsWith(".wasm"));
  const locks = Array.isArray(build.lockfiles) && build.lockfiles.length > 0
    ? build.lockfiles.map((lock) =>
      availableResource(
        "lockfile",
        "Build lockfile",
        immutableReference(repository, commit, { path: lock.name, sha256: lock.sha256 }),
        "application/json",
      )
    )
    : [
      unavailableResource(
        "lockfile",
        "Build lockfile",
        "unknown-provenance",
        "The run record contains no lockfile reference.",
      ),
    ];
  const compiled = wasmArtifacts.length > 0
    ? wasmArtifacts.map((artifact) =>
      availableResource("compiled-wasm", "Compiled WebAssembly", artifact, "application/wasm")
    )
    : [
      unavailableResource(
        "compiled-wasm",
        "Compiled WebAssembly",
        "not-applicable",
        "This variant record contains no compiled WebAssembly artifact.",
      ),
    ];
  return {
    schemaVersion: 1,
    manifestId: "run-source-inspectability-v1",
    benchmarkId: record.benchmark?.id ?? "unknown-run",
    evidenceStatus: "result-provenance",
    performanceResult: {
      state: "unavailable",
      reason: "not-published",
      detail:
        "This panel exposes the run record's provenance without changing its acceptance status.",
    },
    source: { repository, commit, treeUrl: `${repository}/tree/${commit}` },
    build: {
      command: String(build.command ?? "unavailable"),
      toolchains: Array.isArray(build.toolchains) ? build.toolchains : [],
      flags: Array.isArray(build.flags) ? build.flags : [],
    },
    resources: [
      jsArtifact
        ? availableResource(
          "executed-javascript",
          "Executed JavaScript",
          jsArtifact,
          "text/javascript",
        )
        : unavailableResource(
          "executed-javascript",
          "Executed JavaScript",
          "not-applicable",
          "This variant record contains no executed JavaScript artifact.",
        ),
      unavailableResource(
        "authored-wasm",
        "Authored WebAssembly",
        "unknown-provenance",
        "Run schema v1 does not identify authored WebAssembly source; no path is inferred.",
      ),
      unavailableResource(
        "build-recipe",
        "Build recipe",
        "unknown-provenance",
        "Run schema v1 records the command but not a build-recipe file reference.",
      ),
      ...locks,
      unavailableResource(
        "build-manifest",
        "Build manifest",
        "unknown-provenance",
        "Run schema v1 does not identify a build-manifest file; no path is inferred.",
      ),
      ...compiled,
    ],
  };
}

export function inspectabilityFromResultRecord(record) {
  if (record?.contractId === "workload-result-v2-proposal-v1" && record.provenance) {
    return normalizeV2Result(record);
  }
  return normalizeV1Run(record ?? {});
}

export function validateInspectabilityManifest(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["manifest must be an object"] };
  }
  const repository = value.source?.repository;
  const commit = value.source?.commit;
  if (repository !== REPOSITORY) errors.push("source repository is not allowlisted");
  if (!GIT_OID.test(commit ?? "")) errors.push("source commit is not an exact Git OID");
  if (value.source?.treeUrl !== `${repository}/tree/${commit}`) {
    errors.push("commit tree link does not match the repository and commit");
  }
  if (value.performanceResult?.state !== "unavailable" || !value.performanceResult.reason) {
    errors.push("missing performance data must remain typed unavailable");
  }
  const resources = Array.isArray(value.resources) ? value.resources : [];
  const roles = resources.map((resource) => resource?.role);
  if (!REQUIRED_ROLES.every((role) => roles.includes(role))) {
    errors.push("inspectability resource roles are incomplete");
  }
  const identities = resources.map((resource) =>
    `${resource?.role}|${resource?.path ?? resource?.availability?.reason}`
  );
  if (new Set(identities).size !== identities.length) {
    errors.push("inspectability resources contain duplicate identities");
  }
  for (const resource of resources) {
    if (resource?.availability?.state === "unavailable") {
      if (!resource.availability.reason) {
        errors.push(`${resource.role}: unavailable resource has no reason`);
      }
      for (const field of ["path", "sha256", "mediaType", "immutableUrl", "localDownloadRoute"]) {
        if (field in resource) {
          errors.push(`${resource.role}: unavailable resource exposes ${field}`);
        }
      }
      continue;
    }
    if (resource?.availability?.state !== "available") {
      errors.push(`${resource?.role}: availability state is invalid`);
      continue;
    }
    if (!REPO_PATH.test(resource.path ?? "")) {
      errors.push(`${resource.role}: repository path is invalid`);
    }
    if (!SHA256.test(resource.sha256 ?? "")) errors.push(`${resource.role}: SHA-256 is invalid`);
    if (resource.immutableUrl !== `${repository}/blob/${commit}/${resource.path}`) {
      errors.push(`${resource.role}: immutable link does not match commit and path`);
    }
    if (resource.localDownloadRoute) {
      const allowedDownload = localDownloadRoute(resource.path, resource.sha256);
      if (resource.localDownloadRoute !== allowedDownload) {
        errors.push(`${resource.role}: local download route is not allowlisted for these bytes`);
      }
      if (!new Set(["build-manifest", "compiled-wasm", "result-artifact"]).has(resource.role)) {
        errors.push(`${resource.role}: source paths cannot have local download routes`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function element(name, text, className) {
  const node = document.createElement(name);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(href, text, download = false) {
  const anchor = element("a", text);
  anchor.href = href;
  if (download) anchor.download = "";
  return anchor;
}

function availabilityText(availability) {
  const detail = availability.detail ? ` ${availability.detail}` : "";
  return `Unavailable: ${availability.reason}.${detail}`;
}

function appendDefinition(list, term, content) {
  list.append(element("dt", term));
  const description = document.createElement("dd");
  if (typeof content === "string") description.textContent = content;
  else description.append(content);
  list.append(description);
}

function appendHash(container, sha256) {
  container.append(document.createTextNode(" SHA-256 "), element("code", sha256));
}

function resourceContent(resource) {
  if (resource.availability.state === "unavailable") {
    return element("span", availabilityText(resource.availability), "inspectability-unavailable");
  }
  const content = document.createElement("span");
  content.append(link(resource.immutableUrl, `Open ${resource.path} at the exact commit`));
  if (resource.localDownloadRoute) {
    content.append(
      document.createTextNode(" · "),
      link(resource.localDownloadRoute, `Download ${resource.label}`, true),
    );
  }
  appendHash(content, resource.sha256);
  return content;
}

function resourcesForRole(manifest, role) {
  return manifest.resources.filter((resource) => resource.role === role);
}

function appendResourceDefinitions(facts, manifest, role, term) {
  for (const resource of resourcesForRole(manifest, role)) {
    appendDefinition(facts, term, resourceContent(resource));
  }
}

export function inspectabilityRows(manifest) {
  const validation = validateInspectabilityManifest(manifest);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  return [
    {
      term: "Exact commit",
      links: [{ href: manifest.source.treeUrl, label: `Open commit ${manifest.source.commit}` }],
      code: manifest.source.commit,
    },
    ...manifest.resources.map((resource) => ({
      term: resource.label,
      availability: resource.availability,
      links: resource.availability.state === "available"
        ? [
          { href: resource.immutableUrl, label: `Open ${resource.path} at the exact commit` },
          ...(resource.localDownloadRoute
            ? [{ href: resource.localDownloadRoute, label: `Download ${resource.label}` }]
            : []),
        ]
        : [],
      code: resource.availability.state === "available" ? resource.sha256 : undefined,
    })),
  ];
}

export function renderInspectabilityPanel(container, manifest) {
  inspectabilityRows(manifest);
  const panel = element("article", undefined, "inspectability-panel");
  panel.append(
    element("h3", `${manifest.benchmarkId} source and build`),
    element(
      "p",
      "These links come from this evidence record. They do not change the result's acceptance status.",
    ),
  );
  const facts = element("dl", undefined, "inspectability-facts");
  const commit = document.createElement("span");
  commit.append(
    link(manifest.source.treeUrl, `Open commit ${manifest.source.commit}`),
    document.createTextNode(" · "),
    element("code", manifest.source.commit),
  );
  appendDefinition(facts, "Exact commit", commit);
  appendDefinition(facts, "Performance result", availabilityText(manifest.performanceResult));
  appendResourceDefinitions(facts, manifest, "executed-javascript", "Executed JavaScript");
  appendResourceDefinitions(facts, manifest, "authored-wasm", "Authored WebAssembly");
  appendResourceDefinitions(facts, manifest, "build-recipe", "Build recipe");
  appendDefinition(facts, "Build command", element("code", manifest.build.command));
  appendDefinition(
    facts,
    "Toolchain",
    manifest.build.toolchains.length > 0 ? manifest.build.toolchains.join(" · ") : "Unavailable",
  );
  appendDefinition(
    facts,
    "Build flags",
    manifest.build.flags.length > 0 ? manifest.build.flags.join(" · ") : "None recorded",
  );
  appendResourceDefinitions(facts, manifest, "lockfile", "Lockfile");
  appendResourceDefinitions(facts, manifest, "build-manifest", "Build manifest");
  appendResourceDefinitions(facts, manifest, "compiled-wasm", "Compiled artifact");
  appendResourceDefinitions(facts, manifest, "result-artifact", "Result artifact");
  panel.append(facts);
  container.replaceChildren(panel);
}

export function renderResultInspectability(container, record) {
  renderInspectabilityPanel(container, inspectabilityFromResultRecord(record));
}

function fallbackLink() {
  return link(MANIFEST_ROUTE, "Open the source/build manifest without JavaScript");
}

async function loadPanel(container) {
  try {
    const source = new URL(container.dataset.inspectabilitySrc ?? "", location.href);
    if (source.origin !== location.origin || source.pathname !== MANIFEST_ROUTE || source.search) {
      throw new Error("inspectability manifest route is not allowlisted");
    }
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) throw new Error(`manifest returned ${response.status}`);
    renderInspectabilityPanel(container, await response.json());
  } catch (error) {
    const message = element(
      "p",
      `Source and build evidence unavailable: ${
        error instanceof Error ? error.message : "request failed"
      }`,
      "notice",
    );
    container.replaceChildren(message, fallbackLink());
  }
}

if (typeof document !== "undefined") {
  for (const container of document.querySelectorAll("[data-inspectability-src]")) {
    await loadPanel(container);
  }
}
