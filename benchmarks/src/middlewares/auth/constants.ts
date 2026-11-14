import { Type } from "@sinclair/typebox";

export const metadata = {
  name: "auth",
  description: "Validates Bearer authorization header",
};

export const headersSchema = Type.Object({
  authorization: Type.String({ description: "Bearer secret_token_123" }),
});

export const optionsSchema = Type.Object({});
