"use client";

import { useState } from "react";

import {
  createFixtureInterviewCommands,
} from "./fixture-interview-commands";
import type { InterviewFixtureId } from "./fixtures/fixture.types";
import { createHttpInterviewCommands } from "./http-interview-commands";
import type { InterviewCommandsPort } from "./interview-commands";
import { InterviewScreen } from "./interview-screen";
import type { InterviewViewModel } from "./model/interview-ui.types";
import { useInterviewController } from "./use-interview-controller";

type InterviewControllerScreenProps = {
  commands: InterviewCommandsPort;
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

type InterviewRouteScreenProps =
  | {
      fixtureId: InterviewFixtureId;
      initialModel: InterviewViewModel;
      mode: "fixture";
    }
  | {
      initialModel: InterviewViewModel;
      mode: "demo";
    };

export function InterviewRouteScreen(props: InterviewRouteScreenProps) {
  const [commands] = useState<InterviewCommandsPort>(() =>
    props.mode === "fixture"
      ? createFixtureInterviewCommands(props.fixtureId)
      : createHttpInterviewCommands({
          interviewId: props.initialModel.interviewId,
          personaId: props.initialModel.personaId,
        }),
  );
  return (
    <InterviewControllerScreen
      commands={commands}
      initialModel={props.initialModel}
    />
  );
}
