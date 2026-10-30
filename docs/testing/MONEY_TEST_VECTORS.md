# Money and Currency Test Vectors

These vectors test canonical storage and display conversion only. They do not define tax rounding.

|            Input | Unit  |    Canonical IRR | Expected                                     |
| ---------------: | ----- | ---------------: | -------------------------------------------- |
|                1 | TOMAN |               10 | exact                                        |
|               10 | TOMAN |              100 | exact                                        |
|          1250000 | TOMAN |         12500000 | exact                                        |
|                1 | IRR   |                1 | exact                                        |
|               11 | IRR   |               11 | Toman display must preserve 1 Rial remainder |
| 9007199254740993 | IRR   | 9007199254740993 | exact BigInt; never JS Number                |

## Required invariants

- `toIRR(x TOMAN) = x * 10` for integer Toman input.
- `toIRR(x IRR) = x` for integer Rial input.
- No floating-point conversion is allowed in either path.
- `fromIRR(toIRR(x)) = x` for exact supported input units.
- Changing locale or display unit never changes canonical IRR.
- Debit and credit totals are compared as exact integers.
- Any tax-schema conversion must have separate official field-specific test vectors.
