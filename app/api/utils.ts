import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "../config/server";
import { RequestBody } from "./langchain/tool/agent/agentapi";
// import { fromBufferWithMime } from "textract";

export interface MultimodalContent {
  type: "text" | "image_url" | "file";
  text?: string;
  image_url?: {
    url: string;
  };
  file?: {
    url: string;
    type: string;
    name: string;
  };
}

export interface RequestPayload {
  messages: {
    role: "system" | "user" | "assistant";
    content: string | MultimodalContent[];
  }[];
  stream?: boolean;
  model: string;
  temperature: number;
  presence_penalty: number;
  frequency_penalty: number;
  top_p: number;
  max_tokens?: number;
  textract?: boolean;
}

const serverConfig = getServerSideConfig();

const File_Extension = [
  "pdf",
  "docx",
  "csv",
  "txt",
  "html",
  "odt",
  "rtf",
  "epub",
  "md",
  "xml",
  "xsl",
  "pptx",
  "potx",
];

export function isImage(type: string) {
  return /(gif|png|jpg|jpeg|webp|svg|psd|bmp|tif)/gi.test(type);
}

// const File_Link_Exp = /^https:\/\/.+\..+$/;
const File_Link_Exp =
  /https?:\/\/[^\s/$.?#].[^\s]*\/[^\s]*\.?[a-zA-Z0-9]+(\?[^\s]*)?/g;

// https://file.302.ai/gpt/imgs/20240710/2b58bb42373a4c449c7d03d679c8c38a.html
// https://file.302.ai/gpt/imgs/20240710/b9f97ab0f60d4a469529ac5862317e71.pdf
async function parseText(url: string) {
  console.log("[textract] url:", url);
  const res = await fetch(`${serverConfig.apiDomain}/gpt/api/textract`, {
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({ url }),
  }).then((res) => res.json());
  console.log("[textract] res:", !!res.data.msg, res.data.msg.length);

  if (res.code === 0) {
    return res.data.msg;
  }
  return "";
}

async function handleContentUrl(content: string) {
  // https://file.302.ai/gpt/imgs/20240710/611984ac482b4a3f9212b3da7a473e89.txt\nhi
  const strArr = content.match(File_Link_Exp);
  console.log("[parsePrompt] matched:", JSON.stringify({ strArr }));
  if (!strArr) return content;

  // 找到所有文件链接
  const files = strArr
    .map((s) => {
      const urls = s.match(File_Link_Exp);
      console.log("🚀 ~ .map ~ urls:", urls);
      return urls ? urls : [];
    })
    .flat();
  // const contexts = strArr.filter((s) => !File_Link_Exp.test(s));
  // 提取文件内容
  console.log("🚀 ~ files:", files);
  if (files.length) {
    let fileContent = "";
    for (let idx = 0; idx < files.length; idx++) {
      const url = files[idx];
      const ext = url.substring(url.lastIndexOf(".") + 1);
      console.log("[parsePrompt] get url", JSON.stringify({ url, ext }));

      // if (File_Extension.includes(ext.toLocaleLowerCase())) {
      if (!isImage(ext)) {
        console.log("[parsePrompt] get text", url);
        const result = await parseText(url);

        fileContent = (!!fileContent ? "\n" : "") + result;

        content = content.replaceAll(url, "");
      }
    }

    content += "\n" + `file-content: ${fileContent}`;
  }

  return content;
}

export async function parsePrompt(req: NextRequest, fetchOptions: RequestInit) {
  // 将file 转为 prompt
  console.log("\n\n[parsePrompt] start =============");

  if (req.body) {
    try {
      console.log("[parsePrompt] get body");
      const clonedBody = await req.text();
      fetchOptions.body = clonedBody;
      console.log("[parsePrompt] get body end");

      console.log("[parsePrompt] parse body");
      const jsonBody = JSON.parse(clonedBody) as RequestPayload;
      console.log("[parsePrompt] parse body end");

      console.log("[parsePrompt] 是否应该提取文件内容", jsonBody.textract);
      // 是否应该提取文件内容
      if (jsonBody.textract) {
        for (let i = jsonBody.messages.length - 1; i >= 0; i--) {
          const m = jsonBody.messages[i];
          if (m.role === "user") {
            if (typeof m.content === "string") {
              m.content = await handleContentUrl(m.content);
            }

            break;
          }
        }
      }

      fetchOptions.body = JSON.stringify(jsonBody);

      console.log("[parsePrompt] end =============\n\n");
      return clonedBody;
    } catch (error) {
      console.log("[parsePrompt] error:", error);
      throw error;
      //
    }
  }

  return fetchOptions;
}

export async function parsePrompt4Tools(jsonBody: RequestBody) {
  // 将file 转为 prompt
  console.log("\n\n[parsePrompt4Tools] start =============");

  try {
    console.log("[parsePrompt4Tools] 是否应该提取文件内容", jsonBody.textract);
    // 是否应该提取文件内容
    if (jsonBody.textract) {
      for (let i = jsonBody.messages.length - 1; i >= 0; i--) {
        const m = jsonBody.messages[i];
        if (m.role === "user") {
          if (typeof m.content === "string") {
            m.content = await handleContentUrl(m.content);
          }

          break;
        }
      }
    }

    console.log("[parsePrompt4Tools] end =============\n\n");
    return jsonBody;
  } catch (error) {
    console.log("[parsePrompt4Tools] error:", error);
    throw error;
    //
  }
}
