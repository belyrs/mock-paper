"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = normalizeText;
exports.hashNormalizedText = hashNormalizedText;
exports.normalizeTopicKey = normalizeTopicKey;
exports.normalizeStructuralText = normalizeStructuralText;
exports.hashStructuralText = hashStructuralText;
exports.jaccardSimilarity = jaccardSimilarity;
exports.structuralSimilarity = structuralSimilarity;
exports.cosineSimilarity = cosineSimilarity;
const node_crypto_1 = __importDefault(require("node:crypto"));
const STRUCTURAL_STOPWORDS = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "at",
    "for",
    "it",
    "do",
    "if",
    "then",
    "which",
    "what",
    "what",
    "when",
    "where",
    "while",
    "using",
    "following",
    "statement",
    "statements",
    "correct",
    "incorrect",
    "option",
    "options",
    "choose",
    "select",
    "find",
    "determine",
    "identify",
    "calculate",
    "value",
    "values",
    "given",
    "consider",
    "shown",
    "below",
    "above",
    "respectively",
    "possible",
    "physically",
    "meaningful",
    "quantity",
    "quantities",
    "body",
    "object",
    "particle",
    "block",
    "ball",
    "car",
    "train",
    "gas",
    "system",
    "mov",
    "travel",
    "travell",
    "cover",
    "surround",
    "toward",
    "from",
]);
function stemStructuralToken(token) {
    if (token === "num" || token === "var") {
        return token;
    }
    return token
        .replace(/ies$/u, "y")
        .replace(/(ing|ed|es|s)$/u, "")
        .trim();
}
function structuralTokens(value) {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gu, " num ")
        .replace(/\b[a-z]\b/gu, " var ")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .map((token) => stemStructuralToken(token))
        .filter((token) => token && !STRUCTURAL_STOPWORDS.has(token));
}
function normalizeText(value) {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/,/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function hashNormalizedText(value) {
    return node_crypto_1.default.createHash("sha256").update(normalizeText(value)).digest("hex");
}
function normalizeTopicKey(value) {
    return normalizeText(value);
}
function normalizeStructuralText(value) {
    return structuralTokens(value).join(" ");
}
function hashStructuralText(value) {
    return node_crypto_1.default.createHash("sha256").update(normalizeStructuralText(value)).digest("hex");
}
function jaccardSimilarity(left, right) {
    const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean));
    const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean));
    if (leftTokens.size === 0 && rightTokens.size === 0)
        return 1;
    if (leftTokens.size === 0 || rightTokens.size === 0)
        return 0;
    let intersection = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token))
            intersection += 1;
    }
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union === 0 ? 0 : intersection / union;
}
function structuralSimilarity(left, right) {
    const leftTokens = new Set(structuralTokens(left));
    const rightTokens = new Set(structuralTokens(right));
    if (leftTokens.size === 0 && rightTokens.size === 0)
        return 1;
    if (leftTokens.size === 0 || rightTokens.size === 0)
        return 0;
    let intersection = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) {
            intersection += 1;
        }
    }
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union === 0 ? 0 : intersection / union;
}
function cosineSimilarity(left, right) {
    if (left.length === 0 || right.length === 0 || left.length !== right.length)
        return 0;
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
        const leftValue = left[index] ?? 0;
        const rightValue = right[index] ?? 0;
        dot += leftValue * rightValue;
        leftNorm += leftValue * leftValue;
        rightNorm += rightValue * rightValue;
    }
    if (leftNorm === 0 || rightNorm === 0)
        return 0;
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}
//# sourceMappingURL=normalization.js.map