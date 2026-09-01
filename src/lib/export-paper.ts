import { jsPDF } from "jspdf";
import schoolLogoAsset from "../../assets/jnaanadeepa.png";
import { downloadPaperDocx } from "@/lib/export-paper-docx";
import { EXAMS, LETTERS } from "@/lib/mock-generator";
import type { ClassLevel, ExamId, Question } from "@/types/api";

export type ExportFormat = "pdf" | "docx";
export type ExportContent = "full" | "questions" | "answers";

interface ExportMetadata {
  title: string;
  exam?: ExamId | null;
  classLevel?: ClassLevel | null;
}

interface ExamLineContext {
  label: string;
  ordinalDigits: string | null;
  ordinalSuffix: string | null;
  remainder: string;
}

const SUFFIX: Record<ExportContent, string> = {
  full: "",
  questions: "-questions",
  answers: "-answer-key",
};

const SCHOOL_MOTTO = "||Sa vidya ya vimuktaye||";
const SCHOOL_NAME = "JNANADEEPA SENIOR SECONDARY SCHOOL, JAVALLI";
const SCHOOL_AFFILIATION = "(Affiliated to CBSE, Delhi)";

const PDF_FOOTER_BLUE = "#156082";

const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGINS = {
  left: 62.64,
  right: 54,
  top: 56.88,
  bottom: 41.04,
};
const PDF_FIRST_PAGE_CONTENT_START = 148;
const PDF_NEXT_PAGE_CONTENT_START = 54;
const PDF_CONTENT_BOTTOM = PDF_PAGE_HEIGHT - PDF_MARGINS.bottom - 20;

let logoImagePromise: Promise<HTMLImageElement> | null = null;

function fileBase(title: string, content: ExportContent) {
  const base = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "mockpaper";
  return `${base}${SUFFIX[content]}`;
}

async function loadSchoolLogoImage() {
  if (!logoImagePromise) {
    logoImagePromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("Failed to load the Jnanadeepa school logo."));
      image.src = schoolLogoAsset;
    });
  }

  return logoImagePromise;
}

function toOrdinalClassLevel(value?: ClassLevel | null) {
  if (value === "Class 11") return "11th";
  if (value === "Class 12") return "12th";
  return null;
}

function buildExamLineContext(
  metadata: ExportMetadata,
  questions: Question[],
  content: ExportContent,
): ExamLineContext {
  const classLevel = metadata.classLevel ?? questions[0]?.classLevel ?? null;
  const ordinalClass = toOrdinalClassLevel(classLevel);
  const examMeta = metadata.exam ? EXAMS[metadata.exam] : null;
  const examLabel = examMeta
    ? `${examMeta.label}${examMeta.stream ? ` (${examMeta.stream})` : ""}`
    : null;
  const exportLabel = content === "answers" ? "Answer Key" : "Question Paper";
  const remainder = [examLabel, exportLabel].filter(Boolean).join(" ; ");

  if (!ordinalClass) {
    return {
      label: remainder || metadata.title,
      ordinalDigits: null,
      ordinalSuffix: null,
      remainder: remainder || metadata.title,
    };
  }

  const match = ordinalClass.match(/^(\d+)(st|nd|rd|th)$/i);
  const ordinalDigits = match?.[1] ?? null;
  const ordinalSuffix = match?.[2] ?? null;
  const label = `${ordinalClass}${remainder ? ` ${remainder}` : ""}`;

  return {
    label: label || metadata.title,
    ordinalDigits,
    ordinalSuffix,
    remainder,
  };
}

function buildExamLineText(
  metadata: ExportMetadata,
  questions: Question[],
  content: ExportContent,
) {
  return buildExamLineContext(metadata, questions, content).label;
}

function groupQuestionsBySubject(questions: Question[]) {
  const groups: Array<{ subject: string; questions: Question[] }> = [];

  for (const question of questions) {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup && currentGroup.subject === question.subject) {
      currentGroup.questions.push(question);
      continue;
    }

    groups.push({ subject: question.subject, questions: [question] });
  }

  return groups;
}

function getQuestionNumber(question: Question, fallbackIndex: number) {
  return question.position > 0 ? question.position : fallbackIndex + 1;
}

function questionOptionLabel(optionIndex: number) {
  return `(${LETTERS[optionIndex].toLowerCase()})`;
}

function answerOptionLabel(optionIndex: number) {
  return LETTERS[optionIndex];
}

function shouldUseOptionGrid(question: Question) {
  const maxOptionLength = Math.max(
    ...question.options.map((option) => option.length),
  );

  return (
    question.options.length === 4 &&
    maxOptionLength <= 40 &&
    question.text.length <= 210
  );
}

function drawPdfSubjectHeading(doc: jsPDF, subject: string, y: number) {
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.setTextColor("#000000");
  doc.text(subject, PDF_PAGE_WIDTH / 2, y, { align: "center" });

  const underlineWidth = doc.getTextWidth(subject);
  doc.setLineWidth(0.9);
  doc.line(
    PDF_PAGE_WIDTH / 2 - underlineWidth / 2,
    y + 3,
    PDF_PAGE_WIDTH / 2 + underlineWidth / 2,
    y + 3,
  );
}

function estimateOptionHeight(
  doc: jsPDF,
  question: Question,
  contentWidth: number,
) {
  if (shouldUseOptionGrid(question)) {
    const columnGap = 12;
    const columnWidth = (contentWidth - columnGap * 3) / 4;
    const lineCounts = question.options.map((option, optionIndex) => {
      const lines = doc.splitTextToSize(
        `${questionOptionLabel(optionIndex)} ${option}`,
        columnWidth,
      ) as string[];
      return lines.length;
    });

    return Math.max(...lineCounts) * 13 + 10;
  }

  return question.options.reduce((total, option, optionIndex) => {
    const lines = doc.splitTextToSize(
      `${questionOptionLabel(optionIndex)} ${option}`,
      contentWidth - 22,
    ) as string[];

    return total + lines.length * 13 + 4;
  }, 2);
}

function renderPdfQuestionOptions(
  doc: jsPDF,
  question: Question,
  startY: number,
  left: number,
  contentWidth: number,
) {
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  let y = startY;

  if (shouldUseOptionGrid(question)) {
    const columnGap = 12;
    const columnWidth = (contentWidth - columnGap * 3) / 4;
    const optionLines = question.options.map(
      (option, optionIndex) =>
        doc.splitTextToSize(
          `${questionOptionLabel(optionIndex)} ${option}`,
          columnWidth,
        ) as string[],
    );
    const rowHeight =
      Math.max(...optionLines.map((lines) => lines.length)) * 13;

    optionLines.forEach((lines, optionIndex) => {
      const x = left + optionIndex * (columnWidth + columnGap);
      doc.text(lines, x, y);
    });

    return y + rowHeight + 8;
  }

  for (const [optionIndex, option] of question.options.entries()) {
    const lines = doc.splitTextToSize(
      `${questionOptionLabel(optionIndex)} ${option}`,
      contentWidth - 22,
    ) as string[];
    doc.text(lines, left + 18, y);
    y += lines.length * 13 + 4;
  }

  return y + 4;
}

function drawPdfFirstPageHeader(
  doc: jsPDF,
  metadata: ExportMetadata,
  questions: Question[],
  content: ExportContent,
  logo: HTMLImageElement,
) {
  doc.addImage(logo, "PNG", 18, 12, 72, 58);
  doc.setTextColor("#000000");

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(SCHOOL_MOTTO, PDF_PAGE_WIDTH / 2, 28, { align: "center" });

  doc.setFontSize(21);
  doc.text(SCHOOL_NAME, PDF_PAGE_WIDTH / 2, 50, { align: "center" });

  doc.setFontSize(13);
  doc.text(SCHOOL_AFFILIATION, PDF_PAGE_WIDTH / 2, 68, { align: "center" });

  doc.setFontSize(16);
  doc.text(
    buildExamLineText(metadata, questions, content),
    PDF_PAGE_WIDTH / 2,
    91,
    { align: "center" },
  );

  doc.setLineWidth(1.6);
  doc.line(8, 112, PDF_PAGE_WIDTH - 8, 112);
}

function drawPdfSubjectSeparator(doc: jsPDF, y: number) {
  doc.setDrawColor(PDF_FOOTER_BLUE);
  doc.setLineWidth(1.1);
  doc.line(PDF_MARGINS.left, y, PDF_PAGE_WIDTH - PDF_MARGINS.right, y);
  doc.setDrawColor("#000000");
}

function stampPdfFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  doc.setTextColor(PDF_FOOTER_BLUE);
  doc.setFont("times", "normal");
  doc.setFontSize(10);

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.text(
      `Page ${page} of ${pageCount}`,
      PDF_PAGE_WIDTH / 2,
      PDF_PAGE_HEIGHT - 14,
      { align: "center" },
    );
  }
}

async function downloadPaperPdf(
  metadata: ExportMetadata,
  questions: Question[],
  content: ExportContent = "full",
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const logo = await loadSchoolLogoImage();
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGINS.left - PDF_MARGINS.right;
  const groups = groupQuestionsBySubject(questions);
  let y = PDF_FIRST_PAGE_CONTENT_START;

  drawPdfFirstPageHeader(doc, metadata, questions, content, logo);

  const startNewPage = () => {
    doc.addPage("a4", "portrait");
    y = PDF_NEXT_PAGE_CONTENT_START;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= PDF_CONTENT_BOTTOM) return;
    startNewPage();
  };

  const renderQuestionSet = () => {
    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        ensureSpace(28);
        if (y > PDF_NEXT_PAGE_CONTENT_START + 12) {
          drawPdfSubjectSeparator(doc, y);
          y += 18;
        }
      }

      ensureSpace(22);
      drawPdfSubjectHeading(doc, group.subject, y);
      y += 22;

      group.questions.forEach((question, questionIndex) => {
        const questionNumber = getQuestionNumber(question, questionIndex);
        const questionLines = doc.splitTextToSize(
          `${questionNumber}. ${question.text}`,
          contentWidth,
        ) as string[];
        const estimatedHeight =
          questionLines.length * 14 +
          estimateOptionHeight(doc, question, contentWidth) +
          12;

        ensureSpace(estimatedHeight);

        doc.setFont("times", "normal");
        doc.setFontSize(12);
        doc.setTextColor("#000000");
        doc.text(questionLines, PDF_MARGINS.left, y);
        y += questionLines.length * 14 + 4;
        y = renderPdfQuestionOptions(
          doc,
          question,
          y,
          PDF_MARGINS.left,
          contentWidth,
        );
        y += 6;
      });
    });
  };

  const renderAnswerKey = () => {
    if (content === "full") {
      startNewPage();
    }

    ensureSpace(24);
    drawPdfSubjectHeading(doc, "Answer Key", y);
    y += 26;

    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        ensureSpace(22);
        drawPdfSubjectSeparator(doc, y);
        y += 16;
      }

      ensureSpace(20);
      drawPdfSubjectHeading(doc, group.subject, y);
      y += 22;

      group.questions.forEach((question, questionIndex) => {
        const questionNumber = getQuestionNumber(question, questionIndex);
        const answerLines = [
          `${questionNumber}. Correct Answer: ${answerOptionLabel(question.correctIndex)}`,
          `Concept Tested: ${question.conceptTested}`,
          `Learning Outcome: ${question.learningOutcome}`,
          `Bloom's Level: ${question.bloomsTaxonomyLevel}`,
          `Common Mistake: ${question.commonMistake}`,
          `Recommended Remedial Action: ${question.recommendedRemedialAction}`,
        ].flatMap(
          (line) => doc.splitTextToSize(line, contentWidth - 18) as string[],
        );

        ensureSpace(answerLines.length * 13 + 10);
        doc.setFont("times", "normal");
        doc.setFontSize(12);
        doc.text(answerLines, PDF_MARGINS.left + 12, y);
        y += answerLines.length * 13 + 8;
      });
    });
  };

  if (content !== "answers") {
    renderQuestionSet();
  }

  if (content !== "questions") {
    renderAnswerKey();
  }

  stampPdfFooters(doc);
  doc.save(`${fileBase(metadata.title, content)}.pdf`);
}

export async function downloadPaper(
  metadata: ExportMetadata,
  questions: Question[],
  format: ExportFormat,
  content: ExportContent,
) {
  if (format === "pdf") {
    await downloadPaperPdf(metadata, questions, content);
    return;
  }

  await downloadPaperDocx(metadata, questions, content);
}
