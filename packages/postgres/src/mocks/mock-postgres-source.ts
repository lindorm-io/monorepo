import { PostgresQueryBuilder } from "../classes";
import { IPostgresSource } from "../interfaces";

export const createMockPostgresSource = (): IPostgresSource => ({
  __instanceof: "PostgresSource",

  client: {} as any,

  clone: jest.fn().mockImplementation(() => createMockPostgresSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  ping: jest.fn(),
  setup: jest.fn(),

  query: jest.fn(),
  queryBuilder: jest
    .fn()
    .mockImplementation(
      (table: string) => new PostgresQueryBuilder({ table, stringifyComplexTypes: true }),
    ),
});
