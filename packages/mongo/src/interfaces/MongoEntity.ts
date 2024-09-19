export interface IMongoEntity {
  id: string;
  rev: number;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  expiresAt: Date | null;
}
