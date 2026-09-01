import type { Paper } from "../entities/paper.entity";
import type { Question } from "../entities/question.entity";
import type { User } from "../entities/user.entity";

export function serializeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function serializeQuestion(question: Question) {
  return {
    id: question.id,
    paperId: question.paperId,
    position: question.position,
    subject: question.subject,
    classLevel: question.classLevel,
    chapter: question.chapter,
    subTopic: question.subTopic,
    targetExams: question.targetExams,
    difficulty: question.difficulty,
    questionType: question.questionType,
    text: question.text,
    options: question.options,
    correctOption: question.correctOption,
    correctIndex: question.correctIndex,
    conceptTested: question.conceptTested,
    commonMistake: question.commonMistake,
    recommendedRemedialAction: question.recommendedRemedialAction,
    learningOutcome: question.learningOutcome,
    bloomsTaxonomyLevel: question.bloomsTaxonomyLevel,
    examRelevance: question.examRelevance,
    sourceReference: question.sourceReference,
    generationProvider: question.generationProvider,
    generationModel: question.generationModel,
    promptVersion: question.promptVersion,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

export function serializePaper(paper: Paper) {
  return {
    id: paper.id,
    userId: paper.userId,
    title: paper.title,
    exam: paper.exam,
    classLevel: paper.classLevel,
    mode: paper.mode,
    targetExams: paper.targetExams,
    subjectConfigurations: paper.subjectConfigurations,
    questionCount: paper.questionCount,
    status: paper.status,
    generationProvider: paper.generationProvider,
    generationModel: paper.generationModel,
    promptVersion: paper.promptVersion,
    historicalAnalysisMode: paper.historicalAnalysisMode,
    historicalAnalysisSummary: paper.historicalAnalysisSummary,
    validationSummary: paper.validationSummary,
    notes: paper.notes,
    createdAt: paper.createdAt,
    updatedAt: paper.updatedAt,
    questions: (paper.questions ?? []).map(serializeQuestion).sort((left, right) => left.position - right.position),
  };
}
