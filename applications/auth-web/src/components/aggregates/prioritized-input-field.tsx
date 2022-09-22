import { AuthenticationMethod } from "../../enum/AuthenticationMethod";
import { ChangeEvt } from "../../types/evt";
import { ClientConfig } from "../../types/configuration";
import { EmailInputField } from "../input/email-input-field";
import { FunctionComponent, ReactElement } from "react";
import { PhoneInputField } from "../input/phone-input-field";
import { UsernameInputField } from "../input/username-input-field";

type Props = {
  clientConfig: ClientConfig;
  value: string;
  onChange(evt: ChangeEvt): void;
};

export const PrioritizedInputField: FunctionComponent<Props> = ({
  clientConfig,
  value,
  onChange,
}) => {
  switch (clientConfig.method) {
    case AuthenticationMethod.BANK_ID_SE:
      return <></>;

    case AuthenticationMethod.DEVICE_LINK:
      return <></>;

    case AuthenticationMethod.EMAIL:
      return (
        <EmailInputField
          onChange={onChange}
          value={value}
        />
      );

    case AuthenticationMethod.MFA_COOKIE:
      return <></>;

    case AuthenticationMethod.PASSWORD:
      return (
        <UsernameInputField
          onChange={onChange}
          value={value}
        />
      );

    case AuthenticationMethod.PHONE:
      return (
        <PhoneInputField
          onChange={onChange}
          value={value}
        />
      );

    case AuthenticationMethod.SESSION:
      return <></>;

    case AuthenticationMethod.TIME_BASED_OTP:
      return <></>;

    case AuthenticationMethod.WEBAUTHN:
      return <></>;

    default:
      return <></>;
  }
};
