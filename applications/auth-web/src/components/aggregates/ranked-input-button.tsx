import { AuthenticationMethod } from "../../enum/AuthenticationMethod";
import { ClientConfig } from "../../types/configuration";
import { FunctionComponent, ReactElement } from "react";
import { RankedInputIcon } from "./ranked-input-icon";
import { TertiaryActionButton } from "../button/tertiary-action-button";

type Props = {
  clientConfig: ClientConfig;
  disabled: boolean;
  onClick(method: AuthenticationMethod): void;
};

export const RankedInputButton: FunctionComponent<Props> = ({
  clientConfig,
  disabled,
  onClick,
}) => {
  switch (clientConfig.method) {
    case AuthenticationMethod.BANK_ID_SE:
    case AuthenticationMethod.MFA_COOKIE:
      return <></>;

    case AuthenticationMethod.DEVICE_LINK:
    case AuthenticationMethod.EMAIL:
    case AuthenticationMethod.PASSWORD:
    case AuthenticationMethod.PHONE:
    case AuthenticationMethod.SESSION:
    case AuthenticationMethod.TIME_BASED_OTP:
    case AuthenticationMethod.WEBAUTHN:
      return (
        <TertiaryActionButton
          disabled={disabled}
          onClick={() => onClick(clientConfig.method)}
          startIcon={<RankedInputIcon method={clientConfig.method} />}
        >
          {clientConfig.method}
        </TertiaryActionButton>
      );

    default:
      return <></>;
  }
};
