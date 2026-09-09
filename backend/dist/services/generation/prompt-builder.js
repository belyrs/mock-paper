"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQuestionPrompt = buildQuestionPrompt;
const prompt_template_1 = require("./prompt-template");
const difficulty_1 = require("../../utils/difficulty");
const MAX_PROMPT_EXCLUSIONS = 36;
const MAX_RETRY_REJECTIONS = 12;
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
        ? [
            "Historical dataset summary:",
            `- Relevant historical questions: ${input.historicalAnalysis.totalRelevantQuestions}`,
            `- Years covered: ${input.historicalAnalysis.yearsCovered.join(", ") || "none listed"}`,
            `- Recurring concepts: ${compactList(input.historicalAnalysis.recurringConcepts, 5)}`,
            `- Trend summary: ${input.historicalAnalysis.trendSummary}`,
            `- Source examples: ${compactList(input.historicalAnalysis.sourceDetails, 2)}`,
        ].join("\n")
        : 'No local historical-paper dataset is available for this syllabus slice. Use general public exam-pattern knowledge only and set "historicalAnalysisMode" to "model_knowledge_fallback".';
    const previousQuestionsSection = input.previousQuestions.length > 0
        ? `Existing question bank exclusions (do not repeat the same setup, required inference, or answer relation): ${input.previousQuestions
            .slice(0, MAX_PROMPT_EXCLUSIONS)
            .map((text, index) => `${index + 1}) ${text}`)
            .join(" | ")}`
        : "Existing question bank exclusions: none available for this syllabus slice.";
    const retrySection = input.retryContext
        ? `
Retry guidance for this attempt:
- Attempt number: ${input.retryContext.attempt}
- Already accepted unique questions in this paper draft: ${input.retryContext.acceptedQuestionTexts.length}
- Previously rejected candidate questions: ${input.retryContext.rejectedQuestionTexts.length}
- The paper still needs: Easy ${input.retryContext.requiredDifficultyCounts.Easy}, Medium ${input.retryContext.requiredDifficultyCounts.Medium}, Hard ${input.retryContext.requiredDifficultyCounts.Hard}.
- If this request asks for extra candidates beyond those remaining counts, make them genuinely different alternatives; the backend will select the required mix.
- Do not paraphrase, minimally vary, or recycle the rejected candidates below.
- Rejection reasons to avoid: ${compactList(input.retryContext.rejectionReasons, MAX_RETRY_REJECTIONS)}
${input.retryContext.rejectedQuestionTexts.length > 0
            ? `- Rejected candidate texts: ${input.retryContext.rejectedQuestionTexts
                .slice(-MAX_RETRY_REJECTIONS)
                .map((text, index) => `${index + 1}) ${text}`)
                .join(" | ")}`
            : "- Rejected candidate texts: none"}
`.trim()
        : "";
    const syllabusGroundingSection = `
Syllabus grounding for this request:
- Matched local syllabus context: ${input.syllabusContext.canonicalMatch ? "yes" : "no"}
- Match confidence: ${input.syllabusContext.matchScore}
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
    const candidatePoolSection = input.selectionDifficultyCounts
        ? `Candidate-pool requirement:
- The final paper still needs Easy ${input.selectionDifficultyCounts.Easy}, Medium ${input.selectionDifficultyCounts.Medium}, Hard ${input.selectionDifficultyCounts.Hard}.
- This request deliberately asks for extra alternatives. Every alternative must still be complete, correct, distinct, and match its assigned difficulty; the backend will select the final mix after validation.`
        : "";
    const qualityGuardrails = `
Quality guardrails:
- Every question must genuinely test the selected syllabus, not merely mention the topic name.
- The question stem must require subject-specific reasoning or calculation to solve.
- "questionText" must contain only the question stem. Do not include answer choices, option labels, or inline A)/B)/C)/D) text inside "questionText".
- Do not invent internal tags, scenario IDs, placeholder labels, "lens" terminology, or arbitrary metadata inside the question text or options.
- Distractors must be academically plausible student mistakes for this topic.
- Keep the full batch inside the syllabus boundary and make "conceptTested" and "learningOutcome" match the actual question.
- Privately solve and verify every question before returning JSON. Confirm that exactly one option is defensible and that "correctOption" points to it.
- Return a concise "solutionOutline" containing the decisive public-facing equation, calculation, or fact, and a concise "difficultyRationale" explaining why the actual solving work meets its assigned level. Do not return hidden chain-of-thought.
- Vary the physical/mathematical setup and the required inference, not merely names, wording, constants, or numerical values.
- Do not claim that a question came from a specific past paper unless that source appears in the supplied historical dataset.
- Use each mathematical or scientific symbol for exactly one meaning within a question.
- Include every dimension-bearing variable needed to derive the claimed relation; do not silently absorb a dimensional quantity into a dimensionless constant.
- For equations with added terms, specify enough information to determine every coefficient's dimensions and verify that every term has the same dimensions.
- For dimensional-analysis and unit-conversion questions, reduce the entire expression to base dimensions step by step, including every numerator and denominator, and verify the keyed option against the final reduced result.
- Before claiming a unique set of power-law exponents, compare the number of unknown exponents with the number of independent dimensional equations. If underdetermined, either state an additional physical/scaling constraint or ask explicitly about the remaining freedom; never assume a missing constraint.
- For numerical unit conversions, independently calculate the conversion in both directions and ensure the exact result appears once among the options.
- Assertion-reason MCQs must include all four standard truth combinations, including "A is false but R is true", so every possible evaluation is representable.
- Preserve format variety. The core instruction's requirement for at least 3 assertion-reason or statement-based questions applies to the complete paper, not to each focused provider sub-batch. Return at most one assertion-reason or statement-based question in this response. Across a paper of 10 or more questions, the complete paper should contain 3 such questions and never more than 40%; use conventional conceptual, numerical, data-interpretation, and relation-derivation MCQs for the remaining slots.
- Easy questions may use direct recognition or one step. Medium questions must require a meaningful application or at least two linked checks. Hard questions must require multi-step reasoning, non-obvious constraint solving, or careful evaluation of closely plausible statements; never relabel a routine one-step check as Hard.
- Difficulty is relative to the selected class and narrow syllabus slice. Treat the syllabus-specific difficulty guidance as the authoritative rubric: a correctly implemented candidate that satisfies one listed Hard construction is Hard for this paper, even if its individual algebraic operations are familiar.
`.trim();
    const outputContract = 'Return valid JSON only. Top-level shape: {"historicalAnalysisMode":"imported_dataset|model_knowledge_fallback|mixed","historicalAnalysisSummary":"string","questions":[{"questionNumber":1,"difficulty":"Easy|Medium|Hard","questionText":"string","options":["string","string","string","string"],"correctOption":"A|B|C|D","conceptTested":"string","commonMistake":"string","recommendedRemedialAction":"string","learningOutcome":"string","bloomsTaxonomyLevel":"string","examRelevance":{"JEE_MAIN":"High|Medium|Low|N/A","NEET":"High|Medium|Low|N/A","KCET":"High|Medium|Low|N/A","CBSE":"High|Medium|Low|N/A"},"sourceReference":"string or null","solutionOutline":"concise decisive solution check","difficultyRationale":"concise rationale tied to required solving steps"}]}. "correctOption" must be exactly one uppercase letter: "A", "B", "C", or "D" only. Do not return option text, option numbers, lowercase letters, or labels like "Option B". "questionText" must not repeat the options. Every exam-relevance value must be a string, never a boolean.';
    return [
        prompt,
        datasetNote,
        syllabusGroundingSection,
        generationPlanSection,
        candidatePoolSection,
        previousQuestionsSection,
        retrySection,
        qualityGuardrails,
        outputContract,
    ].join("\n\n");
}
//# sourceMappingURL=prompt-builder.js.map