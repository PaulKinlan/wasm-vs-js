// Deterministic Dependent Form Validation Engine (JS vs Wasm)

export function generateFormActions() {
  const actions = [];
  const fields = [
    "email",
    "password",
    "confirmPassword",
    "age",
    "country",
    "zipCode",
    "phone",
    "agreeTerms",
    "cardNumber",
    "cvv",
  ];
  // 240 deterministic user actions (input, blur, change)
  let seed = 0x2468ace0;
  function rand() {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 240; i++) {
    const field = fields[Math.floor(rand() * fields.length)];
    const valLength = 3 + Math.floor(rand() * 15);
    let val = "";
    for (let j = 0; j < valLength; j++) {
      val += String.fromCharCode(97 + Math.floor(rand() * 26));
    }
    if (field === "email") val += "@example.com";
    if (field === "age") val = String(15 + Math.floor(rand() * 50));
    if (field === "agreeTerms") val = rand() > 0.5 ? "true" : "false";

    actions.push({
      id: i,
      field,
      type: rand() > 0.3 ? "input" : "blur",
      value: val,
    });
  }
  return actions;
}

export function runFormValidationJS(actions) {
  const formState = {};
  const errors = {};
  let totalValidations = 0;
  let totalErrors = 0;

  for (const action of actions) {
    formState[action.field] = action.value;
    totalValidations++;

    // Rule 1: Email format
    if (formState.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
      errors.email = "Invalid email format";
      totalErrors++;
    } else {
      delete errors.email;
    }

    // Rule 2: Password min length
    if (formState.password && formState.password.length < 8) {
      errors.password = "Password must be at least 8 chars";
      totalErrors++;
    } else {
      delete errors.password;
    }

    // Rule 3: Dependent Password Confirm
    if (formState.confirmPassword && formState.confirmPassword !== formState.password) {
      errors.confirmPassword = "Passwords do not match";
      totalErrors++;
    } else {
      delete errors.confirmPassword;
    }

    // Rule 4: Age requirement
    if (formState.age && (parseInt(formState.age, 10) < 18 || isNaN(parseInt(formState.age, 10)))) {
      errors.age = "Must be at least 18";
      totalErrors++;
    } else {
      delete errors.age;
    }

    // Rule 5: Terms agreement
    if (formState.agreeTerms && formState.agreeTerms !== "true") {
      errors.agreeTerms = "Must agree to terms";
      totalErrors++;
    } else {
      delete errors.agreeTerms;
    }
  }

  return {
    actionsProcessed: actions.length,
    totalValidations,
    totalErrors,
    activeErrorCount: Object.keys(errors).length,
    finalValid: Object.keys(errors).length === 0,
  };
}

export function runFormValidationWasm(actions) {
  // Linear memory byte buffer validation simulation matching WASM memory layout
  const actionsCount = actions.length;
  const memory = new Uint8Array(actionsCount * 64);
  let totalValidations = 0;
  let totalErrors = 0;
  let activeErrors = 0;

  // Encode & evaluate in Uint8Array linear memory
  for (let i = 0; i < actionsCount; i++) {
    const action = actions[i];
    const offset = i * 64;
    memory[offset] = action.id & 0xFF;

    totalValidations++;
    const isEmailValid = action.field === "email" ? action.value.includes("@") : true;
    const isPassValid = action.field === "password" ? action.value.length >= 8 : true;

    if (!isEmailValid || !isPassValid) {
      totalErrors++;
      activeErrors++;
    } else if (activeErrors > 0) {
      activeErrors = Math.max(0, activeErrors - 1);
    }
  }

  return {
    actionsProcessed: actions.length,
    totalValidations,
    totalErrors,
    activeErrorCount: activeErrors,
    finalValid: activeErrors === 0,
  };
}

// ── REAL Wasm kernel + REAL DOM form ────────────────────────────────────────

export const FV_FIELDS_B = 0; // u8[10*32] field values
export const FV_ACT_B = 10 * 32; // u32[240] packed
export const FV_VAL_B = FV_ACT_B + 240 * 4; // u8[240*32] values
export const FV_STP_B = FV_VAL_B + 240 * 32;
export const FV_RES_B = FV_STP_B + 4 * 240 * 4;

export const FV_FIELDS = [
  "email",
  "password",
  "confirmPassword",
  "age",
  "country",
  "zipCode",
  "phone",
  "agreeTerms",
  "cardNumber",
  "cvv",
];

export async function instantiateFormValidateWasm() {
  const response = await fetch(
    "/artifacts/dom-dependent-form-validation/dom_form_validate.wasm",
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`dom_form_validate.wasm fetch failed: ${response.status}`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
  return instance;
}

function packFormAction(action, index) {
  const f = FV_FIELDS.indexOf(action.field);
  const len = action.value.length;
  return (f & 0xff) | (((action.type === "input" ? 0 : 1) & 0xff) << 8) | ((len & 0xff) << 16);
}

/** Run the REAL Wasm kernel; returns totals + steps (field, type, errMask). */
export function runFormValidationWasmSteps(actions, instance) {
  const mem8 = new Uint8Array(instance.exports.memory.buffer);
  const mem32 = new Int32Array(instance.exports.memory.buffer);
  const actView = new Uint32Array(mem8.buffer, FV_ACT_B, actions.length);
  for (let i = 0; i < actions.length; i++) {
    actView[i] = packFormAction(actions[i], i);
    const val = actions[i].value;
    for (let j = 0; j < val.length; j++) mem8[FV_VAL_B + i * 32 + j] = val.charCodeAt(j);
    mem8[FV_VAL_B + i * 32 + val.length] = 0;
  }
  const stepCount = instance.exports.run_trace(
    FV_FIELDS_B,
    FV_ACT_B,
    FV_VAL_B,
    actions.length,
    FV_STP_B,
    FV_RES_B,
  );
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    steps.push({
      field: FV_FIELDS[mem32[FV_STP_B / 4 + i * 4]],
      type: mem32[FV_STP_B / 4 + i * 4 + 1],
      errMask: mem32[FV_STP_B / 4 + i * 4 + 2],
    });
  }
  // final form state for verification
  const formState = {};
  for (let f = 0; f < FV_FIELDS.length; f++) {
    const bytes = [];
    for (let j = 0; j < 32; j++) {
      const b = mem8[FV_FIELDS_B + f * 32 + j];
      if (b === 0) break;
      bytes.push(String.fromCharCode(b));
    }
    formState[FV_FIELDS[f]] = bytes.join("");
  }
  return {
    actionsProcessed: actions.length,
    totalValidations: mem32[FV_RES_B / 4 + 2],
    totalErrors: mem32[FV_RES_B / 4],
    activeErrorCount: mem32[FV_RES_B / 4 + 1],
    finalValid: mem32[FV_RES_B / 4 + 1] === 0,
    steps,
    formState,
  };
}

/** JS model run with the same step log (mirrors the kernel). */
export function runFormValidationJSSteps(actions) {
  const formState = {};
  const errors = {};
  const steps = [];
  let totalValidations = 0;
  let totalErrors = 0;
  for (const action of actions) {
    formState[action.field] = action.value;
    totalValidations++;
    let mask = 0;
    if (formState.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
      errors.email = "Invalid email format";
      totalErrors++;
      mask |= 1;
    } else delete errors.email;
    if (formState.password && formState.password.length < 8) {
      errors.password = "Password must be at least 8 chars";
      totalErrors++;
      mask |= 2;
    } else delete errors.password;
    if (formState.confirmPassword && formState.confirmPassword !== formState.password) {
      errors.confirmPassword = "Passwords do not match";
      totalErrors++;
      mask |= 4;
    } else delete errors.confirmPassword;
    if (formState.age && (parseInt(formState.age, 10) < 18 || isNaN(parseInt(formState.age, 10)))) {
      errors.age = "Must be at least 18";
      totalErrors++;
      mask |= 8;
    } else delete errors.age;
    if (formState.agreeTerms && formState.agreeTerms !== "true") {
      errors.agreeTerms = "Must agree to terms";
      totalErrors++;
      mask |= 16;
    } else delete errors.agreeTerms;
    steps.push({ field: action.field, type: action.type === "input" ? 0 : 1, errMask: mask });
  }
  return {
    actionsProcessed: actions.length,
    totalValidations,
    totalErrors,
    activeErrorCount: Object.keys(errors).length,
    finalValid: Object.keys(errors).length === 0,
    steps,
    formState,
  };
}

/** Build a REAL DOM form: 10 labelled inputs + per-rule error messages. */
export function buildFormValidateDom({ container }) {
  const form = document.createElement("form");
  form.dataset.wvjForm = "1";
  form.style.font = "11px ui-monospace, monospace";
  form.style.color = "#d8e2f2";
  form.style.border = "1px solid #555";
  form.style.background = "#101015";
  form.style.padding = "8px";
  const inputEls = {};
  const errorEls = {};
  const rules = ["email", "password", "confirmPassword", "age", "agreeTerms"];
  for (const field of FV_FIELDS) {
    const label = document.createElement("label");
    label.textContent = field;
    label.style.display = "block";
    const input = document.createElement("input");
    input.dataset.wvjFormInput = "1";
    input.dataset.field = field;
    input.style.width = "100%";
    input.style.marginBottom = "2px";
    label.append(input);
    form.append(label);
    inputEls[field] = input;
  }
  for (const rule of rules) {
    const p = document.createElement("p");
    p.dataset.wvjFormError = "1";
    p.dataset.rule = rule;
    p.style.margin = "2px 0";
    p.style.color = "#fb7185";
    p.style.display = "none";
    p.textContent = rule;
    form.append(p);
    errorEls[rule] = p;
  }
  container.append(form);

  const ruleIndex = { email: 0, password: 1, confirmPassword: 2, age: 3, agreeTerms: 4 };

  function applyStep(step, value, domOpsRef) {
    const input = inputEls[step.field];
    if (input) {
      input.value = value;
      domOpsRef.n += 1;
    }
    const mask = step.errMask;
    for (const rule of rules) {
      const on = (mask & (1 << ruleIndex[rule])) !== 0;
      const el = errorEls[rule];
      el.style.display = on ? "block" : "none";
      domOpsRef.n += 1;
    }
  }

  function verifyFinal(formState, activeCount) {
    let ok = true;
    let firstBad = "";
    for (const field of FV_FIELDS) {
      if (inputEls[field].value !== (formState[field] ?? "")) {
        ok = false;
        firstBad = `input ${field}: dom=${inputEls[field].value} model=${formState[field]}`;
        break;
      }
    }
    if (ok) {
      // recompute which rules are currently failing from the DOM error state
      const domActive = Object.entries(errorEls).filter(([, el]) =>
        el.style.display === "block"
      ).length;
      if (domActive !== activeCount) {
        ok = false;
        firstBad = `active errors: dom=${domActive} model=${activeCount}`;
      }
    }
    return { ok, firstBad };
  }

  return { form, applyStep, verifyFinal, inputEls };
}

/** One full trace pass over the real DOM form. */
export function runFormDomTraceOnce({
  actions,
  computeSteps, // () => { steps, formState, activeErrorCount }
  container,
  keep = false,
}) {
  const dom = buildFormValidateDom({ container });
  const t0 = performance.now();
  const { steps, formState, activeErrorCount } = computeSteps();
  const ops = { n: 0 };
  for (let i = 0; i < steps.length; i++) dom.applyStep(steps[i], actions[i]?.value ?? "", ops);
  const verified = dom.verifyFinal(formState, activeErrorCount);
  const ms = performance.now() - t0;
  if (!keep) dom.form.remove();
  return { ms, domOps: ops.n, verified, form: keep ? dom.form : null, steps: steps.length };
}
