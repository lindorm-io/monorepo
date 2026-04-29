import {
  writeEntity as writeProteusEntity,
  writeSource as writeProteusSource,
} from "@lindorm/proteus";
import {
  writeMessage as writeIrisMessage,
  writeSource as writeIrisSource,
} from "@lindorm/iris";
import { join } from "path";
import type { Answers, IrisDriver, ProteusDriver } from "./types.js";
import { PROTEUS_DB_DRIVERS } from "./types.js";

/**
 * Number of `..` segments needed to reach `src/` from the directory a source
 * file is written into. Flat layout (`src/proteus/source.ts`) is two levels
 * below `src/`; per-driver layout (`src/proteus/<driver>/source.ts`) is three.
 */
const computeRelativeDepth = (nested: boolean): string => (nested ? "../../" : "../");

const resolveCache = (
  driver: ProteusDriver,
  selected: ReadonlyArray<ProteusDriver>,
): "redis" | "memory" | null => {
  if (!PROTEUS_DB_DRIVERS.includes(driver)) return null;
  if (selected.includes("redis")) return "redis";
  if (selected.includes("memory")) return "memory";
  return null;
};

export const runProteusInit = async (
  projectDir: string,
  answers: Pick<Answers, "proteusDrivers">,
): Promise<void> => {
  const drivers = answers.proteusDrivers;
  if (drivers.length === 0) return;

  const nested = drivers.length > 1;
  const relative = computeRelativeDepth(nested);

  for (const driver of drivers) {
    const directory = nested
      ? join(projectDir, "src/proteus", driver)
      : join(projectDir, "src/proteus");

    await writeProteusSource({
      driver,
      directory,
      loggerImport: `${relative}logger/index.js`,
      configImport: `${relative}pylon/config.js`,
      cache: resolveCache(driver, drivers),
    });
  }
};

export const runProteusGenerateSampleEntity = async (
  projectDir: string,
  driver?: ProteusDriver,
): Promise<void> => {
  const subdir = driver ? `src/proteus/${driver}/entities` : "src/proteus/entities";
  await writeProteusEntity({
    name: "SampleEntity",
    directory: join(projectDir, subdir),
  });
};

export const runIrisInit = async (
  projectDir: string,
  driver: IrisDriver,
): Promise<void> => {
  if (driver === "none") return;

  await writeIrisSource({
    driver,
    directory: join(projectDir, "src/iris"),
    loggerImport: "../logger/index.js",
  });
};

export const runIrisGenerateSampleMessage = async (projectDir: string): Promise<void> => {
  await writeIrisMessage({
    name: "SampleMessage",
    directory: join(projectDir, "src/iris/messages"),
  });
};
