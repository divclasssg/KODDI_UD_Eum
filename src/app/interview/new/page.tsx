import { notFound } from "next/navigation";

import { DevicePreview } from "@/features/interview/components/device-preview";
import { INTERVIEW_FIXTURES } from "@/features/interview/fixtures/fixture-registry";
import { resolveFixtureId } from "@/features/interview/fixtures/resolve-fixture";
import { InterviewRouteScreen } from "@/features/interview/interview-route-screen";

import styles from "./page.module.scss";

type InterviewPageProps = {
  searchParams: Promise<{ fixture?: string | string[] }>;
};

export default async function InterviewPage({
  searchParams,
}: InterviewPageProps) {
  const { fixture: rawFixture } = await searchParams;
  const fixtureEnabled = process.env.INTERVIEW_FIXTURE_MODE === "1";
  const resolved =
    rawFixture === undefined
      ? undefined
      : resolveFixtureId(rawFixture, fixtureEnabled);

  if (resolved && !resolved.ok) notFound();

  const fixture = resolved?.ok
    ? INTERVIEW_FIXTURES[resolved.id]
    : INTERVIEW_FIXTURES["answering-default"];

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <DevicePreview>
          <InterviewRouteScreen
            fixtureId={fixture.id}
            initialModel={fixture.model}
            key={fixture.id}
          />
        </DevicePreview>
      </div>
    </main>
  );
}
