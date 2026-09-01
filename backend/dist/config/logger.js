"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const node_util_1 = require("node:util");
const env_1 = require("./env");
const levelWeight = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
const activeLevel = env_1.env.NODE_ENV === "production" ? "info" : "debug";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function serializeError(error) {
    return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...Object.fromEntries(Object.entries(error).filter(([key]) => !["name", "message", "stack"].includes(key))),
    };
}
function normalizePayload(payload) {
    if (payload instanceof Error) {
        return serializeError(payload);
    }
    if (Array.isArray(payload)) {
        return payload.map((entry) => normalizePayload(entry));
    }
    if (isRecord(payload)) {
        return Object.fromEntries(Object.entries(payload).map(([key, value]) => [
            key,
            key === "err" && value instanceof Error ? serializeError(value) : normalizePayload(value),
        ]));
    }
    return payload;
}
function indentMultiline(value) {
    return value
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n");
}
function resolveLogArguments(payloadOrMessage, maybeMessage) {
    if (typeof payloadOrMessage === "string" && maybeMessage == null) {
        return { message: payloadOrMessage };
    }
    if (typeof maybeMessage === "string") {
        return { message: maybeMessage, payload: payloadOrMessage };
    }
    return { message: "Log entry", payload: payloadOrMessage };
}
function emit(level, payloadOrMessage, maybeMessage) {
    if (levelWeight[level] < levelWeight[activeLevel]) {
        return;
    }
    const { message, payload } = resolveLogArguments(payloadOrMessage, maybeMessage);
    const lines = [`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`];
    if (payload !== undefined) {
        lines.push(indentMultiline((0, node_util_1.inspect)(normalizePayload(payload), {
            depth: 8,
            colors: false,
            compact: false,
            breakLength: 120,
        })));
    }
    process.stdout.write(`${lines.join("\n")}\n\n`);
}
exports.logger = {
    debug(payloadOrMessage, maybeMessage) {
        emit("debug", payloadOrMessage, maybeMessage);
    },
    info(payloadOrMessage, maybeMessage) {
        emit("info", payloadOrMessage, maybeMessage);
    },
    warn(payloadOrMessage, maybeMessage) {
        emit("warn", payloadOrMessage, maybeMessage);
    },
    error(payloadOrMessage, maybeMessage) {
        emit("error", payloadOrMessage, maybeMessage);
    },
};
//# sourceMappingURL=logger.js.map