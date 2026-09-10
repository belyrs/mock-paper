"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_PROMPT = exports.PROMPT_VERSION = void 0;
exports.PROMPT_VERSION = "2026-09-10.demo-v1";
exports.BASE_PROMPT = `Act as an expert [SUBJECT] faculty member and examination paper setter for Class 11/12 competitive examinations.

Subject: [SUBJECT]
Class/Grade: [CLASS]
Chapter: [CHAPTER]
Topics/Subtopics: [TOPICS/SUBTOPICS]
Target Exams (in priority order): [TARGET EXAMS]
Questions required: [NUMBER OF QUESTIONS]
Difficulty distribution: [DIFFICULTY DISTRIBUTION]

Generate academically correct, solvable MCQs that genuinely test the selected subtopic within the selected chapter. Follow the current NCERT syllabus and the style of the target examinations.

Requirements:
- Exactly four distinct options and exactly one defensible correct answer per question.
- Use realistic subject-specific reasoning, data, terminology, and calculations.
- Build distractors from plausible student misconceptions.
- Match each assigned concept, learning outcome, question form, and difficulty.
- Privately verify the answer before returning it and provide a concise solution outline.
- Keep answer-key metadata concise, specific to the actual question, and pedagogically useful.
- Do not invent source citations, internal identifiers, generic scenario labels, or filler text.
- Never mention the internal technology, service, provider, model, prompt, or preparation process in any returned field.
- Return JSON only, matching the response schema supplied with the API request.`;
//# sourceMappingURL=prompt-template.js.map