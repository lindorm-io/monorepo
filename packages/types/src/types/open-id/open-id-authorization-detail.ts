// https://www.rfc-editor.org/rfc/rfc9396

import type { Dict } from "../types.js";

/**
 * RFC 9396 §2 — Rich Authorization Requests.
 *
 * A single `authorization_details` array element. `type` is the only
 * required field; the RFC-reusable optional fields (`locations`,
 * `actions`, `datatypes`, `identifier`, `privileges`) are typed
 * explicitly, while arbitrary type-specific fields are permitted
 * verbatim via the `Dict` index signature.
 *
 * Type-specific fields (e.g. `instructedAmount`, `creditorAccount`)
 * are defined by the schema named in `type` and MAY be camelCase by
 * their own spec. They MUST be preserved verbatim on the wire and
 * MUST NOT be run through any case conversion.
 */
export type AuthorizationDetail = {
  /**
   * REQUIRED
   *
   * The type of authorization data as a string. This field
   * determines the allowable contents of the object that
   * contains it. The value is unique for the described API
   * functionality scope.
   */
  type: string;

  /**
   * OPTIONAL
   *
   * An array of strings representing the location of the
   * resource or resource server. These strings are typically
   * URIs identifying the location of the RS. This field can
   * allow a client to specify a particular RS, as discussed
   * in Section 6.2.
   */
  locations?: Array<string>;

  /**
   * OPTIONAL
   *
   * An array of strings representing the kinds of actions to
   * be taken at the resource.
   */
  actions?: Array<string>;

  /**
   * OPTIONAL
   *
   * An array of strings representing the kinds of data being
   * requested from the resource.
   */
  datatypes?: Array<string>;

  /**
   * OPTIONAL
   *
   * A string identifier indicating a specific resource
   * available at the API.
   */
  identifier?: string;

  /**
   * OPTIONAL
   *
   * An array of strings representing the types or levels of
   * privilege being requested at the resource.
   */
  privileges?: Array<string>;
} & Dict;
