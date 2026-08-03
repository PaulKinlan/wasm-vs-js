export type CleanupLifecycleState =
  | "ready-no-owned-launch"
  | "owned-launch-active"
  | "cleanup-verified"
  | "cleanup-unresolved";

export type StageDisposition = "remove-stage" | "retain-stage-unresolved-cleanup";

export class StageCleanupLifecycle {
  #state: CleanupLifecycleState = "ready-no-owned-launch";

  get state(): CleanupLifecycleState {
    return this.#state;
  }

  get disposition(): StageDisposition {
    return this.#state === "owned-launch-active" || this.#state === "cleanup-unresolved"
      ? "retain-stage-unresolved-cleanup"
      : "remove-stage";
  }

  launchBegan(): void {
    if (this.#state === "owned-launch-active" || this.#state === "cleanup-unresolved") {
      throw new Error(`invalid cleanup lifecycle launch transition from ${this.#state}`);
    }
    this.#state = "owned-launch-active";
  }

  cleanupVerified(): void {
    if (this.#state !== "owned-launch-active") {
      throw new Error(`invalid cleanup lifecycle verified transition from ${this.#state}`);
    }
    this.#state = "cleanup-verified";
  }

  cleanupUnresolved(): void {
    this.#state = "cleanup-unresolved";
  }

  prelaunchFailure(cleanupResolved: boolean): void {
    if (
      this.#state !== "ready-no-owned-launch" && this.#state !== "cleanup-verified"
    ) {
      throw new Error(`invalid prelaunch lifecycle transition from ${this.#state}`);
    }
    if (!cleanupResolved) this.#state = "cleanup-unresolved";
  }
}
