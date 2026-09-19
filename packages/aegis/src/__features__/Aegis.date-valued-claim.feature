Feature: The wire form of a date-valued claim

  The domain shape of a date-valued claim is an instant and its wire shape is
  a count of seconds since the epoch, so the encoder is what stands between
  them — and it fails in the one direction nothing reports: a value it does
  not recognise as an instant encodes to nothing, which drops the claim from
  the token without an error. The issuer then believes it stated an
  authentication time and the audience receives none. The wire is read off
  the bytes by the independent inspector.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a claim a caller states as an instant reaches the wire as a number of seconds

    `auth_time` is the time the End-User authentication occurred, carried as
    a count of seconds since the epoch (OpenID Connect Core 1.0 §2). The
    claim has no registered CWT claim key, so on the COSE wire it rides under
    its text name, and the value is the same number either way. The cose
    scenario carries no tag: the document defines the JWT claim, and a CWT
    carries the name only because aegis keys it by its interoperable text
    form.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the claims record the authentication at "2024-01-01T07:30:00.000Z"
      And no access token is co-issued

    @openid-connect-core-1_0
    Scenario: jose: the authentication time travels as seconds since the epoch under its registered name (OpenID Connect Core 1.0 §2)
      When I mint the content under the "id_token" profile on the jose wire
      Then the raw payload carries "auth_time" as the instant "2024-01-01T07:30:00.000Z"

    Scenario: cose: the authentication time travels as seconds since the epoch under its text name
      When I mint the content under the "id_token" profile on the cose wire
      Then the raw payload carries "auth_time" as the instant "2024-01-01T07:30:00.000Z"
