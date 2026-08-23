"use client";

import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client. The base URL is left unset so requests go to the
 * same origin the page was served from, which is what Workers routes give us.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});

export const { signIn, signOut, useSession } = authClient;
