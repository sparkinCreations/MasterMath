// "Learn more": lessons on other websites, shown under a solution and chosen
// by the topic it was solved as. Free to read and with no affiliation to
// MasterMath; Wolfram|Alpha's example pages are free, its step-by-step
// solutions are not, so it is linked for its examples only.
//
// Plain links: nothing is sent to these sites unless one is clicked, and
// then they open in a new tab with no referrer. Every link was opened and its
// page title checked before release (October 29, 2026); check again on the
// same cycle as the comparison page.

export const LEARN_MORE_HOSTS = [
  'www.khanacademy.org',
  'tutorial.math.lamar.edu',
  'openstax.org',
  'www.3blue1brown.com',
  'www.wolframalpha.com',
];

const KHAN = 'Khan Academy';
const PAUL = "Paul's Online Math Notes";
const OPENSTAX = 'OpenStax';
const TBOB = '3Blue1Brown';
const WOLFRAM = 'Wolfram|Alpha';

export const LEARN_MORE = {
  integrals: [
    { site: KHAN, title: 'Integral calculus', url: 'https://www.khanacademy.org/math/integral-calculus' },
    { site: PAUL, title: 'Calculus I: Integrals', url: 'https://tutorial.math.lamar.edu/Classes/CalcI/IntegralsIntro.aspx' },
    { site: PAUL, title: 'Calculus II: Integration techniques', url: 'https://tutorial.math.lamar.edu/Classes/CalcII/IntTechIntro.aspx' },
    { site: OPENSTAX, title: 'Calculus Volume 1, Chapter 5: Integration', url: 'https://openstax.org/books/calculus-volume-1/pages/5-introduction' },
    { site: OPENSTAX, title: 'Calculus Volume 2, Chapter 3: Techniques of integration', url: 'https://openstax.org/books/calculus-volume-2/pages/3-introduction' },
    { site: TBOB, title: 'Integration and the fundamental theorem of calculus', url: 'https://www.3blue1brown.com/lessons/integration' },
    { site: WOLFRAM, title: 'Examples: integrals', url: 'https://www.wolframalpha.com/examples/mathematics/calculus-and-analysis/integrals' },
  ],
  derivatives: [
    { site: KHAN, title: 'Differential calculus', url: 'https://www.khanacademy.org/math/differential-calculus' },
    { site: PAUL, title: 'Calculus I: Derivatives', url: 'https://tutorial.math.lamar.edu/Classes/CalcI/DerivativeIntro.aspx' },
    { site: OPENSTAX, title: 'Calculus Volume 1, Chapter 3: Derivatives', url: 'https://openstax.org/books/calculus-volume-1/pages/3-introduction' },
    { site: TBOB, title: 'The paradox of the derivative', url: 'https://www.3blue1brown.com/lessons/derivatives' },
    { site: WOLFRAM, title: 'Examples: derivatives', url: 'https://www.wolframalpha.com/examples/mathematics/calculus-and-analysis/derivatives' },
  ],
  limits: [
    { site: KHAN, title: 'Limits and continuity', url: 'https://www.khanacademy.org/math/calculus-1/cs1-limits-and-continuity' },
    { site: PAUL, title: 'Calculus I: Limits', url: 'https://tutorial.math.lamar.edu/Classes/CalcI/LimitsIntro.aspx' },
    { site: OPENSTAX, title: 'Calculus Volume 1, Chapter 2: Limits', url: 'https://openstax.org/books/calculus-volume-1/pages/2-introduction' },
    { site: TBOB, title: 'Limits and the definition of derivatives', url: 'https://www.3blue1brown.com/lessons/limits' },
    { site: WOLFRAM, title: 'Examples: limits', url: 'https://www.wolframalpha.com/examples/mathematics/calculus-and-analysis/limits' },
  ],
  functions: [
    { site: KHAN, title: 'Functions', url: 'https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:functions' },
    { site: PAUL, title: 'Algebra: The definition of a function', url: 'https://tutorial.math.lamar.edu/Classes/Alg/FunctionDefn.aspx' },
    { site: OPENSTAX, title: 'Precalculus, Chapter 1: Functions', url: 'https://openstax.org/books/precalculus-2e/pages/1-introduction-to-functions' },
    { site: WOLFRAM, title: 'Examples: mathematical functions', url: 'https://www.wolframalpha.com/examples/mathematics/mathematical-functions' },
  ],
  trigonometry: [
    { site: KHAN, title: 'Trigonometry', url: 'https://www.khanacademy.org/math/trigonometry' },
    { site: PAUL, title: 'Algebra/Trig review: Trigonometry', url: 'https://tutorial.math.lamar.edu/Extras/AlgebraTrigReview/TrigIntro.aspx' },
    { site: OPENSTAX, title: 'Precalculus, Chapter 5: Trigonometric functions', url: 'https://openstax.org/books/precalculus-2e/pages/5-introduction-to-trigonometric-functions' },
    { site: WOLFRAM, title: 'Examples: trigonometry', url: 'https://www.wolframalpha.com/examples/mathematics/trigonometry' },
  ],
  algebra: [
    { site: KHAN, title: 'Algebra 1', url: 'https://www.khanacademy.org/math/algebra' },
    { site: PAUL, title: 'Algebra: Solutions and solution sets', url: 'https://tutorial.math.lamar.edu/Classes/Alg/SolutionSets.aspx' },
    { site: OPENSTAX, title: 'College Algebra, Chapter 2: Equations and inequalities', url: 'https://openstax.org/books/college-algebra-2e/pages/2-introduction-to-equations-and-inequalities' },
    { site: WOLFRAM, title: 'Examples: algebra', url: 'https://www.wolframalpha.com/examples/mathematics/algebra' },
  ],
  other: [
    { site: KHAN, title: 'Arithmetic', url: 'https://www.khanacademy.org/math/arithmetic' },
    { site: OPENSTAX, title: 'Prealgebra, Chapter 1: Whole numbers', url: 'https://openstax.org/books/prealgebra-2e/pages/1-introduction' },
    { site: WOLFRAM, title: 'Examples: elementary math', url: 'https://www.wolframalpha.com/examples/mathematics/elementary-math' },
  ],
};

export function learnMoreFor(topic) {
  return LEARN_MORE[topic] || [];
}
