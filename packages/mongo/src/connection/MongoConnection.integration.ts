import { Collection } from "mongodb";
import { MongoConnection } from "./MongoConnection";
import { createMockLogger } from "@lindorm-io/winston";

describe("MongoConnection", () => {
  const logger = createMockLogger(console.log);

  let connection: MongoConnection;
  let jedi: Collection;
  let sith: Collection;

  beforeEach(async () => {
    connection = new MongoConnection({
      host: "localhost",
      port: 27017,
      auth: { username: "root", password: "example" },
      database: "default",
      logger,
    });

    await connection.connect();

    jedi = connection.collection("Jedi");
    sith = connection.collection("Sith");
  }, 30000);

  test("should resolve transaction", async () => {
    await expect(
      connection.withTransaction(
        async (ctx) => {
          const { session } = ctx;

          await ctx.options.jedi.insertOne(
            { name: "obi-wan", message: "Hello there" },
            { session },
          );
          await ctx.options.jedi.insertOne(
            { name: "grievous", message: "General Kenobi" },
            { session },
          );

          await ctx.options.jedi.updateOne(
            { name: "obi-wan" },
            { $set: { lightsaber: 1 } },
            { session },
          );
          await ctx.options.jedi.updateOne(
            { name: "grievous" },
            { $set: { lightsaber: 4 } },
            { session },
          );

          await ctx.options.sith.insertOne(
            {
              name: "anakin",
              path: "dark",
            },
            { session },
          );
        },
        { jedi, sith },
      ),
    ).resolves.toBeUndefined();

    await expect(jedi.findOne({ name: "obi-wan" })).resolves.toStrictEqual({
      _id: expect.any(Object),
      name: "obi-wan",
      message: "Hello there",
      lightsaber: 1,
    });

    await expect(sith.findOne({ name: "anakin" })).resolves.toStrictEqual({
      _id: expect.any(Object),
      name: "anakin",
      path: "dark",
    });
  });

  test.skip("should roll back transaction on failure", async () => {
    await expect(
      connection.withTransaction(
        async (ctx) => {
          const { session } = ctx;

          await jedi.insertOne({ name: "dooku", message: "count" }, { session });
          await jedi.insertOne({ name: "sheev", alias: "darth sidious" }, { session });

          const doc = await jedi.findOne({ name: "sheev" }, { session });

          await jedi.insertOne(doc, { session });
        },
        { jedi, sith },
      ),
    ).rejects.toThrow(Error);

    await expect(jedi.findOne({ name: "dooku" })).resolves.toStrictEqual(null);
  }, 10000);
});
