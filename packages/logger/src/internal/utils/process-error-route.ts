import { isError } from "@lindorm/is";

// Routes uncaughtException / unhandledRejection through whichever Logger
// most recently called `setProcessErrorRoute(...)`. Process listeners are
// attached lazily on the first call and reused for the lifetime of the
// module — per-Logger `process.on(...)` would accumulate listeners (and
// hit Node's MaxListeners warning) every time a fresh Logger is built,
// which is common in test suites.

let processHandlersInstalled = false;
let activeRoute: ((error: Error) => void) | null = null;

const installProcessHandlers = (): void => {
  if (processHandlersInstalled) return;
  processHandlersInstalled = true;

  process.on("uncaughtException", (err: unknown) => {
    if (!activeRoute) return;
    activeRoute(isError(err) ? err : new Error(String(err)));
  });

  process.on("unhandledRejection", (reason: unknown) => {
    if (!activeRoute) return;
    activeRoute(isError(reason) ? reason : new Error(String(reason)));
  });
};

export const setProcessErrorRoute = (route: (error: Error) => void): void => {
  installProcessHandlers();
  activeRoute = route;
};
