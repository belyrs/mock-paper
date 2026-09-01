import { createHash } from "node:crypto";
import { access, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const reactShimPath = path.resolve(".output/server/_libs/react.mjs");
const ssrDirPath = path.resolve(".output/server/_ssr");
const publicAssetsDirPath = path.resolve(".output/public/assets");
const serverManifestDirPath = path.resolve(".output/server");
const nitroServerIndexPath = path.resolve(".output/server/index.mjs");
const assetVersion = Date.now().toString(36);

const shimContents = `import { t as __commonJSMin } from "../_runtime.mjs";
//#region patched react jsx-dev-runtime shim
var require_react_jsx_dev_runtime_production = /* @__PURE__ */ __commonJSMin(((exports) => {
\tvar REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
\tvar REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
\tfunction jsxDEV(type, config, maybeKey) {
\t\tvar key = null;
\t\tvoid 0 !== maybeKey && (key = "" + maybeKey);
\t\tconfig || (config = {});
\t\tvoid 0 !== config.key && (key = "" + config.key);
\t\tvar props;
\t\tif ("key" in config) {
\t\t\tprops = {};
\t\t\tfor (var propName in config) "key" !== propName && (props[propName] = config[propName]);
\t\t} else props = config;
\t\tvar ref = props.ref;
\t\treturn {
\t\t\t$$typeof: REACT_ELEMENT_TYPE,
\t\t\ttype,
\t\t\tkey,
\t\t\tref: void 0 !== ref ? ref : null,
\t\t\tprops
\t\t};
\t}
\texports.Fragment = REACT_FRAGMENT_TYPE;
\texports.jsxDEV = jsxDEV;
}));
//#endregion
//#region node_modules/react/jsx-dev-runtime.js
var require_jsx_dev_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
\tmodule.exports = require_react_jsx_dev_runtime_production();
}));
//#endregion
export { require_jsx_dev_runtime as t };
`;

async function ensureFileExists(filePath) {
  await access(filePath, constants.F_OK);
}

async function patchReactShim() {
  try {
    await ensureFileExists(reactShimPath);
  } catch {
    console.warn(
      `[fix-node-server-jsxdev] Skipping patch because ${reactShimPath} was not found.`,
    );
    return;
  }

  const existing = await readFile(reactShimPath, "utf8");
  if (!existing.includes("exports.jsxDEV = void 0;")) {
    console.log("[fix-node-server-jsxdev] JSX dev shim already looks patched.");
    return;
  }

  await writeFile(reactShimPath, shimContents, "utf8");
  console.log(`[fix-node-server-jsxdev] Patched ${reactShimPath}.`);
}

async function collectFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }
      return entryPath;
    }),
  );

  return files.flat();
}

async function patchBrokenSsrJsxCalls() {
  try {
    await stat(ssrDirPath);
  } catch {
    console.warn(
      `[fix-node-server-jsxdev] Skipping SSR call patch because ${ssrDirPath} was not found.`,
    );
    return;
  }

  const files = await collectFiles(ssrDirPath);
  let patchedCount = 0;

  await Promise.all(
    files
      .filter((filePath) => filePath.endsWith(".mjs"))
      .map(async (filePath) => {
        const existing = await readFile(filePath, "utf8");
        if (!existing.includes("(void 0)(")) {
          return;
        }

        const patched = existing.replaceAll(
          "(void 0)(",
          "(0, import_jsx_dev_runtime.jsxDEV)(",
        );

        if (patched === existing) {
          return;
        }

        await writeFile(filePath, patched, "utf8");
        patchedCount += 1;
      }),
  );

  console.log(
    `[fix-node-server-jsxdev] Patched broken SSR JSX calls in ${patchedCount} file(s).`,
  );
}

const clientJsxRuntimeMarker = "e.Fragment=Symbol.for(`react.fragment`),e.jsxDEV=void 0";
const clientJsxRuntimeReplacement =
  "e.Fragment=Symbol.for(`react.fragment`),e.jsxDEV=function(type,config,maybeKey){var key=null;void 0!==maybeKey&&(key=\"\"+maybeKey),config||(config={}),void 0!==config.key&&(key=\"\"+config.key);var props;if(\"key\" in config){props={};for(var propName in config)propName!==`key`&&(props[propName]=config[propName]);}else props=config;var ref=props.ref;return{$$typeof:Symbol.for(`react.transitional.element`),type,key,ref:void 0!==ref?ref:null,props}},globalThis.__mockpaper_jsxDEV__||(globalThis.__mockpaper_jsxDEV__=e.jsxDEV)";

async function patchClientJsxRuntime() {
  try {
    await stat(publicAssetsDirPath);
  } catch {
    console.warn(
      `[fix-node-server-jsxdev] Skipping client bundle patch because ${publicAssetsDirPath} was not found.`,
    );
    return;
  }

  const files = await collectFiles(publicAssetsDirPath);
  let runtimePatchedCount = 0;
  let callsitePatchedCount = 0;

  await Promise.all(
    files
      .filter((filePath) => filePath.endsWith(".js"))
      .map(async (filePath) => {
        const existing = await readFile(filePath, "utf8");
        let patched = existing;

        if (patched.includes(clientJsxRuntimeMarker)) {
          patched = patched.split(clientJsxRuntimeMarker).join(clientJsxRuntimeReplacement);
          if (patched !== existing) {
            runtimePatchedCount += 1;
          }
        }

        if (patched.includes("(void 0)(")) {
          const nextPatched = patched.replaceAll(
            "(void 0)(",
            "globalThis.__mockpaper_jsxDEV__(",
          );

          if (nextPatched !== patched) {
            patched = nextPatched;
            callsitePatchedCount += 1;
          }
        }

        if (patched !== existing) {
          await writeFile(filePath, patched, "utf8");
        }
      }),
  );

  console.log(
    `[fix-node-server-jsxdev] Patched client JSX runtime in ${runtimePatchedCount} file(s).`,
  );
  console.log(
    `[fix-node-server-jsxdev] Patched broken client JSX calls in ${callsitePatchedCount} file(s).`,
  );
}

const assetReferencePattern =
  /(["'`])((?:\.\/|\/assets\/|assets\/)[^"'`?]+\.(?:js|css|png))\1/g;

function applyAssetVersioning(content) {
  return content.replaceAll(assetReferencePattern, (_match, quote, assetPath) => {
    if (assetPath.includes("?v=")) {
      return `${quote}${assetPath}${quote}`;
    }

    return `${quote}${assetPath}?v=${assetVersion}${quote}`;
  });
}

async function patchAssetReferences() {
  const targets = [];

  try {
    await stat(publicAssetsDirPath);
    targets.push(...(await collectFiles(publicAssetsDirPath)).filter((filePath) => filePath.endsWith(".js")));
  } catch {
    console.warn(
      `[fix-node-server-jsxdev] Skipping public asset reference patch because ${publicAssetsDirPath} was not found.`,
    );
  }

  try {
    await stat(serverManifestDirPath);
    targets.push(
      ...(await collectFiles(serverManifestDirPath)).filter((filePath) =>
        path.basename(filePath).startsWith("_tanstack-start-manifest_") && filePath.endsWith(".mjs"),
      ),
    );
  } catch {
    console.warn(
      `[fix-node-server-jsxdev] Skipping server manifest patch because ${serverManifestDirPath} was not found.`,
    );
  }

  let patchedCount = 0;

  await Promise.all(
    [...new Set(targets)].map(async (filePath) => {
      const existing = await readFile(filePath, "utf8");
      const patched = applyAssetVersioning(existing);

      if (patched === existing) {
        return;
      }

      await writeFile(filePath, patched, "utf8");
      patchedCount += 1;
    }),
  );

  console.log(
    `[fix-node-server-jsxdev] Applied asset cache-busting version ${assetVersion} in ${patchedCount} file(s).`,
  );
}

function computePublicAssetEtag(buffer) {
  const sizeHex = buffer.byteLength.toString(16);
  const digest = createHash("sha1")
    .update(buffer)
    .digest("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");

  return `"${sizeHex}-${digest}"`;
}

async function patchNitroPublicAssetMetadata() {
  try {
    await ensureFileExists(nitroServerIndexPath);
  } catch {
    console.warn(
      `[fix-node-server-jsxdev] Skipping Nitro public asset metadata patch because ${nitroServerIndexPath} was not found.`,
    );
    return;
  }

  const existing = await readFile(nitroServerIndexPath, "utf8");
  const startMarker = "var public_assets_data_default = ";
  const endMarker = "\n};\n//#endregion";
  const startIndex = existing.indexOf(startMarker);

  if (startIndex === -1) {
    console.warn("[fix-node-server-jsxdev] Could not find Nitro public asset metadata block.");
    return;
  }

  const objectStart = startIndex + startMarker.length;
  const endIndex = existing.indexOf(endMarker, objectStart);

  if (endIndex === -1) {
    console.warn("[fix-node-server-jsxdev] Could not find the end of the Nitro public asset metadata block.");
    return;
  }

  const objectLiteral = existing.slice(objectStart, endIndex + 2);
  const assetMap = Function(`"use strict"; return (${objectLiteral});`)();
  const serverDir = path.dirname(nitroServerIndexPath);
  let updatedCount = 0;

  for (const asset of Object.values(assetMap)) {
    if (typeof asset?.path !== "string") {
      continue;
    }

    const assetFilePath = path.resolve(serverDir, asset.path);
    try {
      const [assetBuffer, assetStats] = await Promise.all([
        readFile(assetFilePath),
        stat(assetFilePath),
      ]);

      asset.etag = computePublicAssetEtag(assetBuffer);
      asset.mtime = assetStats.mtime.toISOString();
      asset.size = assetBuffer.byteLength;
      updatedCount += 1;
    } catch {
      // Ignore entries that do not resolve to a local file.
    }
  }

  const serializedAssetMap = JSON.stringify(assetMap, null, "\t");
  const patched =
    existing.slice(0, objectStart) + serializedAssetMap + existing.slice(endIndex + 2);

  await writeFile(nitroServerIndexPath, patched, "utf8");
  console.log(
    `[fix-node-server-jsxdev] Refreshed Nitro public asset metadata for ${updatedCount} file(s).`,
  );
}

await patchReactShim();
await patchBrokenSsrJsxCalls();
await patchClientJsxRuntime();
await patchAssetReferences();
await patchNitroPublicAssetMetadata();
