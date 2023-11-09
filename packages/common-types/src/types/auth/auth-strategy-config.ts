import {
  AuthenticationStrategyConfirmKey,
  AuthenticationStrategyConfirmMode,
} from "@lindorm-io/common-enums";

export type AuthStrategyConfig = {
  id: string;
  confirmKey: AuthenticationStrategyConfirmKey;
  confirmLength: number | null;
  confirmMode: AuthenticationStrategyConfirmMode;
  acknowledgeCode: string | null;
  expires: string;
  pollingRequired: boolean;
  qrCode: string | null;
  strategySessionToken: string | null;
  visualHint: string | null;
};
