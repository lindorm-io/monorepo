Feature: Gherkin plugin integration

  Background:
    Given a fresh notebook

  Rule: notes survive a round trip

    Example: default note
      When I write "hello world"
      Then reading returns "hello world"

    Scenario Outline: the note "<note>" round-trips
      When I write "<note>"
      Then reading returns "<note>"

      Examples:
        | note  |
        | alpha |
        | omega |

  Rule: hostile content is data, never code

    Example: hostile `note` with ${payload}, "; quotes and back\slash
      When I write "`${payload}`; import { evil } from 'x';"
      Then reading returns "`${payload}`; import { evil } from 'x';"
