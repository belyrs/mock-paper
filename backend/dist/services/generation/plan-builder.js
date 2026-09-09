"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGenerationPlan = buildGenerationPlan;
const QUESTION_FORMS = {
    Easy: [
        "direct concept recognition with plausible misconception-based distractors",
        "single-step symbolic or numerical application",
        "identify and correct a common student error",
        "compare closely related definitions or cases",
    ],
    Medium: [
        "two-step application in a realistic academic context",
        "multi-statement evaluation",
        "reverse inference from a result or observation",
        "diagnose an incorrect worked step",
        "compare two cases after changing one condition",
    ],
    Hard: [
        "multi-step symbolic or numerical analysis",
        "assertion-reason evaluation",
        "experimental or data-interpretation problem",
        "multi-concept integration within the selected syllabus boundary",
        "limiting-case or validity analysis",
        "reverse-engineer a governing relation from constraints",
    ],
};
function numericSeed(input) {
    let hash = 2166136261;
    for (const character of input) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function expandDifficultyOrder(counts) {
    return ["Easy", "Medium", "Hard"].flatMap((difficulty) => Array.from({ length: counts[difficulty] ?? 0 }, () => difficulty));
}
function buildGenerationPlan(request) {
    const seed = numericSeed(`${request.subject}|${request.chapter}|${request.subTopic}|${request.diversityOffset ?? 0}`);
    const counts = request.difficultyCounts ?? request.difficultyMix;
    const difficultyOrder = expandDifficultyOrder(counts);
    const concepts = request.syllabusContext.coreConcepts.length > 0
        ? request.syllabusContext.coreConcepts
        : [request.subTopic];
    const patterns = request.syllabusContext.questionPatterns.length > 0
        ? request.syllabusContext.questionPatterns
        : [`Exam-style MCQ grounded in ${request.subTopic}`];
    const outcomes = request.syllabusContext.learningOutcomes.length > 0
        ? request.syllabusContext.learningOutcomes
        : [`Demonstrate knowledge of ${request.subTopic}`];
    const usedByDifficulty = {
        Easy: 0,
        Medium: 0,
        Hard: 0,
    };
    const blueprintsByDifficulty = Object.fromEntries(["Easy", "Medium", "Hard"].map((difficulty) => {
        const questionForms = request.syllabusContext.difficultyGuidance?.[difficulty] ??
            QUESTION_FORMS[difficulty];
        const blueprints = concepts.flatMap((concept, conceptIndex) => patterns.flatMap((pattern) => questionForms.map((questionForm) => ({
            concept,
            pattern,
            questionForm,
            learningOutcome: outcomes[conceptIndex % outcomes.length] ??
                `Demonstrate knowledge of ${request.subTopic}`,
        }))));
        return [
            difficulty,
            blueprints.sort((left, right) => {
                const leftKey = `${seed}|${difficulty}|${left.concept}|${left.pattern}|${left.questionForm}`;
                const rightKey = `${seed}|${difficulty}|${right.concept}|${right.pattern}|${right.questionForm}`;
                return (numericSeed(leftKey) - numericSeed(rightKey) ||
                    leftKey.localeCompare(rightKey));
            }),
        ];
    }));
    return difficultyOrder.map((difficulty, index) => {
        const blueprints = blueprintsByDifficulty[difficulty];
        const blueprint = blueprints[usedByDifficulty[difficulty] % blueprints.length];
        usedByDifficulty[difficulty] += 1;
        return {
            slotNumber: index + 1,
            difficulty,
            ...blueprint,
        };
    });
}
//# sourceMappingURL=plan-builder.js.map