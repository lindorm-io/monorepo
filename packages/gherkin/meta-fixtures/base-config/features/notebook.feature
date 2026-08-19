Feature: Notebook

  Example: a note round-trips
    Given a fresh notebook
    When I write "hello world"
    Then reading returns "hello world"

  Example: another note round-trips
    Given a fresh notebook
    When I write "second note"
    Then reading returns "second note"
