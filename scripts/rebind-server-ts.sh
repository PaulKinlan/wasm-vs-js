#!/bin/bash
# Full server.ts rebind cascade for wasm-vs-js. Run from the repo root AFTER
# committing the server.ts change. Usage: scripts/rebind-server-ts.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
C=$(git rev-parse HEAD)
PCM="$REPO_ROOT/public/artifacts/base-ml-keyword-spotting/fixture.pcm16le"
echo "HEAD=$C"
echo "$C" > artifacts/base/server-ssr-template/source-commit.txt
run() { local label=$1; shift; echo -n "$label: "; if "$@" > /tmp/rebind-last.log 2>&1; then echo ok; else echo FAIL; tail -3 /tmp/rebind-last.log; fi }
run mesh        deno run --allow-all scripts/build-cad-mesh-repair.ts --source-commit=$C
run olap        deno run --allow-all scripts/build-base-olap.ts --source-commit=$C
run tracer      deno run --allow-all scripts/build-base-path-tracer.ts --source-commit=$C
run todomvc     deno run --allow-all scripts/build-base-todomvc.ts --source-commit=$C
run kws         deno run --allow-all scripts/build-base-ml-keyword-spotting.ts --source-commit=$C --pcm=$PCM
run kernels     deno run --allow-all scripts/build-base-ml-numeric-kernels.ts --source-commit=$C
run fft         deno run --allow-all scripts/build-numeric-fft-spectral-filter.ts --source-commit=$C
run pdf         deno run --allow-all scripts/build-document-pdf-viewer.ts --source-commit=$C
run grid        deno run --allow-all scripts/build-dom-virtualized-grid.ts --source-commit=$C
run ecs         deno run --allow-all scripts/build-base-game-ecs-frame-update.ts --source-commit=$C
run gltf        deno run --allow-all scripts/build-base-gltf-viewer.ts --source-commit=$C
run polybench   deno run --allow-all scripts/build-base-polybench.ts --source-commit $C
run ssr         deno run --allow-all scripts/build-base-server-ssr-template.ts
run nbody       deno run --allow-all scripts/build-base-simulation-nbody.ts --source-commit=$C
run rigid       deno run --allow-all scripts/build-rigid-body-2d.ts --source-commit=$C
run game        deno run --allow-all scripts/build-game-family.ts --source-commit=$C
run logscan     deno run --allow-all scripts/build-text-regex-log-scan.ts --source-commit=$C
run telemetry   deno run --allow-all scripts/build-v1-json-telemetry.ts --source-commit=$C
run sqlite      deno run --allow-all scripts/build-sqlite-notebook-evidence.ts $C
run v2text      deno run --allow-all scripts/build-v2-text.ts
run v2neural-a  deno run --allow-all scripts/build-v2-neural.ts artifacts $C
WASM_VS_JS_COMMIT=$C run v2neural-r deno run --allow-all scripts/build-v2-neural.ts records $C
WASM_VS_JS_COMMIT=$C run jt-records deno run --allow-all scripts/build-v1-json-telemetry-records.ts
run trad        deno run --allow-all scripts/build-traditional-demos.ts --source-commit=$C
run pcap        deno run --allow-all scripts/build-base-network-pcap-decode.ts --source-commit=$C
run audio-slugs deno run --allow-all scripts/build-audio.ts --source-commit=$C
run audio-rec   deno run --allow-all scripts/build-audio-results.ts --source-commit=$C
run audio-reg   deno run --allow-all scripts/build-audio-demo-registry.ts
run audio-pages deno run --allow-all scripts/build-audio-demo-pages.ts
run audio-web   deno run --allow-all scripts/build-base-audio-webaudio-effects.ts --source-commit=$C --write
run archive     deno run --allow-all scripts/build-v1-archive.ts --source-commit=$C
run crypto-file deno run --allow-all scripts/build-base-crypto-file-integrity.ts
run crypto-stream deno run --allow-all scripts/build-crypto-authenticated-stream.ts
run image-demos deno run --allow-all scripts/build-image-demos.ts
run text-gc-surg deno run --allow-all scripts/rebind-text-gc-surgical.ts
run anchors     deno run --allow-read --allow-write=public scripts/build-worker-anchors.ts
run schemas     deno run --allow-all scripts/build-schemas.ts
run routes      deno run --allow-all scripts/build-routes.ts
WASM_VS_JS_COMMIT=$C run v2text-rec deno run --allow-all scripts/build-v2-text-records.ts
# Surgical traditional-demos retained-evidence rebind (do NOT run the collector — broken+destructive)
echo "$C" > artifacts/demos/traditional/source-commit.txt
TREE=$(git rev-parse HEAD^{tree})
python3 - "$C" "$TREE" <<'EOF'
import json, sys
commit, tree = sys.argv[1], sys.argv[2]
p = 'artifacts/demos/traditional/browser-evidence/evidence.v1.json'
d = open(p).read()
import re
d = re.sub(r'"commit": "[a-f0-9]{40}"', f'"commit": "{commit}"', d, count=1)
d = re.sub(r'"tree": "[a-f0-9]{40}"', f'"tree": "{tree}"', d, count=1)
open(p, 'w').write(d)
print('evidence.v1.json rebound')
EOF
echo "DONE — now: git add -A && git commit && deno task check"
