import JSZip from "jszip";
import schoolLogoAsset from "../../assets/jnaanadeepa.png";
import { EXAMS, LETTERS } from "@/lib/mock-generator";
import type { ClassLevel, ExamId, Question } from "@/types/api";

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

interface TemplateParts {
  body: Element;
  sectionProperties: Element;
  subjectHeading: Element;
  question: Element;
  continuation: Element;
  shortOption: Element;
  longOption: Element;
  spacer: Element;
}

const XML_DECLARATION =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const TEMPLATE_DOCX_ASSET = new URL(
  "../../assets/ques-paper.docx",
  import.meta.url,
).href;
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

const SUFFIX: Record<ExportContent, string> = {
  full: "",
  questions: "-questions",
  answers: "-answer-key",
};

let templateBytesPromise: Promise<ArrayBuffer> | null = null;
let logoBytesPromise: Promise<Uint8Array> | null = null;

function fileBase(title: string, content: ExportContent) {
  const base = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "mockpaper";
  return `${base}${SUFFIX[content]}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadTemplateBytes() {
  if (!templateBytesPromise) {
    templateBytesPromise = fetch(TEMPLATE_DOCX_ASSET).then((response) =>
      response.arrayBuffer(),
    );
  }

  return templateBytesPromise;
}

async function loadSchoolLogoBytes() {
  if (!logoBytesPromise) {
    logoBytesPromise = fetch(schoolLogoAsset)
      .then((response) => response.arrayBuffer())
      .then((buffer) => new Uint8Array(buffer));
  }

  return logoBytesPromise;
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

  return {
    label: `${ordinalClass}${remainder ? ` ${remainder}` : ""}` || metadata.title,
    ordinalDigits: match?.[1] ?? null,
    ordinalSuffix: match?.[2] ?? null,
    remainder,
  };
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

function normalizeInlineText(value: string) {
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitQuestionLines(value: string) {
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .split(/\r?\n+/)
    .map((line) => normalizeInlineText(line))
    .filter(Boolean);
}

function parseXmlDocument(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function serializeXmlDocument(documentNode: XMLDocument) {
  const xml = new XMLSerializer().serializeToString(documentNode);
  return xml.startsWith("<?xml") ? xml : `${XML_DECLARATION}${xml}`;
}

function getWordParagraphs(root: ParentNode) {
  return Array.from(root.getElementsByTagNameNS(WORD_NS, "p"));
}

function getWordRuns(paragraph: Element) {
  return Array.from(paragraph.getElementsByTagNameNS(WORD_NS, "r"));
}

function getParagraphText(paragraph: Element) {
  return Array.from(paragraph.getElementsByTagNameNS(WORD_NS, "t"))
    .map((node) => node.textContent ?? "")
    .join("");
}

function isPlainSpacer(paragraph: Element) {
  return (
    getParagraphText(paragraph).trim().length === 0 &&
    paragraph.getElementsByTagNameNS(WORD_NS, "drawing").length === 0
  );
}

function findParagraph(
  paragraphs: Element[],
  predicate: (paragraph: Element) => boolean,
  label: string,
) {
  const match = paragraphs.find(predicate);
  if (!match) {
    throw new Error(`The reference DOCX is missing the ${label} pattern.`);
  }

  return match;
}

function extractTemplateParts(documentNode: XMLDocument): TemplateParts {
  const body = documentNode.getElementsByTagNameNS(WORD_NS, "body")[0];

  if (!body) {
    throw new Error("The reference DOCX body could not be located.");
  }

  const paragraphs = getWordParagraphs(body);
  const sectionProperties = body.getElementsByTagNameNS(WORD_NS, "sectPr")[0];

  if (!sectionProperties) {
    throw new Error("The reference DOCX section properties are missing.");
  }

  return {
    body,
    sectionProperties,
    subjectHeading: findParagraph(
      paragraphs,
      (paragraph) => getParagraphText(paragraph).trim() === "Physics",
      "subject heading",
    ),
    question: findParagraph(
      paragraphs,
      (paragraph) => getParagraphText(paragraph).trimStart().startsWith("1."),
      "question",
    ),
    continuation: findParagraph(
      paragraphs,
      (paragraph) => getParagraphText(paragraph).includes("Reason:"),
      "question continuation",
    ),
    shortOption: findParagraph(
      paragraphs,
      (paragraph) => getParagraphText(paragraph).includes("(a) S2 and S3"),
      "short option row",
    ),
    longOption: findParagraph(
      paragraphs,
      (paragraph) =>
        getParagraphText(paragraph).startsWith(
          "B) Both Assertion and Reason are true",
        ),
      "long option row",
    ),
    spacer: findParagraph(paragraphs, isPlainSpacer, "blank spacer"),
  };
}

function clearNodeChildren(node: Element, preserveProperties = true) {
  const propertyNodeName = preserveProperties
    ? node.localName === "p"
      ? "pPr"
      : node.localName === "r"
        ? "rPr"
        : null
    : null;

  Array.from(node.childNodes).forEach((child) => {
    if (
      propertyNodeName &&
      child.nodeType === Node.ELEMENT_NODE &&
      (child as Element).localName === propertyNodeName
    ) {
      return;
    }

    node.removeChild(child);
  });
}

function getRunTemplate(paragraph: Element, index = 0) {
  const runs = getWordRuns(paragraph);
  const run = runs[index] ?? runs[0];
  if (!run) {
    throw new Error("The reference DOCX paragraph does not contain a run.");
  }

  return run;
}

function createTextNode(
  documentNode: XMLDocument,
  value: string,
  preserveSpace = false,
) {
  const textNode = documentNode.createElementNS(WORD_NS, "w:t");
  if (preserveSpace) {
    textNode.setAttributeNS(XML_NS, "xml:space", "preserve");
  }
  textNode.textContent = value;
  return textNode;
}

function createRunFromTemplate(
  templateRun: Element,
  value: string,
  preserveSpace = false,
) {
  const run = templateRun.cloneNode(true) as Element;
  clearNodeChildren(run);
  run.appendChild(createTextNode(run.ownerDocument, value, preserveSpace));
  return run;
}

function createTabbedRunFromTemplate(templateRun: Element, segments: string[]) {
  const run = templateRun.cloneNode(true) as Element;
  clearNodeChildren(run);

  segments.forEach((segment, index) => {
    run.appendChild(createTextNode(run.ownerDocument, segment, true));
    if (index < segments.length - 1) {
      run.appendChild(run.ownerDocument.createElementNS(WORD_NS, "w:tab"));
    }
  });

  return run;
}

function cloneSpacer(template: Element) {
  return template.cloneNode(true) as Element;
}

function createSubjectHeading(template: Element, subject: string) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  paragraph.appendChild(createRunFromTemplate(getRunTemplate(template), subject));
  return paragraph;
}

function createQuestionParagraph(
  template: Element,
  number: number,
  text: string,
) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  paragraph.appendChild(
    createRunFromTemplate(getRunTemplate(template, 0), `${number}. `, true),
  );
  paragraph.appendChild(
    createRunFromTemplate(getRunTemplate(template, 1), ` ${text}`, true),
  );
  return paragraph;
}

function createContinuationParagraph(template: Element, text: string) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  paragraph.appendChild(
    createRunFromTemplate(getRunTemplate(template), `      ${text}`, true),
  );
  return paragraph;
}

function createShortOptionParagraph(template: Element, labels: string[]) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  paragraph.appendChild(
    createTabbedRunFromTemplate(getRunTemplate(template), labels),
  );
  return paragraph;
}

function createLongOptionParagraph(template: Element, label: string, text: string) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  paragraph.appendChild(
    createRunFromTemplate(getRunTemplate(template), `${label}) ${text}`),
  );
  return paragraph;
}

function createDetailParagraph(template: Element, text: string) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  paragraph.appendChild(createRunFromTemplate(getRunTemplate(template), text));
  return paragraph;
}

function createPageBreakParagraph(template: Element) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  const run = getRunTemplate(template).cloneNode(true) as Element;
  clearNodeChildren(run);
  const breakNode = run.ownerDocument.createElementNS(WORD_NS, "w:br");
  breakNode.setAttribute("w:type", "page");
  run.appendChild(breakNode);
  paragraph.appendChild(run);
  return paragraph;
}

function buildOptionParagraphs(
  templates: TemplateParts,
  options: string[],
) {
  const normalized = options.map((option) => normalizeInlineText(option));
  const maxLength = Math.max(...normalized.map((option) => option.length), 0);
  const totalLength = normalized.reduce((sum, option) => sum + option.length, 0);

  if (normalized.length === 4 && maxLength <= 32 && totalLength <= 130) {
    return [
      createShortOptionParagraph(
        templates.shortOption,
        normalized.map(
          (option, index) => `(${LETTERS[index].toLowerCase()}) ${option}`,
        ),
      ),
    ];
  }

  if (normalized.length === 4 && maxLength <= 64 && totalLength <= 220) {
    return [
      createShortOptionParagraph(templates.shortOption, [
        `(${LETTERS[0].toLowerCase()}) ${normalized[0] ?? ""}`,
        `(${LETTERS[1].toLowerCase()}) ${normalized[1] ?? ""}`,
      ]),
      createShortOptionParagraph(templates.shortOption, [
        `(${LETTERS[2].toLowerCase()}) ${normalized[2] ?? ""}`,
        `(${LETTERS[3].toLowerCase()}) ${normalized[3] ?? ""}`,
      ]),
    ];
  }

  return normalized.map((option, index) =>
    createLongOptionParagraph(templates.longOption, LETTERS[index] ?? "A", option),
  );
}

function createAnswerParagraphs(
  templates: TemplateParts,
  question: Question,
  number: number,
) {
  return [
    createQuestionParagraph(
      templates.question,
      number,
      `Correct Answer: ${LETTERS[question.correctIndex] ?? question.correctOption}`,
    ),
    createDetailParagraph(
      templates.longOption,
      `Concept Tested: ${normalizeInlineText(question.conceptTested)}`,
    ),
    createDetailParagraph(
      templates.longOption,
      `Learning Outcome: ${normalizeInlineText(question.learningOutcome)}`,
    ),
    createDetailParagraph(
      templates.longOption,
      `Bloom's Level: ${normalizeInlineText(question.bloomsTaxonomyLevel)}`,
    ),
    createDetailParagraph(
      templates.longOption,
      `Common Mistake: ${normalizeInlineText(question.commonMistake)}`,
    ),
    createContinuationParagraph(
      templates.continuation,
      `Recommended Remedial Action: ${normalizeInlineText(
        question.recommendedRemedialAction,
      )}`,
    ),
  ];
}

function buildBodyParagraphs(
  templates: TemplateParts,
  questions: Question[],
  content: ExportContent,
) {
  const nodes: Element[] = [];
  const groups = groupQuestionsBySubject(questions);
  let fallbackIndex = 0;

  if (content !== "answers") {
    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        nodes.push(cloneSpacer(templates.spacer));
      }

      nodes.push(createSubjectHeading(templates.subjectHeading, group.subject));

      group.questions.forEach((question) => {
        const questionNumber = getQuestionNumber(question, fallbackIndex);
        fallbackIndex += 1;
        const lines = splitQuestionLines(question.text);
        const [firstLine, ...rest] = lines.length
          ? lines
          : [normalizeInlineText(question.text)];

        nodes.push(
          createQuestionParagraph(
            templates.question,
            questionNumber,
            firstLine || "",
          ),
        );

        rest.forEach((line) => {
          nodes.push(createContinuationParagraph(templates.continuation, line));
        });

        buildOptionParagraphs(templates, question.options).forEach((paragraph) => {
          nodes.push(paragraph);
        });
      });
    });
  }

  if (content !== "questions") {
    let answerFallbackIndex = 0;

    if (content === "full") {
      nodes.push(createPageBreakParagraph(templates.spacer));
    } else if (nodes.length > 0) {
      nodes.push(cloneSpacer(templates.spacer));
    }

    nodes.push(createSubjectHeading(templates.subjectHeading, "Answer Key"));

    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        nodes.push(cloneSpacer(templates.spacer));
      }

      nodes.push(createSubjectHeading(templates.subjectHeading, group.subject));

      group.questions.forEach((question) => {
        const questionNumber = getQuestionNumber(question, answerFallbackIndex);
        answerFallbackIndex += 1;
        createAnswerParagraphs(templates, question, questionNumber).forEach(
          (paragraph) => {
            nodes.push(paragraph);
          },
        );
      });
    });
  }

  return nodes;
}

function patchHeaderDocument(
  headerDocument: XMLDocument,
  metadata: ExportMetadata,
  questions: Question[],
  content: ExportContent,
) {
  const paragraphs = getWordParagraphs(headerDocument);
  const examParagraph = findParagraph(
    paragraphs,
    (paragraph) => getParagraphText(paragraph).includes("JEE/NEET/KCET"),
    "header exam line",
  );
  const runs = getWordRuns(examParagraph);
  const examLine = buildExamLineContext(metadata, questions, content);
  const [digitsRun, suffixRun, remainderRun] = runs;

  if (!digitsRun || !suffixRun || !remainderRun) {
    throw new Error("The reference DOCX header exam line is incomplete.");
  }

  if (examLine.ordinalDigits && examLine.ordinalSuffix) {
    clearNodeChildren(digitsRun);
    digitsRun.appendChild(
      createTextNode(headerDocument, examLine.ordinalDigits, true),
    );

    clearNodeChildren(suffixRun);
    suffixRun.appendChild(
      createTextNode(headerDocument, examLine.ordinalSuffix, true),
    );

    clearNodeChildren(remainderRun);
    remainderRun.appendChild(
      createTextNode(headerDocument, ` ${examLine.remainder}`, true),
    );
    return;
  }

  clearNodeChildren(digitsRun);
  digitsRun.appendChild(createTextNode(headerDocument, examLine.label, true));
  clearNodeChildren(suffixRun);
  clearNodeChildren(remainderRun);
}

function enableFieldUpdates(settingsDocument: XMLDocument) {
  const settings = settingsDocument.getElementsByTagNameNS(WORD_NS, "settings")[0];
  if (!settings) return;

  let updateFields = settings.getElementsByTagNameNS(WORD_NS, "updateFields")[0];

  if (!updateFields) {
    updateFields = settingsDocument.createElementNS(WORD_NS, "w:updateFields");
    settings.appendChild(updateFields);
  }

  updateFields.setAttribute("w:val", "true");
}

async function buildDocxBlob(
  metadata: ExportMetadata,
  questions: Question[],
  content: ExportContent,
) {
  if (!questions.length) {
    throw new Error("There are no questions available to export.");
  }

  const [templateBytes, logoJpegBytes] = await Promise.all([
    loadTemplateBytes(),
    loadSchoolLogoBytes(),
  ]);
  const zip = await JSZip.loadAsync(templateBytes);
  const documentXml = await zip.file("word/document.xml")?.async("text");
  const headerXml = await zip.file("word/header1.xml")?.async("text");
  const headerRelsXml = await zip.file("word/_rels/header1.xml.rels")?.async("text");
  const settingsXml = await zip.file("word/settings.xml")?.async("text");

  if (!documentXml || !headerXml || !headerRelsXml || !settingsXml) {
    throw new Error("The reference DOCX is missing required Word parts.");
  }

  const documentNode = parseXmlDocument(documentXml);
  const headerNode = parseXmlDocument(headerXml);
  const settingsNode = parseXmlDocument(settingsXml);
  const templates = extractTemplateParts(documentNode);

  const sectionClone = templates.sectionProperties.cloneNode(true) as Element;
  Array.from(templates.body.childNodes).forEach((child) => {
    templates.body.removeChild(child);
  });

  buildBodyParagraphs(templates, questions, content).forEach((paragraph) => {
    templates.body.appendChild(paragraph);
  });
  templates.body.appendChild(sectionClone);

  patchHeaderDocument(headerNode, metadata, questions, content);
  enableFieldUpdates(settingsNode);

  zip.file("word/document.xml", serializeXmlDocument(documentNode));
  zip.file("word/header1.xml", serializeXmlDocument(headerNode));
  zip.file(
    "word/_rels/header1.xml.rels",
    headerRelsXml.replace("Target=\"media/image1.jpg\"", "Target=\"media/export-logo.png\""),
  );
  zip.file("word/settings.xml", serializeXmlDocument(settingsNode));
  zip.file("word/media/export-logo.png", logoJpegBytes);

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

export async function downloadPaperDocx(
  metadata: ExportMetadata,
  questions: Question[],
  content: ExportContent = "full",
) {
  const blob = await buildDocxBlob(metadata, questions, content);
  downloadBlob(blob, `${fileBase(metadata.title, content)}.docx`);
}
