import { Context } from "@lindorm/gherkin";
import type { IKryptos } from "../interfaces/index.js";

@Context()
export class KryptosContext {
  kryptos!: IKryptos;
  other!: IKryptos;
  ca!: IKryptos;
  root!: IKryptos;
  serialised!: string;
}
