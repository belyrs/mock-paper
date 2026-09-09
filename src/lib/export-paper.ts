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
const ANSWER_PAGE_WIDTH = PDF_PAGE_HEIGHT;
const ANSWER_PAGE_HEIGHT = PDF_PAGE_WIDTH;
const ANSWER_TABLE_LEFT = 62.64;
const ANSWER_TABLE_RIGHT = 54;
const ANSWER_TABLE_TOP = 44;
const ANSWER_TABLE_BOTTOM = ANSWER_PAGE_HEIGHT - 38;
const ANSWER_COLUMN_WEIGHTS = [
  595, 1049, 1608, 1607, 1437, 1292, 1292, 1292, 1631, 3366,
];
const ANSWER_HEADERS = [
  "Q No.",
  "Correct Option",
  "Concept Tested",
  "Learning Outcome assessed",
  "Bloom's Taxonomy Level",
  "NEET relevance",
  "JEE relevance",
  "KCET relevance",
  "Common Mistake",
  "Recommended remedial action if the student gets this question wrong",
];

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
  const exportLabel =
    content === "answers" ? "Answer Key" : compactPaperTitle(metadata);
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

function compactPaperTitle(metadata: ExportMetadata) {
  const removable = new Set(
    [metadata.exam, metadata.classLevel]
      .filter(Boolean)
      .map((value) => value!.toLowerCase()),
  );
  const pieces = metadata.title
    .split(/\s+[\u2013\u2014-]\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !removable.has(part.toLowerCase()));
  return pieces.join(" - ") || "Question Paper";
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

function cleanCellValue(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || "N/A";
}

function answerRow(question: Question, fallbackIndex: number) {
  return [
    String(getQuestionNumber(question, fallbackIndex)),
    question.correctOption || answerOptionLabel(question.correctIndex),
    cleanCellValue(question.conceptTested),
    cleanCellValue(question.learningOutcome),
    cleanCellValue(question.bloomsTaxonomyLevel),
    cleanCellValue(question.examRelevance.NEET),
    cleanCellValue(question.examRelevance.JEE_MAIN),
    cleanCellValue(question.examRelevance.KCET),
    cleanCellValue(question.commonMistake),
    cleanCellValue(question.recommendedRemedialAction),
  ];
}

function answerAnalysisTitle(metadata: ExportMetadata, questions: Question[]) {
  const classLevel = toOrdinalClassLevel(
    metadata.classLevel ?? questions[0]?.classLevel,
  );
  const exam = metadata.exam ? EXAMS[metadata.exam] : null;
  const examLabel = exam
    ? `${exam.label}${exam.stream ? ` (${exam.stream})` : ""}`
    : null;
  return `${[classLevel, examLabel, metadata.title].filter(Boolean).join(" ")} paper analysis`;
}

function drawAnswerTableRow(
  doc: jsPDF,
  values: string[],
  y: number,
  widths: number[],
  header = false,
) {
  doc.setFont("times", header ? "bold" : "normal");
  doc.setFontSize(header ? 9.5 : 9);
  const lineHeight = header ? 10.5 : 10;
  const paddingX = 3;
  const paddingY = 4;
  const wrapped = values.map(
    (value, index) =>
      doc.splitTextToSize(
        cleanCellValue(value),
        widths[index]! - paddingX * 2,
      ) as string[],
  );
  const height = Math.max(
    header ? 54 : 24,
    ...wrapped.map((lines) => lines.length * lineHeight + paddingY * 2),
  );
  let x = ANSWER_TABLE_LEFT;

  doc.setDrawColor("#000000");
  doc.setLineWidth(0.45);
  wrapped.forEach((lines, index) => {
    const width = widths[index]!;
    doc.rect(x, y, width, height);
    const textY =
      y + (height - lines.length * lineHeight) / 2 + lineHeight * 0.78;
    doc.text(lines, x + paddingX, textY, {
      align: "left",
      baseline: "alphabetic",
    });
    x += width;
  });

  return height;
}

function downloadAnswerKeyPdf(metadata: ExportMetadata, questions: Question[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const tableWidth = ANSWER_PAGE_WIDTH - ANSWER_TABLE_LEFT - ANSWER_TABLE_RIGHT;
  const totalWeight = ANSWER_COLUMN_WEIGHTS.reduce(
    (sum, width) => sum + width,
    0,
  );
  const widths = ANSWER_COLUMN_WEIGHTS.map(
    (width) => (width / totalWeight) * tableWidth,
  );
  const title = answerAnalysisTitle(metadata, questions);

  doc.setTextColor("#000000");
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text(title, ANSWER_PAGE_WIDTH / 2, 28, { align: "center" });
  const titleWidth = doc.getTextWidth(title);
  doc.setLineWidth(0.7);
  doc.line(
    ANSWER_PAGE_WIDTH / 2 - titleWidth / 2,
    31,
    ANSWER_PAGE_WIDTH / 2 + titleWidth / 2,
    31,
  );

  let y = ANSWER_TABLE_TOP;
  y += drawAnswerTableRow(doc, ANSWER_HEADERS, y, widths, true);

  questions.forEach((question, index) => {
    const values = answerRow(question, index);
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    const estimatedHeight = Math.max(
      24,
      ...values.map((value, valueIndex) => {
        const lines = doc.splitTextToSize(
          cleanCellValue(value),
          widths[valueIndex]! - 6,
        ) as string[];
        return lines.length * 10 + 8;
      }),
    );

    if (y + estimatedHeight > ANSWER_TABLE_BOTTOM) {
      doc.addPage("a4", "landscape");
      y = 36;
    }
    y += drawAnswerTableRow(doc, values, y, widths);
  });

  doc.save(`${fileBase(metadata.title, "answers")}.pdf`);
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
  doc.addImage(logo, "PNG", 20, 12, 58, 58);
  doc.setTextColor("#000000");

  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(SCHOOL_MOTTO, PDF_PAGE_WIDTH / 2, 28, { align: "center" });

  doc.setFontSize(15.5);
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
  if (content === "answers") {
    downloadAnswerKeyPdf(metadata, questions);
    return;
  }

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
