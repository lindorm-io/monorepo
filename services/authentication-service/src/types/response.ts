import { ScopeDescription } from "../common";
import { FlowType } from "../enum";

export interface AuthenticationNextResponseBody {
  consent?: {
    audiences: Array<string>;
    clientName: string;
    scopeDescriptions: Array<ScopeDescription>;
    scopes: Array<string>;
  };
  loginHint?: Array<string>;
  flows?: Array<string>;
  current?: {
    id: string;
    pollingRequired: boolean;
    type: FlowType;
  };
}

export interface InitialiseFlowResponseBody {
  id: string;
  pollingRequired: boolean;
  flowToken?: string;
}
