import spawn from "cross-spawn";

type RunResult = { code: number | null; error?: Error };

const run = (command: string, args: Array<string>, cwd: string): Promise<RunResult> =>
  new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", (error) => resolvePromise({ code: null, error }));
    child.on("close", (code) => resolvePromise({ code }));
  });

export const initGit = async (projectDir: string): Promise<void> => {
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
