import { spawn } from "child_process";
import type { ComposedOptions } from "../../types";

type ComposeUpOptions = Pick<
  ComposedOptions,
  "file" | "verbose" | "build" | "waitTimeout"
>;

export const composeUp = (options: ComposeUpOptions): Promise<void> =>
  new Promise((resolve, reject) => {
    const args = ["compose"];

    if (options.file) args.push("-f", options.file);

    args.push("up", "-d", "--wait", "--wait-timeout", String(options.waitTimeout));

    if (options.build) args.push("--build");

    const child = spawn("docker", args, {
      stdio: options.verbose ? "inherit" : ["ignore", "pipe", "pipe"],
    });

    const chunks: Array<Buffer> = [];

    if (!options.verbose) {
      child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => chunks.push(chunk));
    }

    child.on("error", (err) =>
      reject(new Error(`Failed to spawn docker: ${err.message}`)),
    );

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      if (!options.verbose && chunks.length > 0) {
        process.stderr.write(Buffer.concat(chunks));
      }

      reject(new Error(`docker compose up exited with code ${code}`));
    });
  });
