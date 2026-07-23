import { AiInterviewScreenWithRouter } from "@/features/interview/ai/ai-interview-screen";
import { parsePublicAiMaximumFollowUps } from "@/features/interview/ai/public-ai-config";

export default function AiInterviewPage() {
  const maximumFollowUps = parsePublicAiMaximumFollowUps(
    process.env.PUBLIC_AI_MAX_FOLLOW_UPS,
  );
  return <AiInterviewScreenWithRouter maximumFollowUps={maximumFollowUps} />;
}
