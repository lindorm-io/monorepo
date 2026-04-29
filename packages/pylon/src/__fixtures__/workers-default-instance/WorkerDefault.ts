import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { LindormWorker } from "@lindorm/worker";

export default new LindormWorker({
  alias: "DefaultInstance",
  callback: async () => {},
  interval: 1000,
  logger: createMockLogger(),
});
