import {
  SYLLABUS_GROUNDING_ENTRIES,
  type SyllabusGroundingEntry,
} from "../data/syllabus-grounding";
import {
  jaccardSimilarity,
  normalizeText,
  normalizeTopicKey,
} from "../utils/normalization";

export interface ResolvedSyllabusContext {
  entryKey: string | null;
  canonicalMatch: boolean;
  matchScore: number;
  summary: string;
  coreConcepts: string[];
  learningOutcomes: string[];
  commonMisconceptions: string[];
  questionPatterns: string[];
  validationKeywords: string[];
  difficultyGuidance?: Partial<Record<"Easy" | "Medium" | "Hard", string[]>>;
}

function tokenizeKeywords(value: string) {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(" ")
        .filter((token) => token.length >= 4),
    ),
  );
}

function buildGenericKeywords(
  subject: string,
  chapter: string,
  subTopic: string,
) {
  return Array.from(
    new Set([
      ...tokenizeKeywords(subject),
      ...tokenizeKeywords(chapter),
      ...tokenizeKeywords(subTopic),
    ]),
  );
}

function buildGenericContext(
  subject: string,
  chapter: string,
  subTopic: string,
): ResolvedSyllabusContext {
  const keywords = buildGenericKeywords(subject, chapter, subTopic);
  return {
    entryKey: null,
    canonicalMatch: false,
    matchScore: 0,
    summary: `${subTopic} within ${chapter} for ${subject}, using the teacher-provided topic labels because no local syllabus-grounding entry was matched.`,
    coreConcepts:
      keywords.length > 0
        ? keywords.map((keyword) => `${subTopic}: ${keyword}`)
        : [subTopic],
    learningOutcomes: [
      `Generate questions that genuinely require knowledge of ${subTopic}.`,
      `Ensure the reasoning stays within ${chapter} for ${subject}.`,
    ],
    commonMisconceptions: [
      `Using ${subject} terminology without testing the actual ${subTopic} concept.`,
      `Returning generic template text instead of a solvable ${chapter} question.`,
    ],
    questionPatterns: [
      `Conceptual and application-focused questions grounded in ${subTopic}.`,
      `Exam-style MCQs with one defensible answer and plausible distractors.`,
    ],
    validationKeywords: keywords,
    difficultyGuidance: {
      Easy: [`Use a direct or one-step application of ${subTopic}.`],
      Medium: [
        `Require at least two linked reasoning steps grounded in ${subTopic}.`,
      ],
      Hard: [
        `Require a non-routine multi-step application, multiple constraints, or close-alternative analysis grounded in ${subTopic}.`,
      ],
    },
  };
}

function scoreEntry(
  entry: SyllabusGroundingEntry,
  subject: string,
  chapter: string,
  subTopic: string,
) {
  const subjectMatch =
    normalizeTopicKey(entry.subject) === normalizeTopicKey(subject) ? 1 : 0;
  if (subjectMatch === 0) {
    return 0;
  }

  const normalizedChapter = normalizeTopicKey(chapter);
  const normalizedSubTopic = normalizeTopicKey(subTopic);
  const chapterScore =
    entry.chapterNormalized === normalizedChapter
      ? 1
      : Math.max(
          jaccardSimilarity(entry.chapter, chapter),
          entry.chapterNormalized.includes(normalizedChapter) ||
            normalizedChapter.includes(entry.chapterNormalized)
            ? 0.7
            : 0,
        );
  const subTopicScore =
    entry.subTopicNormalized === normalizedSubTopic
      ? 1
      : Math.max(
          jaccardSimilarity(entry.subTopic, subTopic),
          entry.subTopicNormalized.includes(normalizedSubTopic) ||
            normalizedSubTopic.includes(entry.subTopicNormalized)
            ? 0.8
            : 0,
        );

  return subjectMatch * (chapterScore * 0.4 + subTopicScore * 0.6);
}

export class SyllabusGroundingService {
  resolve(payload: {
    subject: string;
    chapter: string;
    subTopic: string;
  }): ResolvedSyllabusContext {
    const bestMatch = SYLLABUS_GROUNDING_ENTRIES.map((entry) => ({
      entry,
      score: scoreEntry(
        entry,
        payload.subject,
        payload.chapter,
        payload.subTopic,
      ),
    })).sort((left, right) => right.score - left.score)[0];

    if (!bestMatch || bestMatch.score < 0.45) {
      return buildGenericContext(
        payload.subject,
        payload.chapter,
        payload.subTopic,
      );
    }

    return {
      entryKey: bestMatch.entry.key,
      canonicalMatch: bestMatch.score >= 0.65,
      matchScore: Number(bestMatch.score.toFixed(3)),
      summary: bestMatch.entry.summary,
      coreConcepts: bestMatch.entry.coreConcepts,
      learningOutcomes: bestMatch.entry.learningOutcomes,
      commonMisconceptions: bestMatch.entry.commonMisconceptions,
      questionPatterns: bestMatch.entry.questionPatterns,
      validationKeywords: bestMatch.entry.validationKeywords,
      difficultyGuidance: bestMatch.entry.difficultyGuidance,
    };
  }
}
