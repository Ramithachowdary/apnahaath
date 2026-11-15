/**
 * Data access layer. Every query is parameterised and every household-owned read or write is scoped
 * by household id. Modules are grouped by table; import from "@/lib/db" rather than a submodule.
 */
export { batch, query, type Arg, type Stmt } from "./driver";
export * from "./users";
export * from "./households";
export * from "./medicines";
export * from "./events";
export * from "./cards";
