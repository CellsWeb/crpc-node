import { Type } from "@sinclair/typebox";

export const inputSchema = Type.Object({
  email: Type.String(),
  password: Type.String({ minLength: 8 }),
});

export const outputSchema = Type.Object({
  token: Type.String(),
  userId: Type.String(),
  expiresAt: Type.Number(),
});

export const metadata = { description: "Authenticate user and issue JWT" };
