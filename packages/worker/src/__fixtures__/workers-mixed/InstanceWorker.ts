import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { LindormWorker } from "../../classes/LindormWorker";

export default new LindormWorker({
  alias: "MixedInstance",
  callback: async () => {},
  interval: 3000,
  logger: createMockLogger(),
});
