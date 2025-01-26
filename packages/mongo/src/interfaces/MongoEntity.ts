export interface IMongoEntity {
  id: string;
  rev: number;
  seq: number;
  createdAt: Date;
  deletedAt: Date | null;
  expiresAt: Date | null;
  updatedAt: Date;
}
