import {
  createRecordDetailViewModel,
  createRecordListViewModels,
  type RecordDetailViewModel,
  type RecordListItemViewModel,
} from "./records-view-model";
import { openMedicalInterviewDatabase } from "@/lib/db/database";
import { hasMedicalInterviewDatabase } from "@/lib/db/database-presence";
import { ConsentRequiredError } from "@/lib/db/errors";
import { createRecordsRepository } from "@/lib/db/records-repository";

export type RecordsListState =
  | { status: "ready"; records: RecordListItemViewModel[] }
  | { status: "missing" }
  | { status: "error" };

export type RecordDetailState =
  | { status: "ready"; record: RecordDetailViewModel }
  | { status: "missing-database" }
  | { status: "not-found" }
  | { status: "corrupt" }
  | { status: "error" };

export async function loadRecordsList(
  now: Date = new Date(),
): Promise<RecordsListState> {
  let database: IDBDatabase | undefined;

  try {
    if (!(await hasMedicalInterviewDatabase())) {
      return { status: "missing" };
    }

    database = await openMedicalInterviewDatabase();
    const items = await createRecordsRepository(database).list();
    return {
      status: "ready",
      records: createRecordListViewModels(items, now),
    };
  } catch (error) {
    if (error instanceof ConsentRequiredError) {
      return { status: "missing" };
    }
    return { status: "error" };
  } finally {
    database?.close();
  }
}

export async function loadRecordDetail(
  interviewId: string,
  now: Date = new Date(),
): Promise<RecordDetailState> {
  let database: IDBDatabase | undefined;

  try {
    if (!(await hasMedicalInterviewDatabase())) {
      return { status: "missing-database" };
    }

    database = await openMedicalInterviewDatabase();
    const aggregate = await createRecordsRepository(database).load(interviewId);
    if (!aggregate) return { status: "not-found" };
    return createRecordDetailViewModel(aggregate, now);
  } catch (error) {
    if (error instanceof ConsentRequiredError) {
      return { status: "missing-database" };
    }
    return { status: "error" };
  } finally {
    database?.close();
  }
}
