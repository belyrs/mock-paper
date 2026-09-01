import { inspect } from "node:util";
import { env } from "./env";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const activeLevel: LogLevel = env.NODE_ENV === "production" ? "info" : "debug";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...Object.fromEntries(
      Object.entries(error as unknown as Record<string, unknown>).filter(
        ([key]) => !["name", "message", "stack"].includes(key),
      ),
    ),
  };
}

function normalizePayload(payload: unknown): unknown {
  if (payload instanceof Error) {
    return serializeError(payload);
  }

  if (Array.isArray(payload)) {
    return payload.map((entry) => normalizePayload(entry));
  }

  if (isRecord(payload)) {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        key === "err" && value instanceof Error ? serializeError(value) : normalizePayload(value),
      ]),
    );
  }

  return payload;
}

function indentMultiline(value: string) {
  return value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function resolveLogArguments(
  payloadOrMessage: unknown,
  maybeMessage?: string,
): { message: string; payload?: unknown } {
  if (typeof payloadOrMessage === "string" && maybeMessage == null) {
    return { message: payloadOrMessage };
  }

  if (typeof maybeMessage === "string") {
    return { message: maybeMessage, payload: payloadOrMessage };
  }

  return { message: "Log entry", payload: payloadOrMessage };
}

function emit(level: LogLevel, payloadOrMessage: unknown, maybeMessage?: string) {
  if (levelWeight[level] < levelWeight[activeLevel]) {
    return;
  }

  const { message, payload } = resolveLogArguments(payloadOrMessage, maybeMessage);
  const lines = [`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`];

  if (payload !== undefined) {
    lines.push(
      indentMultiline(
        inspect(normalizePayload(payload), {
          depth: 8,
          colors: false,
          compact: false,
          breakLength: 120,
        }),
      ),
    );
  }

  process.stdout.write(`${lines.join("\n")}\n\n`);
}

export const logger = {
  debug(payloadOrMessage: unknown, maybeMessage?: string) {
    emit("debug", payloadOrMessage, maybeMessage);
  },
  info(payloadOrMessage: unknown, maybeMessage?: string) {
    emit("info", payloadOrMessage, maybeMessage);
  },
  warn(payloadOrMessage: unknown, maybeMessage?: string) {
    emit("warn", payloadOrMessage, maybeMessage);
  },
  error(payloadOrMessage: unknown, maybeMessage?: string) {
    emit("error", payloadOrMessage, maybeMessage);
  },
};
