/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as backfill from "../backfill.js";
import type * as credits from "../credits.js";
import type * as email from "../email.js";
import type * as guides from "../guides.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as onboarding from "../onboarding.js";
import type * as polar from "../polar.js";
import type * as polarEvents from "../polarEvents.js";
import type * as questionnaires from "../questionnaires.js";
import type * as sessions from "../sessions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  backfill: typeof backfill;
  credits: typeof credits;
  email: typeof email;
  guides: typeof guides;
  http: typeof http;
  messages: typeof messages;
  onboarding: typeof onboarding;
  polar: typeof polar;
  polarEvents: typeof polarEvents;
  questionnaires: typeof questionnaires;
  sessions: typeof sessions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
