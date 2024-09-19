export interface IMongoEntity {
  id: string;
  revision: number;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  expiresAt: Date | null;
}
