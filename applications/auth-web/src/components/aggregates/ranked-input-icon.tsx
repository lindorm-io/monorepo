import { FunctionComponent, ReactElement } from "react";
import { AuthenticationMethod } from "../../enum/AuthenticationMethod";
import {
  AccountBalance,
  Email,
  Fingerprint,
  Password,
  PhoneIphone,
  Pin,
  QrCode,
  Security,
} from "@mui/icons-material";

type Props = {
  method: AuthenticationMethod;
};

export const RankedInputIcon: FunctionComponent<Props> = ({ method }) => {
  switch (method) {
    case AuthenticationMethod.BANK_ID_SE:
      return <AccountBalance />;

    case AuthenticationMethod.DEVICE_LINK:
      return <Security />;

    case AuthenticationMethod.EMAIL:
      return <Email />;

    case AuthenticationMethod.MFA_COOKIE:
      return <></>;

    case AuthenticationMethod.PASSWORD:
      return <Password />;

    case AuthenticationMethod.PHONE:
      return <PhoneIphone />;

    case AuthenticationMethod.SESSION:
      return <QrCode />;

    case AuthenticationMethod.TIME_BASED_OTP:
      return <Pin />;

    case AuthenticationMethod.WEBAUTHN:
      return <Fingerprint />;

    default:
      return <></>;
  }
};
