import {
  writeEntity as writeProteusEntity,
  writeSource as writeProteusSource,
} from "@lindorm/proteus/scaffold";
import {
  writeMessage as writeIrisMessage,
  writeSource as writeIrisSource,
} from "@lindorm/iris/scaffold";
import { join } from "path";
import type { Answers, IrisDriver } from "./types.js";
import { PROTEUS_DB_DRIVERS } from "./types.js";

export const runProteusInit = async (
  projectDir: string,
  answers: Pick<Answers, "db" | "kv">,
): Promise<void> => {
  const { db, kv } = answers;

  const primaryDriver = db !== "none" ? db : kv !== "none" ? kv : null;
  if (!primaryDriver) return;

  const kvIsSecondary = db !== "none" && kv !== "none";

  // Cache the primary only when it's a real DB driver AND a kv store was
  // picked; the cache adapter is the kv driver (redis or memory).
  const cache =
    db !== "none" && PROTEUS_DB_DRIVERS.includes(db) && kv !== "none" ? kv : null;

  // The primary fills pylon's `db` role (even when the kv driver is the sole
  // store), so it lives under src/proteus/db — mirroring src/proteus/kv.
  await writeProteusSource({
    driver: primaryDriver,
    directory: join(projectDir, "src/proteus/db"),
    loggerImport: "../../logger/index.js",
    configImport: "../../pylon/config.js",
    amphoraImport: "../../pylon/amphora.js",
    cache,
    naming: "snake",
    synchronizeFromConfig: true,
    runMigrationsFromConfig: true,
  });

  if (kvIsSecondary) {
    await writeProteusSource({
      driver: kv,
      directory: join(projectDir, "src/proteus/kv"),
      loggerImport: "../../logger/index.js",
      configImport: "../../pylon/config.js",
      amphoraImport: "../../pylon/amphora.js",
      cache: null,
      naming: "snake",
      synchronizeFromConfig: true,
      runMigrationsFromConfig: true,
    });
  }
};

export const runProteusGenerateSampleEntity = async (
  projectDir: string,
): Promise<void> => {
  await writeProteusEntity({
    name: "SampleEntity",
    directory: join(projectDir, "src/proteus/db/entities"),
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
    configImport: "../pylon/config.js",
  });
};

export const runIrisGenerateSampleMessage = async (projectDir: string): Promise<void> => {
  await writeIrisMessage({
    name: "SampleMessage",
    directory: join(projectDir, "src/iris/messages"),
  });
};
