import type { ChildProcess } from "child_process";

const SIGNALS: Array<NodeJS.Signals> = ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"];

export const forwardSignals = (child: ChildProcess): (() => void) => {
  const handlers = new Map<NodeJS.Signals, () => void>();

  for (const signal of SIGNALS) {
    const handler = (): void => {
      child.kill(signal);
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }

  return () => {
    for (const [signal, handler] of handlers) {
      process.removeListener(signal, handler);
    }
  };
};
