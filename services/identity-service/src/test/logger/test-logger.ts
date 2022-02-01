import { Logger } from "@lindorm-io/winston";

export const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
  createChildLogger: (): any => logger,
} as unknown as Logger;
