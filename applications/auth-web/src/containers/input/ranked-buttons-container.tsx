import { FunctionComponent, ReactElement } from "react";
import { RankedInputButton } from "../../components/aggregates/ranked-input-button";
import { AuthenticationMethod } from "../../enum/AuthenticationMethod";
import { ClientConfig } from "../../types/configuration";

type Props = {
  clientConfig: Array<ClientConfig>;
  disabled: boolean;
  selectedMethod: AuthenticationMethod;
  onClick(method: AuthenticationMethod): void;
};

export const RankedButtonsContainer: FunctionComponent<Props> = ({
  clientConfig,
  disabled,
  selectedMethod,
  onClick,
}) => {
  const ranked = clientConfig.filter((config) => config.method !== selectedMethod);

  return (
    <>
      {ranked.map((config) => (
        <RankedInputButton
          clientConfig={config}
          disabled={disabled}
          onClick={onClick}
        />
      ))}
    </>
  );
};
