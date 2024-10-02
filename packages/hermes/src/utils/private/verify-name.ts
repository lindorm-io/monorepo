import { LindormError } from "@lindorm/errors";
import { isArray } from "@lindorm/is";
import {
  MAX_CONTEXT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_VIEW_LENGTH,
} from "../../constants/private";
import { HandlerIdentifier, HandlerIdentifierMultipleContexts } from "../../types";

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

const verifyContextLength = (context: string): void => {
  if (context.length <= MAX_CONTEXT_LENGTH) return;

  throw new LindormError("Maximum aggregate context length exceeded", {
    data: {
      context: {
        length: context.length,
        maximum: MAX_CONTEXT_LENGTH,
      },
      hint: "Reduce the length of the aggregate context",
    },
  });
};

export const verifyIdentifierLength = (
  handler: HandlerIdentifierMultipleContexts,
): void => {
  const context = isArray(handler.context) ? handler.context : [handler.context];
  for (const c of context) {
    verifyContextLength(c);
  }
  verifyNameLength(handler.name);
};

export const verifyViewIdentifier = (view: HandlerIdentifier): void => {
  const total = view.name.length + view.context.length;

  if (total <= MAX_VIEW_LENGTH) return;

  throw new LindormError("Maximum view name length exceeded", {
    data: {
      name: {
        length: view.name.length,
        value: view.name,
      },
      context: {
        length: view.context.length,
        value: view.context,
      },
      total: {
        length: total,
        maximum: MAX_VIEW_LENGTH,
      },
      hint: "Reduce the length of the view name or context",
    },
  });
};
