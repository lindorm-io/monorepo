import { spawn } from "child_process";

export const composeDown = (file: string, verbose: boolean): Promise<void> =>
  new Promise((resolve) => {
    const args = ["compose"];

    if (file) args.push("-f", file);

    args.push("down", "--remove-orphans", "--volumes");

    const child = spawn("docker", args, {
      stdio: verbose ? "inherit" : ["ignore", "ignore", "inherit"],
    });

    child.on("error", (err) => {
      if (verbose) console.warn(`Warning: docker compose down failed: ${err.message}`);
      resolve();
    });

    child.on("close", (code) => {
      if (code !== 0 && verbose) {
        console.warn(`Warning: docker compose down exited with code ${code}`);
      }
      resolve();
    });
  });
