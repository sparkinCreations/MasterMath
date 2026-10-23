# MasterMath accuracy regression test list

Expected answers verified with SymPy (gen.py) except REFUSE and UI-behaviour cases.
Priority: P0 = silent-wrong-answer risk, P1 = core correctness/teaching, P2 = nice to have.

| # | Pri | Category | Topic | Input | Expected | Notes |
|---|---|---|---|---|---|---|
| 1 | P0 | Unsupported input | algebra | `y'' + y = 0` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. Currently answers 0 (mathParser.js:462 grabs ' y = 0'). True solution y=C1 cos x + C2 sin x is an ODE. |
| 2 | P0 | Unsupported input | derivatives | `y'' + y = 0` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. Same bug under Derivatives topic. |
| 3 | P0 | Unsupported input | derivatives | `y' = y` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. Currently refused correctly - keep it that way. |
| 4 | P0 | Unsupported input | algebra | `y' + 2y = 0` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. Prime notation ODE; '2y = 0' must not be solved as y = 0. |
| 5 | P0 | Unsupported input | derivatives | `dy/dx = x*y` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. Currently answers f'(x) = y (wrong: this is an ODE, y = C e^(x^2/2)). |
| 6 | P0 | Unsupported input | derivatives | `f''(x) + f(x) = 0` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. ODE in function notation; must not be treated as 'second derivative of f(x)'. |
| 7 | P0 | Unsupported input | derivatives | `x^2 + y^2 = 25` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. Implicit curve: either refuse or give dy/dx = -x/y. Currently solves for x. |
| 8 | P0 | Unsupported input | other | `determinant of [[1,2],[3,4]]` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. Currently 'Undefined symbol determinantof'. Should say matrices not supported (or -2 if supported). |
| 9 | P0 | Unsupported input | algebra | `[[1,2],[3,4]] * [[1],[1]]` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. Currently returns [[3],[7]] (correct), but matrices aren't an advertised topic: support with steps or refuse. |
| 10 | P0 | Unsupported input | other | `inverse of [[1,2],[3,4]]` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. If supported: [[-2,1],[1.5,-0.5]]; otherwise refuse clearly. |
| 11 | P0 | Unsupported input | derivatives | `y''' = 6` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. Triple-prime ODE; must not answer 6 or 0. |
| 12 | P0 | Unsupported input | derivatives | `y'(x) = 3x^2` | REFUSE | Must show an unsupported/can't-solve message; must NOT show 'Problem solved!' or any numeric answer. Refuse or answer y = x^3 + C; never a derivative of 3x^2. |
| 13 | P1 | Observed issue | integrals | `integral of 1/(x^2-1)` | 1/2 ln|(x-1)/(x+1)| + C | Steps must show partial fractions (1/2)/(x-1) - (1/2)/(x+1); no raw-text step lines. |
| 14 | P1 | Observed issue | limits | `limit of (1+1/x)^x as x->infinity` | e | Steps must use ln + L'Hopital (ln L = lim ln(1+1/x)/(1/x) = 1), not numeric sampling. |
| 15 | P2 | Observed issue | integrals | `integral of 2x+1` | x^2 + x + C | Prefer expanded form; x(x+1)+C is equivalent but unexpected. |
| 16 | P2 | Observed issue | algebra | `log2(x) = 5` | x = 32 |  |
| 17 | P2 | Observed issue | derivatives | `derivative of log2(x)` | 1/(x ln 2) | Display: avoid log(x)/log(2) since app reads log as base 10. |
| 18 | P2 | Observed issue | integrals | `integral of log2(x)` | (x ln x - x)/ln 2 + C | Display: use ln or log_2, not log(x)/log(2). |
| 19 | P1 | Observed issue / tips | algebra | `x^2 + 1 = 0` | x = i or x = -i (no real solution) | Tips check: Key Insights/Common Mistakes must not mention (x-2)(x-3) or another problem. |
| 20 | P1 | Observed issue / tips | algebra | `|2x-1| < 5` | -2 < x < 3 | Tips check: must not mention numerators/fractions. |
| 21 | P2 | Observed issue / tips | algebra | `x^2 - 5x + 6 = 0, then x^2 + 1 = 0` | second solve shows only tips/steps for x^2+1 | UI: tips must not carry over; old error banners must clear on next solve. |
| 22 | P1 | Algebra | algebra | `2(x+3) = 2x+6` | All real numbers | Identity |
| 23 | P1 | Algebra | algebra | `5x-7 = 5x+2` | No solution | Contradiction |
| 24 | P1 | Algebra | algebra | `x^2 - 2x - 1 = 0` | x = 1 ± √2 | Irrational roots |
| 25 | P2 | Algebra | algebra | `x^2 - 6x + 9 = 0` | x = 3 (double root) | Repeated root |
| 26 | P2 | Algebra | algebra | `x^4 - 5x^2 + 4 = 0` | x = ±1, ±2 | Biquadratic |
| 27 | P2 | Algebra | algebra | `x^3 - 8 = 0` | x = 2 (complex: -1 ± i√3) | Real vs complex roots labelled |
| 28 | P0 | Algebra | algebra | `sqrt(x+7) = x - 5` | x = 9 (x = 2 extraneous) | Must reject x=2 |
| 29 | P0 | Algebra | algebra | `1/(x-1) + 1 = x/(x-1)` | All real x except x = 1 (identity on its domain) | Identity with excluded value; must not say 'all real numbers' or include x = 1. (SymPy solveset wrongly returns EmptySet here, verified by simplification.) |
| 30 | P1 | Algebra | algebra | `x/(x-2) = 2/(x-2)` | No solution | Excluded value |
| 31 | P2 | Algebra | algebra | `0.1x + 0.2 = 0.5` | x = 3 | Float noise (no 2.9999) |
| 32 | P1 | Inequality/Abs | algebra | `x^2 - 4 > 0` | x < -2 or x > 2 |  |
| 33 | P0 | Inequality/Abs | algebra | `(x-1)/(x+2) >= 0` | x < -2 or x ≥ 1 | x=-2 excluded, x=1 included |
| 34 | P1 | Inequality/Abs | algebra | `x^2 + 1 < 0` | No solution |  |
| 35 | P2 | Inequality/Abs | algebra | `x^2 + 1 > 0` | All real numbers |  |
| 36 | P2 | Inequality/Abs | algebra | `-3 < 2x + 1 <= 7` | -2 < x ≤ 3 | Compound |
| 37 | P1 | Inequality/Abs | algebra | `-2x > 6` | x < -3 | Sign flip |
| 38 | P1 | Inequality/Abs | algebra | `|x - 3| = 5` | x = -2 or x = 8 |  |
| 39 | P1 | Inequality/Abs | algebra | `|x + 1| = -2` | No solution |  |
| 40 | P1 | Inequality/Abs | algebra | `|x - 2| >= 3` | x ≤ -1 or x ≥ 5 |  |
| 41 | P2 | Inequality/Abs | algebra | `|2x - 4| = |x + 1|` | x = 1 or x = 5 |  |
| 42 | P1 | Systems | algebra | `x + y = 3; x - y = 1` | x = 2, y = 1 |  |
| 43 | P0 | Systems | algebra | `2x + 4y = 6; x + 2y = 3` | Infinitely many (x = 3 - 2y) | Dependent system |
| 44 | P0 | Systems | algebra | `x + y = 1; x + y = 2` | No solution | Inconsistent |
| 45 | P2 | Systems | algebra | `x + y + z = 6; x - y = 0; x + z = 5` | x=1, y=1, z=4 | 3x3, or refuse clearly |
| 46 | P2 | Systems | algebra | `y = x^2; y = x + 2` | (-1, 1) and (2, 4) | Nonlinear; refuse if unsupported |
| 47 | P0 | Logs | algebra | `log(x) + log(x-3) = 1` | x = 5 (x=-2 rejected) | log = base 10 in app |
| 48 | P2 | Logs | algebra | `ln(x) = 0` | x = 1 |  |
| 49 | P1 | Logs | algebra | `e^(2x) = 7` | x = ln(7)/2 |  |
| 50 | P2 | Logs | algebra | `3^(x+1) = 27` | x = 2 |  |
| 51 | P2 | Logs | algebra | `log(x, 3) = -2` | x = 1/9 | Explicit base |
| 52 | P2 | Logs | algebra | `ln(x) = -1` | x = 1/e |  |
| 53 | P2 | Logs | algebra | `log(-x) = 2` | x = -100 | Negative x is valid here |
| 54 | P1 | Trig | trigonometry | `sin(x) = 1/2 (degrees setting)` | x = 30° + 360°k, 150° + 360°k | Answer in degrees |
| 55 | P1 | Trig | trigonometry | `sin(x) = 1/2 (radians setting)` | x = π/6 + 2πk, 5π/6 + 2πk | General solution |
| 56 | P0 | Trig | trigonometry | `sin(30) (degrees setting)` | 0.5 | Degrees mode must convert |
| 57 | P0 | Trig | trigonometry | `sin(30) (radians setting)` | ≈ -0.9880 | Settings angleUnit=radians must NOT convert (default 'auto' treats bare 30 as degrees) |
| 58 | P1 | Trig | trigonometry | `2cos(x)^2 - cos(x) - 1 = 0 (radians)` | x = 2πk, 2π/3 + 2πk, 4π/3 + 2πk | Quadratic in cos |
| 59 | P2 | Trig | trigonometry | `tan(x) = 1 (radians)` | x = π/4 + πk | Period π, not 2π |
| 60 | P0 | Trig | trigonometry | `sin(x) = 2` | No solution | Out of range |
| 61 | P2 | Trig | trigonometry | `sin(2x) = cos(x) (radians)` | x = π/6, π/2, 5π/6, 3π/2 (+2πk) | Double angle |
| 62 | P1 | Derivatives | derivatives | `derivative of sin(x^2)` | 2x cos(x^2) |  |
| 63 | P2 | Derivatives | derivatives | `derivative of x^2 e^x` | e^x (x^2 + 2x) |  |
| 64 | P1 | Derivatives | derivatives | `derivative of (x^2+1)/(x-1)` | (x^2 - 2x - 1)/(x-1)^2 | Quotient rule |
| 65 | P1 | Derivatives | derivatives | `derivative of |x|` | x/|x| (undefined at x = 0) | Must note x≠0 |
| 66 | P1 | Derivatives | derivatives | `second derivative of x^4` | 12x^2 |  |
| 67 | P2 | Derivatives | derivatives | `derivative of arcsin(x)` | 1/sqrt(1-x^2) |  |
| 68 | P2 | Derivatives | derivatives | `derivative of ln(cos(x))` | -tan(x) |  |
| 69 | P2 | Derivatives | derivatives | `derivative of 5` | 0 |  |
| 70 | P1 | Derivatives | derivatives | `derivative of x^3 at x = 2` | 12 |  |
| 71 | P2 | Derivatives | derivatives | `derivative of x*y with respect to y` | x | Variable choice |
| 72 | P1 | Integrals | integrals | `integral of sin(x) from 0 to pi` | 2 |  |
| 73 | P1 | Integrals | integrals | `integral of 1/x from 1 to e` | 1 |  |
| 74 | P1 | Integrals | integrals | `integral of x*e^x` | e^x (x - 1) + C | By parts |
| 75 | P0 | Integrals | integrals | `integral of 1/x^2 from 1 to infinity` | 1 | Improper, convergent |
| 76 | P0 | Integrals | integrals | `integral of 1/x from 1 to infinity` | Diverges | Must say diverges, not a number |
| 77 | P0 | Integrals | integrals | `integral of 1/x^2 from -1 to 1` | Diverges (singular at x = 0) | Naive FTC gives -2: classic trap |
| 78 | P1 | Integrals | integrals | `integral of e^(-x) from 0 to infinity` | 1 |  |
| 79 | P1 | Integrals | integrals | `integral of 1/sqrt(x) from 0 to 1` | 2 | Improper at endpoint |
| 80 | P2 | Integrals | integrals | `integral of 2x/(x^2+1)` | ln(x^2 + 1) + C | u-sub |
| 81 | P1 | Integrals | integrals | `integral of (3x+5)/((x+1)(x+2))` | 2 ln|x+1| + ln|x+2| + C | Partial-fraction steps |
| 82 | P2 | Integrals | integrals | `integral of x from 2 to 2` | 0 |  |
| 83 | P1 | Integrals | integrals | `integral of x^2 from 3 to 0` | -9 | Reversed bounds |
| 84 | P1 | Limits | limits | `limit of 1/x as x->0+` | +∞ | One-sided |
| 85 | P1 | Limits | limits | `limit of 1/x as x->0-` | -∞ | One-sided |
| 86 | P0 | Limits | limits | `limit of 1/x as x->0` | Does not exist (+∞ vs -∞) | DNE |
| 87 | P0 | Limits | limits | `limit of |x|/x as x->0` | Does not exist (1 vs -1) | Jump |
| 88 | P0 | Limits | limits | `limit of sin(1/x) as x->0` | Does not exist (oscillates) | Must not sample to a number |
| 89 | P1 | Limits | limits | `limit of (x^2-9)/(x-3) as x->3` | 6 | Removable |
| 90 | P1 | Limits | limits | `limit of (3x^2+1)/(2x^2-x) as x->infinity` | 3/2 |  |
| 91 | P1 | Limits | limits | `limit of sqrt(x^2+x) - x as x->infinity` | 1/2 | Sampling-prone |
| 92 | P2 | Limits | limits | `limit of x*sin(1/x) as x->0` | 0 | Squeeze |
| 93 | P2 | Limits | limits | `limit of (1-cos(x))/x^2 as x->0` | 1/2 |  |
| 94 | P2 | Limits | limits | `limit of e^x as x->-infinity` | 0 |  |
| 95 | P2 | Limits | limits | `limit of x^(1/x) as x->infinity` | 1 |  |

## Results against v1.47.1 (solveProblem from the repo, run 2026-10-21)
Raw output: `app-run.txt`. Steps and tips were not checked automatically. Cases 13, 14, 19, 20, and 21 need a person to look at the steps and tips.
- **FAIL (shows an answer when it should refuse):** 1 & 2 `y''+y=0` → `0`; 5 `dy/dx = x*y` → `f'(x) = y`; 6 `f''(x)+f(x)=0` → `f''(f) = 0`; 7 `x^2+y^2=25` → solves for x; 12 `y'(x)=3x^2` → "Infinitely many solutions".
- **FAIL (unclear message):** 8 & 10 → "Undefined symbol determinantof/inverseof". 9 matrix product returns [[3],[7]], which is the right value for an unsupported feature (product decision).
- **Form/display:** 15 gives `x*(x + 1) + C`. 18 echoes `log(x)/log(2)`. 49 gives `ln(√7)`, which is correct but `ln(7)/2` is more standard.
- **PASS:** all other cases with an answer (algebra, inequalities, abs, systems, logs, trig incl. deg/rad via settings, derivatives, integrals incl. improper/divergent, limits incl. one-sided/DNE/∞). 3, 4, and 11 refuse correctly.
