import { describe, expect, it } from "vitest";
import { fanout } from "./parallel.js";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const defer = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe("fanout", () => {
  it("returns [] for empty array (multiplexed)", async () => {
    const result = await fanout({ multiplexed: true }, []);
    expect(result).toEqual([]);
  });

  it("returns [] for empty array (sequential)", async () => {
    const result = await fanout({ multiplexed: false }, []);
    expect(result).toEqual([]);
  });

  it("preserves array order when multiplexed (parallel)", async () => {
    const result = await fanout({ multiplexed: true }, [
      async () => "a",
      async () => "b",
      async () => "c",
    ]);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("runs concurrently when multiplexed (all start before any finishes)", async () => {
    const started: Array<string> = [];
    const da = defer<string>();
    const db = defer<string>();
    const dc = defer<string>();

    const promise = fanout({ multiplexed: true }, [
      async () => {
        started.push("a");
        return da.promise;
      },
      async () => {
        started.push("b");
        return db.promise;
      },
      async () => {
        started.push("c");
        return dc.promise;
      },
    ]);

    // Yield to let all three start before any resolves
    await Promise.resolve();
    await Promise.resolve();

    expect(started).toEqual(["a", "b", "c"]);

    // Resolve in reverse order — result must still match input order
    dc.resolve("c");
    db.resolve("b");
    da.resolve("a");

    const result = await promise;
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("runs sequentially when multiplexed=false (next does not start until prev finishes)", async () => {
    const events: Array<string> = [];
    const da = defer<string>();
    const db = defer<string>();

    const promise = fanout({ multiplexed: false }, [
      async () => {
        events.push("start-a");
        const v = await da.promise;
        events.push("end-a");
        return v;
      },
      async () => {
        events.push("start-b");
        const v = await db.promise;
        events.push("end-b");
        return v;
      },
    ]);

    // Yield — only the first should have started
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["start-a"]);

    // Resolve a; now b should start
    da.resolve("a");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["start-a", "end-a", "start-b"]);

    db.resolve("b");
    const result = await promise;
    expect(events).toEqual(["start-a", "end-a", "start-b", "end-b"]);
    expect(result).toEqual(["a", "b"]);
  });

  it("treats undefined multiplexed as sequential", async () => {
    const events: Array<string> = [];
    const da = defer<string>();
    const db = defer<string>();

    const promise = fanout({}, [
      async () => {
        events.push("start-a");
        const v = await da.promise;
        events.push("end-a");
        return v;
      },
      async () => {
        events.push("start-b");
        const v = await db.promise;
        events.push("end-b");
        return v;
      },
    ]);

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["start-a"]);

    da.resolve("a");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["start-a", "end-a", "start-b"]);

    db.resolve("b");
    const result = await promise;
    expect(result).toEqual(["a", "b"]);
  });
});
