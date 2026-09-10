import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import supertest from "supertest";
import { createApp } from "../src/app";
import { AppError } from "../src/errors/app-error";
import { toPublicError } from "../src/errors/public-error";
import { AuthService } from "../src/services/auth.service";
import { DuplicateDetectionService } from "../src/services/duplicate-detection.service";
import { HistoricalAnalysisService } from "../src/services/historical-analysis.service";
import { HistoricalPaperService } from "../src/services/historical-paper.service";
import { MockQuestionGenerationProvider } from "../src/services/generation/mock.provider";
import { createMailService } from "../src/services/mail/mail-service";
import { buildGenerationPlan } from "../src/services/generation/plan-builder";
import { buildQuestionPrompt } from "../src/services/generation/prompt-builder";
import { ResilientQuestionGenerationProvider } from "../src/services/generation/resilient.provider";
import { validateProviderOutput } from "../src/services/generation/output-validator";
import { PaperService } from "../src/services/paper.service";
import { PasswordResetService } from "../src/services/password-reset.service";
import {
  QuestionGenerationService,
  shouldAcceptAcademicReview,
} from "../src/services/question-generation.service";
import { SyllabusGroundingService } from "../src/services/syllabus-grounding.service";
import { buildDataSource } from "../src/config/data-source";
import { generatePaperSchema } from "../src/dtos/paper.dto";
import { GenerationRunRepository } from "../src/repositories/generation-run.repository";
import { HistoricalRepository } from "../src/repositories/historical.repository";
import { PaperRepository } from "../src/repositories/paper.repository";
import { PasswordResetTokenRepository } from "../src/repositories/password-reset-token.repository";
import { QuestionRepository } from "../src/repositories/question.repository";
import { UserRepository } from "../src/repositories/user.repository";
import { serializePaper } from "../src/utils/serializers";
import {
  buildAuthCookieOptions,
  getAuthCookieOptions,
  resolveAuthCookieSameSite,
} from "../src/utils/auth";
import { createTestDataSource } from "./test-data-source";
import type {
  GenerationProviderRequest,
  GenerationProviderResult,
  QuestionQualityReview,
  ValidatedQuestionPayload,
} from "../src/services/generation/types";

describe("MockPaper backend services", () => {
  let dataSource: DataSource;
  let authService: AuthService;
  let passwordResetService: PasswordResetService;
  let paperService: PaperService;
  let historicalPaperService: HistoricalPaperService;

  beforeEach(async () => {
    dataSource = await createTestDataSource();

    const userRepository = new UserRepository(dataSource);
    const passwordResetTokenRepository = new PasswordResetTokenRepository(
      dataSource,
    );
    const paperRepository = new PaperRepository(dataSource);
    const questionRepository = new QuestionRepository(dataSource);
    const generationRunRepository = new GenerationRunRepository(dataSource);
    const historicalRepository = new HistoricalRepository(dataSource);
    const provider = new MockQuestionGenerationProvider();
    const duplicateDetectionService = new DuplicateDetectionService(
      questionRepository,
      historicalRepository,
      provider,
    );
    const historicalAnalysisService = new HistoricalAnalysisService(
      historicalRepository,
    );
    const syllabusGroundingService = new SyllabusGroundingService();
    const questionGenerationService = new QuestionGenerationService(
      provider,
      duplicateDetectionService,
      historicalAnalysisService,
      syllabusGroundingService,
    );

    authService = new AuthService(userRepository);
    passwordResetService = new PasswordResetService(
      userRepository,
      passwordResetTokenRepository,
      createMailService(),
    );
    historicalPaperService = new HistoricalPaperService(historicalRepository);
    paperService = new PaperService(
      paperRepository,
      questionRepository,
      userRepository,
      questionGenerationService,
      generationRunRepository,
      dataSource,
    );
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  async function createUser() {
    return authService.register({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "supersecret123",
    });
  }

  it("initializes a working database connection", async () => {
    const result = await dataSource.query("SELECT 1 as ok");
    expect(result[0]?.ok).toBe(1);
  });

  it("registers, authenticates, and resolves the current user", async () => {
    const createdUser = await createUser();
    const loggedInUser = await authService.login({
      email: "ada@example.com",
      password: "supersecret123",
    });
    const currentUser = await authService.me(createdUser.id);

    expect(loggedInUser.email).toBe("ada@example.com");
    expect(currentUser.role).toBe("admin");
  });

  it("keeps auth cookies compatible with localhost development", () => {
    const cookieOptions = getAuthCookieOptions();

    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.sameSite).toBe("lax");
    expect(cookieOptions.secure).toBe(false);
    expect(cookieOptions.partitioned).toBe(false);
    expect(cookieOptions.path).toBe("/");
    expect(resolveAuthCookieSameSite(true)).toBe("none");

    const crossSiteHttpsCookie = buildAuthCookieOptions(true);
    expect(crossSiteHttpsCookie.secure).toBe(true);
    expect(crossSiteHttpsCookie.sameSite).toBe("none");
    expect(crossSiteHttpsCookie.partitioned).toBe(true);
  });

  it("persists an HTTP session after account registration", async () => {
    const agent = supertest.agent(createApp(dataSource));
    const registration = await agent.post("/api/auth/register").send({
      name: "Grace Hopper",
      email: "grace@example.com",
      password: "supersecret123",
    });

    expect(registration.status).toBe(201);
    const setCookie = registration.headers["set-cookie"] as
      string[] | undefined;
    expect(setCookie?.[0]).toContain("mockpaper_auth=");
    expect(setCookie?.[0]).toContain("HttpOnly");
    expect(setCookie?.[0]).toContain("SameSite=Lax");

    const currentUser = await agent.get("/api/auth/me");
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.user.email).toBe("grace@example.com");
  });

  it("validates paper generation input", () => {
    const result = generatePaperSchema.safeParse({
      exam: "JEE",
      classLevel: "Class 11",
      mode: "individual",
      subjects: [
        {
          subject: "Physics",
          chapter: "",
          subTopic: "First Law",
          numberOfQuestions: 5,
          mix: { Easy: 30, Medium: 30, Hard: 30 },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("sanitizes provider failures before they cross the API boundary", () => {
    const providerFailure = new AppError(
      502,
      "OPENAI_REQUEST_FAILED",
      "The OpenAI model failed because the API quota was exceeded.",
      {
        model: "gpt-5.2",
        body: "provider response body",
        promptTokens: 1200,
      },
    );

    expect(toPublicError(providerFailure)).toEqual({
      code: "QUESTION_PREPARATION_FAILED",
      message: "We couldn't prepare the question paper. Please try again.",
      details: null,
    });
    expect(
      toPublicError(
        new AppError(
          502,
          "OPENAI_REQUEST_TIMEOUT",
          "The OpenAI generation request timed out.",
        ),
      ),
    ).toEqual({
      code: "QUESTION_PREPARATION_TIMEOUT",
      message:
        "Question paper preparation is taking longer than expected. Please try again.",
      details: null,
    });
  });

  it("builds the canonical OpenAI prompt with dynamic syllabus fields", () => {
    const syllabusGroundingService = new SyllabusGroundingService();
    const prompt = buildQuestionPrompt({
      subject: "Physics",
      classLevel: "Class 11",
      chapter: "Units and Measurements",
      subTopic: "Dimensional Analysis and Applications",
      targetExams: ["JEE_MAIN", "KCET"],
      questionCount: 10,
      difficultyMix: { Easy: 30, Medium: 50, Hard: 20 },
      historicalAnalysis: {
        mode: "model_knowledge_fallback",
        totalRelevantQuestions: 0,
        yearsCovered: [],
        trendSummary: "No imported dataset is currently available.",
        recurringConcepts: [],
        difficultyNotes: [],
        sourceDetails: [],
      },
      previousQuestions: ["Existing question to exclude"],
      syllabusContext: syllabusGroundingService.resolve({
        subject: "Physics",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis and Applications",
      }),
      generationPlan: buildGenerationPlan({
        subject: "Physics",
        classLevel: "Class 11",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis and Applications",
        questionCount: 10,
        difficultyMix: { Easy: 30, Medium: 50, Hard: 20 },
        difficultyCounts: { Easy: 3, Medium: 5, Hard: 2 },
        syllabusContext: syllabusGroundingService.resolve({
          subject: "Physics",
          chapter: "Units and Measurements",
          subTopic: "Dimensional Analysis and Applications",
        }),
      }),
    });

    expect(prompt).toContain("Act as an expert Physics faculty member");
    expect(prompt).toContain("Subject: Physics");
    expect(prompt).toContain("Class/Grade: Class 11");
    expect(prompt).toContain("Chapter: Units and Measurements");
    expect(prompt).toContain(
      "Topics/Subtopics: Dimensional Analysis and Applications",
    );
    expect(prompt).toContain(
      "Target Exams (in priority order): JEE Main, KCET",
    );
    expect(prompt).toContain("Easy: 3 question(s)");
    expect(prompt).toContain("Medium: 5 question(s)");
    expect(prompt).toContain("Hard: 2 question(s)");
    expect(prompt).toContain("Syllabus grounding for this request:");
    expect(prompt).toContain("Dimensional formulae of physical quantities");
    expect(prompt).toContain("Difficulty guidance:");
    expect(prompt).toContain("provide a concise solution outline");
    expect(prompt).toContain("Return JSON only");
    expect(prompt).toContain(
      "Deterministic generation plan for diversity and coverage:",
    );
    expect(prompt.length).toBeLessThan(10_000);
  });

  it("builds distinct retry-aware blueprints for a ten-question syllabus slice", () => {
    const syllabusContext = new SyllabusGroundingService().resolve({
      subject: "Physics",
      chapter: "Units and Measurements",
      subTopic: "Dimensional Analysis and Applications",
    });
    const build = (diversityOffset: number) =>
      buildGenerationPlan({
        subject: "Physics",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis and Applications",
        questionCount: 10,
        difficultyMix: { Easy: 10, Medium: 20, Hard: 70 },
        difficultyCounts: { Easy: 1, Medium: 2, Hard: 7 },
        syllabusContext,
        diversityOffset,
      });

    const firstPlan = build(88);
    const retryPlan = build(219);
    const blueprintKey = (slot: (typeof firstPlan)[number]) =>
      [slot.difficulty, slot.concept, slot.pattern, slot.questionForm].join(
        "|",
      );

    expect(firstPlan).toHaveLength(10);
    expect(new Set(firstPlan.map(blueprintKey)).size).toBe(10);
    expect(retryPlan.map(blueprintKey)).not.toEqual(
      firstPlan.map(blueprintKey),
    );
    expect(
      firstPlan
        .filter((slot) => slot.difficulty === "Hard")
        .every((slot) =>
          syllabusContext.difficultyGuidance?.Hard?.includes(slot.questionForm),
        ),
    ).toBe(true);
  });

  it("accepts only calibrated difficulty disagreements for otherwise valid hard questions", () => {
    const question = {
      difficulty: "Hard",
      correctOption: "A",
      metadata: {
        generationPlanSlot: {
          difficulty: "Hard",
          questionForm:
            "Use a two-stage dimensional derivation and scaling application.",
        },
        difficultyRationale:
          "Requires a derivation followed by an independent scaling application.",
      },
    } as unknown as ValidatedQuestionPayload;
    const review = {
      candidateIndex: 1,
      accepted: false,
      independentCorrectOption: "A",
      syllabusAligned: true,
      unambiguous: true,
      difficultyAligned: false,
      metadataAligned: true,
      verificationSummary: "The independently derived answer is option A.",
      issues: [
        "Difficulty fits Medium rather than Hard under a broader exam rubric.",
      ],
    } satisfies QuestionQualityReview;

    expect(shouldAcceptAcademicReview(question, review)).toBe(true);
    expect(
      shouldAcceptAcademicReview(question, {
        ...review,
        issues: ["Difficulty is Easy because this is a direct one-step check."],
      }),
    ).toBe(false);
    expect(
      shouldAcceptAcademicReview(question, {
        ...review,
        independentCorrectOption: "B",
        issues: ["Difficulty fits Medium rather than Hard."],
      }),
    ).toBe(false);
  });

  it("rejects placeholder-style academic nonsense before persistence", () => {
    const syllabusGroundingService = new SyllabusGroundingService();
    const request = {
      subject: "Physics",
      classLevel: "Class 11" as const,
      chapter: "Units and Measurements",
      subTopic: "Dimensional Analysis and Applications",
      targetExams: ["JEE_MAIN"] as const,
      questionCount: 1,
      difficultyMix: { Easy: 100, Medium: 0, Hard: 0 },
      historicalAnalysis: {
        mode: "model_knowledge_fallback" as const,
        totalRelevantQuestions: 0,
        yearsCovered: [],
        trendSummary: "No imported dataset.",
        recurringConcepts: [],
        difficultyNotes: [],
        sourceDetails: [],
      },
      previousQuestions: [],
      syllabusContext: syllabusGroundingService.resolve({
        subject: "Physics",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis and Applications",
      }),
      generationPlan: buildGenerationPlan({
        subject: "Physics",
        classLevel: "Class 11",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis and Applications",
        questionCount: 1,
        difficultyMix: { Easy: 100, Medium: 0, Hard: 0 },
        difficultyCounts: { Easy: 1, Medium: 0, Hard: 0 },
        syllabusContext: syllabusGroundingService.resolve({
          subject: "Physics",
          chapter: "Units and Measurements",
          subTopic: "Dimensional Analysis and Applications",
        }),
      }),
    };

    expect(() =>
      validateProviderOutput(request, {
        rawPrompt: "mock",
        rawResponse: {},
        provider: "mock",
        model: "mock",
        historicalAnalysisMode: "model_knowledge_fallback",
        historicalAnalysisSummary: "No imported dataset.",
        questions: [
          {
            questionNumber: 1,
            difficulty: "Easy",
            questionText:
              "In the scenario tagged 27f2c4c6-600-1, the boundary-condition lens uses reference values 40 and 33.",
            options: [
              "Apply the core idea only after checking the boundary-condition lens.",
              "Use a shortcut.",
              "Pick a random interpretation.",
              "Choose the plausible option.",
            ],
            correctOption: "A",
            conceptTested: "Dimensional Analysis reasoning",
            commonMistake: "Generic mistake",
            recommendedRemedialAction: "Generic action",
            learningOutcome: "Generic outcome",
            bloomsTaxonomyLevel: "Understanding",
            examRelevance: { JEE_MAIN: "High" },
            sourceReference: null,
          },
        ],
      }),
    ).toThrowError(/placeholder|synthetic internal metadata/i);

    expect(() =>
      validateProviderOutput(request, {
        rawPrompt: "internal request",
        rawResponse: {},
        provider: "internal",
        model: "internal",
        historicalAnalysisMode: "model_knowledge_fallback",
        historicalAnalysisSummary: "No imported dataset.",
        questions: [
          {
            questionNumber: 1,
            difficulty: "Easy",
            questionText:
              "Which dimensional formula correctly represents force?",
            options: ["MLT^-2", "ML^2T^-2", "ML^-1T^-2", "LT^-1"],
            correctOption: "A",
            conceptTested: "Dimensional formulae of physical quantities",
            commonMistake: "Using the dimensions of work instead of force",
            recommendedRemedialAction:
              "Derive force from mass multiplied by acceleration.",
            learningOutcome:
              "Identify dimensions from a defining physical relation.",
            bloomsTaxonomyLevel: "Understanding",
            examRelevance: { JEE_MAIN: "High" },
            sourceReference: "OpenAI model output",
          },
        ],
      }),
    ).toThrowError(/internal preparation terminology/i);
  });

  it("does not reject valid full-chapter questions when no curated concept map exists", () => {
    const syllabusGroundingService = new SyllabusGroundingService();
    const syllabusContext = syllabusGroundingService.resolve({
      subject: "Chemistry",
      chapter: "Amines",
      subTopic: "Full Chapter",
    });
    const request: GenerationProviderRequest = {
      subject: "Chemistry",
      classLevel: "Class 12",
      chapter: "Amines",
      subTopic: "Full Chapter",
      targetExams: ["JEE_MAIN"],
      questionCount: 1,
      difficultyMix: { Easy: 0, Medium: 100, Hard: 0 },
      difficultyCounts: { Easy: 0, Medium: 1, Hard: 0 },
      historicalAnalysis: {
        mode: "model_knowledge_fallback",
        totalRelevantQuestions: 0,
        yearsCovered: [],
        trendSummary: "No imported dataset.",
        recurringConcepts: [],
        difficultyNotes: [],
        sourceDetails: [],
      },
      previousQuestions: [],
      syllabusContext,
      generationPlan: buildGenerationPlan({
        subject: "Chemistry",
        chapter: "Amines",
        subTopic: "Full Chapter",
        questionCount: 1,
        difficultyMix: { Easy: 0, Medium: 100, Hard: 0 },
        difficultyCounts: { Easy: 0, Medium: 1, Hard: 0 },
        syllabusContext,
      }),
    };

    expect(syllabusContext.canonicalMatch).toBe(false);
    expect(syllabusContext.coreConcepts).toEqual(["Amines"]);
    expect(syllabusContext.validationKeywords).not.toContain("full");
    expect(syllabusContext.validationKeywords).not.toContain("chapter");

    const [question] = validateProviderOutput(request, {
      rawPrompt: "test",
      rawResponse: {},
      provider: "test",
      model: "test",
      historicalAnalysisMode: "model_knowledge_fallback",
      historicalAnalysisSummary: "No imported dataset.",
      questions: [
        {
          questionNumber: 1,
          difficulty: "Medium",
          questionText:
            "An organic compound gives a precipitate with benzenesulfonyl chloride that dissolves in aqueous alkali. Which class does it belong to?",
          options: [
            "Primary aliphatic amine",
            "Secondary aliphatic amine",
            "Tertiary aliphatic amine",
            "Quaternary ammonium salt",
          ],
          correctOption: "A",
          conceptTested: "Hinsberg test",
          commonMistake:
            "Confusing the alkali solubility of primary and secondary sulfonamides.",
          recommendedRemedialAction:
            "Revise the products and solubility observations in the Hinsberg test.",
          learningOutcome:
            "Classify an organic nitrogen compound using a qualitative test.",
          bloomsTaxonomyLevel: "Application",
          examRelevance: { JEE_MAIN: "High" },
          sourceReference: "NCERT Class 12 Chemistry - Amines",
        },
      ],
    });

    expect(question?.conceptTested).toBe("Hinsberg test");
    expect(question?.metadata.syllabusGroundingValidation).toBe(
      "provider-grounded",
    );
  });

  it("keeps strict topic checks for curated syllabus grounding", () => {
    const syllabusGroundingService = new SyllabusGroundingService();
    const syllabusContext = syllabusGroundingService.resolve({
      subject: "Physics",
      chapter: "Units and Measurements",
      subTopic: "Dimensional Analysis and Applications",
    });
    const request: GenerationProviderRequest = {
      subject: "Physics",
      classLevel: "Class 11",
      chapter: "Units and Measurements",
      subTopic: "Dimensional Analysis and Applications",
      targetExams: ["JEE_MAIN"],
      questionCount: 1,
      difficultyMix: { Easy: 100, Medium: 0, Hard: 0 },
      difficultyCounts: { Easy: 1, Medium: 0, Hard: 0 },
      historicalAnalysis: {
        mode: "model_knowledge_fallback",
        totalRelevantQuestions: 0,
        yearsCovered: [],
        trendSummary: "No imported dataset.",
        recurringConcepts: [],
        difficultyNotes: [],
        sourceDetails: [],
      },
      previousQuestions: [],
      syllabusContext,
      generationPlan: buildGenerationPlan({
        subject: "Physics",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis and Applications",
        questionCount: 1,
        difficultyMix: { Easy: 100, Medium: 0, Hard: 0 },
        difficultyCounts: { Easy: 1, Medium: 0, Hard: 0 },
        syllabusContext,
      }),
    };

    expect(() =>
      validateProviderOutput(request, {
        rawPrompt: "test",
        rawResponse: {},
        provider: "test",
        model: "test",
        historicalAnalysisMode: "model_knowledge_fallback",
        historicalAnalysisSummary: "No imported dataset.",
        questions: [
          {
            questionNumber: 1,
            difficulty: "Easy",
            questionText: "Which cell organelle contains digestive enzymes?",
            options: ["Lysosome", "Ribosome", "Centrosome", "Nucleolus"],
            correctOption: "A",
            conceptTested: "Functions of cell organelles",
            commonMistake: "Confusing lysosomes with ribosomes.",
            recommendedRemedialAction:
              "Revise the functions of membrane-bound cell organelles.",
            learningOutcome:
              "Identify organelles from their cellular function.",
            bloomsTaxonomyLevel: "Understanding",
            examRelevance: { JEE_MAIN: "N/A" },
            sourceReference: "NCERT Biology",
          },
        ],
      }),
    ).toThrowError(/selected syllabus topic/i);
  });

  it("normalizes answer-letter drift and strips inline options from generated stems", () => {
    const syllabusGroundingService = new SyllabusGroundingService();
    const request = {
      subject: "Chemistry",
      classLevel: "Class 12" as const,
      chapter: "The d-and f-Block Elements",
      subTopic: "Transition Elements",
      targetExams: ["JEE_MAIN"] as const,
      questionCount: 1,
      difficultyMix: { Easy: 0, Medium: 100, Hard: 0 },
      historicalAnalysis: {
        mode: "model_knowledge_fallback" as const,
        totalRelevantQuestions: 0,
        yearsCovered: [],
        trendSummary: "No imported dataset.",
        recurringConcepts: [],
        difficultyNotes: [],
        sourceDetails: [],
      },
      previousQuestions: [],
      syllabusContext: syllabusGroundingService.resolve({
        subject: "Chemistry",
        chapter: "The d-and f-Block Elements",
        subTopic: "Transition Elements",
      }),
      generationPlan: buildGenerationPlan({
        subject: "Chemistry",
        classLevel: "Class 12",
        chapter: "The d-and f-Block Elements",
        subTopic: "Transition Elements",
        questionCount: 1,
        difficultyMix: { Easy: 0, Medium: 100, Hard: 0 },
        difficultyCounts: { Easy: 0, Medium: 1, Hard: 0 },
        syllabusContext: syllabusGroundingService.resolve({
          subject: "Chemistry",
          chapter: "The d-and f-Block Elements",
          subTopic: "Transition Elements",
        }),
      }),
    };

    const validated = validateProviderOutput(request, {
      rawPrompt: "mock",
      rawResponse: {},
      provider: "mock",
      model: "mock",
      historicalAnalysisMode: "model_knowledge_fallback",
      historicalAnalysisSummary: "No imported dataset.",
      questions: [
        {
          questionNumber: "1" as unknown as number,
          difficulty: "moderate" as unknown as "Easy",
          questionText:
            "Which of the following ions has the highest number of unpaired electrons? A) Cr3+ B) Mn2+ C) Fe3+ D) Co2+",
          options: ["A) Cr3+", "B) Mn2+", "C) Fe3+", "D) Co2+"],
          correctOption: "Option B" as unknown as "A",
          conceptTested: "Unpaired electrons in transition-metal ions",
          commonMistake: "Ignoring the d-electron count after ion formation",
          recommendedRemedialAction:
            "Write the electronic configuration of each ion before comparing spin states.",
          learningOutcome:
            "Determine magnetic behavior from the electronic configuration of transition-metal ions.",
          bloomsTaxonomyLevel: "Application",
          examRelevance: {
            JEE: true,
            NEET: false,
            KCET: false,
            CBSE: true,
          } as unknown as { JEE_MAIN: string },
          sourceReference: "",
        },
      ],
    });

    expect(validated[0]?.correctOption).toBe("B");
    expect(validated[0]?.correctIndex).toBe(1);
    expect(validated[0]?.difficulty).toBe("Medium");
    expect(validated[0]?.text).toBe(
      "Which of the following ions has the highest number of unpaired electrons?",
    );
    expect(validated[0]?.options).toEqual(["Cr3+", "Mn2+", "Fe3+", "Co2+"]);
    expect(validated[0]?.examRelevance.JEE_MAIN).toBe("High");
    expect(validated[0]?.examRelevance.NEET).toBe("N/A");
    expect(validated[0]?.examRelevance.CBSE).toBe("High");
    expect(validated[0]?.sourceReference).toBeNull();
  });

  it("generates, persists, and retrieves a paper with the expected question count", async () => {
    const user = await createUser();
    const paper = await paperService.generatePaper(user.id, {
      exam: "JEE",
      classLevel: "Class 11",
      mode: "individual",
      subjects: [
        {
          subject: "Physics",
          chapter: "Thermodynamics",
          subTopic: "First Law",
          numberOfQuestions: 5,
          mix: { Easy: 40, Medium: 40, Hard: 20 },
        },
      ],
    });

    const retrieved = await paperService.getPaper(user.id, paper.id);
    const papers = await paperService.listPapers(user.id);

    expect(retrieved.questions).toHaveLength(5);
    expect(papers).toHaveLength(1);
    expect(paper.historicalAnalysisMode).toBe("model_knowledge_fallback");
  });

  it("keeps internal preparation metadata out of public paper responses", async () => {
    const user = await createUser();
    const paper = await paperService.generatePaper(user.id, {
      exam: "JEE",
      classLevel: "Class 11",
      mode: "individual",
      subjects: [
        {
          subject: "Physics",
          chapter: "Units and Measurements",
          subTopic: "Dimensional Analysis and Applications",
          numberOfQuestions: 1,
          mix: { Easy: 100, Medium: 0, Hard: 0 },
        },
      ],
    });
    const question = paper.questions[0]!;
    question.commonMistake =
      "Trusting the GPT model response without checking units.";
    question.sourceReference = "OpenAI provider output";

    const serialized = serializePaper(paper);
    const serializedText = JSON.stringify(serialized);

    expect(serialized).not.toHaveProperty("generationProvider");
    expect(serialized).not.toHaveProperty("generationModel");
    expect(serialized).not.toHaveProperty("promptVersion");
    expect(serialized.historicalAnalysisMode).toBe("Curriculum aligned");
    expect(serialized.historicalAnalysisSummary).toEqual({
      mode: "Curriculum aligned",
      totalRelevantQuestions: 0,
      yearsCovered: [],
      trendSummary:
        "Questions are aligned with the selected subject, chapter, subtopic, and examination pattern.",
      recurringConcepts: [],
      difficultyNotes: [],
      sourceDetails: [],
    });
    expect(serialized).not.toHaveProperty("validationSummary");
    expect(serialized).not.toHaveProperty("notes");
    expect(serialized.questions[0]).not.toHaveProperty("generationProvider");
    expect(serialized.questions[0]).not.toHaveProperty("generationModel");
    expect(serialized.questions[0]).not.toHaveProperty("promptVersion");
    expect(serialized.questions[0]?.sourceReference).toBeNull();
    expect(serializedText).not.toMatch(
      /OpenAI|ChatGPT|GPT|LLM|language model|provider output/i,
    );
  });

  it("keeps generating unique fallback questions for the same syllabus even after the provider restarts", async () => {
    const user = await createUser();
    const input = {
      exam: "JEE" as const,
      classLevel: "Class 11" as const,
      mode: "individual" as const,
      subjects: [
        {
          subject: "Physics",
          chapter: "Units and Measurements",
          subTopic: "Dimensional Analysis and Applications",
          numberOfQuestions: 3,
          mix: { Easy: 30, Medium: 40, Hard: 30 },
        },
      ],
    };

    const firstPaper = await paperService.generatePaper(user.id, input);
    expect(firstPaper.questions).toHaveLength(3);

    const restartedProvider = new MockQuestionGenerationProvider();
    const restartedQuestionRepository = new QuestionRepository(dataSource);
    const restartedHistoricalRepository = new HistoricalRepository(dataSource);
    const restartedDuplicateDetectionService = new DuplicateDetectionService(
      restartedQuestionRepository,
      restartedHistoricalRepository,
      restartedProvider,
    );
    const restartedHistoricalAnalysisService = new HistoricalAnalysisService(
      restartedHistoricalRepository,
    );
    const restartedSyllabusGroundingService = new SyllabusGroundingService();
    const restartedQuestionGenerationService = new QuestionGenerationService(
      restartedProvider,
      restartedDuplicateDetectionService,
      restartedHistoricalAnalysisService,
      restartedSyllabusGroundingService,
    );

    const rerunResult =
      await restartedQuestionGenerationService.generateForSubject({
        subjectConfiguration: input.subjects[0]!,
        classLevel: input.classLevel,
        targetExams: ["JEE_MAIN"],
        previousQuestionTexts: [],
      });

    expect(rerunResult.questions).toHaveLength(3);

    const generatedTexts = new Set([
      ...firstPaper.questions.map((question) => question.text),
      ...rerunResult.questions.map((question) => question.text),
    ]);

    expect(generatedTexts.size).toBe(6);
  });

  it("fills a paper from the exact-syllabus question bank when generation is unavailable", async () => {
    const user = await createUser();
    const subjectConfiguration = {
      subject: "Physics",
      chapter: "Units and Measurements",
      subTopic: "Dimensional Analysis and Applications",
      numberOfQuestions: 3,
      mix: { Easy: 34, Medium: 33, Hard: 33 },
    } as const;
    const existingPaper = await paperService.generatePaper(user.id, {
      exam: "JEE",
      classLevel: "Class 11",
      mode: "individual",
      subjects: [subjectConfiguration],
    });
    let callCount = 0;
    const unavailableProvider = {
      async generate() {
        callCount += 1;
        throw new AppError(
          502,
          "OPENAI_REQUEST_TIMEOUT",
          "The OpenAI generation request timed out.",
          { status: 0 },
        );
      },
    };
    const questionRepository = new QuestionRepository(dataSource);
    const historicalRepository = new HistoricalRepository(dataSource);
    const generationService = new QuestionGenerationService(
      unavailableProvider,
      new DuplicateDetectionService(
        questionRepository,
        historicalRepository,
        unavailableProvider,
      ),
      new HistoricalAnalysisService(historicalRepository),
      new SyllabusGroundingService(),
    );
    const fallbackPaperService = new PaperService(
      new PaperRepository(dataSource),
      questionRepository,
      new UserRepository(dataSource),
      generationService,
      new GenerationRunRepository(dataSource),
      dataSource,
    );
    const result = await fallbackPaperService.generatePaper(user.id, {
      exam: "JEE",
      classLevel: "Class 11",
      mode: "individual",
      subjects: [subjectConfiguration],
    });

    expect(callCount).toBe(2);
    expect(result.questions).toHaveLength(3);
    expect(result.generationProvider).toBe("question-bank-fallback");
    expect(new Set(result.questions.map((question) => question.text))).toEqual(
      new Set(existingPaper.questions.map((question) => question.text)),
    );
  });

  it("keeps accepted questions and retries only the missing duplicate slots", async () => {
    const user = await createUser();
    const input = {
      exam: "JEE" as const,
      classLevel: "Class 11" as const,
      mode: "individual" as const,
      subjects: [
        {
          subject: "Physics",
          chapter: "Units and Measurements",
          subTopic: "Dimensional Analysis and Applications",
          numberOfQuestions: 3,
          mix: { Easy: 34, Medium: 33, Hard: 33 },
        },
      ],
    };

    const existingPaper = await paperService.generatePaper(user.id, input);
    const subjectConfiguration = input.subjects[0]!;
    const syllabusGroundingService = new SyllabusGroundingService();
    const requestTemplate: GenerationProviderRequest = {
      subject: subjectConfiguration.subject,
      classLevel: input.classLevel,
      chapter: subjectConfiguration.chapter,
      subTopic: subjectConfiguration.subTopic,
      targetExams: ["JEE_MAIN"],
      questionCount: subjectConfiguration.numberOfQuestions,
      difficultyMix: subjectConfiguration.mix,
      historicalAnalysis: {
        mode: "model_knowledge_fallback",
        totalRelevantQuestions: 0,
        yearsCovered: [],
        trendSummary: "No imported dataset is currently available.",
        recurringConcepts: [],
        difficultyNotes: [],
        sourceDetails: [],
      },
      previousQuestions: [],
      syllabusContext: syllabusGroundingService.resolve({
        subject: subjectConfiguration.subject,
        chapter: subjectConfiguration.chapter,
        subTopic: subjectConfiguration.subTopic,
      }),
      generationPlan: buildGenerationPlan({
        subject: subjectConfiguration.subject,
        classLevel: input.classLevel,
        chapter: subjectConfiguration.chapter,
        subTopic: subjectConfiguration.subTopic,
        questionCount: subjectConfiguration.numberOfQuestions,
        difficultyMix: subjectConfiguration.mix,
        difficultyCounts: { Easy: 1, Medium: 1, Hard: 1 },
        syllabusContext: syllabusGroundingService.resolve({
          subject: subjectConfiguration.subject,
          chapter: subjectConfiguration.chapter,
          subTopic: subjectConfiguration.subTopic,
        }),
      }),
    };

    const mockProvider = new MockQuestionGenerationProvider();
    const duplicateBatch = await mockProvider.generate(requestTemplate);
    const uniqueBatch = await mockProvider.generate({
      ...requestTemplate,
      previousQuestions: existingPaper.questions.map(
        (question) => question.text,
      ),
    });

    const firstAttemptQuestions = [
      duplicateBatch.questions.find(
        (question) => question.difficulty === "Easy",
      )!,
      uniqueBatch.questions.find(
        (question) => question.difficulty === "Medium",
      )!,
      uniqueBatch.questions.find((question) => question.difficulty === "Hard")!,
    ];
    const secondAttemptQuestions = (
      await mockProvider.generate({
        ...requestTemplate,
        questionCount: 2,
        difficultyCounts: { Easy: 2, Medium: 0, Hard: 0 },
        previousQuestions: existingPaper.questions.map(
          (question) => question.text,
        ),
      })
    ).questions;

    const requestedCounts: number[] = [];
    const requestedDifficultyCounts: Array<
      GenerationProviderRequest["difficultyCounts"]
    > = [];
    let callCount = 0;

    const stagedProvider = {
      async generate(
        request: GenerationProviderRequest,
      ): Promise<GenerationProviderResult> {
        requestedCounts.push(request.questionCount);
        requestedDifficultyCounts.push(request.difficultyCounts);
        callCount += 1;

        return {
          rawPrompt: `staged-${callCount}`,
          rawResponse: { attempt: callCount },
          provider: "staged",
          model: "staged-model",
          historicalAnalysisMode: request.historicalAnalysis.mode,
          historicalAnalysisSummary: request.historicalAnalysis.trendSummary,
          questions:
            callCount === 1 ? firstAttemptQuestions : secondAttemptQuestions,
        };
      },
    };

    const questionRepository = new QuestionRepository(dataSource);
    const historicalRepository = new HistoricalRepository(dataSource);
    const duplicateDetectionService = new DuplicateDetectionService(
      questionRepository,
      historicalRepository,
      stagedProvider,
    );
    const historicalAnalysisService = new HistoricalAnalysisService(
      historicalRepository,
    );
    const questionGenerationService = new QuestionGenerationService(
      stagedProvider,
      duplicateDetectionService,
      historicalAnalysisService,
      syllabusGroundingService,
    );

    const result = await questionGenerationService.generateForSubject({
      subjectConfiguration,
      classLevel: input.classLevel,
      targetExams: ["JEE_MAIN"],
      previousQuestionTexts: [],
    });

    expect(result.questions).toHaveLength(3);
    expect(requestedCounts).toEqual([3, 1]);
    expect(requestedDifficultyCounts[1]).toEqual({
      Easy: 1,
      Medium: 0,
      Hard: 0,
    });
    expect(
      result.questions.some(
        (question) => question.text === existingPaper.questions[0]?.text,
      ),
    ).toBe(false);
  });

  it("keeps valid candidates and repairs only malformed missing slots", async () => {
    const syllabusGroundingService = new SyllabusGroundingService();
    const syllabusContext = syllabusGroundingService.resolve({
      subject: "Physics",
      chapter: "Units and Measurements",
      subTopic: "Dimensional Analysis and Applications",
    });
    const baseRequest: GenerationProviderRequest = {
      subject: "Physics",
      classLevel: "Class 11",
      chapter: "Units and Measurements",
      subTopic: "Dimensional Analysis and Applications",
      targetExams: ["JEE_MAIN"],
      questionCount: 3,
      difficultyMix: { Easy: 100, Medium: 0, Hard: 0 },
      difficultyCounts: { Easy: 3, Medium: 0, Hard: 0 },
      historicalAnalysis: {
        mode: "model_knowledge_fallback",
        totalRelevantQuestions: 0,
        yearsCovered: [],
        trendSummary: "No imported dataset.",
        recurringConcepts: [],
        difficultyNotes: [],
        sourceDetails: [],
      },
      previousQuestions: [],
      syllabusContext,
      generationPlan: buildGenerationPlan({
        subject: "Physics",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis and Applications",
        questionCount: 3,
        difficultyMix: { Easy: 100, Medium: 0, Hard: 0 },
        difficultyCounts: { Easy: 3, Medium: 0, Hard: 0 },
        syllabusContext,
      }),
    };
    const sourceQuestions = (
      await new MockQuestionGenerationProvider().generate(baseRequest)
    ).questions;
    let generationCall = 0;
    let reviewCall = 0;
    const reviewedProvider = {
      async generate(
        request: GenerationProviderRequest,
      ): Promise<GenerationProviderResult> {
        generationCall += 1;
        const questions =
          generationCall === 1
            ? [
                sourceQuestions[0]!,
                { ...sourceQuestions[1]!, options: ["invalid"] },
              ]
            : [sourceQuestions[1]!];
        return {
          rawPrompt: `reviewed-${generationCall}`,
          rawResponse: { generationCall },
          provider: "reviewed",
          model: "reviewed-model",
          historicalAnalysisMode: request.historicalAnalysis.mode,
          historicalAnalysisSummary: request.historicalAnalysis.trendSummary,
          questions,
        };
      },
      async reviewQuestions(
        _request: GenerationProviderRequest,
        questions: Array<{ text: string }>,
      ) {
        reviewCall += 1;
        return {
          provider: "reviewed",
          model: "reviewed-model",
          rawResponse: { reviewCall },
          reviews: questions.map((_question, index) => ({
            candidateIndex: index + 1,
            accepted: reviewCall > 1 || index > 0,
            independentCorrectOption: "A" as const,
            syllabusAligned: true,
            unambiguous: true,
            difficultyAligned: true,
            metadataAligned: true,
            verificationSummary: "Independent solution confirms option A.",
            issues:
              reviewCall === 1 && index === 0
                ? ["The supplied answer is incorrect."]
                : [],
          })),
        };
      },
    };
    const questionRepository = new QuestionRepository(dataSource);
    const historicalRepository = new HistoricalRepository(dataSource);
    const generationService = new QuestionGenerationService(
      reviewedProvider,
      new DuplicateDetectionService(
        questionRepository,
        historicalRepository,
        reviewedProvider,
      ),
      new HistoricalAnalysisService(historicalRepository),
      syllabusGroundingService,
    );

    const result = await generationService.generateForSubject({
      subjectConfiguration: {
        subject: "Physics",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis and Applications",
        numberOfQuestions: 2,
        mix: { Easy: 100, Medium: 0, Hard: 0 },
      },
      classLevel: "Class 11",
      targetExams: ["JEE_MAIN"],
      previousQuestionTexts: [],
    });

    expect(generationCall).toBe(2);
    expect(reviewCall).toBe(0);
    expect(result.questions).toHaveLength(2);
    expect(result.questions.map((question) => question.text)).toEqual([
      sourceQuestions[0]!.questionText,
      sourceQuestions[1]!.questionText,
    ]);
  });

  it("updates and regenerates questions while preserving the paper", async () => {
    const user = await createUser();
    const paper = await paperService.generatePaper(user.id, {
      exam: "NEET",
      classLevel: "Class 12",
      mode: "individual",
      subjects: [
        {
          subject: "Biology",
          chapter: "Genetics",
          subTopic: "Mendelian Inheritance",
          numberOfQuestions: 3,
          mix: { Easy: 34, Medium: 33, Hard: 33 },
        },
      ],
    });

    const firstQuestion = paper.questions[0]!;
    const updatedPaper = await paperService.updateQuestion(
      user.id,
      paper.id,
      firstQuestion.id,
      {
        text: "Edited question text for validation purposes?",
        options: ["A", "B", "C", "D"],
        correctOption: "B",
        conceptTested: "Edited concept",
        commonMistake: "Edited mistake",
        recommendedRemedialAction: "Edited action",
        learningOutcome: "Edited outcome",
        bloomsTaxonomyLevel: "Analysis",
        examRelevance: { NEET: "High" },
      },
    );

    expect(updatedPaper.questions[0]?.correctOption).toBe("B");

    const regeneratedPaper = await paperService.regenerateQuestion(
      user.id,
      paper.id,
      firstQuestion.id,
    );
    expect(regeneratedPaper.questions[0]?.text).not.toBe(
      "Edited question text for validation purposes?",
    );
  });

  it("keeps structurally similar questions when their normalized text differs", async () => {
    const syllabusGroundingService = new SyllabusGroundingService();
    const provider = new MockQuestionGenerationProvider();
    const questionRepository = new QuestionRepository(dataSource);
    const historicalRepository = new HistoricalRepository(dataSource);
    const duplicateDetectionService = new DuplicateDetectionService(
      questionRepository,
      historicalRepository,
      provider,
    );

    const request = {
      subject: "Physics",
      classLevel: "Class 11" as const,
      chapter: "Units and Measurements",
      subTopic: "Dimensional Analysis and Applications",
      targetExams: ["JEE_MAIN"] as const,
      questionCount: 2,
      difficultyMix: { Easy: 100, Medium: 0, Hard: 0 },
      historicalAnalysis: {
        mode: "model_knowledge_fallback" as const,
        totalRelevantQuestions: 0,
        yearsCovered: [],
        trendSummary: "No imported dataset.",
        recurringConcepts: [],
        difficultyNotes: [],
        sourceDetails: [],
      },
      previousQuestions: [],
      syllabusContext: syllabusGroundingService.resolve({
        subject: "Physics",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis and Applications",
      }),
      generationPlan: buildGenerationPlan({
        subject: "Physics",
        classLevel: "Class 11",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis and Applications",
        questionCount: 2,
        difficultyMix: { Easy: 100, Medium: 0, Hard: 0 },
        difficultyCounts: { Easy: 2, Medium: 0, Hard: 0 },
        syllabusContext: syllabusGroundingService.resolve({
          subject: "Physics",
          chapter: "Units and Measurements",
          subTopic: "Dimensional Analysis and Applications",
        }),
      }),
    };

    const validated = validateProviderOutput(request, {
      rawPrompt: "mock",
      rawResponse: {},
      provider: "mock",
      model: "mock",
      historicalAnalysisMode: "model_knowledge_fallback",
      historicalAnalysisSummary: "No imported dataset.",
      questions: [
        {
          questionNumber: 1,
          difficulty: "Easy",
          questionText:
            "A body moves at 20 m/s for 5 s. What distance does it cover?",
          options: ["100 m", "25 m", "15 m", "4 m"],
          correctOption: "A",
          conceptTested: "Unit conversion and dimensional consistency",
          commonMistake: "Multiplying the wrong quantities",
          recommendedRemedialAction:
            "Write the physical relation before substituting values.",
          learningOutcome:
            "Use dimensional reasoning in a simple motion relation.",
          bloomsTaxonomyLevel: "Understanding",
          examRelevance: { JEE_MAIN: "Medium" },
          sourceReference: null,
        },
        {
          questionNumber: 2,
          difficulty: "Easy",
          questionText:
            "A train moves at 30 m/s for 4 s. Calculate the distance travelled.",
          options: ["120 m", "34 m", "26 m", "7.5 m"],
          correctOption: "A",
          conceptTested: "Unit conversion and dimensional consistency",
          commonMistake: "Confusing speed with acceleration",
          recommendedRemedialAction:
            "Use distance equals speed into time for uniform motion.",
          learningOutcome:
            "Use dimensional reasoning in a simple motion relation.",
          bloomsTaxonomyLevel: "Understanding",
          examRelevance: { JEE_MAIN: "Medium" },
          sourceReference: null,
        },
      ],
    });

    const result = await duplicateDetectionService.assessQuestions(validated, {
      existingQuestions: [],
      historicalQuestions: [],
    });

    expect(result.acceptedQuestions).toHaveLength(2);
    expect(result.conflicts).toHaveLength(0);
  });

  it("supports password reset without a real mail provider in console mode", async () => {
    const user = await createUser();

    const reset = await passwordResetService.requestReset({
      email: user.email,
    });
    expect(reset.previewToken).toBeTruthy();

    await passwordResetService.confirmReset({
      token: reset.previewToken!,
      password: "newpassword123",
    });

    const relogin = await authService.login({
      email: user.email,
      password: "newpassword123",
    });

    expect(relogin.id).toBe(user.id);
  });

  it("falls back to the mock provider when the OpenAI provider returns an insufficient quota error", async () => {
    const failingProvider = {
      async generate() {
        throw new AppError(
          502,
          "OPENAI_REQUEST_FAILED",
          "The OpenAI generation request failed.",
          {
            status: 429,
            body: '{"error":{"code":"insufficient_quota"}}',
          },
        );
      },
      async embedTexts(texts: string[]) {
        return {
          provider: "openai",
          model: "text-embedding-3-small",
          latencyMs: 0,
          inputCount: texts.length,
          embeddings: texts.map(() => [0.1, 0.2, 0.3]),
          usage: { promptTokens: 0, totalTokens: 0 },
        };
      },
    };

    const resilientProvider = new ResilientQuestionGenerationProvider(
      failingProvider,
      new MockQuestionGenerationProvider(),
    );

    const result = await resilientProvider.generate({
      subject: "Physics",
      classLevel: "Class 11",
      chapter: "Units and Measurements",
      subTopic: "Dimensional Analysis",
      targetExams: ["JEE_MAIN"],
      questionCount: 3,
      difficultyMix: { Easy: 30, Medium: 40, Hard: 30 },
      historicalAnalysis: {
        mode: "model_knowledge_fallback",
        totalRelevantQuestions: 0,
        yearsCovered: [],
        trendSummary: "No imported dataset.",
        recurringConcepts: [],
        difficultyNotes: [],
        sourceDetails: [],
      },
      previousQuestions: [],
      syllabusContext: new SyllabusGroundingService().resolve({
        subject: "Physics",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis",
      }),
      generationPlan: buildGenerationPlan({
        subject: "Physics",
        classLevel: "Class 11",
        chapter: "Units and Measurements",
        subTopic: "Dimensional Analysis",
        questionCount: 3,
        difficultyMix: { Easy: 30, Medium: 40, Hard: 30 },
        difficultyCounts: { Easy: 1, Medium: 1, Hard: 1 },
        syllabusContext: new SyllabusGroundingService().resolve({
          subject: "Physics",
          chapter: "Units and Measurements",
          subTopic: "Dimensional Analysis",
        }),
      }),
    });

    expect(result.provider).toBe("mock");
    expect(result.questions).toHaveLength(3);
    expect(
      (result.rawResponse.fallback as { errorCode?: string } | undefined)
        ?.errorCode,
    ).toBe("OPENAI_REQUEST_FAILED");
  });

  it("imports historical papers and uses them for analysis during generation", async () => {
    const user = await createUser();

    const imported = await historicalPaperService.importStructuredPapers({
      papers: [
        {
          exam: "NEET",
          year: 2024,
          subject: "Biology",
          classLevel: "Class 12",
          sourceLabel: "Imported sample paper",
          questions: [
            {
              questionNumber: 1,
              chapter: "Genetics",
              subTopic: "Mendelian Inheritance",
              text: "Imported historical question on Mendelian inheritance",
              options: ["A", "B", "C", "D"],
              correctOption: "A",
              conceptTags: ["Inheritance", "Monohybrid"],
            },
          ],
        },
      ],
    });

    expect(imported.importedQuestionCount).toBe(1);

    const status = await historicalPaperService.getStatus();
    expect(status.isHistoricalDatasetAvailable).toBe(true);

    const paper = await paperService.generatePaper(user.id, {
      exam: "NEET",
      classLevel: "Class 12",
      mode: "individual",
      subjects: [
        {
          subject: "Biology",
          chapter: "Genetics",
          subTopic: "Mendelian Inheritance",
          numberOfQuestions: 2,
          mix: { Easy: 50, Medium: 50, Hard: 0 },
        },
      ],
    });

    expect(paper.historicalAnalysisMode).toBe("imported_dataset");
  });
});
