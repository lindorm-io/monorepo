Feature: Caller-supplied key policy

  A key policy is the caller's constraint on which key material may verify a
  token — an algorithm floor is how a deployment refuses an algorithm
  downgrade. It is checked on the key that resolves, whichever door the token
  arrived through and whichever wire it is on, because a policy silently
  dropped on one code path is worse than no policy at all: the caller
  believes the constraint is in force and stops checking. Aegis policy; the
  scenario carries no tag.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a caller-supplied key policy is applied when verifying an opaque signature

    An opaque signature has no claims layer, so the domain verify reaches the
    wire kit directly, and that is the path on which a forwarded option is
    most easily lost. A policy that held on one wire and not the other would
    be a policy an attacker chooses to be bound by, since the encoding is the
    issuer's choice and the presenter's opportunity. The vault's signing key
    is the ES512 one, so a policy demanding RS256 can only be satisfied by
    ignoring the policy.

    Background:
      Given the payload to sign
        | hello | world |
      And the verifier accepts only a signing key of the algorithm "RS256"

    Scenario Outline: <wire>: the opaque signature is refused as a key error under the caller's policy
      When I sign the payload as opaque content on the <wire> wire
      And I verify the token
      Then verification is refused as a key error "verify_key_policy_violation"

      Examples:
        | wire |
        | jose |
        | cose |
