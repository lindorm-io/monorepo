export interface IMongoEntity {
  id: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  expiresAt: Date | null;
}
