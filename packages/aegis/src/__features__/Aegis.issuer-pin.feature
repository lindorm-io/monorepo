Feature: The issuer pin — which keys may answer, and which iss is believed

  A verify pinned to an issuer does two separate things. First it scopes the
  key lookup, so a key id chosen by whoever wrote the token can only resolve
  among the pinned issuer's keys; then it compares the token's own issuer
  claim, because a key registered under the pinned issuer only says whose
  material signed the bytes. Both are aegis policy: no specification tells an
  implementation how to index the keys it has collected, and the issuer
  claim's processing is application specific. No scenario carries a tag.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a verify pinned to an issuer refuses a token whose key is not registered under that issuer

    A `kid` is chosen by whoever wrote the token, so resolving it against
    every key the process knows lets the presenter decide which issuer's key
    answers — and two issuers may legitimately publish the same `kid`, since
    distinctness is scoped to one key set (RFC 7517 §4.5). The alternative
    has no safe ordering: a signature checked against a second issuer's
    colliding key succeeds, and the issuer comparison that would catch it
    runs afterwards, by which point the verifier has accepted material from a
    party the caller excluded. Refusing at resolution is what makes the
    restriction mean "these keys" rather than "these keys, eventually", so
    the refusal is the key layer's and names the issuer it was scoped to.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the verifier expects the issuer "https://not-the-issuer/"

    Scenario Outline: <wire>: the key lookup is refused under the pinned issuer, before any claim is compared
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a key error "verify_key_not_found"
      And the refusal names the issuer "https://not-the-issuer/"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token naming another issuer is refused even when its key resolves under the pinned one

    `iss` is the claim that identifies the principal that issued the token,
    on either wire (RFC 7519 §4.1.1, RFC 8392 §3.1.1). A key registered under
    the pinned issuer only says the pinned issuer's material signed the
    bytes; the claim is what the token says about who issued it, and the two
    can disagree — a deployment signing on behalf of a tenant, a key shared
    between environments. So the claim comparison is a separate check from
    the key scope, and skipping it once the key resolves would believe the
    token's own account of its origin. The refusal is the issuer
    comparison's own code, so the key is shown to have resolved.

    Background:
      Given the wire claims
        | iss       | "https://someone-else.lindorm.io/" |
        | sub       | "user-1"                           |
        | aud       | ["https://rs.lindorm.io/"]         |
        | jti       | "token-1"                          |
        | client_id | "client-1"                         |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the claims token carries the type prefix "at"
      And the verifier expects the issuer "https://test.lindorm.io/"

    Scenario Outline: <wire>: the issuer claim is compared once the key has resolved, and refuses
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "issuer_mismatch"

      Examples:
        | wire |
        | jose |
        | cose |
