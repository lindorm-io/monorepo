export interface IRedisEntity {
  id: string;
  rev: number;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  expiresAt: Date | null;
}
