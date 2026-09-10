"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.containsInternalTechnologyReference = containsInternalTechnologyReference;
exports.redactInternalTechnologyReferences = redactInternalTechnologyReferences;
const INTERNAL_TECHNOLOGY_PATTERN = new RegExp([
    "\\bAI\\b",
    "\\bartificial intelligence\\b",
    "\\bOpenAI\\b",
    "\\bAzure OpenAI\\b",
    "\\bChatGPT\\b",
    "\\bCodex\\b",
    "\\bGPT(?:[- .]?[A-Za-z0-9.]+)?\\b",
    "\\bLLMs?\\b",
    "\\b(?:large )?language models?\\b",
    "\\bAnthropic\\b",
    "\\bClaude\\b",
    "\\bGoogle AI\\b",
    "\\bGemini\\b",
    "\\bMistral\\b",
    "\\bCohere\\b",
    "\\bPerplexity\\b",
    "\\bLlama\\b",
    "\\bDeepSeek\\b",
    "\\bAmazon Bedrock\\b",
    "\\bAWS Bedrock\\b",
    "\\bGroq\\b",
    "\\bGrok\\b",
    "\\bxAI\\b",
    "\\bHugging Face\\b",
    "\\bTogether AI\\b",
    "\\bReplicate\\b",
    "\\bmodel[- ]knowledge\\b",
    "\\bmodel (?:output|response|version)\\b",
    "\\bprompt(?: version)?\\b",
    "\\bprovider\\b",
    "\\bembeddings?\\b",
    "\\bcompletion tokens?\\b",
    "\\btoken (?:count|limit|usage)\\b",
    "\\bAPI (?:key|request|response|quota)\\b",
].join("|"), "i");
const INTERNAL_TECHNOLOGY_REPLACEMENT_PATTERN = new RegExp(INTERNAL_TECHNOLOGY_PATTERN.source, "gi");
function containsInternalTechnologyReference(value) {
    return INTERNAL_TECHNOLOGY_PATTERN.test(value);
}
function redactInternalTechnologyReferences(value) {
    return value
        .replace(INTERNAL_TECHNOLOGY_REPLACEMENT_PATTERN, "question-paper platform")
        .replace(/\bquestion-paper platform\s+(?:model|provider|service|system|response|request|prompt)\b/gi, "question-paper platform");
}
//# sourceMappingURL=public-content.js.map