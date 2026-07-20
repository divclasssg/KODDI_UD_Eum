export type AiPromptKind = "question" | "summary";

const PROMPT_POLICIES: Record<AiPromptKind, readonly string[]> = {
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

export function getPromptPolicy(kind: AiPromptKind): readonly string[] {
  return PROMPT_POLICIES[kind];
}
