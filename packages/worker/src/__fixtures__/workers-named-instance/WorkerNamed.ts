import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { LindormWorker } from "../../classes/LindormWorker";

export const worker = new LindormWorker({
  alias: "NamedInstance",
  callback: async () => {},
  interval: 1000,
  logger: createMockLogger(),
});
