import spawn from "cross-spawn";
import type { StdioOptions } from "child_process";

type SpawnOptions = {
  cwd: string;
  stdio?: StdioOptions;
};

const runSpawn = (
  command: string,
  args: Array<string>,
  options: SpawnOptions,
): Promise<void> =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: options.stdio ?? "inherit",
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) return resolvePromise();
      rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });

export const installDependencies = async (
  projectDir: string,
  packages: Array<string>,
): Promise<void> => {
  if (packages.length === 0) return;
  await runSpawn("npm", ["install", "--save", ...packages], { cwd: projectDir });
};

export const installDevDependencies = async (
  projectDir: string,
  packages: Array<string>,
): Promise<void> => {
  if (packages.length === 0) return;
  await runSpawn("npm", ["install", "--save-dev", ...packages], { cwd: projectDir });
};
