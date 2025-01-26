export interface IRedisEntity {
  id: string;
  createdAt: Date;
  expiresAt: Date | null;
  updatedAt: Date;
}
