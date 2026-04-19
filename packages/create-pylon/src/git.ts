import spawn from "cross-spawn";

type RunResult = { code: number | null; error?: Error };

const run = (command: string, args: Array<string>, cwd: string): Promise<RunResult> =>
  new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", (error) => resolvePromise({ code: null, error }));
    child.on("close", (code) => resolvePromise({ code }));
  });

const runSilent = (
  command: string,
  args: Array<string>,
  cwd: string,
): Promise<RunResult> =>
  new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, stdio: "ignore" });
    child.on("error", (error) => resolvePromise({ code: null, error }));
    child.on("close", (code) => resolvePromise({ code }));
  });

export const isInsideGitRepo = async (projectDir: string): Promise<boolean> => {
  const result = await runSilent(
    "git",
    ["rev-parse", "--is-inside-work-tree"],
    projectDir,
  );
  return result.code === 0;
};

export const initGit = async (projectDir: string): Promise<void> => {
  if (await isInsideGitRepo(projectDir)) {
    process.stdout.write(
      "Detected existing git repository; skipping git init and initial commit.\n",
    );
    return;
  }

  const initResult = await run("git", ["init"], projectDir);
  if (initResult.code !== 0) {
    process.stderr.write(
      `warning: git init failed (${initResult.error?.message ?? initResult.code}); skipping initial commit\n`,
    );
    return;
  }

  const addResult = await run("git", ["add", "."], projectDir);
  if (addResult.code !== 0) {
    process.stderr.write("warning: git add . failed; skipping initial commit\n");
    return;
  }

  const commitResult = await run(
    "git",
    ["commit", "-m", "chore: initial commit from create-pylon"],
    projectDir,
  );
  if (commitResult.code !== 0) {
    process.stderr.write(
      "warning: git commit failed; project left without initial commit\n",
    );
  }
};
