const REQUIRED_ROLES = [
  "executed-javascript",
  "authored-wasm",
  "build-recipe",
  "lockfile",
  "build-manifest",
  "compiled-wasm",
];

const LOCAL_DOWNLOADS = new Map([
  ["build-manifest", "/artifacts/sum-u32/build-manifest.9c309c49.json"],
  ["compiled-wasm", "/artifacts/sum-u32/sum-u32.wasm"],
]);

const MANIFEST_ROUTE = "/data/sum-u32-inspectability.v1.json";
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OID = /^[a-f0-9]{40}$/;
const REPO_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/;

export function validateInspectabilityManifest(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["manifest must be an object"] };
  }
  const repository = value.source?.repository;
  const commit = value.source?.commit;
  if (repository !== "https://github.com/PaulKinlan/wasm-vs-js") {
    errors.push("source repository is not allowlisted");
  }
  if (!GIT_OID.test(commit ?? "")) errors.push("source commit is not an exact Git OID");
  if (value.source?.treeUrl !== `${repository}/tree/${commit}`) {
    errors.push("commit tree link does not match the repository and commit");
  }
  if (value.performanceResult?.state !== "unavailable" || !value.performanceResult.reason) {
    errors.push("missing performance data must remain typed unavailable");
  }
  const resources = Array.isArray(value.resources) ? value.resources : [];
  const roles = resources.map((resource) => resource?.role);
  if (
    roles.length !== REQUIRED_ROLES.length || new Set(roles).size !== roles.length ||
    !REQUIRED_ROLES.every((role) => roles.includes(role))
  ) {
    errors.push("inspectability resource roles are incomplete or duplicated");
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
    const allowedDownload = LOCAL_DOWNLOADS.get(resource.role);
    if (allowedDownload) {
      if (resource.localDownloadRoute !== allowedDownload) {
        errors.push(`${resource.role}: local download route is not allowlisted`);
      }
    } else if ("localDownloadRoute" in resource) {
      errors.push(`${resource.role}: source paths cannot have local download routes`);
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

export function renderInspectabilityPanel(container, manifest) {
  const validation = validateInspectabilityManifest(manifest);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  const resources = new Map(manifest.resources.map((resource) => [resource.role, resource]));
  const panel = element("article", undefined, "inspectability-panel");
  panel.append(
    element("h3", `${manifest.benchmarkId} source and build`),
    element(
      "p",
      "These links identify the accepted implementation. They do not represent a collected performance result.",
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
  appendDefinition(
    facts,
    "Performance result",
    availabilityText(manifest.performanceResult),
  );
  appendDefinition(
    facts,
    "Executed JavaScript",
    resourceContent(resources.get("executed-javascript")),
  );
  appendDefinition(
    facts,
    "Authored WebAssembly",
    resourceContent(resources.get("authored-wasm")),
  );
  appendDefinition(facts, "Build recipe", resourceContent(resources.get("build-recipe")));
  appendDefinition(facts, "Build command", element("code", manifest.build.command));
  appendDefinition(facts, "Toolchain", manifest.build.toolchains.join(" · "));
  appendDefinition(facts, "Build flags", manifest.build.flags.join(" · "));
  appendDefinition(facts, "Lockfile", resourceContent(resources.get("lockfile")));
  appendDefinition(facts, "Build manifest", resourceContent(resources.get("build-manifest")));
  appendDefinition(facts, "Compiled artifact", resourceContent(resources.get("compiled-wasm")));
  panel.append(facts);
  container.replaceChildren(panel);
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
    container.replaceChildren(
      element(
        "p",
        `Source and build evidence unavailable: ${
          error instanceof Error ? error.message : "request failed"
        }`,
        "notice",
      ),
    );
  }
}

if (typeof document !== "undefined") {
  for (const container of document.querySelectorAll("[data-inspectability-src]")) {
    await loadPanel(container);
  }
}
