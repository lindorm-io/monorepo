import { IKryptos } from "@lindorm/kryptos";
import { AmphoraConfig, AmphoraJwks, AmphoraQuery } from "../types";

export interface IAmphora {
  config: Array<AmphoraConfig>;
  jwks: AmphoraJwks;
  vault: Array<IKryptos>;

  add(kryptos: Array<IKryptos> | IKryptos): void;
  filter(query: AmphoraQuery): Promise<Array<IKryptos>>;
  find(query: AmphoraQuery): Promise<IKryptos>;
  refresh(): Promise<void>;
  setup(): Promise<void>;
}
