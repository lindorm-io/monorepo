Feature: Greeting

  Background:
    Given the greeting "Hello"

  Example: greet a name
    When I greet "World"
    Then the result is "Hello, World!"
    And the book has recorded 3 steps

  Example: greet shouting
    When I greet "world" shouting
    Then the result is "Hello, WORLD!"

  Scenario Outline: every greeting applies
    Given the greeting "<greeting>"
    When I greet "Lindorm"
    Then the result is "<greeting>, Lindorm!"

    Examples:
      | greeting |
      | Hi       |
      | Hej      |
