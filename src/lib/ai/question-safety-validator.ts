import type { InterviewQuestion } from "@/features/interview/model/interview-domain.types";

export type QuestionSafetyReason =
  | "not-a-question"
  | "multiple-sentences"
  | "multiple-questions"
  | "duplicate-question"
  | "repeats-answer"
  | "diagnosis-or-treatment"
  | "medication-instruction"
  | "prompt-injection"
  | "structured-output"
  | "html-or-script"
  | "unsafe-option";

export type QuestionValidationResult =
  | { status: "valid" }
  | { status: "invalid"; reasons: QuestionSafetyReason[] };

const OPTION_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/u;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)/iu;
const HTML_OR_SCRIPT_PATTERN = /<\/?[a-z][^>]*>|\bon[a-z]+\s*=/iu;
const PROMPT_INJECTION_PATTERN = /(?:(?:시스템|개발자)\s*(?:프롬프트|지시|명령).{0,40}(?:무시|보여|따르|공개)|(?:이전|위)\s*(?:지시|명령).{0,40}(?:무시|보여|따르|공개).{0,40}(?:시스템|개발자|프롬프트)|\b(?:ignore\s+(?:previous|all)\s+(?:instructions?|prompts?)|reveal\s+(?:the\s+)?system\s+prompt)\b)/iu;
const DIAGNOSIS_OR_TREATMENT_PATTERN = /(?:진단(?:은|이|됩니다|해요)|확실(?:하니|합니다|해요)|치료(?:를|가|는)?\s*(?:받|하|시|해)|(?:휴식|쉬)(?:을)?\s*하세요|병원(?:에)?\s*가세요|검사(?:를)?\s*받으세요)/u;
const MEDICATION_INSTRUCTION_PATTERN = /(?:약|약물|복약|복용).{0,32}(?:\d+\s*알|더\s*드시|드세요|복용하세요|중단하세요|용량(?:을)?\s*(?:늘리|줄이|바꾸)|늘리세요|줄이세요)/u;
const QUESTION_JOINER_PATTERN = /(?:그리고|또한|또는|및)\s+(?:언제|어디|어떤|얼마나|무엇|누구|왜|어떻게)/u;
const QUESTION_MARK_PATTERN = /[?？]\s*$/u;
const INTERROGATIVE_ENDING_PATTERN = /(?:나요|가요|까요|인가요|한가요|했나요|있나요|없나요|습니까|합니까|입니까)\s*[.!]?\s*$/u;
const ANSWER_REQUEST_PATTERN = /(?:알려|말해|적어|선택해|답해|설명해)\s*주세요\s*[.!]?\s*$/u;

function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
}

function unsafeTextReason(value: string):
  | "prompt-injection"
  | "structured-output"
  | "html-or-script"
  | undefined {
  const trimmed = value.trim();
  if (
    CONTROL_CHARACTER_PATTERN.test(value) ||
    URL_PATTERN.test(value) ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    value.includes("```")
  ) {
    return "structured-output";
  }
  if (HTML_OR_SCRIPT_PATTERN.test(value)) return "html-or-script";
  if (PROMPT_INJECTION_PATTERN.test(value)) return "prompt-injection";
  return undefined;
}

function hasMedicalInstruction(value: string): boolean {
  return (
    DIAGNOSIS_OR_TREATMENT_PATTERN.test(value) ||
    MEDICATION_INSTRUCTION_PATTERN.test(value)
  );
}

function hasUnsafeOptions(options: InterviewQuestion["options"]): boolean {
  const optionIds = new Set<string>();
  const optionLabels = new Set<string>();

  return options.some((option) => {
    if (
      option === null ||
      typeof option !== "object" ||
      Object.keys(option).some((key) => key !== "id" && key !== "label") ||
      typeof option.id !== "string" ||
      typeof option.label !== "string" ||
      !OPTION_ID_PATTERN.test(option.id) ||
      option.label.trim().length === 0 ||
      option.label.length > 120 ||
      unsafeTextReason(option.id) !== undefined ||
      unsafeTextReason(option.label) !== undefined ||
      hasMedicalInstruction(option.label)
    ) {
      return true;
    }

    const normalizedId = option.id.toLocaleLowerCase("en-US");
    const normalizedLabel = normalizeText(option.label);
    if (optionIds.has(normalizedId) || optionLabels.has(normalizedLabel)) {
      return true;
    }
    optionIds.add(normalizedId);
    optionLabels.add(normalizedLabel);
    return false;
  });
}

export function validateGeneratedQuestion(
  question: InterviewQuestion,
  previousQuestions: readonly string[],
  previousAnswers: readonly string[] = [],
): QuestionValidationResult {
  const reasons = new Set<QuestionSafetyReason>();
  const text = question.text.normalize("NFKC");
  const sentenceCount = text.match(/[.!?]+/gu)?.length ?? 0;
  const questionCount = text.match(/\?/gu)?.length ?? 0;

  if (
    !QUESTION_MARK_PATTERN.test(text) &&
    !INTERROGATIVE_ENDING_PATTERN.test(text) &&
    !ANSWER_REQUEST_PATTERN.test(text)
  ) {
    reasons.add("not-a-question");
  }
  if (sentenceCount > 1) reasons.add("multiple-sentences");
  if (questionCount > 1 || QUESTION_JOINER_PATTERN.test(text)) {
    reasons.add("multiple-questions");
  }
  if (
    previousQuestions.some(
      (previousQuestion) => normalizeText(previousQuestion) === normalizeText(text),
    )
  ) {
    reasons.add("duplicate-question");
  }
  if (
    previousAnswers.some(
      (previousAnswer) => normalizeText(previousAnswer) === normalizeText(text),
    )
  ) {
    reasons.add("repeats-answer");
  }
  if (DIAGNOSIS_OR_TREATMENT_PATTERN.test(text)) {
    reasons.add("diagnosis-or-treatment");
  }
  if (MEDICATION_INSTRUCTION_PATTERN.test(text)) {
    reasons.add("medication-instruction");
  }

  const textSafetyReason = unsafeTextReason(text);
  if (textSafetyReason) reasons.add(textSafetyReason);
  if (hasUnsafeOptions(question.options)) reasons.add("unsafe-option");

  return reasons.size === 0
    ? { status: "valid" }
    : { status: "invalid", reasons: [...reasons] };
}
