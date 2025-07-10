import { snakeCase } from "@lindorm/case";
import { Constructor } from "@lindorm/types";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  AggregateNotDestroyedError,
  ChecksumError,
  CommandSchemaValidationError,
  DomainError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
  ViewNotUpdatedError,
} from "../../errors";
import { IHermesMessage } from "../../interfaces";
import { HermesErrorData } from "../../types";

const ErrorConstructor = (message: IHermesMessage<HermesErrorData>): Constructor => {
  switch (message.name) {
    case snakeCase(AggregateAlreadyCreatedError.name):
      return AggregateAlreadyCreatedError;

    case snakeCase(AggregateDestroyedError.name):
      return AggregateDestroyedError;

    case snakeCase(AggregateNotCreatedError.name):
      return AggregateNotCreatedError;

    case snakeCase(AggregateNotDestroyedError.name):
      return AggregateNotDestroyedError;

    case snakeCase(CommandSchemaValidationError.name):
      return CommandSchemaValidationError;

    case snakeCase(ChecksumError.name):
      return ChecksumError;

    case snakeCase(SagaAlreadyCreatedError.name):
      return SagaAlreadyCreatedError;

    case snakeCase(SagaDestroyedError.name):
      return SagaDestroyedError;

    case snakeCase(SagaNotCreatedError.name):
      return SagaNotCreatedError;

    case snakeCase(ViewAlreadyCreatedError.name):
      return ViewAlreadyCreatedError;

    case snakeCase(ViewDestroyedError.name):
      return ViewDestroyedError;

    case snakeCase(ViewNotCreatedError.name):
      return ViewNotCreatedError;

    case snakeCase(ViewNotUpdatedError.name):
      return ViewNotUpdatedError;

    default:
      return DomainError;
  }
};

export const recoverError = (message: IHermesMessage<HermesErrorData>): DomainError => {
  const error = new (ErrorConstructor(message))(message.data.error.message);

  for (const [key, value] of Object.entries(message.data.error)) {
    error[key] = value;
  }

  return error;
};
