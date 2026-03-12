import { spawn } from "child_process";
import { forwardSignals } from "./forward-signals";

const SIGNAL_CODES: Record<string, number> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGTERM: 15,
};

export const spawnCommand = (command: string, args: Array<string>): Promise<number> =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit" });
    const unforward = forwardSignals(child);

    child.on("error", () => {
      unforward();
      resolve(127);
    });

    child.on("close", (code, signal) => {
      unforward();
      if (signal) {
        resolve(128 + (SIGNAL_CODES[signal] ?? 15));
      } else {
        resolve(code ?? 1);
      }
    });
  });
