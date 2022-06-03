import { KoaApp } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/winston";
import { createNodeServer } from "./create-node-server";

describe("createNodeServer", () => {
  const logger = createMockLogger();

  test("should create koa app", () => {
    expect(
      createNodeServer({
        host: "host",
        port: 4000,
        logger,
      }),
    ).toBeInstanceOf(KoaApp);
  });
});
