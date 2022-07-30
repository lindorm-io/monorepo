import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";
import { PostgresConnection } from "./PostgresConnection";
import { createMockLogger } from "@lindorm-io/winston";

@Entity({ orderBy: { firstName: "ASC" } })
class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  firstName: string;

  @Column()
  @Index()
  lastName: string;
}

describe("PostgresConnection", () => {
  const logger = createMockLogger();

  let connection: PostgresConnection;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5432,
        username: "root",
        password: "example",
        database: "default",
        entities: [User],
        synchronize: true,
      },
      logger,
    );

    await connection.connect();
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should be connected", async () => {
    await expect(connection.isConnected).toBe(true);
  }, 10000);

  test("should create User", async () => {
    const repository = connection.getRepository(User);

    const user = repository.create({
      firstName: "Obi-Wan",
      lastName: "Kenobi",
    });

    await expect(repository.save(user)).resolves.toStrictEqual(
      expect.objectContaining({
        id: expect.any(Number),
        firstName: "Obi-Wan",
        lastName: "Kenobi",
      }),
    );

    await expect(repository.findBy({ lastName: "Kenobi" })).resolves.toStrictEqual([
      expect.objectContaining({
        id: expect.any(Number),
        firstName: "Obi-Wan",
        lastName: "Kenobi",
      }),
    ]);
  }, 10000);

  test("should create Users in a transaction", async () => {
    await expect(
      connection.transaction(async (manager) => {
        const repository = manager.getRepository(User);

        await repository.save({
          firstName: "Anakin",
          lastName: "Skywalker",
        });
        await repository.save({
          firstName: "Leia",
          lastName: "Skywalker",
        });
      }),
    ).resolves.not.toThrow();

    await expect(
      connection.getRepository(User).findBy({ lastName: "Skywalker" }),
    ).resolves.toStrictEqual([
      expect.objectContaining({
        id: expect.any(Number),
        firstName: "Anakin",
        lastName: "Skywalker",
      }),
      expect.objectContaining({
        id: expect.any(Number),
        firstName: "Leia",
        lastName: "Skywalker",
      }),
    ]);
  }, 10000);

  test("should rollback transaction", async () => {
    await expect(
      connection.transaction(async (manager) => {
        const repository = manager.getRepository(User);

        await repository.save({
          firstName: "Luke",
          lastName: "Skywalker",
        });

        throw new Error("throw");
      }),
    ).rejects.toThrow();

    await expect(
      connection.getRepository(User).findBy({ firstName: "Luke" }),
    ).resolves.toStrictEqual([]);
  }, 10000);
});
