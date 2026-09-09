import JSZip from "jszip";
import { EXAMS, LETTERS } from "@/lib/mock-generator";
import type { ClassLevel, ExamId, Question, TargetExam } from "@/types/api";

export type ExportContent = "full" | "questions" | "answers";

interface ExportMetadata {
  title: string;
  exam?: ExamId | null;
  classLevel?: ClassLevel | null;
}

interface QuestionTemplateParts {
  body: Element;
  sectionProperties: Element;
  subjectHeading: Element;
  question: Element;
  continuation: Element;
  shortOption: Element;
  longOption: Element;
  spacer: Element;
  separator: Element | null;
}

interface AnswerTemplateParts {
  table: Element;
  dataRow: Element;
}

const XML_DECLARATION =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const QUESTION_TEMPLATE_DOCX_ASSET = new URL(
  "../../assets/reference_question_paper.docx",
  import.meta.url,
).href;
const ANSWER_TEMPLATE_DOCX_ASSET = new URL(
  "../../assets/reference_answer_key.docx",
  import.meta.url,
).href;
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const VML_NS = "urn:schemas-microsoft-com:vml";

const SUFFIX: Record<ExportContent, string> = {
  full: "",
  questions: "-questions",
  answers: "-answer-key",
};

const templatePromises = new Map<string, Promise<ArrayBuffer>>();

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

async function loadTemplateBytes(url: string, label: string) {
  if (!templatePromises.has(url)) {
    templatePromises.set(
      url,
      fetch(url).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load the ${label} reference DOCX.`);
        }
        return response.arrayBuffer();
      }),
    );
  }
  return templatePromises.get(url)!;
}

function parseXmlDocument(xml: string, label: string) {
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  if (parsed.getElementsByTagName("parsererror").length > 0) {
    throw new Error(`The ${label} reference DOCX contains invalid XML.`);
  }
  return parsed;
}

function serializeXmlDocument(documentNode: XMLDocument) {
  const xml = new XMLSerializer().serializeToString(documentNode);
  return xml.startsWith("<?xml") ? xml : `${XML_DECLARATION}${xml}`;
}

function getElements(root: ParentNode, localName: string) {
  return Array.from(root.getElementsByTagNameNS(WORD_NS, localName));
}

function getDirectElements(root: ParentNode, localName: string) {
  return Array.from(root.childNodes).filter(
    (node): node is Element =>
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).namespaceURI === WORD_NS &&
      (node as Element).localName === localName,
  );
}

function getParagraphText(paragraph: Element) {
  return getElements(paragraph, "t")
    .map((node) => node.textContent ?? "")
    .join("");
}

function getWordRuns(paragraph: Element) {
  return getElements(paragraph, "r");
}

function findParagraph(
  paragraphs: Element[],
  predicate: (paragraph: Element) => boolean,
  label: string,
) {
  const match = paragraphs.find(predicate);
  if (!match) {
    throw new Error(`The reference DOCX is missing its ${label} pattern.`);
  }
  return match;
}

function clearNodeChildren(node: Element, preserveProperties = true) {
  const propertyNodeName = preserveProperties
    ? node.localName === "p"
      ? "pPr"
      : node.localName === "r"
        ? "rPr"
        : node.localName === "tc"
          ? "tcPr"
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
    throw new Error(
      "The reference DOCX paragraph does not contain a text run.",
    );
  }
  return run;
}

function createTextNode(
  documentNode: XMLDocument,
  value: string,
  preserveSpace = false,
) {
  const textNode = documentNode.createElementNS(WORD_NS, "w:t");
  if (preserveSpace || /^\s|\s$/.test(value)) {
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

function normalizeInlineText(value: string | null | undefined) {
  return (value ?? "")
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
    .map(normalizeInlineText)
    .filter(Boolean);
}

function getQuestionNumber(question: Question, fallbackIndex: number) {
  return question.position > 0 ? question.position : fallbackIndex + 1;
}

function groupQuestionsBySubject(questions: Question[]) {
  const groups: Array<{ subject: string; questions: Question[] }> = [];
  for (const question of questions) {
    const current = groups[groups.length - 1];
    if (current?.subject === question.subject) {
      current.questions.push(question);
    } else {
      groups.push({ subject: question.subject, questions: [question] });
    }
  }
  return groups;
}

function toOrdinalClassLevel(value?: ClassLevel | null) {
  if (value === "Class 11") return { digits: "11", suffix: "th" };
  if (value === "Class 12") return { digits: "12", suffix: "th" };
  return null;
}

function examLabel(exam?: ExamId | null) {
  const examMeta = exam ? EXAMS[exam] : null;
  return examMeta
    ? `${examMeta.label}${examMeta.stream ? ` (${examMeta.stream})` : ""}`
    : "JEE/NEET/KCET";
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

function questionPaperHeader(metadata: ExportMetadata, questions: Question[]) {
  const classLevel = metadata.classLevel ?? questions[0]?.classLevel ?? null;
  return {
    ordinal: toOrdinalClassLevel(classLevel),
    remainder: `${examLabel(metadata.exam)} ; ${compactPaperTitle(metadata)}`,
  };
}

function answerAnalysisTitle(metadata: ExportMetadata, questions: Question[]) {
  const classLevel = metadata.classLevel ?? questions[0]?.classLevel ?? null;
  const ordinal = toOrdinalClassLevel(classLevel);
  const prefix = [
    ordinal ? `${ordinal.digits}${ordinal.suffix}` : null,
    examLabel(metadata.exam),
  ]
    .filter(Boolean)
    .join(" ");
  const title = compactPaperTitle(metadata).replace(/\s+paper$/i, "");
  return `${prefix} ${title} paper analysis`.replace(/\s+/g, " ").trim();
}

function extractQuestionTemplateParts(
  documentNode: XMLDocument,
): QuestionTemplateParts {
  const body = getElements(documentNode, "body")[0];
  if (!body) throw new Error("The question-paper reference body is missing.");

  const paragraphs = getElements(body, "p");
  const sectionProperties = getDirectElements(body, "sectPr")[0];
  if (!sectionProperties) {
    throw new Error(
      "The question-paper reference section properties are missing.",
    );
  }
  const blankParagraphs = paragraphs.filter(
    (paragraph) => getParagraphText(paragraph).trim().length === 0,
  );

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
      (paragraph) =>
        getParagraphText(paragraph)
          .trimStart()
          .startsWith("charge-to-mass ratio"),
      "question continuation",
    ),
    shortOption: findParagraph(
      paragraphs,
      (paragraph) => getParagraphText(paragraph).includes("(a) 2s"),
      "compact option row",
    ),
    longOption: findParagraph(
      paragraphs,
      (paragraph) =>
        getParagraphText(paragraph).includes(
          "The relative velocity of the particle",
        ),
      "long option row",
    ),
    spacer: findParagraph(
      blankParagraphs,
      (paragraph) =>
        paragraph.getElementsByTagNameNS(WORD_NS, "drawing").length === 0 &&
        paragraph.getElementsByTagNameNS(WORD_NS, "pict").length === 0,
      "blank spacer",
    ),
    separator:
      blankParagraphs.find(
        (paragraph) =>
          paragraph.getElementsByTagNameNS(VML_NS, "shape").length > 0,
      ) ?? null,
  };
}

function createSubjectHeading(template: Element, subject: string) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  paragraph.appendChild(
    createRunFromTemplate(getRunTemplate(template), subject),
  );
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
    createRunFromTemplate(getRunTemplate(template, 0), `${number}.`, true),
  );
  paragraph.appendChild(
    createRunFromTemplate(getRunTemplate(template, 2), ` ${text}`, true),
  );
  return paragraph;
}

function createContinuationParagraph(template: Element, text: string) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  paragraph.appendChild(
    createRunFromTemplate(getRunTemplate(template), text, true),
  );
  return paragraph;
}

function createCompactOptionParagraph(template: Element, labels: string[]) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  paragraph.appendChild(
    createTabbedRunFromTemplate(getRunTemplate(template), labels),
  );
  return paragraph;
}

function createLongOptionParagraph(
  template: Element,
  label: string,
  value: string,
) {
  const paragraph = template.cloneNode(true) as Element;
  clearNodeChildren(paragraph);
  paragraph.appendChild(
    createRunFromTemplate(
      getRunTemplate(template),
      `(${label}) ${value}`,
      true,
    ),
  );
  return paragraph;
}

function createOptionParagraphs(
  templates: QuestionTemplateParts,
  options: string[],
) {
  const values = options.map(normalizeInlineText);
  const maxLength = Math.max(...values.map((value) => value.length), 0);
  const totalLength = values.reduce((sum, value) => sum + value.length, 0);
  const labels = values.map(
    (value, index) => `(${LETTERS[index]?.toLowerCase() ?? "a"}) ${value}`,
  );

  if (values.length === 4 && maxLength <= 28 && totalLength <= 100) {
    return [createCompactOptionParagraph(templates.shortOption, labels)];
  }
  if (values.length === 4 && maxLength <= 58 && totalLength <= 190) {
    return [
      createCompactOptionParagraph(templates.shortOption, labels.slice(0, 2)),
      createCompactOptionParagraph(templates.shortOption, labels.slice(2, 4)),
    ];
  }
  return values.map((value, index) =>
    createLongOptionParagraph(
      templates.longOption,
      LETTERS[index]?.toLowerCase() ?? "a",
      value,
    ),
  );
}

function rebuildQuestionBody(documentNode: XMLDocument, questions: Question[]) {
  const templates = extractQuestionTemplateParts(documentNode);
  const sectionClone = templates.sectionProperties.cloneNode(true) as Element;
  const groups = groupQuestionsBySubject(questions);
  const nodes: Element[] = [];
  let fallbackIndex = 0;

  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      nodes.push(
        templates.separator
          ? (templates.separator.cloneNode(true) as Element)
          : (templates.spacer.cloneNode(true) as Element),
      );
    }
    nodes.push(createSubjectHeading(templates.subjectHeading, group.subject));

    group.questions.forEach((question) => {
      const questionNumber = getQuestionNumber(question, fallbackIndex++);
      const lines = splitQuestionLines(question.text);
      const [firstLine, ...rest] = lines.length
        ? lines
        : [normalizeInlineText(question.text)];
      nodes.push(
        createQuestionParagraph(
          templates.question,
          questionNumber,
          firstLine ?? "",
        ),
      );
      rest.forEach((line) =>
        nodes.push(createContinuationParagraph(templates.continuation, line)),
      );
      nodes.push(...createOptionParagraphs(templates, question.options));
    });
  });

  Array.from(templates.body.childNodes).forEach((child) =>
    templates.body.removeChild(child),
  );
  nodes.forEach((node) => templates.body.appendChild(node));
  templates.body.appendChild(sectionClone);
}

function patchQuestionHeader(
  headerNode: XMLDocument,
  metadata: ExportMetadata,
  questions: Question[],
) {
  const examParagraph = findParagraph(
    getElements(headerNode, "p"),
    (paragraph) => getParagraphText(paragraph).includes("JEE/NEET/KCET"),
    "assessment-line",
  );
  const runs = getWordRuns(examParagraph);
  const { ordinal, remainder } = questionPaperHeader(metadata, questions);
  const digitsTemplate = runs[0];
  const suffixTemplate = runs[1];
  const remainderTemplate = runs[2] ?? runs[0];
  if (!digitsTemplate || !suffixTemplate || !remainderTemplate) {
    throw new Error(
      "The question-paper reference assessment line is incomplete.",
    );
  }

  clearNodeChildren(examParagraph);
  if (ordinal) {
    examParagraph.appendChild(
      createRunFromTemplate(digitsTemplate, ordinal.digits),
    );
    examParagraph.appendChild(
      createRunFromTemplate(suffixTemplate, ordinal.suffix),
    );
    examParagraph.appendChild(
      createRunFromTemplate(remainderTemplate, ` ${remainder}`, true),
    );
  } else {
    examParagraph.appendChild(createRunFromTemplate(digitsTemplate, remainder));
  }
}

function extractAnswerTemplateParts(
  documentNode: XMLDocument,
): AnswerTemplateParts {
  const body = getElements(documentNode, "body")[0];
  if (!body) throw new Error("The answer-key reference body is missing.");
  const table = getDirectElements(body, "tbl")[0];
  const rows = table ? getDirectElements(table, "tr") : [];
  if (!table || rows.length < 2) {
    throw new Error(
      "The answer-key reference must contain a header and data row.",
    );
  }
  return { table, dataRow: rows[1]! };
}

function setCellText(cell: Element, value: string) {
  const templateParagraph = getDirectElements(cell, "p")[0];
  if (!templateParagraph) {
    throw new Error("The answer-key reference contains an empty table cell.");
  }
  const paragraph = templateParagraph.cloneNode(true) as Element;
  const runTemplate = getRunTemplate(templateParagraph);
  clearNodeChildren(paragraph);
  paragraph.appendChild(
    createRunFromTemplate(runTemplate, normalizeInlineText(value) || "N/A"),
  );
  clearNodeChildren(cell);
  cell.appendChild(paragraph);
}

function relevance(question: Question, exam: TargetExam) {
  return normalizeInlineText(question.examRelevance?.[exam]) || "N/A";
}

function answerRowValues(question: Question, fallbackIndex: number) {
  return [
    String(getQuestionNumber(question, fallbackIndex)),
    question.correctOption || LETTERS[question.correctIndex] || "N/A",
    question.conceptTested,
    question.learningOutcome,
    question.bloomsTaxonomyLevel,
    relevance(question, "NEET"),
    relevance(question, "JEE_MAIN"),
    relevance(question, "KCET"),
    question.commonMistake,
    question.recommendedRemedialAction,
  ];
}

function rebuildAnswerTable(documentNode: XMLDocument, questions: Question[]) {
  const templates = extractAnswerTemplateParts(documentNode);
  getDirectElements(templates.table, "tr")
    .slice(1)
    .forEach((row) => templates.table.removeChild(row));

  questions.forEach((question, index) => {
    const row = templates.dataRow.cloneNode(true) as Element;
    const cells = getDirectElements(row, "tc");
    const values = answerRowValues(question, index);
    if (cells.length !== values.length) {
      throw new Error("The answer-key reference column count has changed.");
    }
    cells.forEach((cell, cellIndex) =>
      setCellText(cell, values[cellIndex] ?? "N/A"),
    );
    templates.table.appendChild(row);
  });
}

function patchAnswerHeader(
  headerNode: XMLDocument,
  metadata: ExportMetadata,
  questions: Question[],
) {
  const titleParagraph = findParagraph(
    getElements(headerNode, "p"),
    (paragraph) => getParagraphText(paragraph).includes("paper analysis"),
    "analysis title",
  );
  const runTemplate = getRunTemplate(titleParagraph);
  clearNodeChildren(titleParagraph);
  titleParagraph.appendChild(
    createRunFromTemplate(
      runTemplate,
      answerAnalysisTitle(metadata, questions),
    ),
  );
}

function enableFieldUpdates(settingsDocument: XMLDocument) {
  const settings = getElements(settingsDocument, "settings")[0];
  if (!settings) return;
  let updateFields = getElements(settings, "updateFields")[0];
  if (!updateFields) {
    updateFields = settingsDocument.createElementNS(WORD_NS, "w:updateFields");
    settings.appendChild(updateFields);
  }
  updateFields.setAttributeNS(WORD_NS, "w:val", "true");
}

async function readRequiredPart(zip: JSZip, path: string, label: string) {
  const value = await zip.file(path)?.async("text");
  if (!value) throw new Error(`The ${label} reference is missing ${path}.`);
  return value;
}

async function buildQuestionPaperBlob(
  metadata: ExportMetadata,
  questions: Question[],
) {
  const bytes = await loadTemplateBytes(
    QUESTION_TEMPLATE_DOCX_ASSET,
    "question-paper",
  );
  const zip = await JSZip.loadAsync(bytes);
  const [documentXml, headerXml, settingsXml] = await Promise.all([
    readRequiredPart(zip, "word/document.xml", "question-paper"),
    readRequiredPart(zip, "word/header1.xml", "question-paper"),
    readRequiredPart(zip, "word/settings.xml", "question-paper"),
  ]);
  const documentNode = parseXmlDocument(documentXml, "question-paper");
  const headerNode = parseXmlDocument(headerXml, "question-paper header");
  const settingsNode = parseXmlDocument(settingsXml, "question-paper settings");

  rebuildQuestionBody(documentNode, questions);
  patchQuestionHeader(headerNode, metadata, questions);
  enableFieldUpdates(settingsNode);

  zip.file("word/document.xml", serializeXmlDocument(documentNode));
  zip.file("word/header1.xml", serializeXmlDocument(headerNode));
  zip.file("word/settings.xml", serializeXmlDocument(settingsNode));
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

async function buildAnswerKeyBlob(
  metadata: ExportMetadata,
  questions: Question[],
) {
  const bytes = await loadTemplateBytes(
    ANSWER_TEMPLATE_DOCX_ASSET,
    "answer-key",
  );
  const zip = await JSZip.loadAsync(bytes);
  const [documentXml, headerXml, settingsXml] = await Promise.all([
    readRequiredPart(zip, "word/document.xml", "answer-key"),
    readRequiredPart(zip, "word/header1.xml", "answer-key"),
    readRequiredPart(zip, "word/settings.xml", "answer-key"),
  ]);
  const documentNode = parseXmlDocument(documentXml, "answer-key");
  const headerNode = parseXmlDocument(headerXml, "answer-key header");
  const settingsNode = parseXmlDocument(settingsXml, "answer-key settings");

  rebuildAnswerTable(documentNode, questions);
  patchAnswerHeader(headerNode, metadata, questions);
  enableFieldUpdates(settingsNode);

  zip.file("word/document.xml", serializeXmlDocument(documentNode));
  zip.file("word/header1.xml", serializeXmlDocument(headerNode));
  zip.file("word/settings.xml", serializeXmlDocument(settingsNode));
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

export async function buildPaperDocxBlob(
  metadata: ExportMetadata,
  questions: Question[],
  content: ExportContent,
) {
  if (!questions.length) {
    throw new Error("There are no questions available to export.");
  }
  return content === "answers"
    ? buildAnswerKeyBlob(metadata, questions)
    : buildQuestionPaperBlob(metadata, questions);
}

export async function downloadPaperDocx(
  metadata: ExportMetadata,
  questions: Question[],
  content: ExportContent = "questions",
) {
  const blob = await buildPaperDocxBlob(metadata, questions, content);
  downloadBlob(blob, `${fileBase(metadata.title, content)}.docx`);
}
