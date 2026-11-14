import { Type } from "@sinclair/typebox";

export const inputSchema = Type.Object({});
export const outputSchema = Type.Object({ pong: Type.Boolean() });
export const metadata = { description: "Ping baseline benchmark" };
