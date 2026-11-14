import { Type } from "@sinclair/typebox";

export const metadata = {
  name: "rateLimit",
  description: "Sliding window rate limiter middleware",
};

export const optionsSchema = Type.Object({
  max: Type.Optional(Type.Number({ default: 100 })),
});

export const headersSchema = Type.Object({});
