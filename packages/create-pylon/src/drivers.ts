import {
  writeEntity as writeProteusEntity,
  writeSource as writeProteusSource,
} from "@lindorm/proteus";
import {
  writeMessage as writeIrisMessage,
  writeSource as writeIrisSource,
} from "@lindorm/iris";
import { join } from "path";
import type { IrisDriver, ProteusDriver } from "./types";

export const runProteusInit = async (
  projectDir: string,
  driver: ProteusDriver,
): Promise<void> => {
  if (driver === "none") return;

  await writeProteusSource({
    driver,
    directory: join(projectDir, "src/proteus"),
    loggerImport: "../logger",
  });
};

export const runProteusGenerateEntity = async (
  projectDir: string,
  entityName: string,
): Promise<void> => {
  await writeProteusEntity({
    name: entityName,
    directory: join(projectDir, "src/proteus/entities"),
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
    loggerImport: "../logger",
  });
};

export const runIrisGenerateMessage = async (
  projectDir: string,
  messageName: string,
): Promise<void> => {
  await writeIrisMessage({
    name: messageName,
    directory: join(projectDir, "src/iris/messages"),
  });
};
