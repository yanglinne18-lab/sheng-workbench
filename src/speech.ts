export type VoiceStatus = "idle" | "listening" | "unsupported" | "error";

export interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionResultList {
  length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}

interface BrowserSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

export function getBrowserSpeechRecognition() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function isBrowserSpeechSupported() {
  return Boolean(getBrowserSpeechRecognition());
}

export function normalizeSpeechTranscript(input: string) {
  return input
    .trim()
    .replace(/\s+/g, "")
    .replace(/逗号/g, "，")
    .replace(/顿号/g, "、")
    .replace(/句号/g, "。")
    .replace(/问号/g, "？")
    .replace(/感叹号/g, "！")
    .replace(/分号/g, "；")
    .replace(/冒号/g, "：")
    .replace(/换行/g, "\n")
    .replace(/空格/g, " ");
}

export function speechErrorMessage(error: string) {
  const messages: Record<string, string> = {
    "not-allowed": "浏览器未授权麦克风",
    "service-not-allowed": "当前浏览器不允许语音识别服务",
    "no-speech": "没有检测到清晰语音",
    "audio-capture": "没有检测到可用麦克风",
    network: "语音识别服务网络不可用",
  };
  return messages[error] ?? "语音识别中断";
}
