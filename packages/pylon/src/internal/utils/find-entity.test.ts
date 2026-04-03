import { Column, Entity, PrimaryKey } from "@lindorm/entity";
import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { createMockMnemosRepository } from "@lindorm/mnemos";
import { TestEntityOne } from "../../__fixtures__/entities/test-entity-one";
import { findEntity } from "./find-entity";
import { getCtxRepository as _getEntityRepository } from "./get-ctx-repository";

jest.mock("./get-ctx-repository");

const getEntityRepository = _getEntityRepository as jest.Mock;

describe("findEntity", () => {
  let ctx: any;
  let target: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      entities: {},
      logger: createMockLogger(),
      data: {
        id: "f35303e4-1a35-59cb-97e0-281400432b10",
      },
      body: {
        email: "uwtaj@buzipus.sd",
        name: "Rhoda Carter",
      },
    };

    target = TestEntityOne;

    options = {
      mandatory: true,
      path: "data.id",
      source: "MnemosSource",
    };

    getEntityRepository.mockReturnValue(createMockMnemosRepository(TestEntityOne));
  });

  test("should resolve entity using string path", async () => {
    await expect(findEntity(ctx, target, options)).resolves.toEqual(
      expect.objectContaining({
        id: "f35303e4-1a35-59cb-97e0-281400432b10",
      }),
    );
  });

  test("should throw when path is a string without primaryKey", async () => {
    options.path = "data.id";

    @Entity()
    @PrimaryKey(["one", "two"])
    class TestEntityFour {
      @Column()
      one!: string;

      @Column()
      two!: string;
    }

    await expect(findEntity(ctx, TestEntityFour, options)).rejects.toThrow(ServerError);
  });

  test("should resolve entity using dict path", async () => {
    options.path = {
      email: "body.email",
      name: "body.name",
    };

    await expect(findEntity(ctx, target, options)).resolves.toEqual(
      expect.objectContaining({
        email: "uwtaj@buzipus.sd",
        name: "Rhoda Carter",
      }),
    );
  });

  test("should throw when values are missing", async () => {
    options.path = {
      email: "test.email",
      name: "test.name",
    };

    await expect(findEntity(ctx, target, options)).rejects.toThrow(ClientError);
  });

  test("should resolve null when optional values are missing", async () => {
    options.mandatory = false;
    options.path = {
      email: "test.email",
      name: "test.name",
    };

    await expect(findEntity(ctx, target, options)).resolves.toEqual(null);
  });
});
