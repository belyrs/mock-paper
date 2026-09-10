"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProviderOutput = validateProviderOutput;
exports.validateProviderCandidates = validateProviderCandidates;
const zod_1 = require("zod");
const app_error_1 = require("../../errors/app-error");
const domain_1 = require("../../constants/domain");
const difficulty_1 = require("../../utils/difficulty");
const normalization_1 = require("../../utils/normalization");
const public_content_1 = require("../../utils/public-content");
const bannedPlaceholderPatterns = [
    /\bscenario tagged\b/i,
    /\breference values?\b/i,
    /\bboundary[- ]condition lens\b/i,
    /\bstatement[- ]filtering lens\b/i,
    /\bcomparison[- ]table lens\b/i,
    /\bapplication[- ]selection lens\b/i,
    /\blab[- ]note interpretation\b/i,
    /\bcore concept transfer\b/i,
    /\bapply the core idea\b/i,
];
const OPTION_LETTERS = ["A", "B", "C", "D"];
const candidateSchema = zod_1.z.object({
    questionNumber: zod_1.z.coerce.number().int().positive(),
    difficulty: zod_1.z.enum(domain_1.DIFFICULTIES),
    questionText: zod_1.z.string().trim().min(10),
    options: zod_1.z.array(zod_1.z.string().trim().min(1)).length(4),
    correctOption: zod_1.z.enum(OPTION_LETTERS),
    conceptTested: zod_1.z.string().trim().min(1),
    commonMistake: zod_1.z.string().trim().min(1),
    recommendedRemedialAction: zod_1.z.string().trim().min(1),
    learningOutcome: zod_1.z.string().trim().min(1),
    bloomsTaxonomyLevel: zod_1.z.string().trim().min(1),
    examRelevance: zod_1.z.object({
        JEE_MAIN: zod_1.z.string().optional(),
        NEET: zod_1.z.string().optional(),
        KCET: zod_1.z.string().optional(),
        CBSE: zod_1.z.string().optional(),
    }),
    sourceReference: zod_1.z.string().trim().optional().nullable(),
    solutionOutline: zod_1.z.string().trim().min(8).optional(),
    difficultyRationale: zod_1.z.string().trim().min(8).optional(),
});
function sanitizeMaybeString(value) {
    return typeof value === "string" ? sanitizeText(value) : value;
}
function countByDifficulty(questions) {
    return questions.reduce((counts, question) => {
        counts[question.difficulty] += 1;
        return counts;
    }, { Easy: 0, Medium: 0, Hard: 0 });
}
function hasPlaceholderLeakage(texts) {
    return texts.some((text) => bannedPlaceholderPatterns.some((pattern) => pattern.test(text)));
}
function sanitizeText(value) {
    return value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}
function sanitizeOption(value) {
    return sanitizeText(value)
        .replace(/^[A-D][\)\].:-]\s*/i, "")
        .trim();
}
function normalizeDifficulty(value) {
    if (typeof value !== "string") {
        return value;
    }
    const normalized = sanitizeText(value).toLowerCase();
    if (["easy", "basic", "simple"].includes(normalized)) {
        return "Easy";
    }
    if (["medium", "moderate", "intermediate"].includes(normalized)) {
        return "Medium";
    }
    if (["hard", "challenging", "difficult", "advanced"].includes(normalized)) {
        return "Hard";
    }
    return value;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function stripLeadingQuestionMarker(value) {
    return value
        .replace(/^question\s*\d+\s*[:.)-]\s*/i, "")
        .replace(/^q\s*\.?\s*\d+\s*[:.)-]\s*/i, "")
        .replace(/^\d+\s*[:.)-]\s*/, "")
        .trim();
}
function stripInlinedOptionsFromStem(questionText, options) {
    if (options.length !== 4 || options.some((option) => option.length === 0)) {
        return questionText;
    }
    const inlinePattern = new RegExp(options
        .map((option, optionIndex) => {
        const letter = OPTION_LETTERS[optionIndex];
        const optionPattern = escapeRegExp(option).replace(/\s+/g, "\\s+");
        return `(?:\\(?${letter.toLowerCase()}\\)?|${letter})[\\)\\].:-]?\\s*${optionPattern}`;
    })
        .join("\\s*"), "i");
    return sanitizeText(questionText.replace(inlinePattern, " "));
}
function normalizeCorrectOption(value, options) {
    if (typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 4) {
        return OPTION_LETTERS[value - 1];
    }
    if (typeof value !== "string") {
        return value;
    }
    const raw = sanitizeText(value);
    const directMatch = raw.match(/^(?:correct\s*option|correct\s*answer|answer|option|choice)?\s*[:=-]?\s*[\(\[]?([A-D]|[1-4])[\)\].:-]?(?:\s+.*)?$/i);
    if (directMatch) {
        const token = directMatch[1].toUpperCase();
        if (OPTION_LETTERS.includes(token)) {
            return token;
        }
        const numeric = Number.parseInt(token, 10);
        if (numeric >= 1 && numeric <= 4) {
            return OPTION_LETTERS[numeric - 1];
        }
    }
    const normalizedRaw = (0, normalization_1.normalizeText)(sanitizeOption(raw));
    const matchedOptionIndex = options.findIndex((option) => (0, normalization_1.normalizeText)(sanitizeOption(option)) === normalizedRaw);
    if (matchedOptionIndex >= 0) {
        return OPTION_LETTERS[matchedOptionIndex];
    }
    return raw.toUpperCase();
}
function coerceExamRelevance(value) {
    if (!value || typeof value !== "object") {
        return {};
    }
    const record = value;
    const read = (key) => {
        const relevance = record[key];
        if (typeof relevance === "boolean") {
            return relevance ? "High" : "N/A";
        }
        if (typeof relevance === "number") {
            return relevance > 0 ? "High" : "N/A";
        }
        return sanitizeMaybeString(relevance);
    };
    return {
        JEE_MAIN: read("JEE_MAIN") ?? read("JEE") ?? undefined,
        NEET: read("NEET") ?? undefined,
        KCET: read("KCET") ?? undefined,
        CBSE: read("CBSE") ?? undefined,
    };
}
function coerceQuestionCandidate(rawQuestion, index) {
    if (!rawQuestion || typeof rawQuestion !== "object") {
        return rawQuestion;
    }
    const record = rawQuestion;
    const rawOptions = Array.isArray(record.options)
        ? record.options.map((option) => typeof option === "string"
            ? sanitizeOption(option)
            : String(option ?? ""))
        : [];
    const questionTextSource = record.questionText ?? record.text ?? record.stem ?? record.question;
    const sanitizedQuestionText = typeof questionTextSource === "string"
        ? stripInlinedOptionsFromStem(stripLeadingQuestionMarker(sanitizeText(questionTextSource)), rawOptions)
        : questionTextSource;
    const sourceReference = record.sourceReference ?? record.source ?? null;
    return {
        questionNumber: record.questionNumber ?? record.qNo ?? record.number ?? index + 1,
        difficulty: normalizeDifficulty(record.difficulty),
        questionText: sanitizedQuestionText,
        options: rawOptions,
        correctOption: normalizeCorrectOption(record.correctOption ?? record.correctAnswer ?? record.answer, rawOptions),
        conceptTested: sanitizeMaybeString(record.conceptTested ?? record.concept),
        commonMistake: sanitizeMaybeString(record.commonMistake),
        recommendedRemedialAction: sanitizeMaybeString(record.recommendedRemedialAction ?? record.remedialAction),
        learningOutcome: sanitizeMaybeString(record.learningOutcome),
        bloomsTaxonomyLevel: sanitizeMaybeString(record.bloomsTaxonomyLevel ?? record.bloomLevel ?? record.bloomsLevel),
        examRelevance: coerceExamRelevance(record.examRelevance),
        sourceReference: typeof sourceReference === "string"
            ? sanitizeText(sourceReference)
            : sourceReference,
        solutionOutline: sanitizeMaybeString(record.solutionOutline),
        difficultyRationale: sanitizeMaybeString(record.difficultyRationale),
    };
}
function countInlineChoiceMarkers(text) {
    return (text.match(/(?:^|\s)(?:[A-D][\).:]|\([A-D]\))\s+/gi) ?? []).length;
}
function hasEnoughTopicGrounding(question, request) {
    const keywordPool = request.syllabusContext.validationKeywords
        .map((keyword) => (0, normalization_1.normalizeText)(keyword))
        .filter((keyword) => keyword.length >= 4);
    if (keywordPool.length === 0)
        return true;
    const combined = (0, normalization_1.normalizeText)([
        question.questionText,
        question.options.join(" "),
        question.conceptTested,
        question.learningOutcome,
    ].join(" "));
    const keywordHits = keywordPool.filter((keyword) => combined.includes(keyword));
    return new Set(keywordHits).size >= 1;
}
function conceptAlignsWithGrounding(question, request) {
    const concept = (0, normalization_1.normalizeText)(question.conceptTested);
    const matchesGroundedConcept = request.syllabusContext.coreConcepts.some((allowedConcept) => {
        const normalizedAllowedConcept = (0, normalization_1.normalizeText)(allowedConcept);
        return (normalizedAllowedConcept.includes(concept) ||
            concept.includes(normalizedAllowedConcept) ||
            keywordOverlap(normalizedAllowedConcept, concept) >= 1);
    });
    if (matchesGroundedConcept) {
        return true;
    }
    const questionContext = (0, normalization_1.normalizeText)(`${question.questionText} ${question.options.join(" ")} ${concept}`);
    return request.syllabusContext.validationKeywords.some((keyword) => {
        const normalizedKeyword = (0, normalization_1.normalizeText)(keyword);
        return (normalizedKeyword.length >= 4 &&
            (concept.includes(normalizedKeyword) ||
                questionContext.includes(normalizedKeyword)));
    });
}
function hasCuratedSyllabusGrounding(request) {
    return (request.syllabusContext.canonicalMatch &&
        request.syllabusContext.entryKey !== null);
}
function keywordOverlap(left, right) {
    const leftTokens = new Set(left.split(" ").filter((token) => token.length >= 4));
    const rightTokens = new Set(right.split(" ").filter((token) => token.length >= 4));
    let hits = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) {
            hits += 1;
        }
    }
    return hits;
}
function validateProviderOutput(request, result) {
    const parsedQuestions = zod_1.z
        .array(candidateSchema)
        .safeParse(result.questions.map((question, index) => coerceQuestionCandidate(question, index)));
    if (!parsedQuestions.success) {
        throw new app_error_1.AppError(502, "INVALID_GENERATION_OUTPUT", "The generated output does not match the required schema.", parsedQuestions.error.flatten());
    }
    const questions = parsedQuestions.data;
    if (questions.length !== request.questionCount) {
        throw new app_error_1.AppError(502, "INVALID_GENERATION_COUNT", `Expected ${request.questionCount} generated question(s), received ${questions.length}.`);
    }
    const expectedMix = request.difficultyCounts ??
        (0, difficulty_1.mixToCounts)(request.difficultyMix, request.questionCount);
    const actualMix = countByDifficulty(questions);
    for (const difficulty of domain_1.DIFFICULTIES) {
        if (actualMix[difficulty] !== expectedMix[difficulty]) {
            throw new app_error_1.AppError(502, "INVALID_DIFFICULTY_DISTRIBUTION", "The generated questions do not satisfy the requested difficulty distribution.", { expectedMix, actualMix });
        }
    }
    const seen = new Set();
    return questions.map((question, index) => {
        const sanitizedQuestion = {
            ...question,
            questionText: sanitizeText(question.questionText),
            options: question.options.map(sanitizeOption),
            conceptTested: sanitizeText(question.conceptTested),
            commonMistake: sanitizeText(question.commonMistake),
            recommendedRemedialAction: sanitizeText(question.recommendedRemedialAction),
            learningOutcome: sanitizeText(question.learningOutcome),
            bloomsTaxonomyLevel: sanitizeText(question.bloomsTaxonomyLevel),
            sourceReference: question.sourceReference
                ? sanitizeText(question.sourceReference)
                : null,
        };
        const userFacingTexts = [
            sanitizedQuestion.questionText,
            ...sanitizedQuestion.options,
            sanitizedQuestion.conceptTested,
            sanitizedQuestion.commonMistake,
            sanitizedQuestion.recommendedRemedialAction,
            sanitizedQuestion.learningOutcome,
            sanitizedQuestion.bloomsTaxonomyLevel,
            sanitizedQuestion.sourceReference ?? "",
            sanitizedQuestion.solutionOutline ?? "",
            sanitizedQuestion.difficultyRationale ?? "",
        ];
        if (hasPlaceholderLeakage(userFacingTexts)) {
            throw new app_error_1.AppError(502, "ACADEMIC_VALIDATION_FAILED", "The generated output leaked placeholder or synthetic internal metadata into user-facing question content.", {
                questionNumber: question.questionNumber,
                subject: request.subject,
                chapter: request.chapter,
                subTopic: request.subTopic,
            });
        }
        if (userFacingTexts.some(public_content_1.containsInternalTechnologyReference)) {
            throw new app_error_1.AppError(502, "ACADEMIC_VALIDATION_FAILED", "The generated output contains internal preparation terminology.", {
                questionNumber: question.questionNumber,
                subject: request.subject,
                chapter: request.chapter,
                subTopic: request.subTopic,
            });
        }
        if (countInlineChoiceMarkers(sanitizedQuestion.questionText) >= 2) {
            throw new app_error_1.AppError(502, "ACADEMIC_VALIDATION_FAILED", "The generated question stem includes answer-choice content instead of only the question prompt.", {
                questionNumber: question.questionNumber,
                subject: request.subject,
                chapter: request.chapter,
                subTopic: request.subTopic,
            });
        }
        if (hasCuratedSyllabusGrounding(request) &&
            !hasEnoughTopicGrounding(sanitizedQuestion, request)) {
            throw new app_error_1.AppError(502, "ACADEMIC_VALIDATION_FAILED", "The generated question does not appear to test the selected syllabus topic strongly enough.", {
                questionNumber: question.questionNumber,
                subject: request.subject,
                chapter: request.chapter,
                subTopic: request.subTopic,
                validationKeywords: request.syllabusContext.validationKeywords,
            });
        }
        if (hasCuratedSyllabusGrounding(request) &&
            !conceptAlignsWithGrounding(sanitizedQuestion, request)) {
            throw new app_error_1.AppError(502, "ACADEMIC_VALIDATION_FAILED", "The generated concept label does not align with the grounded syllabus concepts for this topic.", {
                questionNumber: question.questionNumber,
                subject: request.subject,
                chapter: request.chapter,
                subTopic: request.subTopic,
                allowedConcepts: request.syllabusContext.coreConcepts,
                receivedConcept: sanitizedQuestion.conceptTested,
            });
        }
        const normalizedText = (0, normalization_1.normalizeText)(sanitizedQuestion.questionText);
        const normalizedHash = (0, normalization_1.hashNormalizedText)(sanitizedQuestion.questionText);
        const structuralFingerprint = (0, normalization_1.hashStructuralText)(sanitizedQuestion.questionText);
        if (seen.has(normalizedHash)) {
            throw new app_error_1.AppError(502, "DUPLICATE_IN_GENERATED_BATCH", "The generated batch contains duplicate questions.", { normalizedHash, questionNumber: question.questionNumber });
        }
        seen.add(normalizedHash);
        return {
            subject: request.subject,
            classLevel: request.classLevel,
            chapter: request.chapter,
            subTopic: request.subTopic,
            targetExams: request.targetExams,
            difficulty: sanitizedQuestion.difficulty,
            text: sanitizedQuestion.questionText,
            options: sanitizedQuestion.options,
            correctOption: sanitizedQuestion.correctOption,
            correctIndex: ["A", "B", "C", "D"].indexOf(sanitizedQuestion.correctOption),
            conceptTested: sanitizedQuestion.conceptTested,
            commonMistake: sanitizedQuestion.commonMistake,
            recommendedRemedialAction: sanitizedQuestion.recommendedRemedialAction,
            learningOutcome: sanitizedQuestion.learningOutcome,
            bloomsTaxonomyLevel: sanitizedQuestion.bloomsTaxonomyLevel,
            examRelevance: sanitizedQuestion.examRelevance,
            sourceReference: sanitizedQuestion.sourceReference ?? null,
            normalizedText,
            normalizedHash,
            structuralFingerprint,
            semanticEmbedding: null,
            metadata: {
                requestedQuestionNumber: question.questionNumber,
                returnedOrder: index + 1,
                generationPlanSlot: request.generationPlan[index] ?? null,
                historicalAnalysisMode: result.historicalAnalysisMode,
                historicalAnalysisSummary: result.historicalAnalysisSummary,
                syllabusGroundingValidation: hasCuratedSyllabusGrounding(request)
                    ? "curated"
                    : "provider-grounded",
                solutionOutline: sanitizedQuestion.solutionOutline ?? null,
                difficultyRationale: sanitizedQuestion.difficultyRationale ?? null,
            },
        };
    });
}
function candidateText(value) {
    if (!value || typeof value !== "object")
        return null;
    const record = value;
    const text = record.questionText ?? record.text ?? record.stem ?? record.question;
    return typeof text === "string" ? sanitizeText(text).slice(0, 500) : null;
}
function validateProviderCandidates(request, result) {
    const acceptedQuestions = [];
    const rejectedQuestions = [];
    result.questions.forEach((question, index) => {
        const planSlot = request.generationPlan[index];
        const expectedDifficulty = planSlot?.difficulty ?? "Medium";
        const difficultyCounts = {
            Easy: expectedDifficulty === "Easy" ? 1 : 0,
            Medium: expectedDifficulty === "Medium" ? 1 : 0,
            Hard: expectedDifficulty === "Hard" ? 1 : 0,
        };
        try {
            const [validated] = validateProviderOutput({
                ...request,
                questionCount: 1,
                difficultyCounts,
                selectionDifficultyCounts: undefined,
                generationPlan: planSlot ? [{ ...planSlot, slotNumber: 1 }] : [],
            }, {
                ...result,
                questions: [question],
            });
            if (validated)
                acceptedQuestions.push(validated);
        }
        catch (error) {
            rejectedQuestions.push({
                candidateIndex: index + 1,
                questionText: candidateText(question),
                code: error instanceof app_error_1.AppError ? error.code : "INVALID_GENERATION_OUTPUT",
                message: error instanceof Error
                    ? error.message
                    : "The generated candidate could not be validated.",
            });
        }
    });
    if (result.questions.length < request.questionCount) {
        for (let index = result.questions.length; index < request.questionCount; index += 1) {
            rejectedQuestions.push({
                candidateIndex: index + 1,
                questionText: null,
                code: "MISSING_GENERATED_QUESTION",
                message: "The generation provider omitted this requested question slot.",
            });
        }
    }
    return { acceptedQuestions, rejectedQuestions };
}
//# sourceMappingURL=output-validator.js.map