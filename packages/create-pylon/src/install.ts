import spawn from "cross-spawn";
import pc from "picocolors";
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

// Echo the exact npm command (dimmed) before running it, so the command is
// visible and copy-pasteable — e.g. to re-run it by hand after tweaking the
// package list (dropping an unpublished local dep, etc.).
const echoCommand = (args: Array<string>): void => {
  process.stdout.write(pc.dim(`npm ${args.join(" ")}`) + "\n");
};

export const installDependencies = async (
  projectDir: string,
  packages: Array<string>,
): Promise<void> => {
  if (packages.length === 0) return;
  const args = ["install", "--save", ...packages];
  echoCommand(args);
  await runSpawn("npm", args, { cwd: projectDir });
};

export const installDevDependencies = async (
  projectDir: string,
  packages: Array<string>,
): Promise<void> => {
  if (packages.length === 0) return;
  const args = ["install", "--save-dev", ...packages];
  echoCommand(args);
  await runSpawn("npm", args, { cwd: projectDir });
};
