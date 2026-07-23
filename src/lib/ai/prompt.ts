export type AiPromptKind = "question" | "summary";

const SYNTHETIC_PERSONA_POLICIES: Record<AiPromptKind, readonly string[]> = {
  question: [
    "합성 Persona 역할극의 문진 질문만 생성한다.",
    "진단이나 치료 지시를 생성하지 않는다.",
    "version 1 JSON 계약만 반환한다.",
  ],
  summary: [
    "확정된 대화 근거만 요약한다.",
    "진단이나 치료 지시를 생성하지 않는다.",
    "각 항목에 근거 turn ID를 포함한다.",
  ],
};

const PUBLIC_INTERVIEW_POLICIES: Record<AiPromptKind, readonly string[]> = {
  question: [
    "공개 문진 보조 질문만 생성한다.",
    "한 문장, 한 의도, 쉬운 한국어로 질문한다.",
    "진단, 치료, 복약 지시를 생성하지 않는다.",
    "version 2 JSON 계약만 반환한다.",
  ],
  summary: [
    "공개 문진 답변의 근거만 요약한다.",
    "진단, 치료, 복약 지시를 생성하지 않는다.",
    "각 항목에 근거 turn ID를 포함한다.",
    "근거 원문의 수치, 날짜, 시간, 단위를 보존한다.",
  ],
};

export function getPromptPolicy(
  kind: AiPromptKind,
  version: "1" | "2",
): readonly string[] {
  if (version === "1") return SYNTHETIC_PERSONA_POLICIES[kind];
  if (version === "2") return PUBLIC_INTERVIEW_POLICIES[kind];
  throw new Error("Unsupported AI contract version");
}
