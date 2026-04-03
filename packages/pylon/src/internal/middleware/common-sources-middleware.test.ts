import { createMockIrisSource } from "@lindorm/iris/mocks";
import { createMockLogger } from "@lindorm/logger";
import { createMockProteusSource } from "@lindorm/proteus/mocks";
import { createSourcesMiddleware } from "./common-sources-middleware";

describe("createSourcesMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };
  });

  test("should clone proteus source onto context", async () => {
    const proteus = createMockProteusSource();

    const middleware = createSourcesMiddleware({ proteus: proteus as any });

    await middleware(ctx, jest.fn());

    expect(proteus.clone).toHaveBeenCalledWith({ logger: ctx.logger });
    expect(ctx.proteus).toBeDefined();
  });

  test("should clone iris source onto context", async () => {
    const iris = createMockIrisSource();

    const middleware = createSourcesMiddleware({ iris: iris as any });

    await middleware(ctx, jest.fn());

    expect(iris.clone).toHaveBeenCalledWith({ logger: ctx.logger });
    expect(ctx.iris).toBeDefined();
  });

  test("should clone hermes onto context", async () => {
    const hermes = { clone: jest.fn().mockReturnValue("cloned") };

    const middleware = createSourcesMiddleware({ hermes: hermes as any });

    await middleware(ctx, jest.fn());

    expect(hermes.clone).toHaveBeenCalledWith({ logger: ctx.logger });
    expect(ctx.hermes).toEqual("cloned");
  });

  test("should handle no sources configured", async () => {
    const middleware = createSourcesMiddleware({});

    await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.proteus).toBeUndefined();
    expect(ctx.iris).toBeUndefined();
    expect(ctx.hermes).toBeUndefined();
  });
});
