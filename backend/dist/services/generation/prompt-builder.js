"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQuestionPrompt = buildQuestionPrompt;
const prompt_template_1 = require("./prompt-template");
const difficulty_1 = require("../../utils/difficulty");
const MAX_PROMPT_EXCLUSIONS = 8;
const MAX_RETRY_REJECTIONS = 6;
function targetExamLabel(value) {
    if (value === "JEE_MAIN")
        return "JEE Main";
    return value;
}
function buildQuestionPrompt(input) {
    const counts = input.difficultyCounts ??
        (0, difficulty_1.mixToCounts)(input.difficultyMix, input.questionCount);
    const difficultyDistribution = [
        `Easy: ${counts.Easy} question(s)`,
        `Medium: ${counts.Medium} question(s)`,
        `Hard: ${counts.Hard} question(s)`,
    ].join("; ");
    const compactList = (values, limit) => values.filter(Boolean).slice(0, limit).join("; ") || "none";
    const prompt = prompt_template_1.BASE_PROMPT.replace("[SUBJECT]", input.subject)
        .replace("[SUBJECT]", input.subject)
        .replace("[CLASS]", input.classLevel)
        .replace("[CHAPTER]", input.chapter)
        .replace("[TOPICS/SUBTOPICS]", input.subTopic)
        .replace("[TARGET EXAMS]", input.targetExams.map(targetExamLabel).join(", "))
        .replace("[NUMBER OF QUESTIONS]", String(input.questionCount))
        .replace("[DIFFICULTY DISTRIBUTION]", difficultyDistribution);
    const compactPlan = input.generationPlan
        .map((slot) => `${slot.slotNumber}. [${slot.difficulty}] Concept: ${slot.concept} | Task: ${slot.pattern} | Form: ${slot.questionForm} | Outcome: ${slot.learningOutcome}`)
        .join("\n");
    const datasetNote = input.historicalAnalysis.mode === "imported_dataset"
        ? `Historical context: ${compactList(input.historicalAnalysis.recurringConcepts, 5)}. ${input.historicalAnalysis.trendSummary}`
        : "Historical context: no local past-paper corpus is available. Do not claim that one was analysed and do not invent citations.";
    const previousQuestionsSection = input.previousQuestions.length > 0
        ? `Recent exact-question exclusions (do not repeat these stems): ${input.previousQuestions
            .slice(0, MAX_PROMPT_EXCLUSIONS)
            .map((text, index) => `${index + 1}) ${text}`)
            .join(" | ")}`
        : "Recent exact-question exclusions: none.";
    const retrySection = input.retryContext
        ? `
Targeted repair attempt ${input.retryContext.attempt}:
- Return only the missing slots: Easy ${input.retryContext.requiredDifficultyCounts.Easy}, Medium ${input.retryContext.requiredDifficultyCounts.Medium}, Hard ${input.retryContext.requiredDifficultyCounts.Hard}.
- Avoid these rejection reasons: ${compactList(input.retryContext.rejectionReasons, MAX_RETRY_REJECTIONS)}
${input.retryContext.rejectedQuestionTexts.length > 0
            ? `- Rejected candidate texts: ${input.retryContext.rejectedQuestionTexts
                .slice(-MAX_RETRY_REJECTIONS)
                .map((text, index) => `${index + 1}) ${text}`)
                .join(" | ")}`
            : "- Rejected candidate texts: none."}
`.trim()
        : "";
    const syllabusGroundingSection = `
Syllabus grounding for this request:
- Topic summary: ${input.syllabusContext.summary}
- Core concepts: ${compactList(input.syllabusContext.coreConcepts, 5)}
- Expected learning outcomes: ${compactList(input.syllabusContext.learningOutcomes, 4)}
- Common misconceptions to target in distractors: ${compactList(input.syllabusContext.commonMisconceptions, 4)}
- Preferred question patterns: ${compactList(input.syllabusContext.questionPatterns, 4)}
- Difficulty guidance: ${["Easy", "Medium", "Hard"].map((difficulty) => `${difficulty}: ${compactList(input.syllabusContext.difficultyGuidance?.[difficulty] ?? [], 5)}`).join(" | ")}
`.trim();
    const generationPlanSection = `
Deterministic generation plan for diversity and coverage:
${compactPlan}

Produce exactly one question for every numbered slot. Follow each slot's concept, task, form, difficulty, and outcome. Vary the underlying reasoning and avoid repeating the same template with surface-only changes.
`.trim();
    const qualityGuardrails = `
Quality guardrails:
- Every question must genuinely test the selected syllabus, not merely mention the topic name.
- "questionText" must contain only the question stem. Do not include answer choices, option labels, or inline A)/B)/C)/D) text inside "questionText".
- Distractors must be academically plausible student mistakes for this topic.
- Make "conceptTested", "learningOutcome", "commonMistake", and the solution outline specific to the actual question.
- Vary the required reasoning, not just names or numerical values.
- Easy may be direct; Medium must require meaningful application; Hard must require non-routine multi-step reasoning.
`.trim();
    return [
        prompt,
        datasetNote,
        syllabusGroundingSection,
        generationPlanSection,
        previousQuestionsSection,
        retrySection,
        qualityGuardrails,
    ].join("\n\n");
}
//# sourceMappingURL=prompt-builder.js.map