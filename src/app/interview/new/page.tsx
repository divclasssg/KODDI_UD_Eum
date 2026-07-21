import { notFound } from "next/navigation";

import { DevicePreview } from "@/features/interview/components/device-preview";
import {
  createDemoInterviewModel,
  INTERVIEW_FIXTURES,
  resolveDemoPersonaId,
} from "@/features/interview/fixtures/fixture-registry";
import { resolveFixtureId } from "@/features/interview/fixtures/resolve-fixture";
import { InterviewRouteScreen } from "@/features/interview/interview-route-screen";

import styles from "./page.module.scss";

type InterviewPageProps = {
  searchParams: Promise<{
    fixture?: string | string[];
    persona?: string | string[];
  }>;
};

export default async function InterviewPage({
  searchParams,
}: InterviewPageProps) {
  const { fixture: rawFixture, persona: rawPersona } = await searchParams;
  const fixtureEnabled = process.env.INTERVIEW_FIXTURE_MODE === "1";
  const resolvedFixture =
    rawFixture === undefined
      ? undefined
      : resolveFixtureId(rawFixture, fixtureEnabled);
  const resolvedPersona = resolveDemoPersonaId(rawPersona);

  if (
    (resolvedFixture && !resolvedFixture.ok) ||
    !resolvedPersona.ok
  ) {
    notFound();
  }

  const fixture = resolvedFixture?.ok
    ? INTERVIEW_FIXTURES[resolvedFixture.id]
    : undefined;
  const initialModel = fixture
    ? fixture.model
    : createDemoInterviewModel(resolvedPersona.id);

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <DevicePreview>
          {fixture ? (
            <InterviewRouteScreen
              fixtureId={fixture.id}
              initialModel={initialModel}
              key={fixture.id}
              mode="fixture"
            />
          ) : (
            <InterviewRouteScreen
              initialModel={initialModel}
              key={initialModel.personaId}
              mode="demo"
            />
          )}
        </DevicePreview>
      </div>
    </main>
  );
}
