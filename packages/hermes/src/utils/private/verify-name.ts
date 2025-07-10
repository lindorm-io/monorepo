import { LindormError } from "@lindorm/errors";
import {
  MAX_NAMESPACE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_VIEW_LENGTH,
} from "../../constants/private";
import { HandlerIdentifier } from "../../types";

const verifyNameLength = (name: string): void => {
  if (name.length <= MAX_NAME_LENGTH) return;

  throw new LindormError("Maximum aggregate name length exceeded", {
    data: {
      name: {
        length: name.length,
        maximum: MAX_NAME_LENGTH,
      },
      hint: "Reduce the length of the aggregate name",
    },
  });
};

const verifyNamespaceLength = (namespace: string): void => {
  if (namespace.length <= MAX_NAMESPACE_LENGTH) return;

  throw new LindormError("Maximum aggregate namespace length exceeded", {
    data: {
      namespace: {
        length: namespace.length,
        maximum: MAX_NAMESPACE_LENGTH,
      },
      hint: "Reduce the length of the aggregate namespace",
    },
  });
};

export const verifyIdentifierLength = (handler: HandlerIdentifier): void => {
  verifyNamespaceLength(handler.namespace);
  verifyNameLength(handler.name);
};

export const verifyViewIdentifier = (view: HandlerIdentifier): void => {
  const total = view.name.length + view.namespace.length;

  if (total <= MAX_VIEW_LENGTH) return;

  throw new LindormError("Maximum view name length exceeded", {
    data: {
      name: {
        length: view.name.length,
        value: view.name,
      },
      namespace: {
        length: view.namespace.length,
        value: view.namespace,
      },
      total: {
        length: total,
        maximum: MAX_VIEW_LENGTH,
      },
      hint: "Reduce the length of the view name or namespace",
    },
  });
};
