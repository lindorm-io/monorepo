import {
  AuthenticationFactor,
  AuthenticationLevel,
  AuthenticationMethod,
} from "@lindorm-io/common-enums";
import { AdjustedAccessLevel, LevelOfAssurance } from "../auth";
import { OpenIdIntrospectResponseBody } from "../open-id";

export type LindormIntrospectResponseBody = OpenIdIntrospectResponseBody & {
  aal: AdjustedAccessLevel;
  acr: AuthenticationLevel | null;
  afr: AuthenticationFactor | null;
  amr: Array<AuthenticationMethod>;
  authTime: number | null;
  azp: string | null;
  gty: string | null;
  loa: LevelOfAssurance;
  sid: string | null;
  sih: string | null;
  suh: string | null;
  tid: string | null;
};
