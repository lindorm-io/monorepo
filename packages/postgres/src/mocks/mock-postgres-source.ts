import { IPostgresSource } from "../interfaces";

export const createMockPostgresSource = (): IPostgresSource => ({
  client: {} as any,
  clone: jest.fn().mockImplementation(() => createMockPostgresSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),
  query: jest.fn(),
});
