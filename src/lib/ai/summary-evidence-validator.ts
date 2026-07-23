import type {
  InterviewSummary,
  InterviewSummaryItem,
} from "@/features/interview/model/interview-domain.types";

export type EvidenceSourceTurn = {
  id: string;
  question: string;
  answer: string;
};

export type EvidenceItemClassification = "accepted" | "verification" | "reject";

export type EvidenceValidationResult = {
  summary: InterviewSummary;
  rejectedItemIds: string[];
  usedFallback: boolean;
};

const SUMMARY_SECTIONS = [
  "subjective",
  "objective",
  "verificationNeeded",
] as const;

const NEGATION_PATTERN = /없|아니|않/;
const UNKNOWN_PATTERN = /모르/;
const AFFIRMATIVE_PATTERN = /있|^(?:네|예)$/;
const CURRENT_TIME_PATTERN = /지금|오늘/;
const PAST_TIME_PATTERN = /어제|예전/;
const INDIVIDUAL_SUBJECT_PATTERN = /사용자|본인/;
const FAMILY_SUBJECT_PATTERN = /가족|아버지|어머니/;
const DATE_PATTERN = /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일/g;
const TIME_PATTERN = /(?:[01]?\d|2[0-3]):[0-5]\d|(?:[01]?\d|2[0-3])시(?:\s*\d{1,2}분)?/g;
const UNIT_PATTERN = /\d+(?:[.,]\d+)?\s*(?:mg|g|kg|ml|mL|℃|도|점|시간|분|일|주|개월|살)(?![A-Za-z가-힣])/g;
const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;

function tokens(text: string, pattern: RegExp): string[] {
  return Array.from(text.matchAll(pattern), (match) => match[0]);
}

function everyTokenExists(text: string, evidence: string, pattern: RegExp): boolean {
  const evidenceTokens = new Set(tokens(evidence, pattern));
  return tokens(text, pattern).every((token) => evidenceTokens.has(token));
}

function hasLiteralMismatch(text: string, evidence: string): boolean {
  return ![
    DATE_PATTERN,
    TIME_PATTERN,
    UNIT_PATTERN,
    NUMBER_PATTERN,
  ].every((pattern) => everyTokenExists(text, evidence, pattern));
}

function subjectGroup(
  text: string,
): "individual" | "family" | "father" | "mother" | undefined {
  if (INDIVIDUAL_SUBJECT_PATTERN.test(text)) return "individual";
  if (/아버지/.test(text)) return "father";
  if (/어머니/.test(text)) return "mother";
  if (FAMILY_SUBJECT_PATTERN.test(text)) return "family";
  return undefined;
}

function isCurrentTime(text: string): boolean {
  return CURRENT_TIME_PATTERN.test(text);
}

function isPastTime(text: string): boolean {
  return PAST_TIME_PATTERN.test(text);
}

function stripKoreanEnding(word: string): string {
  return word
    .replace(/(?:이|가|은|는|을|를|에|의|도|와|과|부터|에서)$/, "")
    .replace(/(?:웠|었|았|였|했|워)?(?:어요|아요|예요|요|다)$/, "");
}

function topics(text: string): Set<string> {
  return new Set(
    (text.match(/[가-힣]{2,}/g) ?? [])
      .map(stripKoreanEnding)
      .filter(
        (word) =>
          word.length >= 2 &&
          ![
            "사용자",
            "본인",
            "가족",
            "아버지",
            "어머니",
            "지금",
            "오늘",
            "어제",
            "예전",
            "없",
            "아니",
            "않",
            "모르",
            "있",
          ].includes(word),
      ),
  );
}

function sharesTopic(itemText: string, evidenceText: string): boolean {
  const evidenceTopics = topics(evidenceText);
  return Array.from(topics(itemText)).some((topic) => evidenceTopics.has(topic));
}

function responseState(text: string): "unknown" | "negative" | "affirmative" | undefined {
  if (UNKNOWN_PATTERN.test(text)) return "unknown";
  if (NEGATION_PATTERN.test(text)) return "negative";
  if (AFFIRMATIVE_PATTERN.test(text)) return "affirmative";
  return undefined;
}

function hasExplicitContradiction(
  text: string,
  turn: EvidenceSourceTurn,
): boolean {
  if (!sharesTopic(text, `${turn.question}\n${turn.answer}`)) return false;

  const itemState = responseState(text);
  const evidenceState = responseState(turn.answer);
  const unknownContradiction =
    (itemState === "unknown" && evidenceState !== undefined && evidenceState !== "unknown") ||
    (evidenceState === "unknown" && itemState !== undefined && itemState !== "unknown");
  if (unknownContradiction) return true;

  const oppositeNegation =
    (itemState === "negative" && evidenceState === "affirmative") ||
    (itemState === "affirmative" && evidenceState === "negative");
  if (oppositeNegation) return true;

  const oppositeTime =
    (isCurrentTime(text) && isPastTime(turn.answer)) ||
    (isPastTime(text) && isCurrentTime(turn.answer));
  if (oppositeTime) return true;

  const itemSubject = subjectGroup(text);
  const evidenceSubject = subjectGroup(turn.answer);
  return Boolean(itemSubject && evidenceSubject && itemSubject !== evidenceSubject);
}

function sourceTurnsFor(
  item: InterviewSummaryItem,
  turnsById: ReadonlyMap<string, EvidenceSourceTurn>,
): EvidenceSourceTurn[] | undefined {
  const sourceTurns = item.evidenceTurnIds.map((id) => turnsById.get(id));
  const existingTurns = sourceTurns.filter(
    (turn): turn is EvidenceSourceTurn => turn !== undefined,
  );
  if (existingTurns.length !== sourceTurns.length) return undefined;
  return existingTurns;
}

function answerEvidenceText(turns: readonly EvidenceSourceTurn[]): string {
  return turns.map((turn) => turn.answer).join("\n");
}

function hasUnsupportedAnswerFact(
  text: string,
  turns: readonly EvidenceSourceTurn[],
): boolean {
  const answers = answerEvidenceText(turns);
  if (hasLiteralMismatch(text, answers)) return true;

  const relevantTurns = turns.filter((turn) =>
    sharesTopic(text, `${turn.question}\n${turn.answer}`),
  );
  if (
    isCurrentTime(text) &&
    !relevantTurns.some((turn) =>
      isCurrentTime(turn.answer) || isPastTime(turn.answer),
    )
  ) {
    return true;
  }
  if (
    isPastTime(text) &&
    !relevantTurns.some((turn) =>
      isPastTime(turn.answer) || isCurrentTime(turn.answer),
    )
  ) {
    return true;
  }

  const itemSubject = subjectGroup(text);
  if (
    itemSubject &&
    !relevantTurns.some((turn) => subjectGroup(turn.answer) !== undefined)
  ) {
    return true;
  }

  const itemState = responseState(text);
  return Boolean(
    itemState &&
      !relevantTurns.some((turn) => responseState(turn.answer) !== undefined),
  );
}

export function classifyItem(
  item: InterviewSummaryItem,
  turns: readonly EvidenceSourceTurn[],
): EvidenceItemClassification {
  const sourceTurns = sourceTurnsFor(
    item,
    new Map(turns.map((turn) => [turn.id, turn])),
  );
  if (
    sourceTurns === undefined ||
    hasUnsupportedAnswerFact(item.text, sourceTurns)
  ) {
    return "reject";
  }
  return sourceTurns.some((turn) =>
    hasExplicitContradiction(item.text, turn),
  )
    ? "verification"
    : "accepted";
}

function cloneItem(item: InterviewSummaryItem): InterviewSummaryItem {
  return {
    ...item,
    evidenceTurnIds: Array.from(new Set(item.evidenceTurnIds)),
  };
}

export function validateSummaryEvidence(
  summary: InterviewSummary,
  turns: readonly EvidenceSourceTurn[],
): EvidenceValidationResult {
  const result: InterviewSummary = {
    subjective: [],
    objective: [],
    verificationNeeded: [],
  };
  const turnsById = new Map(turns.map((turn) => [turn.id, turn]));
  const seenItemIds = new Set<string>();
  const rejectedItemIds: string[] = [];

  for (const section of SUMMARY_SECTIONS) {
    for (const sourceItem of summary[section]) {
      if (seenItemIds.has(sourceItem.id)) {
        rejectedItemIds.push(sourceItem.id);
        continue;
      }
      seenItemIds.add(sourceItem.id);

      const item = cloneItem(sourceItem);
      const sourceTurns = sourceTurnsFor(item, turnsById);
      if (
        sourceTurns === undefined ||
        hasUnsupportedAnswerFact(item.text, sourceTurns)
      ) {
        rejectedItemIds.push(item.id);
        continue;
      }

      if (
        sourceTurns.some((turn) =>
          hasExplicitContradiction(item.text, turn),
        )
      ) {
        result.verificationNeeded.push(item);
        continue;
      }
      result[section].push(item);
    }
  }

  return {
    summary: result,
    rejectedItemIds,
    usedFallback: SUMMARY_SECTIONS.every((section) => result[section].length === 0),
  };
}
