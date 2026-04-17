import spawn from "cross-spawn";
import { join } from "path";
import type { IrisDriver, ProteusDriver } from "./types";

const runBin = (bin: string, args: Array<string>, projectDir: string): Promise<void> =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(bin, args, { cwd: projectDir, stdio: "inherit" });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) return resolvePromise();
      rejectPromise(new Error(`${bin} ${args.join(" ")} exited with code ${code}`));
    });
  });

const proteusBin = (projectDir: string): string =>
  join(projectDir, "node_modules", ".bin", "proteus");

const irisBin = (projectDir: string): string =>
  join(projectDir, "node_modules", ".bin", "iris");

export const runProteusInit = async (
  projectDir: string,
  driver: ProteusDriver,
): Promise<void> => {
  if (driver === "none") return;
  await runBin(
    proteusBin(projectDir),
    ["init", "--driver", driver, "-d", "./src/proteus"],
    projectDir,
  );
};

export const runProteusGenerateEntity = async (
  projectDir: string,
  entityName: string,
): Promise<void> => {
  await runBin(
    proteusBin(projectDir),
    ["generate", "entity", entityName, "-d", "./src/proteus/entities"],
    projectDir,
  );
};

export const runIrisInit = async (
  projectDir: string,
  driver: IrisDriver,
): Promise<void> => {
  if (driver === "none") return;
  await runBin(
    irisBin(projectDir),
    ["init", "--driver", driver, "-d", "./src/iris"],
    projectDir,
  );
};

export const runIrisGenerateMessage = async (
  projectDir: string,
  messageName: string,
): Promise<void> => {
  await runBin(
    irisBin(projectDir),
    ["generate", "message", messageName, "-d", "./src/iris/messages"],
    projectDir,
  );
};
