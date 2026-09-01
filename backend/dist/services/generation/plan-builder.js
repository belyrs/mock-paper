"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGenerationPlan = buildGenerationPlan;
function numericSeed(input) {
    return input.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
}
function expandDifficultyOrder(counts) {
    return ["Easy", "Medium", "Hard"].flatMap((difficulty) => Array.from({ length: counts[difficulty] ?? 0 }, () => difficulty));
}
function rotate(items, offset) {
    if (items.length === 0) {
        return items;
    }
    const normalizedOffset = ((offset % items.length) + items.length) % items.length;
    return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}
function buildGenerationPlan(request) {
    const seed = numericSeed(`${request.subject}|${request.chapter}|${request.subTopic}|${request.questionCount}`);
    const counts = request.difficultyCounts ?? request.difficultyMix;
    const difficultyOrder = expandDifficultyOrder(counts);
    const concepts = rotate(request.syllabusContext.coreConcepts.length > 0
        ? request.syllabusContext.coreConcepts
        : [request.subTopic], seed);
    const patterns = rotate(request.syllabusContext.questionPatterns.length > 0
        ? request.syllabusContext.questionPatterns
        : [`Exam-style MCQ grounded in ${request.subTopic}`], seed * 3);
    const outcomes = rotate(request.syllabusContext.learningOutcomes.length > 0
        ? request.syllabusContext.learningOutcomes
        : [`Demonstrate knowledge of ${request.subTopic}`], seed * 5);
    return difficultyOrder.map((difficulty, index) => ({
        slotNumber: index + 1,
        difficulty,
        concept: concepts[index % concepts.length] ?? request.subTopic,
        pattern: patterns[index % patterns.length] ?? `Exam-style MCQ grounded in ${request.subTopic}`,
        learningOutcome: outcomes[index % outcomes.length] ?? `Demonstrate knowledge of ${request.subTopic}`,
    }));
}
//# sourceMappingURL=plan-builder.js.map