import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";
import { PostgresConnection } from "./PostgresConnection";
import { createMockLogger } from "@lindorm-io/winston";

@Entity()
class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  firstName: string;

  @Column()
  @Index({ unique: true })
  lastName: string;
}

describe("PostgresConnection", () => {
  const logger = createMockLogger(console.log);

  test("should create connection", () => {
    expect(
      () =>
        new PostgresConnection(
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
        ),
    ).not.toThrow();
  });

  test("should resolve", async () => {
    expect(User.name).toBe("User");
  }, 10000);
});
