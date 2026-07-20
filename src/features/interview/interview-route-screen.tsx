"use client";

import { useState } from "react";

import {
  createFixtureInterviewCommands,
  type FixtureInterviewCommands,
} from "./fixture-interview-commands";
import type { InterviewFixtureId } from "./fixtures/fixture.types";
import { InterviewScreen } from "./interview-screen";
import type { InterviewViewModel } from "./model/interview-ui.types";
import { useInterviewController } from "./use-interview-controller";

type InterviewControllerScreenProps = {
  commands: FixtureInterviewCommands;
  initialModel: InterviewViewModel;
};

export function InterviewControllerScreen({
  commands,
  initialModel,
}: InterviewControllerScreenProps) {
  const controller = useInterviewController(initialModel, commands);
  return (
    <InterviewScreen
      actions={controller.actions}
      commands={controller.screenCommands}
      initialModel={controller.model}
      key={controller.model.question?.id ?? `state-${controller.model.state}`}
      showSavingStatus={controller.showSavingStatus}
    />
  );
}

type InterviewRouteScreenProps = {
  fixtureId: InterviewFixtureId;
  initialModel: InterviewViewModel;
};

export function InterviewRouteScreen({
  fixtureId,
  initialModel,
}: InterviewRouteScreenProps) {
  const [commands] = useState(() => createFixtureInterviewCommands(fixtureId));
  return (
    <InterviewControllerScreen commands={commands} initialModel={initialModel} />
  );
}
