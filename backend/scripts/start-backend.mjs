const port = process.env.BACKEND_PORT ?? process.env.PORT ?? "4000";
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3100";
const apiUrl = process.env.BACKEND_PUBLIC_URL ?? `http://localhost:${port}/api`;
const docsUrl = process.env.API_DOCS_PUBLIC_URL ?? `http://localhost:${port}/api-docs`;
const questionProvider = process.env.QUESTION_PROVIDER ?? "openai";
const openAiConfigured = process.env.OPENAI_API_KEY ? "yes" : "no";

console.log(
  [
    "",
    "========================================",
    " MockPaper Backend",
    "========================================",
    ` API URL     : ${apiUrl}`,
    ` Swagger URL : ${docsUrl}`,
    ` Frontend URL: ${frontendUrl}`,
    ` Bind Port   : ${port}`,
    ` Provider    : ${questionProvider}`,
    ` OpenAI Key  : ${openAiConfigured}`,
    "========================================",
    "",
  ].join("\n"),
);

await import("../dist/index.js");
