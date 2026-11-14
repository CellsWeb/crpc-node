import { Type } from "@sinclair/typebox";

export const inputSchema = Type.Object({ id: Type.String() });
export const outputSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  category: Type.String(),
  price: Type.Number(),
  tags: Type.Array(Type.String()),
  createdAt: Type.String(),
});
export const metadata = { description: "Get item by ID" };
