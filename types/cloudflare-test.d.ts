/// <reference types="@cloudflare/vitest-pool-workers/types" />

import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
  namespace Cloudflare {
    interface Env {
      /** Injected by vitest.config.mts so tests/setup.ts can migrate the D1 database. */
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
