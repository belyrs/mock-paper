"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mixToCounts = mixToCounts;
exports.countByDifficulty = countByDifficulty;
exports.subtractDifficultyCounts = subtractDifficultyCounts;
exports.totalDifficultyCount = totalDifficultyCount;
const ORDER = ["Easy", "Medium", "Hard"];
function mixToCounts(mix, total) {
    const safeTotal = Math.max(0, Math.floor(total));
    const raw = ORDER.map((difficulty) => ((mix[difficulty] ?? 0) * safeTotal) / 100);
    const counts = raw.map((value) => Math.floor(value));
    let remaining = safeTotal - counts.reduce((sum, value) => sum + value, 0);
    const fractions = raw
        .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((left, right) => right.fraction - left.fraction);
    let cursor = 0;
    while (remaining > 0 && fractions.length > 0) {
        const nextIndex = fractions[cursor % fractions.length]?.index ?? 0;
        counts[nextIndex] = (counts[nextIndex] ?? 0) + 1;
        remaining -= 1;
        cursor += 1;
    }
    return {
        Easy: counts[0] ?? 0,
        Medium: counts[1] ?? 0,
        Hard: counts[2] ?? 0,
    };
}
function countByDifficulty(questions) {
    return questions.reduce((counts, question) => {
        counts[question.difficulty] += 1;
        return counts;
    }, { Easy: 0, Medium: 0, Hard: 0 });
}
function subtractDifficultyCounts(target, used) {
    return {
        Easy: Math.max(0, target.Easy - used.Easy),
        Medium: Math.max(0, target.Medium - used.Medium),
        Hard: Math.max(0, target.Hard - used.Hard),
    };
}
function totalDifficultyCount(counts) {
    return ORDER.reduce((sum, difficulty) => sum + (counts[difficulty] ?? 0), 0);
}
//# sourceMappingURL=difficulty.js.map