import { Type } from "@sinclair/typebox";

export type UserRole = "user" | "admin" | "staff" | "vendor" | "dev";

export const metadata = {
  name: "auth",
  description: "Validates bearer token and enforces role-based access control",
};

export const headersSchema = Type.Object({
  authorization: Type.Optional(Type.String({ description: "Bearer JWT token for authentication" })),
  token: Type.Optional(Type.String({ description: "Alternative token header" })),
});

export const optionsSchema = Type.Object({
  roles: Type.Optional(
    Type.Array(
      Type.Union([
        Type.Literal("user"),
        Type.Literal("admin"),
        Type.Literal("vendor"),
        Type.Literal("staff"),
        Type.Literal("dev"),
      ]),
      { description: "Allowed user roles for this endpoint" },
    ),
  ),
});

export const outputSchema = Type.Object({
  userId: Type.String(),
  role: Type.Union([
    Type.Literal("user"),
    Type.Literal("admin"),
    Type.Literal("vendor"),
    Type.Literal("staff"),
    Type.Literal("dev"),
  ]),
  user: Type.Record(Type.String(), Type.Unknown()),
});
