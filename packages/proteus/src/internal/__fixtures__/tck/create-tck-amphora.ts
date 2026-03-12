import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger";
import type { IAmphora } from "@lindorm/amphora";

export const createTckAmphora = (): IAmphora => {
  const key = KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    issuer: "https://test.proteus.tck/",
  });
  const amphora = new Amphora({ logger: createMockLogger() });
  amphora.add(key);
  return amphora;
};
