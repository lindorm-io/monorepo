import type { ChildProcess } from "child_process";
import { forwardSignals } from "./forward-signals";

const SIGNALS: Array<NodeJS.Signals> = ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"];

describe("forwardSignals", () => {
  test("should register handlers for exactly these signals", () => {
    const child = { kill: jest.fn() } as unknown as ChildProcess;
    const before = SIGNALS.map((s) => process.listenerCount(s));

    const unregister = forwardSignals(child);

    const added = SIGNALS.map((s, i) => process.listenerCount(s) - before[i]);

    expect(added).toEqual([1, 1, 1, 1]);
    expect(SIGNALS).toMatchSnapshot();

    unregister();
  });

  test("should forward signal to child.kill", () => {
    const kill = jest.fn();
    const child = { kill } as unknown as ChildProcess;

    const unregister = forwardSignals(child);

    process.emit("SIGHUP", "SIGHUP");

    expect(kill).toHaveBeenCalledWith("SIGHUP");

    unregister();
  });

  test("should remove all handlers on unregister", () => {
    const child = { kill: jest.fn() } as unknown as ChildProcess;
    const before = SIGNALS.map((s) => process.listenerCount(s));

    const unregister = forwardSignals(child);
    unregister();

    const after = SIGNALS.map((s) => process.listenerCount(s));

    expect(after).toEqual(before);
  });
});
