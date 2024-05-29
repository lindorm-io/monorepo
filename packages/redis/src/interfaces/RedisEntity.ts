import { Dict } from "@lindorm/types";

export interface IRedisEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | undefined;

  toJSON?(): Dict;
  validate?(): void;
}
