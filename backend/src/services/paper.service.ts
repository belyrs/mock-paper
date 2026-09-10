import { AppError } from "../errors/app-error";
import { logger } from "../config/logger";
import type {
  GeneratePaperInput,
  RenamePaperInput,
  UpdateQuestionInput,
} from "../dtos/paper.dto";
import { PaperRepository } from "../repositories/paper.repository";
import { QuestionRepository } from "../repositories/question.repository";
import { GenerationRunRepository } from "../repositories/generation-run.repository";
import { QuestionGenerationService } from "./question-generation.service";
import {
  hashNormalizedText,
  hashStructuralText,
  normalizeTopicKey,
  normalizeText,
} from "../utils/normalization";
import { Paper } from "../entities/paper.entity";
import { Question } from "../entities/question.entity";
import { GenerationRun } from "../entities/generation-run.entity";
import { UserRepository } from "../repositories/user.repository";
import type { DataSource } from "typeorm";

function defaultTitle(input: GeneratePaperInput) {
  return [
    input.exam,
    input.classLevel,
    input.mode === "individual" ? "Individual Questions" : "Full Paper",
    new Date().toLocaleDateString("en-IN"),
  ].join(" — ");
}

function targetExamsFromExam(exam: GeneratePaperInput["exam"]) {
  return exam === "JEE" ? (["JEE_MAIN"] as const) : (["NEET"] as const);
}

export class PaperService {
  constructor(
    private readonly paperRepository: PaperRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly userRepository: UserRepository,
    private readonly questionGenerationService: QuestionGenerationService,
    private readonly generationRunRepository: GenerationRunRepository,
    private readonly dataSource: DataSource,
  ) {}

  async listPapers(userId: string) {
    return this.paperRepository.findAllActiveForUser(userId);
  }

  async getPaper(userId: string, paperId: string) {
    const paper = await this.paperRepository.findActiveByIdForUser(
      paperId,
      userId,
    );

    if (!paper) {
      throw new AppError(
        404,
        "PAPER_NOT_FOUND",
        "The requested paper could not be found.",
      );
    }

    return paper;
  }

  async generatePaper(userId: string, input: GeneratePaperInput) {
    logger.info(
      {
        userId,
        exam: input.exam,
        classLevel: input.classLevel,
        mode: input.mode,
        subjectCount: input.subjects.length,
      },
      "Paper generation requested.",
    );

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(
        401,
        "USER_NOT_FOUND",
        "The signed-in account could not be found.",
      );
    }

    const targetExams = input.targetExams?.length
      ? input.targetExams
      : [...targetExamsFromExam(input.exam)];
    const generationRuns: GenerationRun[] = [];
    const historicalModes = new Set<string>();
    const historicalDetails: unknown[] = [];

    const subjectResults = await Promise.all(
      input.subjects.map(async (configuration, subjectIndex) => {
        logger.info(
          {
            userId,
            subject: configuration.subject,
            chapter: configuration.chapter,
            subTopic: configuration.subTopic,
            questionCount: configuration.numberOfQuestions,
          },
          "Generating questions for subject within paper.",
        );

        const subjectResult =
          await this.questionGenerationService.generateForSubject({
            subjectConfiguration: configuration,
            classLevel: input.classLevel,
            targetExams,
            previousQuestionTexts: [],
          });

        logger.info(
          {
            userId,
            subject: configuration.subject,
            generatedQuestionCount: subjectResult.questions.length,
            provider: subjectResult.generationRun.provider,
            model: subjectResult.generationRun.model,
          },
          "Completed subject generation for paper.",
        );

        return {
          configuration,
          subjectIndex,
          subjectResult,
        };
      }),
    );

    let position = 1;
    const allQuestions: Question[] = [];

    for (const { subjectResult } of subjectResults) {
      historicalModes.add(subjectResult.historicalAnalysisSummary.mode);
      historicalDetails.push(subjectResult.historicalAnalysisSummary);

      const questionEntities = subjectResult.questions.map((questionPayload) =>
        this.questionRepository.create({
          paperId: "",
          position: position++,
          subject: questionPayload.subject,
          classLevel: questionPayload.classLevel,
          chapter: questionPayload.chapter,
          chapterNormalized: normalizeTopicKey(questionPayload.chapter),
          subTopic: questionPayload.subTopic,
          subTopicNormalized: normalizeTopicKey(questionPayload.subTopic),
          targetExams: questionPayload.targetExams,
          difficulty: questionPayload.difficulty,
          questionType: "MCQ",
          text: questionPayload.text,
          normalizedText: questionPayload.normalizedText,
          normalizedHash: questionPayload.normalizedHash,
          structuralFingerprint: questionPayload.structuralFingerprint,
          options: questionPayload.options,
          correctOption: questionPayload.correctOption,
          correctIndex: questionPayload.correctIndex,
          conceptTested: questionPayload.conceptTested,
          commonMistake: questionPayload.commonMistake,
          recommendedRemedialAction: questionPayload.recommendedRemedialAction,
          learningOutcome: questionPayload.learningOutcome,
          bloomsTaxonomyLevel: questionPayload.bloomsTaxonomyLevel,
          examRelevance: questionPayload.examRelevance,
          sourceReference: questionPayload.sourceReference,
          generationProvider: subjectResult.generationRun.provider,
          generationModel: subjectResult.generationRun.model,
          promptVersion: subjectResult.generationRun.promptVersion,
          semanticEmbedding: questionPayload.semanticEmbedding,
          metadata: questionPayload.metadata,
        }),
      );

      allQuestions.push(...questionEntities);
      generationRuns.push(
        this.generationRunRepository.create(subjectResult.generationRun),
      );
    }

    const paper = this.paperRepository.create({
      userId: user.id,
      title: input.title?.trim() || defaultTitle(input),
      exam: input.exam,
      classLevel: input.classLevel,
      mode: input.mode,
      targetExams,
      subjectConfigurations: input.subjects,
      questionCount: allQuestions.length,
      status: "active",
      generationProvider: generationRuns[0]?.provider ?? "openai",
      generationModel: generationRuns[0]?.model ?? "unknown",
      promptVersion: generationRuns[0]?.promptVersion ?? "unknown",
      historicalAnalysisMode:
        historicalModes.size > 1
          ? "mixed"
          : (([...historicalModes][0] ??
              "model_knowledge_fallback") as Paper["historicalAnalysisMode"]),
      historicalAnalysisSummary: {
        mode:
          historicalModes.size > 1
            ? "mixed"
            : (([...historicalModes][0] ??
                "model_knowledge_fallback") as Paper["historicalAnalysisMode"]),
        totalRelevantQuestions: historicalDetails.reduce(
          (sum: number, detail) =>
            sum +
            Number(
              (detail as { totalRelevantQuestions?: number })
                .totalRelevantQuestions ?? 0,
            ),
          0 as number,
        ),
        yearsCovered: [
          ...new Set(
            historicalDetails.flatMap(
              (detail) =>
                (detail as { yearsCovered?: number[] }).yearsCovered ?? [],
            ),
          ),
        ].sort((left, right) => left - right),
        trendSummary: historicalDetails
          .map((detail) => (detail as { trendSummary?: string }).trendSummary)
          .filter(Boolean)
          .join(" "),
        recurringConcepts: [
          ...new Set(
            historicalDetails.flatMap(
              (detail) =>
                (detail as { recurringConcepts?: string[] })
                  .recurringConcepts ?? [],
            ),
          ),
        ],
        difficultyNotes: historicalDetails.flatMap(
          (detail) =>
            (detail as { difficultyNotes?: string[] }).difficultyNotes ?? [],
        ),
        sourceDetails: historicalDetails.flatMap(
          (detail) =>
            (detail as { sourceDetails?: string[] }).sourceDetails ?? [],
        ),
      },
      validationSummary: {
        generatedQuestionCount: allQuestions.length,
        subjectCount: input.subjects.length,
        subjectMetrics: subjectResults.map(
          ({ configuration, subjectResult }) => ({
            subject: configuration.subject,
            chapter: configuration.chapter,
            subTopic: configuration.subTopic,
            metrics:
              subjectResult.generationRun.validationReport.metrics ?? null,
          }),
        ),
      },
      notes: {
        historicalDetails,
      },
    });

    const { savedPaper, savedQuestions } = await this.dataSource.transaction(
      async (manager) => {
        const persistedPaper = await manager.save(Paper, paper);
        const questionsToSave = allQuestions.map((question) =>
          Object.assign(question, { paperId: persistedPaper.id }),
        );
        const runsToSave = generationRuns.map((generationRun) =>
          Object.assign(generationRun, { paperId: persistedPaper.id }),
        );
        const persistedQuestions = await manager.save(
          Question,
          questionsToSave,
        );
        await manager.save(GenerationRun, runsToSave);

        return {
          savedPaper: persistedPaper,
          savedQuestions: persistedQuestions,
        };
      },
    );

    logger.info(
      {
        userId,
        paperId: savedPaper.id,
        questionCount: savedQuestions.length,
        provider: savedPaper.generationProvider,
        model: savedPaper.generationModel,
      },
      "Paper generation completed and persisted.",
    );

    return {
      ...savedPaper,
      questions: savedQuestions.sort(
        (left, right) => left.position - right.position,
      ),
    };
  }

  async renamePaper(userId: string, paperId: string, input: RenamePaperInput) {
    const paper = await this.getPaper(userId, paperId);
    paper.title = input.title;
    return this.paperRepository.save(paper);
  }

  async deletePaper(userId: string, paperId: string) {
    const paper = await this.getPaper(userId, paperId);
    paper.status = "deleted";
    await this.paperRepository.save(paper);
  }

  async regeneratePaper(userId: string, paperId: string) {
    const paper = await this.getPaper(userId, paperId);
    return this.generatePaper(userId, {
      title: paper.title,
      exam: paper.exam,
      classLevel: paper.classLevel,
      mode: paper.mode,
      targetExams: paper.targetExams,
      subjects: paper.subjectConfigurations,
    });
  }

  async updateQuestion(
    userId: string,
    paperId: string,
    questionId: string,
    input: UpdateQuestionInput,
  ) {
    const paper = await this.getPaper(userId, paperId);
    const question = paper.questions.find((item) => item.id === questionId);

    if (!question) {
      throw new AppError(
        404,
        "QUESTION_NOT_FOUND",
        "The requested question could not be found.",
      );
    }

    const normalizedText = normalizeText(input.text);
    const normalizedHash = hashNormalizedText(input.text);

    const relevantQuestions =
      await this.questionRepository.findRelevantForDeduplication({
        subject: question.subject,
        classLevel: question.classLevel,
        chapterNormalized: question.chapterNormalized,
        subTopicNormalized: question.subTopicNormalized,
      });

    const conflictingQuestion = relevantQuestions.find(
      (existing) =>
        existing.id !== question.id &&
        existing.normalizedHash === normalizedHash,
    );

    if (conflictingQuestion) {
      throw new AppError(
        409,
        "QUESTION_DUPLICATE",
        "The edited question duplicates an existing question in the question bank.",
      );
    }

    question.text = input.text;
    question.normalizedText = normalizedText;
    question.normalizedHash = normalizedHash;
    question.structuralFingerprint = hashStructuralText(input.text);
    question.options = input.options;
    question.correctOption = input.correctOption;
    question.correctIndex = ["A", "B", "C", "D"].indexOf(input.correctOption);
    question.difficulty = input.difficulty ?? question.difficulty;
    question.conceptTested = input.conceptTested;
    question.commonMistake = input.commonMistake;
    question.recommendedRemedialAction = input.recommendedRemedialAction;
    question.learningOutcome = input.learningOutcome;
    question.bloomsTaxonomyLevel = input.bloomsTaxonomyLevel;
    question.examRelevance = input.examRelevance;
    question.sourceReference = input.sourceReference ?? null;

    await this.questionRepository.save(question);
    return this.getPaper(userId, paperId);
  }

  async regenerateQuestion(
    userId: string,
    paperId: string,
    questionId: string,
  ) {
    const paper = await this.getPaper(userId, paperId);
    const question = paper.questions.find((item) => item.id === questionId);

    if (!question) {
      throw new AppError(
        404,
        "QUESTION_NOT_FOUND",
        "The requested question could not be found.",
      );
    }

    const subjectResult =
      await this.questionGenerationService.generateForSubject({
        subjectConfiguration: {
          subject: question.subject,
          chapter: question.chapter,
          subTopic: question.subTopic,
          numberOfQuestions: 1,
          mix: {
            Easy: question.difficulty === "Easy" ? 100 : 0,
            Medium: question.difficulty === "Medium" ? 100 : 0,
            Hard: question.difficulty === "Hard" ? 100 : 0,
          },
        },
        classLevel: paper.classLevel,
        targetExams: paper.targetExams,
        previousQuestionTexts: paper.questions
          .filter((item) => item.id !== question.id)
          .map((item) => item.text),
        excludePaperId: paper.id,
        excludeQuestionId: question.id,
      });

    const replacement = subjectResult.questions[0];
    if (!replacement) {
      throw new AppError(
        502,
        "QUESTION_REGEN_FAILED",
        "Failed to regenerate the requested question.",
      );
    }

    question.text = replacement.text;
    question.normalizedText = replacement.normalizedText;
    question.normalizedHash = replacement.normalizedHash;
    question.structuralFingerprint = replacement.structuralFingerprint;
    question.options = replacement.options;
    question.correctOption = replacement.correctOption;
    question.correctIndex = replacement.correctIndex;
    question.difficulty = replacement.difficulty;
    question.conceptTested = replacement.conceptTested;
    question.commonMistake = replacement.commonMistake;
    question.recommendedRemedialAction = replacement.recommendedRemedialAction;
    question.learningOutcome = replacement.learningOutcome;
    question.bloomsTaxonomyLevel = replacement.bloomsTaxonomyLevel;
    question.examRelevance = replacement.examRelevance;
    question.sourceReference = replacement.sourceReference;
    question.generationProvider = subjectResult.generationRun.provider;
    question.generationModel = subjectResult.generationRun.model;
    question.promptVersion = subjectResult.generationRun.promptVersion;
    question.semanticEmbedding = replacement.semanticEmbedding;
    question.metadata = replacement.metadata;

    await this.questionRepository.save(question);
    return this.getPaper(userId, paperId);
  }
}
