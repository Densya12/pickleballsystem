import { describe, expect, it, vi } from "vitest";
import { ScreenWakeLock, type WakeLockApi, type WakeLockSentinelLike } from "./wakeLock";

function fakeApi() {
  const sentinels: (WakeLockSentinelLike & { fireRelease: () => void; releaseCalls: number })[] = [];
  const api: WakeLockApi & { requests: number } = {
    requests: 0,
    request: vi.fn(async () => {
      api.requests += 1;
      let listener: (() => void) | undefined;
      const sentinel = {
        released: false,
        releaseCalls: 0,
        async release() {
          sentinel.releaseCalls += 1;
          sentinel.released = true;
          listener?.();
        },
        addEventListener(_type: "release", cb: () => void) {
          listener = cb;
        },
        fireRelease() {
          sentinel.released = true;
          listener?.();
        },
      };
      sentinels.push(sentinel);
      return sentinel;
    }),
  };
  return { api, sentinels };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ScreenWakeLock", () => {
  it("is 'unsupported' without the API and never throws", () => {
    const lock = new ScreenWakeLock(undefined, () => true);
    lock.setWanted(true);
    lock.handleVisibilityChange();
    lock.setWanted(false);
    expect(lock.status).toBe("unsupported");
  });

  it("queued/playing: requests the lock; paused/left/ended: releases it", async () => {
    const { api, sentinels } = fakeApi();
    const statuses: string[] = [];
    const lock = new ScreenWakeLock(api, () => true, (s) => statuses.push(s));
    lock.setWanted(true);
    await flush();
    expect(lock.status).toBe("on");
    expect(api.requests).toBe(1);

    lock.setWanted(true); // already held: no second request
    await flush();
    expect(api.requests).toBe(1);

    lock.setWanted(false);
    expect(sentinels[0].releaseCalls).toBe(1);
    expect(lock.status).toBe("off");
    expect(statuses).toEqual(["requesting", "on", "off"]);
  });

  it("asks again when the page is visible after the browser dropped the lock", async () => {
    let visible = true;
    const { api, sentinels } = fakeApi();
    const lock = new ScreenWakeLock(api, () => visible);
    lock.setWanted(true);
    await flush();

    visible = false;
    sentinels[0].fireRelease(); // the browser releases it on hide
    lock.handleVisibilityChange();
    await flush();
    expect(lock.status).toBe("off");
    expect(api.requests).toBe(1);

    visible = true;
    lock.handleVisibilityChange();
    await flush();
    expect(lock.status).toBe("on");
    expect(api.requests).toBe(2);
  });

  it("does not request while hidden, nor when no longer wanted", async () => {
    const { api } = fakeApi();
    const lock = new ScreenWakeLock(api, () => false);
    lock.setWanted(true);
    await flush();
    expect(api.requests).toBe(0);

    const lock2 = new ScreenWakeLock(api, () => true);
    lock2.setWanted(false);
    lock2.handleVisibilityChange();
    await flush();
    expect(api.requests).toBe(0);
  });

  it("releases a lock that arrives after the player paused", async () => {
    const { api, sentinels } = fakeApi();
    const lock = new ScreenWakeLock(api, () => true);
    lock.setWanted(true);
    lock.setWanted(false); // before the request resolved
    await flush();
    expect(sentinels[0].releaseCalls).toBe(1);
    expect(lock.status).toBe("off");
  });

  it("a refused request fails silently", async () => {
    const api: WakeLockApi = { request: vi.fn(async () => Promise.reject(new DOMException("no", "NotAllowedError"))) };
    const lock = new ScreenWakeLock(api, () => true);
    lock.setWanted(true);
    await flush();
    expect(lock.status).toBe("failed");
  });

  it("dispose releases and stops", async () => {
    const { api, sentinels } = fakeApi();
    const lock = new ScreenWakeLock(api, () => true);
    lock.setWanted(true);
    await flush();
    lock.dispose();
    expect(sentinels[0].releaseCalls).toBe(1);
    lock.handleVisibilityChange();
    await flush();
    expect(api.requests).toBe(1);
  });
});
