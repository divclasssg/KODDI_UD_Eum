export class DatabaseOpenError extends Error {
  constructor(options?: ErrorOptions) {
    super("로컬 데이터베이스를 열지 못했습니다.", options);
    this.name = "DatabaseOpenError";
  }
}

export class DatabaseMigrationError extends Error {
  constructor(options?: ErrorOptions) {
    super("로컬 데이터베이스를 갱신하지 못했습니다.", options);
    this.name = "DatabaseMigrationError";
  }
}

export class DatabaseUpgradeBlockedError extends Error {
  constructor() {
    super("다른 화면에서 로컬 데이터베이스를 사용하고 있어 갱신하지 못했습니다.");
    this.name = "DatabaseUpgradeBlockedError";
  }
}

export class DatabaseVersionTooNewError extends Error {
  constructor(options?: ErrorOptions) {
    super("현재 앱보다 새로운 로컬 데이터베이스입니다.", options);
    this.name = "DatabaseVersionTooNewError";
  }
}

export class ConsentRequiredError extends Error {
  constructor() {
    super("로컬 저장 동의가 필요합니다.");
    this.name = "ConsentRequiredError";
  }
}

export class InvalidUtcTimestampError extends Error {
  constructor() {
    super("UTC millisecond timestamp 형식이 아닙니다.");
    this.name = "InvalidUtcTimestampError";
  }
}

export class OnboardingTimestampMismatchError extends Error {
  constructor() {
    super("온보딩 완료 record의 timestamp가 서로 다릅니다.");
    this.name = "OnboardingTimestampMismatchError";
  }
}

export class RevisionConflictError extends Error {
  constructor() {
    super("문진 revision이 현재 상태와 다릅니다.");
    this.name = "RevisionConflictError";
  }
}

export class InterviewNotFoundError extends Error {
  constructor() {
    super("문진을 찾을 수 없습니다.");
    this.name = "InterviewNotFoundError";
  }
}

export class ImmutableInterviewError extends Error {
  constructor() {
    super("완료되거나 안전 종료된 문진은 변경할 수 없습니다.");
    this.name = "ImmutableInterviewError";
  }
}

export class DatabaseCorruptionError extends Error {
  constructor() {
    super("저장된 문진 데이터의 revision 또는 순서가 올바르지 않습니다.");
    this.name = "DatabaseCorruptionError";
  }
}
