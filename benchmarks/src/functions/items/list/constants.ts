import { Type } from "@sinclair/typebox";

export const inputSchema = Type.Object({
  limit: Type.Optional(Type.Number({ default: 20 })),
});

export const outputSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      id: Type.String(),
      title: Type.String(),
      category: Type.String(),
      price: Type.Number(),
      tags: Type.Array(Type.String()),
      createdAt: Type.String(),
    }),
  ),
  total: Type.Number(),
});

export const metadata = { description: "List items with pagination" };
