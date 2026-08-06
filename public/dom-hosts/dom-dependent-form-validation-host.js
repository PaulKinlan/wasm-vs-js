// Real-DOM host for the DOM Dependent Form-Validation workload (iframe orchestration).
//
// Renders a real <form> with the workload's field set and applies the frozen
// input/blur action stream to the DOM fields, mirroring the engine's rules
// exactly (email format, password length, dependent confirm, age, terms —
// re-evaluated on every action). The rendered error state is verified against
// a plain-data replay of the workload's intended semantics.

import { createModelDomHost } from "./dom-host-factory.js";

const FIELDS = [
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function evaluateRules(formState) {
  const errors = {};
  if (formState.email && !EMAIL_RE.test(formState.email)) errors.email = "Invalid email format";
  if (formState.password && formState.password.length < 8) {
    errors.password = "Password must be at least 8 chars";
  }
  if (formState.confirmPassword && formState.confirmPassword !== formState.password) {
    errors.confirmPassword = "Passwords do not match";
  }
  if (
    formState.age && (Number.isNaN(parseInt(formState.age, 10)) || parseInt(formState.age, 10) < 18)
  ) {
    errors.age = "Must be at least 18";
  }
  if (formState.agreeTerms && formState.agreeTerms !== "true") {
    errors.agreeTerms = "Must agree to terms";
  }
  return errors;
}

export async function createTodomvcHost() {
  return createModelDomHost({
    slug: "dom-dependent-form-validation",
    label: "DOM Dependent Form-Validation Engine",
    loadEngine: () => import("/benchmarks/dom-dependent-form-validation/engine.js"),
    generateActions: (engine) => engine.generateFormActions(),

    renderDom: () => {
      const root = document.createElement("div");
      root.id = "wvj-form-host";
      root.className = "wvj-form-app";
      const form = document.createElement("form");
      form.id = "wvj-form";
      form.setAttribute("novalidate", "");
      const fields = new Map();
      for (const name of FIELDS) {
        const label = document.createElement("label");
        label.textContent = name;
        const input = document.createElement("input");
        input.name = name;
        input.dataset.field = name;
        const error = document.createElement("span");
        error.className = "wvj-field-error";
        error.dataset.errorFor = name;
        label.append(input, error);
        form.append(label);
        fields.set(name, { input, error });
      }
      root.append(form);
      document.body.append(root);
      const formState = {};
      const reset = () => {
        for (const name of FIELDS) {
          formState[name] = "";
          fields.get(name).input.value = "";
          fields.get(name).error.textContent = "";
          fields.get(name).input.classList.remove("wvj-invalid");
        }
      };
      reset();
      return { root, form, fields, formState, reset };
    },

    applyAction: (dom, action) => {
      const { fields, formState } = dom;
      formState[action.field] = action.value;
      fields.get(action.field).input.value = action.value;
      const errors = evaluateRules(formState);
      for (const name of FIELDS) {
        const entry = fields.get(name);
        const message = errors[name] ?? "";
        entry.error.textContent = message;
        entry.input.classList.toggle("wvj-invalid", message !== "");
      }
    },

    computeReference: (actions) => {
      const formState = {};
      for (const a of actions) formState[a.field] = a.value;
      return { activeErrorCount: Object.keys(evaluateRules(formState)).length };
    },

    readDomState: (dom) => ({
      activeErrorCount: [...dom.fields.values()].filter(({ error }) => error.textContent).length,
    }),

    verifyDom: (state, reference) => {
      if (state.activeErrorCount !== reference.activeErrorCount) {
        throw new Error(
          `form DOM drift: ${state.activeErrorCount} errors != reference ${reference.activeErrorCount}`,
        );
      }
    },

    runModel: (engine, actions, target) =>
      target === "wasm"
        ? engine.runFormValidationWasm(actions)
        : engine.runFormValidationJS(actions),
  });
}
