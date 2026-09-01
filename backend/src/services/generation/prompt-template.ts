export const PROMPT_VERSION = "2026-08-25.v1";

export const BASE_PROMPT = `Act as an expert faculty member and question paper setter for NEET, JEE Main, KCET, and CBSE Class 11/12 [SUBJECT] with at least 20 years of experience in competitive exam coaching.

FILL THESE IN BEFORE SENDING:

Subject: [SUBJECT]
Class/Grade: [CLASS]
Chapter: [CHAPTER]
Topics/Subtopics: [TOPICS/SUBTOPICS]
Target Exams (in priority order): [TARGET EXAMS]

Before generating questions, analyse all available sets of the past 7 years’ NEET, JEE Main, and KCET question papers relevant to the selected subject, chapter, and topics. Identify recurring concepts, question patterns, difficulty trends, commonly tested applications, and high-probability areas for the current year’s examination.

Generate [NUMBER OF QUESTIONS] high-quality multiple-choice questions (MCQs) from the above syllabus. Include only questions based on concepts, patterns, and applications that are most likely to appear in this year’s target examinations, as inferred from the past 7 years’ papers and current NCERT syllabus.

The questions must be useful for students preparing simultaneously for the target exams listed above.

Difficulty Level:

[DIFFICULTY DISTRIBUTION]

The questions should appropriately represent the requested distribution.

Question Design Guidelines

- Strictly follow the latest NCERT syllabus.
- Base every question on high-probability concepts identified through analysis of the past 7 years’ NEET/JEE Main/KCET papers, including all available sets.
- Include conceptual, application-based and analytical questions.
- Avoid memory-based factual questions unless they are frequently asked in the target exams.
- Include questions testing reasoning and conceptual clarity.
- Include calculation-based questions wherever appropriate.
- Use correct scientific/subject terminology.
- Numerical values should be realistic and exam-oriented.
- Include at least 5 questions inspired by previous NEET/JEE/KCET papers, not necessarily verbatim, but conceptually similar.
- Include at least 3 assertion-reason or statement-based questions whenever suitable.
- Include distractors based on common student misconceptions.
- Do not include low-probability, outdated, off-syllabus, or rarely tested question types.

Cognitive Distribution

Knowledge, Understanding, Application, Analysis, and Multi-concept Integration should be appropriately distributed across the questions.

Every question must be original and must not duplicate any question already stored in the question bank.

Do not repeat questions from previous tests on the same relevant chapter/topic.

OUTPUT FORMAT

Return structured data that can be consumed directly by the backend/frontend.

SECTION A — QUESTIONS

For each question provide:

Q[NUMBER]
[Question text]

A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]

SECTION B — ANSWER KEY

For every question provide:

Q.No
Correct Option
Concept Tested
Common Mistake
Recommended Remedial Action

SECTION C — PERFORMANCE & EXAM-RELEVANCE ANALYSIS

For every question provide:

Q.No
Learning Outcome Assessed
Bloom's Taxonomy Level
NEET Relevance
JEE Relevance
KCET Relevance

Leave an exam relevance field blank or "N/A" where that exam is not applicable.

Ensure every question is original, error-free, NCERT-aligned, and capable of identifying conceptual weaknesses.`;
