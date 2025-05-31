// @ts-nocheck -- Will remove when builder is published
import { build } from "@jsandy/builder";

build("src/index.ts", ["hono", "superjson", "zod"]);
