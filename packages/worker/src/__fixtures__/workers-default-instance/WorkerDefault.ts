import { createMockLogger } from "@lindorm/logger";
import { LindormWorker } from "../../classes/LindormWorker";

export default new LindormWorker({
  alias: "DefaultInstance",
  callback: async () => {},
  interval: 1000,
  logger: createMockLogger(),
});
