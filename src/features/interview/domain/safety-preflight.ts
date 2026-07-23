export type SafetyPreflightResult =
  | { kind: "none" }
  | { kind: "verification-needed" }
  | {
      kind: "urgent";
      reason: "breathing" | "unresponsive" | "bleeding" | "explicit-help";
    };

type SafetyCategory = Extract<SafetyPreflightResult, { kind: "urgent" }>["reason"];

type SafetyObservation = {
  category: SafetyCategory;
  signal: boolean;
  negated: boolean;
  current: boolean;
  past: boolean;
  ambiguous: boolean;
  bleedingSeverity: boolean;
  bleedingPersistence: boolean;
};

const CATEGORY_ORDER: readonly SafetyCategory[] = [
  "breathing",
  "unresponsive",
  "bleeding",
  "explicit-help",
];

const EXPLICIT_PAST_PATTERN = /(?:어제|예전|과거|지난번|전에|적이 있|했었|였었)/u;
const COMPLETION_PATTERN = /(?:었|았|였)/u;
const AMBIGUOUS_PATTERN = /(?:조금|약간|것 같|듯|모르|애매|가끔)/u;
const CURRENT_PATTERN = /(?:지금|현재|당장|즉시)/u;

const BREATHING_TOPIC = /(?:숨|호흡)/u;
const BREATHING_SIGNAL = /(?:숨(?:을|이|쉬기|쉬기가)?|호흡).{0,20}(?:못 쉬|쉬기 힘|쉬기가 힘|곤란|매우 힘|심하게 힘)/u;
const BREATHING_NEGATION = /(?:힘들지 않|어렵지 않|곤란(?:은|이)?\s*(?:없|아니)|문제없|(?:숨|호흡).{0,16}괜찮)/u;

const UNRESPONSIVE_TOPIC = /(?:의식|반응)/u;
const UNRESPONSIVE_SIGNAL = /(?:의식.{0,12}(?:잃|없|소실)|반응.{0,12}(?:없|하지 않))/u;
const UNRESPONSIVE_NEGATION = /(?:의식.{0,16}(?:잃은 건 아니|잃지 않|소실.{0,6}아니|있)|반응.{0,16}(?:없는 건 아니|없음.{0,6}아니|있))/u;

const BLEEDING_TOPIC = /(?:피|출혈)/u;
const BLEEDING_SEVERITY = /(?:심하게|심하고|심하며|심한|심해|심합니다|심했|심하$|많이|많은)/u;
const BLEEDING_PERSISTENCE = /(?:멈추지 않|멎지 않)/u;
const BLEEDING_NEGATION = /(?:심하지 않|많지 않|이미 멈|멎었|(?:피|출혈).{0,16}(?:없어|없는|아니))/u;

const HELP_TOPIC = /(?:도움|119|살려)/u;
const HELP_SIGNAL = /(?:도움.{0,12}필요|(?:즉시|당장).{0,12}도움|살려\s*주)/u;
const HELP_NEGATION = /(?:도움.{0,16}(?:필요 없|필요하지 않|괜찮)|119.{0,12}(?:필요 없|아니))/u;

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?;\n]+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitCoordinatedClauses(sentence: string): string[] {
  return sentence
    .split(/[,،]+|(?:하지만|그러나|그런데)\s*|(?:그리고|고)\s+/u)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function baseObservation(
  category: SafetyCategory,
  clause: string,
): Omit<SafetyObservation, "signal" | "negated" | "bleedingSeverity" | "bleedingPersistence"> {
  const current = CURRENT_PATTERN.test(clause);
  return {
    category,
    current,
    past:
      EXPLICIT_PAST_PATTERN.test(clause) ||
      (!current && COMPLETION_PATTERN.test(clause)),
    ambiguous: AMBIGUOUS_PATTERN.test(clause),
  };
}

function observeClause(
  clause: string,
  previousCategories: ReadonlySet<SafetyCategory>,
): SafetyObservation[] {
  const observations: SafetyObservation[] = [];

  if (BREATHING_TOPIC.test(clause)) {
    observations.push({
      ...baseObservation("breathing", clause),
      signal: BREATHING_SIGNAL.test(clause),
      negated: BREATHING_NEGATION.test(clause),
      bleedingSeverity: false,
      bleedingPersistence: false,
    });
  }

  if (UNRESPONSIVE_TOPIC.test(clause)) {
    observations.push({
      ...baseObservation("unresponsive", clause),
      signal: UNRESPONSIVE_SIGNAL.test(clause),
      negated: UNRESPONSIVE_NEGATION.test(clause),
      bleedingSeverity: false,
      bleedingPersistence: false,
    });
  }

  const bleedingPersistence = BLEEDING_PERSISTENCE.test(clause);
  if (
    BLEEDING_TOPIC.test(clause) ||
    (bleedingPersistence && previousCategories.has("bleeding"))
  ) {
    const bleedingSeverity = BLEEDING_SEVERITY.test(clause);
    observations.push({
      ...baseObservation("bleeding", clause),
      signal: bleedingSeverity || bleedingPersistence,
      negated: BLEEDING_NEGATION.test(clause),
      bleedingSeverity,
      bleedingPersistence,
    });
  }

  if (HELP_TOPIC.test(clause)) {
    observations.push({
      ...baseObservation("explicit-help", clause),
      signal: HELP_SIGNAL.test(clause),
      negated: HELP_NEGATION.test(clause),
      bleedingSeverity: false,
      bleedingPersistence: false,
    });
  }

  return observations;
}

function classifyObservationRun(
  category: SafetyCategory,
  observations: readonly SafetyObservation[],
): SafetyPreflightResult {
  const hasSignal = observations.some(({ signal }) => signal);
  const hasPositiveSignal = observations.some(
    ({ signal, negated }) => signal && !negated,
  );
  const hasNegation = observations.some(({ negated }) => negated);
  const hasPast = observations.some(({ past }) => past);
  const hasAmbiguity = observations.some(({ ambiguous }) => ambiguous);
  const hasCurrent = observations.some(({ current }) => current);

  if (hasNegation) {
    if (hasPositiveSignal || hasPast || hasAmbiguity) {
      return { kind: "verification-needed" };
    }
    return { kind: "none" };
  }

  if (category === "bleeding") {
    const severe = observations.some(({ bleedingSeverity }) => bleedingSeverity);
    const persistent = observations.some(
      ({ bleedingPersistence }) => bleedingPersistence,
    );
    if (!severe && !persistent) {
      return hasPast || hasAmbiguity
        ? { kind: "verification-needed" }
        : { kind: "none" };
    }
    if (hasPast || hasAmbiguity) return { kind: "verification-needed" };
    return severe && persistent && hasCurrent
      ? { kind: "urgent", reason: "bleeding" }
      : { kind: "verification-needed" };
  }

  if (!hasSignal) {
    return hasPast || hasAmbiguity
      ? { kind: "verification-needed" }
      : { kind: "none" };
  }
  if (hasPast || hasAmbiguity) return { kind: "verification-needed" };
  return hasCurrent
    ? { kind: "urgent", reason: category }
    : { kind: "verification-needed" };
}

function classifySentence(sentence: string): SafetyPreflightResult[] {
  const observationsByClause: SafetyObservation[][] = [];
  let previousCategories = new Set<SafetyCategory>();
  for (const clause of splitCoordinatedClauses(sentence)) {
    const observations = observeClause(clause, previousCategories);
    observationsByClause.push(observations);
    previousCategories = new Set(observations.map(({ category }) => category));
  }

  const results: SafetyPreflightResult[] = [];
  for (const category of CATEGORY_ORDER) {
    let run: SafetyObservation[] = [];
    for (const observations of observationsByClause) {
      const observation = observations.find((item) => item.category === category);
      if (observation) {
        run.push(observation);
        continue;
      }
      if (run.length > 0) {
        results.push(classifyObservationRun(category, run));
        run = [];
      }
    }
    if (run.length > 0) results.push(classifyObservationRun(category, run));
  }
  return results;
}

export function runSafetyPreflight(answerText: string): SafetyPreflightResult {
  const results = splitSentences(answerText.normalize("NFKC").trim())
    .flatMap(classifySentence);
  const urgent = results.find(
    (result): result is Extract<SafetyPreflightResult, { kind: "urgent" }> =>
      result.kind === "urgent",
  );
  if (urgent) return urgent;
  return results.some(({ kind }) => kind === "verification-needed")
    ? { kind: "verification-needed" }
    : { kind: "none" };
}
