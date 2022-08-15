export interface ViewRepositoryData<S> {
  id: string;
  name: string;
  context: string;
  revision: number;
  state: S;
  created_at: Date;
  updated_at: Date;
}
