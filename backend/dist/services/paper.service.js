"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaperService = void 0;
const app_error_1 = require("../errors/app-error");
const logger_1 = require("../config/logger");
const normalization_1 = require("../utils/normalization");
const paper_entity_1 = require("../entities/paper.entity");
const question_entity_1 = require("../entities/question.entity");
const generation_run_entity_1 = require("../entities/generation-run.entity");
function defaultTitle(input) {
    return [
        input.exam,
        input.classLevel,
        input.mode === "individual" ? "Individual Questions" : "Full Paper",
        new Date().toLocaleDateString("en-IN"),
    ].join(" — ");
}
function targetExamsFromExam(exam) {
    return exam === "JEE" ? ["JEE_MAIN"] : ["NEET"];
}
class PaperService {
    paperRepository;
    questionRepository;
    userRepository;
    questionGenerationService;
    generationRunRepository;
    dataSource;
    constructor(paperRepository, questionRepository, userRepository, questionGenerationService, generationRunRepository, dataSource) {
        this.paperRepository = paperRepository;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
        this.questionGenerationService = questionGenerationService;
        this.generationRunRepository = generationRunRepository;
        this.dataSource = dataSource;
    }
    async listPapers(userId) {
        return this.paperRepository.findAllActiveForUser(userId);
    }
    async getPaper(userId, paperId) {
        const paper = await this.paperRepository.findActiveByIdForUser(paperId, userId);
        if (!paper) {
            throw new app_error_1.AppError(404, "PAPER_NOT_FOUND", "The requested paper could not be found.");
        }
        return paper;
    }
    async generatePaper(userId, input) {
        logger_1.logger.info({
            userId,
            exam: input.exam,
            classLevel: input.classLevel,
            mode: input.mode,
            subjectCount: input.subjects.length,
        }, "Paper generation requested.");
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new app_error_1.AppError(401, "USER_NOT_FOUND", "The signed-in account could not be found.");
        }
        const targetExams = input.targetExams?.length
            ? input.targetExams
            : [...targetExamsFromExam(input.exam)];
        const generationRuns = [];
        const historicalModes = new Set();
        const historicalDetails = [];
        const subjectResults = await Promise.all(input.subjects.map(async (configuration, subjectIndex) => {
            logger_1.logger.info({
                userId,
                subject: configuration.subject,
                chapter: configuration.chapter,
                subTopic: configuration.subTopic,
                questionCount: configuration.numberOfQuestions,
            }, "Generating questions for subject within paper.");
            const subjectResult = await this.questionGenerationService.generateForSubject({
                subjectConfiguration: configuration,
                classLevel: input.classLevel,
                targetExams,
                previousQuestionTexts: [],
            });
            logger_1.logger.info({
                userId,
                subject: configuration.subject,
                generatedQuestionCount: subjectResult.questions.length,
                provider: subjectResult.generationRun.provider,
                model: subjectResult.generationRun.model,
            }, "Completed subject generation for paper.");
            return {
                configuration,
                subjectIndex,
                subjectResult,
            };
        }));
        let position = 1;
        const allQuestions = [];
        for (const { subjectResult } of subjectResults) {
            historicalModes.add(subjectResult.historicalAnalysisSummary.mode);
            historicalDetails.push(subjectResult.historicalAnalysisSummary);
            const questionEntities = subjectResult.questions.map((questionPayload) => this.questionRepository.create({
                paperId: "",
                position: position++,
                subject: questionPayload.subject,
                classLevel: questionPayload.classLevel,
                chapter: questionPayload.chapter,
                chapterNormalized: (0, normalization_1.normalizeTopicKey)(questionPayload.chapter),
                subTopic: questionPayload.subTopic,
                subTopicNormalized: (0, normalization_1.normalizeTopicKey)(questionPayload.subTopic),
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
            }));
            allQuestions.push(...questionEntities);
            generationRuns.push(this.generationRunRepository.create(subjectResult.generationRun));
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
            historicalAnalysisMode: historicalModes.size > 1
                ? "mixed"
                : ([...historicalModes][0] ??
                    "model_knowledge_fallback"),
            historicalAnalysisSummary: {
                mode: historicalModes.size > 1
                    ? "mixed"
                    : ([...historicalModes][0] ??
                        "model_knowledge_fallback"),
                totalRelevantQuestions: historicalDetails.reduce((sum, detail) => sum +
                    Number(detail
                        .totalRelevantQuestions ?? 0), 0),
                yearsCovered: [
                    ...new Set(historicalDetails.flatMap((detail) => detail.yearsCovered ?? [])),
                ].sort((left, right) => left - right),
                trendSummary: historicalDetails
                    .map((detail) => detail.trendSummary)
                    .filter(Boolean)
                    .join(" "),
                recurringConcepts: [
                    ...new Set(historicalDetails.flatMap((detail) => detail
                        .recurringConcepts ?? [])),
                ],
                difficultyNotes: historicalDetails.flatMap((detail) => detail.difficultyNotes ?? []),
                sourceDetails: historicalDetails.flatMap((detail) => detail.sourceDetails ?? []),
            },
            validationSummary: {
                generatedQuestionCount: allQuestions.length,
                subjectCount: input.subjects.length,
                subjectMetrics: subjectResults.map(({ configuration, subjectResult }) => ({
                    subject: configuration.subject,
                    chapter: configuration.chapter,
                    subTopic: configuration.subTopic,
                    metrics: subjectResult.generationRun.validationReport.metrics ?? null,
                })),
            },
            notes: {
                historicalDetails,
            },
        });
        const { savedPaper, savedQuestions } = await this.dataSource.transaction(async (manager) => {
            const persistedPaper = await manager.save(paper_entity_1.Paper, paper);
            const questionsToSave = allQuestions.map((question) => Object.assign(question, { paperId: persistedPaper.id }));
            const runsToSave = generationRuns.map((generationRun) => Object.assign(generationRun, { paperId: persistedPaper.id }));
            const persistedQuestions = await manager.save(question_entity_1.Question, questionsToSave);
            await manager.save(generation_run_entity_1.GenerationRun, runsToSave);
            return {
                savedPaper: persistedPaper,
                savedQuestions: persistedQuestions,
            };
        });
        logger_1.logger.info({
            userId,
            paperId: savedPaper.id,
            questionCount: savedQuestions.length,
            provider: savedPaper.generationProvider,
            model: savedPaper.generationModel,
        }, "Paper generation completed and persisted.");
        return {
            ...savedPaper,
            questions: savedQuestions.sort((left, right) => left.position - right.position),
        };
    }
    async renamePaper(userId, paperId, input) {
        const paper = await this.getPaper(userId, paperId);
        paper.title = input.title;
        return this.paperRepository.save(paper);
    }
    async deletePaper(userId, paperId) {
        const paper = await this.getPaper(userId, paperId);
        paper.status = "deleted";
        await this.paperRepository.save(paper);
    }
    async regeneratePaper(userId, paperId) {
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
    async updateQuestion(userId, paperId, questionId, input) {
        const paper = await this.getPaper(userId, paperId);
        const question = paper.questions.find((item) => item.id === questionId);
        if (!question) {
            throw new app_error_1.AppError(404, "QUESTION_NOT_FOUND", "The requested question could not be found.");
        }
        const normalizedText = (0, normalization_1.normalizeText)(input.text);
        const normalizedHash = (0, normalization_1.hashNormalizedText)(input.text);
        const relevantQuestions = await this.questionRepository.findRelevantForDeduplication({
            subject: question.subject,
            classLevel: question.classLevel,
            chapterNormalized: question.chapterNormalized,
            subTopicNormalized: question.subTopicNormalized,
        });
        const conflictingQuestion = relevantQuestions.find((existing) => existing.id !== question.id &&
            existing.normalizedHash === normalizedHash);
        if (conflictingQuestion) {
            throw new app_error_1.AppError(409, "QUESTION_DUPLICATE", "The edited question duplicates an existing question in the question bank.");
        }
        question.text = input.text;
        question.normalizedText = normalizedText;
        question.normalizedHash = normalizedHash;
        question.structuralFingerprint = (0, normalization_1.hashStructuralText)(input.text);
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
    async regenerateQuestion(userId, paperId, questionId) {
        const paper = await this.getPaper(userId, paperId);
        const question = paper.questions.find((item) => item.id === questionId);
        if (!question) {
            throw new app_error_1.AppError(404, "QUESTION_NOT_FOUND", "The requested question could not be found.");
        }
        const subjectResult = await this.questionGenerationService.generateForSubject({
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
            throw new app_error_1.AppError(502, "QUESTION_REGEN_FAILED", "Failed to regenerate the requested question.");
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
exports.PaperService = PaperService;
//# sourceMappingURL=paper.service.js.map