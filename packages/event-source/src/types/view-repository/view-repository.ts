export interface ViewRepositoryData<S> {
  id: string;
  name: string;
  context: string;
  revision: number;
  state: S;
  timestamp_modified: Date;
}
