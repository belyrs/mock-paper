import type { GenerationProviderRequest } from "./types";
import { BASE_PROMPT } from "./prompt-template";
import { mixToCounts } from "../../utils/difficulty";

const MAX_PROMPT_EXCLUSIONS = 5;
const MAX_RETRY_REJECTIONS = 2;

function targetExamLabel(value: string): string {
  if (value === "JEE_MAIN") return "JEE Main";
  return value;
}

export function buildQuestionPrompt(input: GenerationProviderRequest) {
  const counts = input.difficultyCounts ?? mixToCounts(input.difficultyMix, input.questionCount);
  const difficultyDistribution = [
    `Easy: ${counts.Easy} question(s)`,
    `Medium: ${counts.Medium} question(s)`,
    `Hard: ${counts.Hard} question(s)`,
  ].join("; ");

  const compactList = (values: string[], limit: number) =>
    values
      .filter(Boolean)
      .slice(0, limit)
      .join("; ") || "none";

  const prompt = BASE_PROMPT
    .replace("[SUBJECT]", input.subject)
    .replace("[SUBJECT]", input.subject)
    .replace("[CLASS]", input.classLevel)
    .replace("[CHAPTER]", input.chapter)
    .replace("[TOPICS/SUBTOPICS]", input.subTopic)
    .replace("[TARGET EXAMS]", input.targetExams.map(targetExamLabel).join(", "))
    .replace("[NUMBER OF QUESTIONS]", String(input.questionCount))
    .replace("[DIFFICULTY DISTRIBUTION]", difficultyDistribution);

  const compactPlan = (["Easy", "Medium", "Hard"] as const)
    .map((difficulty) => {
      const entries = Array.from(
        new Set(
          input.generationPlan
            .filter((slot) => slot.difficulty === difficulty)
            .map((slot) => `${slot.concept} (${slot.pattern})`),
        ),
      ).slice(0, 3);
      if (entries.length === 0) {
        return null;
      }
      return `- ${difficulty}: ${entries.join(" | ")}`;
    })
    .filter(Boolean)
    .join("\n");

  const datasetNote =
    input.historicalAnalysis.mode === "imported_dataset"
      ? [
          "Historical dataset summary:",
          `- Relevant historical questions: ${input.historicalAnalysis.totalRelevantQuestions}`,
          `- Years covered: ${input.historicalAnalysis.yearsCovered.join(", ") || "none listed"}`,
          `- Recurring concepts: ${compactList(input.historicalAnalysis.recurringConcepts, 5)}`,
          `- Trend summary: ${input.historicalAnalysis.trendSummary}`,
          `- Source examples: ${compactList(input.historicalAnalysis.sourceDetails, 2)}`,
        ].join("\n")
      : 'No local historical-paper dataset is available for this syllabus slice. Use general public exam-pattern knowledge only and set "historicalAnalysisMode" to "model_knowledge_fallback".';

  const previousQuestionsSection =
    input.previousQuestions.length > 0
      ? `Existing question bank exclusions: ${input.previousQuestions
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
- Do not paraphrase, minimally vary, or recycle the rejected candidates below.
- Rejection reasons to avoid: ${compactList(input.retryContext.rejectionReasons, MAX_RETRY_REJECTIONS)}
${input.retryContext.rejectedQuestionTexts.length > 0 ? `- Rejected candidate texts: ${input.retryContext.rejectedQuestionTexts.slice(0, MAX_RETRY_REJECTIONS).map((text, index) => `${index + 1}) ${text}`).join(" | ")}` : "- Rejected candidate texts: none"}
`.trim()
    : "";

  const syllabusGroundingSection = `
Syllabus grounding for this request:
- Matched local syllabus context: ${input.syllabusContext.canonicalMatch ? "yes" : "no"}
- Match confidence: ${input.syllabusContext.matchScore}
- Topic summary: ${input.syllabusContext.summary}
- Core concepts: ${compactList(input.syllabusContext.coreConcepts, 5)}
- Expected learning outcomes: ${compactList(input.syllabusContext.learningOutcomes, 4)}
- Common misconceptions to target in distractors: ${compactList(
  input.syllabusContext.commonMisconceptions,
  4,
)}
- Preferred question patterns: ${compactList(input.syllabusContext.questionPatterns, 4)}
`.trim();

  const generationPlanSection = `
Deterministic generation plan for diversity and coverage:
${compactPlan}

Follow the plan closely. Vary the underlying reasoning and avoid repeating the same template with surface-only changes.
`.trim();

  const qualityGuardrails = `
Quality guardrails:
- Every question must genuinely test the selected syllabus, not merely mention the topic name.
- The question stem must require subject-specific reasoning or calculation to solve.
- "questionText" must contain only the question stem. Do not include answer choices, option labels, or inline A)/B)/C)/D) text inside "questionText".
- Do not invent internal tags, scenario IDs, placeholder labels, "lens" terminology, or arbitrary metadata inside the question text or options.
- Distractors must be academically plausible student mistakes for this topic.
- Keep the full batch inside the syllabus boundary and make "conceptTested" and "learningOutcome" match the actual question.
`.trim();

  const outputContract =
    'Return valid JSON only. Top-level shape: {"historicalAnalysisMode":"imported_dataset|model_knowledge_fallback|mixed","historicalAnalysisSummary":"string","questions":[{"questionNumber":1,"difficulty":"Easy|Medium|Hard","questionText":"string","options":["string","string","string","string"],"correctOption":"A|B|C|D"}]}. "correctOption" must be exactly one uppercase letter: "A", "B", "C", or "D" only. Do not return option text, option numbers, lowercase letters, or labels like "Option B". "questionText" must not repeat the options. Each question must also include "conceptTested", "commonMistake", "recommendedRemedialAction", "learningOutcome", "bloomsTaxonomyLevel", "examRelevance":{"JEE_MAIN","NEET","KCET","CBSE"}, and "sourceReference".';

  return [
    prompt,
    datasetNote,
    syllabusGroundingSection,
    generationPlanSection,
    previousQuestionsSection,
    retrySection,
    qualityGuardrails,
    outputContract,
  ].join("\n\n");
}
