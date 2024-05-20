import { IKryptos } from "@lindorm/kryptos";
import { AmphoraConfig, AmphoraQuery } from "./amphora";

export interface IAmphora {
  config: Array<AmphoraConfig>;
  vault: Array<IKryptos>;

  add(kryptos: Array<IKryptos> | IKryptos): void;
  filter(query: AmphoraQuery): Promise<Array<IKryptos>>;
  find(query: AmphoraQuery): Promise<IKryptos>;
  refresh(): Promise<void>;
  setup(): Promise<void>;
}
