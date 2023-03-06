import { AdjustedAccessLevel, LevelOfAssurance } from "../auth";
import { OpenIdIntrospectResponseBody } from "../open-id";

export type LindormIntrospectResponseBody = OpenIdIntrospectResponseBody & {
  aal: AdjustedAccessLevel;
  acr: string | null;
  amr: Array<string>;
  authTime: number | null;
  azp: string | null;
  jwt: string | null; // token as signed JWT
  loa: LevelOfAssurance;
  sid: string | null;
  sih: string | null;
  suh: string | null;
  tid: string | null;
};
