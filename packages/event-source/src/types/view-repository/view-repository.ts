export interface ViewRepositoryData<TState> {
  id: string;
  name: string;
  context: string;
  revision: number;
  state: TState;
  created_at: Date;
  updated_at: Date;
}
