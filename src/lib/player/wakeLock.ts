/**
 * Phase 6: keep the screen on while the player waits or plays, so the call is
 * heard (Screen Wake Lock API). Browsers drop the lock when the page is hidden;
 * it is requested again when the page is visible. Unsupported or refused:
 * silent, except that "unsupported" lets the page show one quiet line.
 */

export type WakeLockSentinelLike = {
  released?: boolean;
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
};
export type WakeLockApi = { request(type: "screen"): Promise<WakeLockSentinelLike> };

export type WakeLockStatus = "unsupported" | "off" | "requesting" | "on" | "failed";

export class ScreenWakeLock {
  status: WakeLockStatus;
  private wanted = false;
  private sentinel: WakeLockSentinelLike | null = null;
  private requesting = false;
  private disposed = false;

  constructor(
    private readonly api: WakeLockApi | null | undefined,
    private readonly isVisible: () => boolean,
    private readonly onStatus: (status: WakeLockStatus) => void = () => {},
  ) {
    this.status = api ? "off" : "unsupported";
  }

  /** Queued or playing: true. Paused, left, or the session ended: false. */
  setWanted(wanted: boolean): void {
    this.wanted = wanted;
    if (wanted) void this.ensure();
    else this.releaseNow();
  }

  /** Call on visibilitychange. */
  handleVisibilityChange(): void {
    if (this.isVisible()) void this.ensure();
  }

  dispose(): void {
    this.disposed = true;
    this.wanted = false;
    this.releaseNow();
  }

  private set(status: WakeLockStatus) {
    if (this.status === status) return;
    this.status = status;
    this.onStatus(status);
  }

  private releaseNow() {
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel) void sentinel.release().catch(() => {});
    if (this.api) this.set("off");
  }

  private async ensure(): Promise<void> {
    if (!this.api || !this.wanted || this.disposed || this.sentinel || this.requesting || !this.isVisible()) return;
    this.requesting = true;
    this.set("requesting");
    try {
      const sentinel = await this.api.request("screen");
      this.requesting = false;
      if (!this.wanted || this.disposed) {
        void sentinel.release().catch(() => {});
        this.set("off");
        return;
      }
      this.sentinel = sentinel;
      sentinel.addEventListener("release", () => {
        // Released by the browser (page hidden) or by us.
        if (this.sentinel === sentinel) this.sentinel = null;
        if (this.status === "on") this.set("off");
      });
      this.set("on");
    } catch {
      this.requesting = false;
      this.set("failed");
    }
  }
}
