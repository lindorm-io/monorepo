import { IrisSource } from "@lindorm/iris";
import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { ProteusSource } from "@lindorm/proteus";

export const createTestProteusSource = (): ProteusSource =>
  new ProteusSource({
    driver: "memory",
    logger: createMockLogger(),
  });

export const createTestIrisSource = (): IrisSource =>
  new IrisSource({
    driver: "memory",
    logger: createMockLogger(),
  });
