export interface GridControlState {
  selectedTarget?: unknown;
  runnerInitialized?: unknown;
  startDisabled?: unknown;
  cancelDisabled?: unknown;
  workerActive?: unknown;
  status?: unknown;
}

export function gridControlReady(state: GridControlState, target: string): boolean {
  return state.selectedTarget === target && state.runnerInitialized === "true" &&
    state.startDisabled === false && state.cancelDisabled === true &&
    state.workerActive === "false";
}

export function gridControlRunning(state: GridControlState): boolean {
  return String(state.status).startsWith("Running ") && state.startDisabled === true &&
    state.cancelDisabled === false && state.workerActive === "true";
}

export function assertGridControlRunning(state: GridControlState): void {
  if (!gridControlRunning(state)) {
    throw new Error(`Start click did not enter Running state: ${JSON.stringify(state)}`);
  }
}
