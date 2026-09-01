const host = process.env.HOST ?? "0.0.0.0";
const port = process.env.PORT ?? "3000";
const publicUrl = process.env.FRONTEND_PUBLIC_URL ?? `http://localhost:${port}`;
const apiUrl = process.env.BACKEND_PUBLIC_URL ?? process.env.VITE_API_BASE_URL ?? "http://localhost:4100/api";

console.log(
  [
    "",
    "========================================",
    " MockPaper Frontend",
    "========================================",
    ` Public URL : ${publicUrl}`,
    ` Bind Host  : ${host}`,
    ` Bind Port  : ${port}`,
    ` Backend API: ${apiUrl}`,
    "========================================",
    "",
  ].join("\n"),
);

await import("../.output/server/index.mjs");
