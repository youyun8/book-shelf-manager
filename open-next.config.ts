import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The app is fully dynamic and per-user authenticated, so there is nothing worth
// persisting in an incremental cache. Keeping the default in-worker cache avoids
// requiring an extra R2 bucket just for ISR data. See DECISIONS.md.
export default defineCloudflareConfig();
