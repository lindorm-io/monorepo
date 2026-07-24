import { spawn } from "child_process";

/**
 * Spawn a command and CAPTURE its stdout — the read-only probe behind `--reuse`
 * detection (`docker compose config`, `docker ps`). It NEVER rejects on a
 * non-zero exit: it resolves with the exit code plus whatever stdout was
 * captured, so a caller can degrade gracefully (a failed probe simply means
 * "cannot determine, proceed normally"). It rejects only when the binary itself
 * cannot be spawned.
 */
export const captureOutput = (
  command: string,
  args: Array<string>,
): Promise<{ code: number; stdout: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });

    const chunks: Array<Buffer> = [];
    child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));

    child.on("error", (err) =>
      reject(new Error(`Failed to spawn ${command}: ${err.message}`)),
    );

    child.on("close", (code) =>
      resolve({ code: code ?? 0, stdout: Buffer.concat(chunks).toString("utf8") }),
    );
  });
