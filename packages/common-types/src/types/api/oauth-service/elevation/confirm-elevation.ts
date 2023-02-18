import { AuthenticationMethod, LevelOfAssurance } from "../../../auth";
import { StandardRequestParamsWithId } from "../../standard";

export type ConfirmElevationRequestParams = StandardRequestParamsWithId;

export type ConfirmElevationRequestBody = {
  identityId: string;
  levelOfAssurance: LevelOfAssurance;
  methods: Array<AuthenticationMethod>;
};
