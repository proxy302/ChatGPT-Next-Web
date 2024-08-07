import ReactMarkdown from "react-markdown";
import "katex/dist/katex.min.css";
import RemarkMath from "remark-math";
import RemarkBreaks from "remark-breaks";
import RehypeKatex from "rehype-katex";
import RemarkGfm from "remark-gfm";
import RehypeHighlight from "rehype-highlight";
import { useRef, useState, RefObject, useEffect, useMemo } from "react";
import { copyToClipboard, isImage, useWindowSize } from "../utils";
import mermaid from "mermaid";

import LoadingIcon from "../icons/three-dots.svg";
import React from "react";
import { useDebouncedCallback } from "use-debounce";
import { FullScreen, showImageModal, Modal as UiModal } from "./ui-lib";
import { MultimodalContent } from "../client/api";
import { PluggableList } from "react-markdown/lib/react-markdown";
import rehypeRaw from "rehype-raw";
import Locale from "../locales";
import { Modal, Segmented } from "antd";

import CodeMirror from "@uiw/react-codemirror";
import { LanguageSupport } from "@codemirror/language";
import { html } from "@codemirror/lang-html";
// import { vue } from "@codemirror/lang-vue";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import {
  ArtifactsShareButton,
  detectLanguage,
  HTMLPreview,
  Stdout,
} from "./artifacts";

const htmlReg = /<\/?.+?>/gim;
const svgReg = /<svg[^>]+>/gim;

const langConfigMap: Record<string, LanguageSupport[]> = {
  jsx: [javascript()],
  javascript: [javascript()],
  python: [python()],
  // vue: [vue()],
  html: [html()],
};

export function CodePreviewModal(props: {
  content: string;
  isRunCode?: boolean;
  currentLang: string;
  open: boolean;
  onOk?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onCancel?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onClose?: (e: any) => void;
}) {
  const [tab, setTab] = useState("preview");
  const [code, setCode] = useState(props.content);
  const [codeLang, setCodeLang] = useState(props.currentLang);

  const onChange = useDebouncedCallback((val: string) => {
    setCode(val);

    if (props.isRunCode) {
      const lang = detectLanguage(val);
      setCodeLang(lang === "unknow" ? props.currentLang : lang);
    }
  }, 600);

  return (
    <div className="modal-mask">
      <UiModal
        title={Locale.Preview.Title}
        containerClass="code-preview-modal"
        footer={[]}
        showMaxButton={true}
        onClose={() => props.onClose?.(false)}
      >
        <div className="code-preview-modal-actions">
          <Segmented
            value={tab}
            style={{ marginBottom: 8 }}
            onChange={(value) => setTab(value)}
            options={[
              {
                label: props.isRunCode
                  ? Locale.Preview.Actions.Stdout
                  : Locale.Preview.Actions.Preview,
                value: "preview",
              },
              {
                label: Locale.Preview.Actions.Code,
                value: "code",
              },
            ]}
          />
          {!props.isRunCode && (
            <ArtifactsShareButton
              style={{ position: "relative", top: -5, right: 5 }}
              getCode={() => code}
            />
          )}
        </div>

        {tab === "preview" ? (
          props.isRunCode ? (
            <Stdout codeString={code} codeLang={codeLang} />
          ) : (
            code.length > 0 && (
              <HTMLPreview code={code} autoHeight={true} height="100%" />
            )
          )
        ) : (
          <CodeMirror
            value={code}
            theme="dark"
            extensions={langConfigMap[props.currentLang]}
            onChange={onChange}
          />
        )}
      </UiModal>
    </div>
  );
}

export function Mermaid(props: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (props.code && ref.current) {
      mermaid
        .run({
          nodes: [ref.current],
          suppressErrors: true,
        })
        .catch((e) => {
          setHasError(true);
          console.error("[Mermaid] ", e.message);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.code]);

  function viewSvgInNewWindow() {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const text = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([text], { type: "image/svg+xml" });
    showImageModal(URL.createObjectURL(blob));
  }

  if (hasError) {
    return null;
  }

  return (
    <div
      className="no-dark mermaid"
      style={{
        cursor: "pointer",
        overflow: "auto",
      }}
      ref={ref}
      onClick={() => viewSvgInNewWindow()}
    >
      {props.code}
    </div>
  );
}

export function PreCode(props: { children: any }) {
  const ref = useRef<HTMLPreElement>(null);
  const refText = ref.current?.innerText;
  const [mermaidCode, setMermaidCode] = useState("");
  const [showCodePreviewAction, setShowCodePreviewAction] = useState(false);
  const [showCodeInterpreterAction, setShowCodeInterpreterAction] =
    useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isRunCode, setIsStdout] = useState(false);
  const [codeText, setCodeText] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("html");

  const renderMermaid = useDebouncedCallback(() => {
    if (!ref.current) return;
    const mermaidDom = ref.current.querySelector("code.language-mermaid");
    if (mermaidDom) {
      setMermaidCode((mermaidDom as HTMLElement).innerText);
    }

    const htmlDom = ref.current.querySelector("code.language-html");
    const jsxDom = ref.current.querySelector("code.language-jsx");
    const tsxDom = ref.current.querySelector("code.language-tsx");
    const vueDom = ref.current.querySelector("code.language-vue");

    const javascriptDom = ref.current.querySelector("code.language-javascript");
    const pythonDom = ref.current.querySelector("code.language-python");

    // const _refText = ref.current?.innerText;
    // const svgCode = svgReg.exec(_refText);

    const showPreviewBtn = htmlDom; // || jsxDom || tsxDom || vueDom;

    if (showPreviewBtn) {
      setShowCodePreviewAction(true);
    } else if (refText?.startsWith("<!DOCTYPE")) {
      setShowCodePreviewAction(true);
    }

    if (javascriptDom || pythonDom) {
      setShowCodeInterpreterAction(true);
    }
  }, 600);

  useEffect(() => {
    setTimeout(renderMermaid, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refText]);

  return (
    <>
      {mermaidCode.length > 0 && (
        <Mermaid code={mermaidCode} key={mermaidCode} />
      )}
      <div className="pre-wrap">
        <pre ref={ref}>
          <span
            className="copy-code-button"
            onClick={() => {
              if (ref.current) {
                const code = ref.current.innerText;
                copyToClipboard(code);
              }
            }}
          ></span>
          {props.children}
        </pre>

        <div className="code-actions">
          {showCodePreviewAction && (
            <span
              className="code-actions-item code-preview"
              onClick={() => {
                if (ref.current) {
                  const code = ref.current.innerText;
                  const codeLang =
                    ref.current
                      .querySelector('code[class^="hljs language-"]')
                      ?.className.split("language-")?.[1] ?? "html";
                  setCodeLanguage(codeLang);
                  setCodeText(code);
                  setIsStdout(false);
                  setShowPreview(true);
                }
              }}
            >
              {Locale.Preview.Actions.Preview}
            </span>
          )}

          {showCodeInterpreterAction && (
            <span
              className="code-actions-item code-interpreter"
              onClick={() => {
                if (ref.current) {
                  const code = ref.current.innerText;
                  const codeLang =
                    ref.current
                      .querySelector('code[class^="hljs language-"]')
                      ?.className.split("language-")?.[1] ?? "html";
                  setCodeLanguage(codeLang);
                  setCodeText(code);
                  setIsStdout(true);
                  setShowPreview(true);
                }
              }}
            >
              {Locale.Preview.Actions.Implement}
            </span>
          )}
        </div>
      </div>

      {showPreview && (
        <CodePreviewModal
          content={codeText}
          open={showPreview}
          currentLang={codeLanguage}
          isRunCode={isRunCode}
          onOk={() => setShowPreview(false)}
          onCancel={() => setShowPreview(false)}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

function escapeDollarNumber(text: string) {
  let escapedText = "";

  for (let i = 0; i < text.length; i += 1) {
    let char = text[i];
    const nextChar = text[i + 1] || " ";

    if (char === "$" && nextChar >= "0" && nextChar <= "9") {
      char = "\\$";
    }

    escapedText += char;
  }

  return escapedText;
}

function escapeBrackets(text: string) {
  const pattern =
    /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
  return text.replace(
    pattern,
    (match, codeBlock, squareBracket, roundBracket) => {
      if (codeBlock) {
        return codeBlock;
      } else if (squareBracket) {
        return `$$${squareBracket}$$`;
      } else if (roundBracket) {
        return `$${roundBracket}$`;
      }
      return match;
    },
  );
}

function _MarkDownContent(props: { content: string; isHtml?: boolean }) {
  const escapedContent = useMemo(
    () => escapeBrackets(escapeDollarNumber(props.content)),
    [props.content],
  );

  const rehypePlugins: PluggableList = [
    RehypeKatex,
    [
      RehypeHighlight,
      {
        detect: false,
        ignoreMissing: true,
      },
    ],
  ];
  if (props.isHtml) {
    rehypePlugins.push(
      // @ts-ignore
      rehypeRaw,
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[RemarkMath, RemarkGfm, RemarkBreaks]}
      rehypePlugins={rehypePlugins}
      components={{
        pre: PreCode,
        p: (pProps) => <p {...pProps} dir="auto" />,
        a: (aProps) => {
          const href = aProps.href || "";
          const isInternal = /^\/#/i.test(href);
          const target = isInternal ? "_self" : aProps.target ?? "_blank";
          return <a {...aProps} target={target} />;
        },
      }}
    >
      {escapedContent}
    </ReactMarkdown>
  );
}

export const MarkdownContent = React.memo(_MarkDownContent);

export function Markdown(
  props: {
    content: string | MultimodalContent[];
    imgCount?: number;
    isUser?: boolean;
    loading?: boolean;
    fontSize?: number;
    parentRef?: RefObject<HTMLDivElement>;
    defaultShow?: boolean;
    setShowPreview?: (arg: any) => {};
    setCodeText?: (arg: any) => {};
    setCodeLanguage?: (arg: any) => {};
  } & React.DOMAttributes<HTMLDivElement>,
) {
  const mdRef = useRef<HTMLDivElement>(null);
  const [className, setClassName] = useState("markdown-body");
  const [msgContent, setMsgContent] = useState("");
  const [isHtml, setIsHtml] = useState(false);
  const updateAssistantClass = (imgCount: number) => {
    if (imgCount == 3) {
      setClassName(className + " multi-img-3");
    } else if (imgCount >= 4) {
      setClassName(className + " multi-img-4");
    }
  };
  useEffect(() => {
    updateAssistantClass(props.imgCount ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.imgCount]);

  useEffect(() => {
    let msg = props.content;
    if (!(typeof props.content === "string")) {
      if (props.content instanceof Array) {
        msg = "";
        let imgCount_1 = 0;
        props.content.forEach((content, index) => {
          if (content.type == "text") {
            msg += content.text + "\n";
          } else if (content.type == "image_url") {
            // msg += `[![${index}](${content.image_url!.url})](${
            //   content.image_url!.url
            // })`;
            imgCount_1++;
          } else if (content.type == "file") {
            if (content.file!.type.includes("audio")) {
              msg += `<audio class='msg-audio' preload='auto' controls><source src='${
                content.file!.url
              }'/></audio>`;
              setIsHtml(true);
            } else if (!isImage(content.file!.type)) {
              msg += `[${content.file!.name}](${content.file!.url})` + "\n";
            } else {
              //
            }
          }
        });
        if (imgCount_1 > 0) {
          if (props.isUser) {
            setClassName(className + " user-multi-img");
          } else {
            updateAssistantClass(imgCount_1);
          }
        }
      }
    }
    setMsgContent(msg as string);
  }, [props.content]);

  return (
    <div
      className={className}
      style={{
        fontSize: `${props.fontSize ?? 14}px`,
      }}
      ref={mdRef}
      onContextMenu={props.onContextMenu}
      onDoubleClickCapture={props.onDoubleClickCapture}
      dir="auto"
    >
      {props.loading ? (
        <LoadingIcon />
      ) : (
        <MarkdownContent
          content={msgContent}
          isHtml={isHtml}
          // setShowPreview={props.setShowPreview}
          // setCodeText={props.setCodeText}
          // setCodeLanguage={props.setCodeLanguage}
        />
      )}
    </div>
  );
}
