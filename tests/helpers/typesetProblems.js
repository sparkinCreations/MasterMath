// The problems the typesetting tests solve: one or more per solver path, so
// every step template (tests/typesetting.test.js) and every tip and mistake
// (tests/typesettingTips.test.js) is rendered at least once.
export const CONVERTED = [
  ['derivatives', 'x^2 + 3*x'], ['derivatives', 'sin(3x^2)'], ['derivatives', 'x^2*sin(x)'], ['derivatives', '(x+1)/(x-1)'],
  ['derivatives', 'ln(x^2 + 1)'], ['derivatives', 'second derivative of x*e^x'], ['derivatives', 'x^x'], ['derivatives', 'abs(2x-4)'],
  ['derivatives', 'x^2 + y^2 = 25 at (3, 4)'], ['derivatives', 'x^3 at x = 2'], ['derivatives', 'sqrt(x-3)'],
  ['integrals', '2*x + 1'], ['integrals', 'x*cos(x^2)'], ['integrals', 'x*e^x'], ['integrals', 'sqrt(1 - x^2)'], ['integrals', '1/(x^2 - 1)'],
  ['integrals', '∫_0^1 x^2 dx'], ['integrals', '∫_1^∞ 1/x^2 dx'], ['integrals', 'sin(x)^2'], ['integrals', '1/(1+4x^2)'], ['integrals', 'abs(x)'],
  ['limits', 'lim x->0 (sin(x)/x)'], ['limits', 'lim x->1 (x^2-1)/(x-1)'], ['limits', 'lim x->0 (sqrt(x+1)-1)/x'], ['limits', 'lim x->infinity (3x^2+1)/(2x^2-5)'],
  ['limits', 'lim x->inf (1 + 1/x)^(2x + 3)'], ['limits', 'lim x->0 (1-cos(x))/x^2'], ['limits', 'lim x->0+ 1/x'], ['limits', 'lim x->0 x*sin(1/x)'],
  // 1.68.2: an exponential against a power and a logarithm at once, and a
  // polynomial whose roots are located numerically (its own insights).
  ['limits', 'lim x->infinity (x^3*ln(x)^2)/e^x'], ['limits', 'lim x->infinity e^x/ln(x)'], ['limits', 'lim x->infinity ln(x)/e^x'],
  ['algebra', 'x^5 - x - 1 = 0'],
  // 1.68.6: limits at ±∞ proved from the expression (leading powers, the
  // conjugate of two roots, the limit laws, ∞⁰), and an estimate said to be one.
  ['limits', 'lim x->inf (sqrt(x+1) - sqrt(x))'], ['limits', 'lim x->inf sqrt(x)/(x+1)'], ['limits', 'lim x->inf sin(1/sqrt(x))'],
  ['limits', 'lim x->inf 1/ln(ln(x))'], ['limits', 'lim x->-inf sqrt(-x)/(1-x)'], ['limits', 'lim x->inf x^(1/x)'], ['limits', 'lim x->inf (2+1/x)^x'],
  ['limits', 'lim x->inf atan(x)'], ['limits', 'lim x->inf e^(1/x)'], ['limits', 'lim x->infinity x/1.5^x'],
  // 1.68.8: a series about x = 1, sequences through a power, a linear
  // inside's power.
  ['limits', 'lim x->1 log(x)/(x-1)'], ['limits', 'lim x->inf sin(x^2)'], ['limits', 'lim x->0 sin(1/x^2)'],
  ['integrals', 'sqrt(2x+1)'], ['integrals', '1/(3x+2)^2'],
  // 1.70.5: a limit with a parameter, refused with a worked suggestion.
  ['limits', 'lim x->0 sin(n*x)/x'],
  ['functions', 'y = m*x + b'],
  ['algebra', 'e^(a*x) = b'],
  ['algebra', 'a*e^x + b = c'],
  ['algebra', 'x^5 + a*x + 1 = 0'],
  ['algebra', '3xy + y = 6'],
  ['algebra', 'k*x = 5'],
  ['algebra', 'a*x^2 + b*x + c = 0'],
  ['integrals', 'integral of sin(a*x) dx'],
  ['integrals', 'integral of a^x dx'],
  ['integrals', 'integral of e^(k*x) dx from 0 to 1'],
  ['integrals', 'integral of 1/(x + a) dx from 0 to 1'],
  ['derivatives', 'd/dx a^x'],
  ['derivatives', 'd/dx x^2*ln(a*x)'],
  ['derivatives', 'd/dx x^2*ln(a*x) at x = -2'],
  ['integrals', 'integral of ln(a*x) dx'],
  ['algebra', 'x^2 - a = 0'],
  ['algebra', 'x/a = b'],
  ['functions', 'x^2 - 4*x + 3'], ['functions', '1/(x-2)'], ['functions', 'x^3 - x'], ['functions', 'ln(x)'], ['functions', 'sqrt(x-2)'],
  ['algebra', 'x^2 - 5x + 6 = 0'], ['algebra', 'x^2 + x + 1 = 0'], ['algebra', 'x^3 - 6x^2 + 11x - 6 = 0'], ['algebra', 'sqrt(x+2) = x'],
  ['algebra', '2^x = 8'], ['algebra', 'log(x) + log(x - 3) = 1'], ['algebra', 'ln(2x) = 3'],
  ['algebra', 'e^x + e^(-x) = 1'], ['algebra', 'e^x + e^(-x) = 3'], ['algebra', 'e^(-2x) - e^(-x) = 6'], ['algebra', '2^x + 2^(-x) = 3'], ['algebra', 'e^(3x) + e^(-x) = 0'],
  // systems
  ['algebra', '2x + 3y = 6; x - y = 4'], ['algebra', 'x + y + z = 6; 2x - y + z = 3; x + 2y - z = 2'], ['algebra', 'x + y = 2; 2x + 2y = 4'],
  ['algebra', 'x + y = 2; x + y = 3'], ['algebra', 'y = x^2; y = x + 2'], ['algebra', 'x^2 + y^2 = 25; x + y = 7'],
  // linear
  ['algebra', '2*x + 5 = 11'], ['algebra', 'x/3 + 1/2 = 5/6'], ['algebra', '3(x - 2) = 2x + 4'], ['algebra', '5x - 7 = 5x + 2'], ['algebra', '2(x+3) = 2x+6'],
  // inequalities
  ['algebra', '2x + 3 <= 7'], ['algebra', '-2x > 4'], ['algebra', 'x^2 - 4 > 0'], ['algebra', '(x-1)/(x+2) <= 0'], ['algebra', 'x^3 - x >= 0'],
  ['algebra', '-1 < 2x + 1 <= 5'], ['algebra', 'x < -1 or x > 3'], ['algebra', 'sin(x) > 1/2'], ['algebra', 'cos(x) > 0'], ['algebra', 'x^2 + 1 > 0'], ['algebra', '|x - 2| < 3'],
  // trig values / identities
  ['trigonometry', 'sin(pi/4)'], ['trigonometry', 'cos(2*pi/3)'], ['trigonometry', 'tan(pi/3)'], ['trigonometry', 'tan(pi/2)'], ['trigonometry', 'sec(pi/3)'],
  ['trigonometry', 'sin(x)^2 + cos(x)^2'], ['trigonometry', 'tan(x) - sin(x)/cos(x)'], ['trigonometry', 'sin(2x) - 2*sin(x)*cos(x)'], ['trigonometry', 'arcsin(1/2)'], ['trigonometry', 'sin(30)'],
  // trig equations
  ['trigonometry', 'sin(x) = 1/2'], ['trigonometry', '2cos(x) - 1 = 0'], ['trigonometry', 'tan(x) = 1'], ['trigonometry', 'sin(2x) = 1'], ['trigonometry', '2sin(x)^2 - 1 = 0'],
  ['trigonometry', '2sin(x)^2 - sin(x) - 1 = 0'], ['trigonometry', 'sin(x) = 2'], ['trigonometry', 'cos(x) = -1'], ['algebra', 'sin(x) + cos(x) = 1'],
  // arithmetic
  ['other', '(5 + 3) * 4 - 2^3'], ['other', '3/4 + 5/6'], ['other', '15% of 80'], ['other', '2^10'], ['other', '7!'], ['other', 'sqrt(50)'], ['other', '8/2(2+2)'], ['other', '17 mod 5'], ['other', '1/3 * 3/4'], ['other', '-3^2'],
  // rare integral paths
  // 1.52.4: a bare polynomial under Algebra shows its factored form; like terms combine in an antiderivative.
  ['algebra', 'x^2-5x+6'], ['algebra', 'x^3 - x'], ['integrals', 'x + 2x'], ['integrals', '2 + 3'],
  // 1.53.1: one equation in two unknowns, a cancelled factor, exact and domain-bounded inequality endpoints, odd roots of negatives.
  ['algebra', 'x^2 + y^2 = 25'], ['algebra', 'x^3 + y^3 = 1'], ['algebra', 'x^4 + y^2 = 16'], ['algebra', 'x^2 + x*y = 1'],
  ['algebra', '(x^2-1)/(x-1)'], ['algebra', '(x^3-x)/(x^2-1)'], ['algebra', 'e^x > 2'], ['algebra', 'ln(x) < 1'],
  ['algebra', 'x^2 - x - 1 > 0'], ['algebra', 'sqrt(x - 1) < 3'], ['other', '(-8)^(1/3)'],
  ['integrals', '(x+1)/((x-1)^2*(x^2+1))'], ['integrals', '1/(x^3+1)'], ['integrals', '(x^3+2)/((x-1)*(x+1)^2)'],
  ['integrals', '1/((x^2+1)^2)'], ['integrals', 'x^3/((x^2+1)^2)'], ['integrals', '(x^4+1)/(x^2+1)'], ['integrals', '(2x+3)/((x+1)*(x^2+4))'],
  // 1.57.0: trig powers, reduction formulas, form substitutions, x⁴ + a⁴, numeric fallbacks, named table methods
  ['integrals', 'sin(x)^2*cos(x)^3'], ['integrals', 'sin(x)^3'], ['integrals', '3*sin(x)^3*cos(x)'], ['integrals', 'sin(2x)^3*cos(2x)^2'], ['integrals', 'sec(x)^3'], ['integrals', 'sec(x)^4'],
  ['integrals', 'csc(x)^3'], ['integrals', 'sec(x)^5'], ['integrals', 'tan(x)^3*sec(x)'], ['integrals', 'tan(x)^2*sec(x)^4'], ['integrals', 'tan(x)^2'], ['integrals', 'tan(x)^3'], ['integrals', 'cot(x)^4'], ['integrals', '2*sec(3x)^3'],
  ['integrals', '1/(1+e^x)'], ['integrals', 'e^x/(1+e^(2x))'], ['integrals', 'sqrt(x)/(1+x)'], ['integrals', '1/(x^4+1)'], ['integrals', '3/(x^4+9)'],
  ['integrals', '∫_0^1 sqrt(1+x^4) dx'], ['integrals', '∫_0^∞ e^(-x^2)/(1+x^2) dx'], ['integrals', '∫_0^∞ 1/(x^4+1) dx'], ['integrals', '∫_0^1 sec(x)^3 dx'],
  ['integrals', 'tan(x)'], ['integrals', 'sec(x)'], ['integrals', 'csc(x)'], ['integrals', 'cot(x)'], ['integrals', '1/(x^2*sqrt(x^2+9))'], ['integrals', 'x^3/(x-1)'], ['integrals', 'cos(x)^4'], ['integrals', 'sin(x)^2*cos(x)^2'], ['integrals', 'sin(x)^4*cos(x)^2'], ['integrals', 'x*sqrt(x+1)'], ['integrals', 'x*sqrt(3-2x)'], ['integrals', '1/(x^2-2)^2'], ['integrals', '1/((x^2-2)^2*(x^2+1))'],
  ['integrals', '1/(x^5+1)'], ['integrals', '1/(x^3-2)'], ['integrals', '1/(x^4-2)'], ['integrals', 'x^2/(x^5+1)'], ['integrals', '∫_0^1 1/(x^5+1) dx'],
  ['integrals', 'e^(-x^2)'], ['integrals', '∫_0^1 1/sqrt(x) dx'], ['integrals', '∫_0^1 1/x dx'], ['integrals', '∫_-1^1 1/x dx'], ['integrals', '∫_-1^1 1/x^2 dx'],
  ['integrals', '1/(x^3 + x)'], ['integrals', '∫_0^∞ e^(-x^2) dx'],
  ['integrals', '1/((x^2+1)^3)'], ['integrals', '(2x+3)/(x^4+2*x^3+3*x^2+2*x+1)'], ['integrals', '1/(2*x^2+2*x+1)'], ['integrals', '1/(4*x^4+4*x^2+1)'],
  ['integrals', '1/(x^6-1)'], ['integrals', '(x^2+2)/(x^4+5*x^2+6)'], ['integrals', '(x+1)/((x^2+4)^2)'], ['integrals', '1/((x^2+2x+5)^2)'], ['integrals', '1/(x*(2*x^2+2*x+1))'],
  // 1.53.2: f'(x) with and without its function, one exponential, inverse/hyperbolic/reciprocal rules, square-root and quadratic-formula tips.
  ['derivatives', "f'(x) where f(x) = x^3"], ['derivatives', "f(x) = x^2, find f'(3)"], ['derivatives', "f'(x)"], ['derivatives', "y'(x) = 3x^2"],
  ['algebra', 'e^(2x) = 7'], ['algebra', '3*2^(x+1) - 4 = 20'], ['algebra', '5 - e^(-x) = 2'], ['algebra', '6/e^x = 2'], ['algebra', 'e^x = -2'], ['algebra', '3^(-x/2) = 4'], ['algebra', '(2/3)^x = 5'], ['algebra', 'ln(x^2) = 3'], ['derivatives', "g'(t) where g(t) = t^2"], ['algebra', 'x*e^x = 1'],
  ['derivatives', 'arcsin(x)'], ['derivatives', 'arctan(2x)'], ['derivatives', 'sinh(x)'], ['derivatives', 'sec(x)'], ['derivatives', 'sqrt(x)'],
  ['algebra', 'x^2 + 1 = 0'], ['algebra', 'x^2 = 9'], ['algebra', 'x^2 + x - 1 = 0'], ['algebra', '|2x-1| < 5'], ['limits', 'lim x->0 abs(x)/x'],
  // 1.54.0: exact roots, logarithms in their own notation, cancelling shown, word problems, area under a curve.
  ['other', 'sqrt(50)'], ['other', 'cbrt(54)'], ['other', 'log(8)'], ['other', 'log(8,2)'], ['other', 'log(4, 8)'], ['other', 'log(10, 2)'],
  ['other', 'ln(8)'], ['other', 'log(8) + log(2)'], ['algebra', '(x^2-1)/(x-1)'], ['algebra', '(x^3-x)/(x^2-1)'],
  ['auto', 'A train travels 120 miles in 2 hours. What is its speed?'], ['auto', 'area under the curve x^2 from 0 to 1'],
  ['auto', 'find the critical points of x^3 - 3x'], ['auto', 'simplify the expression (x^2-1)/(x-1)'], ['auto', 'find the zeros of x^2 - 5x + 6'],
  // 1.55.0: period, amplitude, tangent line, inverse, angle conversion; complex roots, erf, ln(e^2), partial fractions; tips by method.
  ['auto', 'find the period of 3sin(2x) + 1'], ['auto', 'period of sin(2x) + cos(3x)'], ['auto', 'period of sin(x) + sin(pi*x)'], ['auto', 'period of sin(x)^2'],
  ['auto', 'amplitude of -3cos(2x) + 5'], ['auto', 'amplitude of 3sin(x) + 4cos(x)'], ['auto', 'amplitude of tan(x)'], ['auto', 'amplitude of 2sin(x) + cos(2x)'],
  ['auto', 'find the equation of the tangent line to x^2 at x = 3'], ['auto', 'tangent line to sqrt(x) at x = 4'], ['auto', 'tangent line to ln(x) at x = e'], ['auto', 'tangent line to abs(x) at x = 0'], ['auto', 'tangent line to x^2 at (3, 8)'],
  ['auto', 'find the inverse of 2x + 3'], ['auto', 'inverse of (2x+1)/(x-3)'], ['auto', 'inverse of 2sqrt(x) + 1'], ['auto', 'inverse of 2^(x-1)'], ['auto', 'inverse of log(x)'], ['auto', 'inverse of 4/(x+1)'],
  ['auto', 'inverse of 5 - x'], ['auto', 'inverse of x^3 + 1'], ['auto', 'inverse of x^2'], ['auto', 'inverse of sin(x)'], ['auto', 'inverse of x^3 + x'],
  ['auto', 'convert 45 degrees to radians'], ['auto', '30.5 degrees to radians'], ['auto', 'convert 2pi/3 radians to degrees'], ['auto', '1 radian to degrees'],
  ['algebra', '2x^2 + 3x + 5 = 0'], ['derivatives', 'erf(x)'], ['other', 'ln(e^2)'], ['integrals', '1/(x^3 + x)'], ['integrals', '(x+1)/(x^2+1)'],
  ['limits', 'lim x->2 x^2 + 1'], ['limits', 'lim x->0 (e^x - 1 - x)/x^2'], ['limits', 'lim x->0 sin(1/x)'],
  ['functions', 'sin(2x)'], ['functions', 'e^x'],
  // 1.55.2: exact big integers, ≈ for what a float cannot show, complex arithmetic, a domain marked per condition.
  ['other', '123456789*987654321'], ['other', '2^53 + 1'], ['other', '25!'], ['other', '100!'], ['other', '2^-60'], ['other', '2^100/3'], ['other', '1000000 + 2'],
  ['other', '(2+3i)*(1-i)'], ['other', '(1+i)^2'], ['other', '(3+4i)/(1-2i)'], ['other', 'i^3'], ['other', 'i^10'], ['other', '(2+3i)+(1-i)'], ['other', 'abs(3+4i)'],
  ['other', '2*(3+4i)'], ['other', 'sqrt(-4)+3i'], ['other', '1/(2i)'], ['other', '(2+3i)^3'],
  ['functions', '(x^2-1)/(x^2-4)'], ['functions', 'sqrt(x-2)/(x-5)'],
  // 1.56.0: average value, max/min on an interval, primes, factorization, rounding; implicit curves graphed.
  ['auto', 'average value of x^2 on [0, 3]'], ['auto', 'average value of sin(x) from 0 to pi'], ['auto', 'average value of 1/x on [-1, 1]'],
  ['auto', 'max and min of x^3 - 3x on [-2, 3]'], ['auto', 'maximum of abs(x - 1) on [0, 3]'], ['auto', 'minimum of x^(2/3) on [-1, 8]'],
  ['auto', 'maximum of 1/x on [-1, 1]'], ['auto', 'maximum of 5 on [0, 1]'], ['auto', 'extreme values of sin(x) on [0, 2pi]'],
  ['auto', 'is 97 prime'], ['auto', 'is 91 prime'], ['auto', 'is 1 prime'], ['auto', 'prime factorization of 360'], ['auto', 'factor 97'],
  ['auto', 'round 3.14159 to 2 decimal places'], ['auto', 'round 2.996 to 2 dp'], ['auto', 'round 1250 to the nearest hundred'],
  ['auto', 'round 0.004567 to 2 significant figures'], ['auto', 'round sqrt(2) to 3 decimal places'], ['auto', 'round 5 to 2 decimal places'],
  ['algebra', 'x^(2/3) = 4'], ['algebra', 'x^(2/3) = -4'], ['algebra', '1/x = 0'], ['algebra', 'x/(x-1) = 1'],
  // 1.56.0: malformed input refused the same way on every path, in words; the substitution algebra; f′ in the function analysis.
  ['auto', '2+*'], ['auto', '3+'], ['auto', '*5'], ['auto', '(2+3'], ['auto', '2+3)'], ['auto', '()'], ['auto', '2..5'], ['auto', 'sin()'], ['auto', '2 + = 3'],
  ['auto', '= 5'], ['auto', 'x = = 2'], ['auto', 'x < < 3'], ['auto', '2x + 3 >'], ['auto', 'd/dx'], ['auto', 'd/dx (x^2 +)'], ['auto', 'integral of'], ['auto', 'limit of'],
  ['auto', 'foo(x)'], ['auto', 'x$2'], ['auto', '3!!'], ['auto', '|x'], ['auto', '[1,2]'], ['auto', '{x}'], ['auto', 'x;y'], ['auto', 'x == 2'], ['auto', '3:4'],
  ['derivatives', '2+*'], ['integrals', '2+3)'], ['limits', 'x^2 +'], ['trigonometry', 'sin x +'], ['functions', 'x$2'],
  ['algebra', '2x + 3y = 12, x - y = 1'], ['algebra', 'x + y = 5; 2x - y = 1'], ['algebra', '3x - 2y = 4; 5x + 4y = 14'], ['algebra', '-x + 2y = 3; 3x + y = 5'],
  ['algebra', '2y = 6; x + y = 5'], ['algebra', 'x - y = 1; 3y = 9'], ['algebra', '2x = 8; x + y = 5'], ['algebra', 'x/2 + y/3 = 1; x - y = 1'], ['algebra', 'x + y = 0; x - y = 2'],
  ['functions', 'x^3 - 3x'], ['functions', 'x*e^(-x)'], ['functions', 'x^3'], ['functions', 'abs(x)'], ['functions', 'x^(2/3)'], ['functions', 'sin(x)'], ['functions', 'x^4 - 2x^2'],
  ['auto', 'sketch x^3'], ['auto', 'analyze x^2 - 4'], ['derivatives', 'e^-x'], ['integrals', '50% of 80'], ['derivatives', 'the gcd of 12 and 18'],
  // 1.56.1: guidance by value, method and operation (the tips audit).
  ['trigonometry', 'sin(2x) = 1'], ['trigonometry', 'cos(x) = -1'], ['trigonometry', 'sin(x) = 0'], ['trigonometry', 'sec(pi/3)'], ['trigonometry', 'csc(pi/6)'], ['trigonometry', 'cot(pi/4)'],
  ['functions', 'abs(x - 2)'], ['functions', 'x^(2/3)'], ['functions', 'x*e^(-x)'], ['functions', 'e^(-x^2)'], ['functions', 'sin(x^2)'], ['functions', 'tan(x)'],
  ['integrals', 'cos(2x)'], ['integrals', 'tan(x)'], ['integrals', '(x+1)/(x^2+1)'], ['integrals', '(x^4+1)/(x^2+1)'],
  ['algebra', 'x*e^x = 1'], ['algebra', 'e^x = -2'], ['algebra', '5x - 7 = 5x + 2'], ['algebra', '2(x+3) = 2x+6'], ['algebra', 'x/3 + 1/2 = 5/6'], ['algebra', 'x^2 = 9'],
  ['other', '-3^2'], ['other', '17 mod 5'], ['other', '2^10'], ['other', '(1/2)^3'], ['other', '2^0.5'], ['other', '5 - 8'], ['other', '0.1 + 0.2'], ['other', '100 / 8'],
  ['other', 'sqrt(16) + sqrt(9)'], ['other', '(-8)^(1/3)'], ['auto', 'lcm of 4 and 6'], ['other', 'abs(3+4i)'], ['other', '(2+3i)+(1-i)'], ['other', 'i^10'], ['other', '(2+3i)*(1-i)'],
  ['auto', 'round 1250 to the nearest hundred'], ['derivatives', 'arctan(2x)'],
  // 1.58.0: superscript trig powers, trig substitution worked in θ, x⁴ + 4 by Sophie Germain, x/0, √ of negatives, ln x by parts, solve-for-y.
  ['integrals', '∫ sec³x dx'], ['integrals', '∫ sin^2(x) cos^3(x) dx'], ['integrals', 'ln(x)'], ['integrals', 'x*ln(x)'], ['integrals', '1/(x^4+4)'],
  ['integrals', 'sqrt(x^2+4)'], ['integrals', 'x^2/sqrt(9-x^2)'], ['integrals', '1/(x^2+9)^(3/2)'], ['integrals', 'sqrt(x^2-4)/x'], ['integrals', '1/sqrt(x^2-9)'], ['integrals', '1/(x^2*sqrt(x^2-1))'],
  ['algebra', 'x/0 = 1'], ['algebra', '2x + 3y = 6'], ['other', 'sqrt(-4)'], ['other', 'sqrt(-8)'], ['trigonometry', 'sin(x) = 2'],
  // 1.66.0: inequality and system guidance; zeros proved (monotone pieces, convexity, the half-angle polynomial); holes, edges, ≈.
  ['algebra', '(x-1)^2*(x+2) >= 0'], ['algebra', '(x^2-1)/(x-1) > 0'], ['algebra', 'abs(x-3) > 2'], ['algebra', 'abs(x) < x + 1'], ['algebra', 'sqrt(x-1) <= 0'],
  ['algebra', 'x - ln(x) > 2'], ['algebra', 'e^(x/20) > x'], ['algebra', 'sin(x) > x/2'], ['algebra', 'sin(10x) > 0'], ['algebra', 'abs(sin(x)) > 1/2'],
  ['algebra', 'x^2 > 2x + 1'], ['algebra', 'x < 1 or x > 3'], ['algebra', 'x + y = 1; x + y = 3'], ['algebra', 'y = x^5 - 3x; y = x'],
  ['algebra', 'x + y + x*(x-1)*(x-2)*(x+1) = 3; x - y = 1'], ['algebra', 'x+y+z=1; x+y+2z=2; x+y+3z=4'], ['algebra', 'x+y+z=1; x+y+2z=2; x+y+3z=3'],
  ['algebra', 'e^(2x) - 3e^x + 2 > 0'], ['algebra', 'sinh(x) > 1'], ['algebra', '4^x - 3*2^x + 2 < 0'], ['algebra', 'x^2 > sin(x)'], ['algebra', 'abs(x) >= x'],
  ['integrals', 'integral of 0.5*x^2 dx'], ['integrals', 'integral from 0.5 to 2 of 1/x dx'], ['derivatives', 'x^1.5'],
  // 1.67.0: arithmetic worked lines; gcd, lcm, mod worked; repeating decimals, the gamma function, logs of negatives.
  ['other', 'gcd(12, 18)'], ['other', 'gcd(7, 9)'], ['other', 'lcm(4, 6)'], ['other', '-7 mod 5'], ['other', '23 * 47'], ['other', '25 + 17'],
  ['other', '8/2(2+2)'], ['other', '2^3^2'], ['other', '3.5!'], ['other', '(-5)!'], ['other', 'log(-1)'], ['other', '0.333...'], ['other', '(-8)^(2/3)'],
  ['other', '2/3 * 9/4'], ['other', '(1/2) / (3/4)'], ['auto', 'is 97 prime'], ['auto', 'is 2 prime'], ['auto', 'prime factorization of 13'],
  // 1.67.2: a square against a wave, convex though f″ touches 0; a sign that changes infinitely often.
  ['algebra', 'x^2 > 2*sin(x) + 1'], ['algebra', 'e^x > cos(x)'], ['trigonometry', 'e^x - cos(x) = 0'], ['trigonometry', 'x*sin(x) = 1'],
  ['trigonometry', 'tan(x) = x'], ['trigonometry', 'tan(x) = 2x + 1'], ['trigonometry', 'tan(x) = x^2'], ['trigonometry', 'sec(x) = x'], ['algebra', 'tan(x) > x'], ['trigonometry', 'csc(x) = x + 2'], ['trigonometry', 'tan(x) = sin(x)'],
  // 1.67.3: written in sine and cosine, factored, excluded angles removed.
  ['trigonometry', '2*sin(x)*cos(x) = sin(x)'], ['trigonometry', 'csc(x) - sin(x) = cos(x)'], ['trigonometry', 'sin(x) + tan(x) = 1'], ['trigonometry', 'tan(x)*cos(x) = 1'], ['trigonometry', 'tan(2x) = sin(2x)'], ['trigonometry', 'sin(x)^2 = 3*cos(x)^2'],
  // 1.68.3: d/dx in front of an equation; its refusals.
  ['auto', 'd/dx (x^2 + y^2 = 25)'], ['auto', 'd/dx (x^2 + 3x = 5)'], ['auto', 'd/dx (2 = 2)'], ['auto', 'd/dx (x^2 + y^2) = 25'], ['auto', 'd/dx (x^2 + y^2 = r^2)'], ['auto', 'd/dx (y = 3)'],
  // 1.74.0: constants in simplify, equations, inequalities, systems and limits.
  ['auto', 'simplify (a*x + a)/a'], ['auto', 'simplify a*x + b*x'], ['auto', 'simplify x/a + x/b'], ['auto', 'simplify (a + b)^2 - (a - b)^2'],
  ['auto', 'ln(x + a) = b'], ['auto', 'log(x) = a'], ['auto', 'sqrt(x + a) = b'], ['auto', 'abs(x - a) = b'], ['auto', 'a^x = b'], ['auto', 'sin(x) = a'], ['auto', 'sin(a*x) = 1/2'], ['auto', 'tan(x/a) = 1'],
  ['auto', 'x/(x + a) = b'], ['auto', '1/x + 1/a = 1'], ['auto', 'x^3 - a*x = 0'],
  ['auto', 'a*x > b'], ['auto', 'a*x + 1 <= 3'], ['auto', 'x + a > b'], ['auto', 'x^2 < a'], ['auto', 'x^2 >= a'], ['auto', 'x^3 > a'],
  ['auto', 'x + y = a; x - y = b'], ['auto', 'x + a*y = 2; a*x + y = 2'], ['auto', 'x + y + z = a; x - y = 0; y - z = b'], ['auto', 'x*y = a; x + y = 1'],
  ['auto', 'lim x->0 sin(a*x)/x'], ['auto', 'lim x->a (x^2 - a^2)/(x - a)'], ['auto', 'lim x->0 (1 + a*x)^(1/x)'], ['auto', 'lim x->inf a*x^2/(x + 1)'], ['auto', 'lim x->-inf (a*x^3+1)/(x^2+1)'],
  ['auto', 'lim x->3 (x + a)/(x - a)'], ['auto', 'lim x->1 ln(a*x)'], ['auto', 'lim x->1 tan(a*x)'],
];

// Math left in a text run: an equation, a power, a function call, a
// derivative operator, an operator between short operands.
export const LEAK = /[a-z0-9)²³]\s*[=^]\s*[-a-z0-9(√]|[√∫]|\b(?:sin|cos|tan|sec|csc|cot|ln|log|sqrt|exp|arcsin|arctan)\(|\bd\/d[a-z]\b|(?<![a-z])[a-z0-9)]{1,3}\s*[·*/]\s*[0-9a-z(]{1,3}(?![a-z])|[a-z]\^/i;
