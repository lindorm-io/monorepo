import { AuthenticationMethod } from "../../enum";
import { ClientConfig } from "../../types/configuration";
import { FunctionComponent } from "react";
import { RankedInputButton } from "../../components/aggregates/ranked-input-button";

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
          key={config.rank}
          clientConfig={config}
          disabled={disabled}
          onClick={onClick}
        />
      ))}
    </>
  );
};
