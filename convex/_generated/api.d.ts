/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assignmentFunctions from "../assignmentFunctions.js";
import type * as blueBook from "../blueBook.js";
import type * as communityLots from "../communityLots.js";
import type * as contractRates from "../contractRates.js";
import type * as invoicing from "../invoicing.js";
import type * as jobRequests from "../jobRequests.js";
import type * as mutations from "../mutations.js";
import type * as queries from "../queries.js";
import type * as seedHelpers from "../seedHelpers.js";
import type * as userFunctions from "../userFunctions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assignmentFunctions: typeof assignmentFunctions;
  blueBook: typeof blueBook;
  communityLots: typeof communityLots;
  contractRates: typeof contractRates;
  invoicing: typeof invoicing;
  jobRequests: typeof jobRequests;
  mutations: typeof mutations;
  queries: typeof queries;
  seedHelpers: typeof seedHelpers;
  userFunctions: typeof userFunctions;
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

export declare const components: {};
