import "fake-indexeddb/auto";

import { afterEach } from "vitest";

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("koddi-ud-eum");
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("테스트 데이터베이스 삭제가 차단됐습니다."));
    request.onsuccess = () => resolve();
  });
});
