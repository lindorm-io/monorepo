import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { LindormWorker } from "../../classes/LindormWorker.js";

export default new LindormWorker({
  alias: "MixedInstance",
  callback: async () => {},
  interval: 3000,
  logger: createMockLogger(),
});
