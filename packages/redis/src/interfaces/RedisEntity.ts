export interface IRedisEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | undefined;

  toJSON?(): IRedisEntity;
  validate?(): void;
}
