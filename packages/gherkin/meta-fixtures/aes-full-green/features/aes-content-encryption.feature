Feature: AES content encryption

  Background:
    Given an oct key with algorithm "A128KW" and encryption "A128GCM"

  Rule: a round trip preserves the content

    Example: default mode
      When I encrypt "hello world"
      Then decrypting returns "hello world"

    Scenario Outline: every content encryption round-trips
      Given an oct key with algorithm "A128KW" and encryption "<encryption>"
      When I encrypt "payload"
      Then decrypting returns "payload"

      Examples:
        | encryption    |
        | A128GCM       |
        | A256GCM       |
        | A256CBC-HS512 |

  Rule: record mode binds the caller-supplied AAD

    Example: the bound AAD must be re-supplied
      When I encrypt "secret" in record mode with aad "tenant-1"
      Then decrypting with aad "tenant-1" returns "secret"
      But decrypting with aad "tenant-2" is rejected
