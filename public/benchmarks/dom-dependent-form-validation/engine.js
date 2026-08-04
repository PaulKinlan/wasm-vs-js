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
