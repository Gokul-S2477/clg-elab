import React, { useEffect, useMemo, useRef, useState } from "react";

const LANGUAGE_MAP = {
  python: "python",
  javascript: "javascript",
  java: "java",
  cpp: "cpp",
  c: "c",
  csharp: "csharp",
  go: "go",
  rust: "rust",
  typescript: "typescript",
  php: "php",
  ruby: "ruby",
  swift: "swift",
  kotlin: "kotlin",
  r: "r",
  scala: "scala",
  perl: "perl",
  lua: "lua",
  bash: "bash",
  sql: "postgresql",
};

const FILE_NAME_MAP = {
  python: "main.py",
  javascript: "main.js",
  java: "Main.java",
  cpp: "main.cpp",
  c: "main.c",
  csharp: "Program.cs",
  go: "main.go",
  rust: "main.rs",
  typescript: "main.ts",
  php: "main.php",
  ruby: "main.rb",
  swift: "main.swift",
  kotlin: "Main.kt",
  r: "main.r",
  scala: "Main.scala",
  perl: "main.pl",
  lua: "main.lua",
  bash: "main.sh",
  sql: "script.sql",
};

const OneCompilerEmbed = ({
  language = "python",
  code = "",
  files = null,
  onCodeChange,
  onFilesChange,
  syncVersion = 0,
  theme: initialTheme = "dark",
  title = "Online Compiler",
  subtitle = "",
  templateLabel = "",
  onResetCode,
}) => {
  const iframeRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pendingRun, setPendingRun] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [copied, setCopied] = useState(false);

  const oneCompilerLanguage = LANGUAGE_MAP[language] || "python";
  const fileName = FILE_NAME_MAP[language] || "main.txt";
  const compilerUrl = `https://onecompiler.com/embed/${oneCompilerLanguage}`;

  const iframeSrc = useMemo(() => {
    const query = new URLSearchParams({
      theme,
      listenToEvents: "true",
      codeChangeEvent: "true",
      availableLanguages: "true",
      hideTitle: "true",
      hideNewFileOption: "true",
      hideEditorOptions: "true",
      fontSize: "15",
    });
    return `${compilerUrl}?${query.toString()}`;
  }, [compilerUrl, theme]);

  const populateCode = () => {
    if (!iframeRef.current?.contentWindow || !isLoaded) {
      return;
    }
    const normalizedFiles = Array.isArray(files) && files.length > 0
      ? files.map((item) => ({ name: item.name, content: item.content || "" }))
      : [{ name: fileName, content: code || "" }];
    iframeRef.current.contentWindow.postMessage(
      {
        eventType: "populateCode",
        language: oneCompilerLanguage,
        files: normalizedFiles,
      },
      "*"
    );
  };

  const triggerRun = () => {
    if (!iframeRef.current?.contentWindow || !isLoaded) {
      return;
    }
    iframeRef.current.contentWindow.postMessage({ eventType: "triggerRun" }, "*");
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== "https://onecompiler.com") {
        return;
      }
      const payload = event.data;
      if (payload?.files?.length && typeof onFilesChange === "function") {
        const nextFiles = payload.files.map((item) => ({
          name: item.name || "main.txt",
          content: item.content || "",
        }));
        onFilesChange(nextFiles);
      }
      if (payload?.language && payload?.files?.length && typeof onCodeChange === "function" && typeof onFilesChange !== "function") {
        onCodeChange(payload.files[0]?.content || "");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onCodeChange, onFilesChange]);

  useEffect(() => {
    setIsLoaded(false);
  }, [language, theme]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    populateCode();
  }, [isLoaded, oneCompilerLanguage, syncVersion]);

  useEffect(() => {
    if (pendingRun && isLoaded) {
      triggerRun();
      setPendingRun(false);
    }
  }, [pendingRun, isLoaded]);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[30px] border border-[#dbe8ff] bg-white shadow-[0_22px_48px_rgba(37,99,235,0.08)]">
      <div className="border-b border-[#e8f0ff] bg-gradient-to-r from-[#f8fbff] via-white to-[#eef8ff] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{title}</p>
              {subtitle ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {theme === "dark" ? "Light Theme" : "Dark Theme"}
            </button>
            <button
              type="button"
              onClick={populateCode}
              className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Sync Code
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code || "");
                  setCopied(true);
                } catch {}
              }}
              className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {copied ? "Copied" : "Copy Code"}
            </button>
            {typeof onResetCode === "function" && (
              <button
                type="button"
                onClick={onResetCode}
                className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700"
              >
                Reset Sample
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isLoaded) {
                  triggerRun();
                } else {
                  setPendingRun(true);
                }
              }}
              className="rounded-full bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-2 text-sm font-bold text-white"
            >
              Run in OneCompiler
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-blue-100 bg-white/90 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">{oneCompilerLanguage}</span>
            {templateLabel ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{templateLabel}</span> : null}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isLoaded ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{isLoaded ? "Ready" : "Loading"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://onecompiler.com/${oneCompilerLanguage}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
            >
              Open Full Page
            </a>
            <button
              type="button"
              onClick={() => iframeRef.current?.contentWindow?.focus()}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Focus Editor
            </button>
          </div>
        </div>
      </div>

      <div className="relative min-h-[860px] flex-1 bg-slate-100">
        {!isLoaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
              <p className="mt-4 text-sm font-medium text-slate-500">Loading OneCompiler...</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="OneCompiler Editor"
          src={iframeSrc}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="clipboard-read; clipboard-write"
          className="min-h-[860px] w-full"
          onLoad={() => setIsLoaded(true)}
        />
      </div>
    </div>
  );
};

export default OneCompilerEmbed;
