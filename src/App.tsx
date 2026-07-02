import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  AudioLines,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  CircleHelp,
  Database,
  Download,
  FileText,
  LayoutDashboard,
  Link2,
  Mic,
  MicOff,
  Moon,
  Network,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { mockLLMProvider } from "./mockLLM";
import { exportState, loadState, resetState, saveState } from "./storage";
import type {
  AnalysisResult,
  CandidateOpportunity,
  Confidence,
  EntityKind,
  FollowUpTask,
  Interaction,
  Note,
  Opportunity,
  Organization,
  Person,
  Relationship,
  Sensitivity,
  WorkbenchState,
} from "./types";
import {
  type BrowserSpeechRecognition,
  type VoiceStatus,
  getBrowserSpeechRecognition,
  isBrowserSpeechSupported,
  normalizeSpeechTranscript,
  speechErrorMessage,
} from "./speech";
import { clamp, formatDateTime, makeId, normalizeName, todayISO, unique } from "./utils";

type View = "dashboard" | "review" | "people" | "organizations" | "network" | "ask" | "settings";

const navItems: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "工作台", icon: LayoutDashboard },
  { id: "review", label: "记事确认", icon: NotebookPen },
  { id: "people", label: "人物库", icon: UsersRound },
  { id: "organizations", label: "机构库", icon: Building2 },
  { id: "network", label: "关系网", icon: Network },
  { id: "ask", label: "检索问答", icon: Search },
  { id: "settings", label: "本地设置", icon: Settings },
];

const sampleNote =
  "今天和赵总、孙律师吃饭，赵总提到明源装备公司最近在看一家新能源零部件企业收购，也担心历史劳动争议和供应链合同纠纷。孙律师认识他们董秘刘董秘，可以帮忙约一次。赵总是王总介绍认识的，关系温度不错。下次见面可以准备并购合规和争议解决案例。";

export function App() {
  const [state, setState] = useState<WorkbenchState>(() => loadState());
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [draft, setDraft] = useState(sampleNote);
  const [source, setSource] = useState("盛老师文字记事");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("团队内部");
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [query, setQuery] = useState("王总是谁？我们能从华东新能源集团切入什么业务？");
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(() =>
    isBrowserSpeechSupported() ? "idle" : "unsupported",
  );
  const [voiceMessage, setVoiceMessage] = useState("可点击麦克风，把口述内容转写到记事框");

  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (state.settings.speechMode === "localAsr") {
      setVoiceStatus("idle");
      setVoiceMessage("内网 ASR 接口预留中，当前不调用公网语音服务");
      return;
    }
    if (!isBrowserSpeechSupported()) {
      setVoiceStatus("unsupported");
      setVoiceMessage("当前浏览器不支持直接语音转写");
      return;
    }
    setVoiceStatus((current) => (current === "unsupported" ? "idle" : current));
    setVoiceMessage("可点击麦克风，把口述内容转写到记事框");
  }, [state.settings.speechMode]);

  const pendingNotes = state.notes.filter((note) => note.status === "待确认");
  const selectedNote = pendingNotes.find((note) => note.id === selectedNoteId) ?? pendingNotes[0];
  const stats = useMemo(() => buildStats(state), [state]);

  async function analyzeDraft() {
    if (!draft.trim()) return;
    setIsAnalyzing(true);
    const provider = mockLLMProvider;
    const analysis = await provider.analyzeNote({
      text: draft.trim(),
      sensitivity,
      now: new Date().toISOString(),
    });
    const note: Note = {
      id: makeId("note"),
      text: draft.trim(),
      source,
      sensitivity,
      status: "待确认",
      createdAt: new Date().toISOString(),
      analysis,
    };
    setState((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
    setSelectedNoteId(note.id);
    setDraft("");
    setActiveView("review");
    setIsAnalyzing(false);
  }

  function confirmNote(noteId: string) {
    setState((prev) => confirmAnalysisIntoState(prev, noteId));
    setSelectedNoteId(undefined);
    setActiveView("dashboard");
  }

  function dismissNote(noteId: string) {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((note) => (note.id === noteId ? { ...note, status: "原始" } : note)),
    }));
  }

  function toggleTask(taskId: string) {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId ? { ...task, status: task.status === "完成" ? "待办" : "完成" } : task,
      ),
    }));
  }

  function runQuestion() {
    setAnswer(answerQuestion(state, query));
  }

  function handleReset() {
    const next = resetState();
    setState(next);
    setActiveView("dashboard");
  }

  function savePerson(person: Person) {
    setState((prev) => upsertPersonIntoState(prev, person));
  }

  function deletePerson(personId: string) {
    setState((prev) => deletePersonFromState(prev, personId));
  }

  function saveOrganization(organization: Organization) {
    setState((prev) => upsertOrganizationIntoState(prev, organization));
  }

  function deleteOrganization(organizationId: string) {
    setState((prev) => deleteOrganizationFromState(prev, organizationId));
  }

  function toggleTheme() {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: prev.settings.theme === "dark" ? "light" : "dark",
      },
    }));
  }

  function appendVoiceTranscript(transcript: string) {
    const cleaned = normalizeSpeechTranscript(transcript);
    if (!cleaned) return;
    setDraft((prev) => {
      const trimmed = prev.trimEnd();
      const separator = trimmed ? (/[。！？；\n]$/.test(trimmed) ? "\n" : "。") : "";
      return `${trimmed}${separator}${cleaned}`;
    });
    setSource((current) => (current.includes("语音") ? current : "盛老师语音转写"));
  }

  function startVoiceInput() {
    if (state.settings.speechMode === "localAsr") {
      setVoiceStatus("error");
      setVoiceMessage("内网 ASR 还未接入，当前请切回浏览器语音识别或继续文字输入");
      return;
    }

    const Recognition = getBrowserSpeechRecognition();
    if (!Recognition) {
      setVoiceStatus("unsupported");
      setVoiceMessage("当前浏览器不支持语音识别，可后续接入内网 ASR");
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = state.settings.speechLanguage || "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) appendVoiceTranscript(transcript);
        else interim += transcript;
      }
      setVoiceMessage(interim ? `正在识别：${interim.trim()}` : "正在听，可以继续口述");
    };
    recognition.onerror = (event) => {
      setVoiceStatus("error");
      setVoiceMessage(speechErrorMessage(event.error));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceStatus((current) => (current === "listening" ? "idle" : current));
      setVoiceMessage((current) => (current.startsWith("正在") ? "语音转写已停止" : current));
    };

    try {
      recognition.start();
      setVoiceStatus("listening");
      setVoiceMessage("正在听，请开始口述");
    } catch {
      setVoiceStatus("error");
      setVoiceMessage("语音识别启动失败，请检查浏览器麦克风权限");
    }
  }

  function stopVoiceInput() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceStatus("idle");
    setVoiceMessage("语音转写已停止");
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="brandMark">
            <BriefcaseBusiness size={20} />
          </div>
          <div>
            <div className="brandTitle">盛老师工作台</div>
            <div className="brandSub">关系外脑 · 本地优先</div>
          </div>
        </div>

        <nav className="navList">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`navButton ${activeView === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => setActiveView(item.id)}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === "review" && pendingNotes.length > 0 ? (
                  <b className="navCount">{pendingNotes.length}</b>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="localStatus">
          <ShieldCheck size={18} />
          <div>
            <strong>内网模型模式</strong>
            <span>数据不送公网分析</span>
          </div>
        </div>
      </aside>

      <main className="mainArea">
        <Topbar
          state={state}
          onExport={() => exportState(state)}
          onReset={handleReset}
          onToggleTheme={toggleTheme}
        />
        {activeView === "dashboard" ? (
          <Dashboard
            stats={stats}
            draft={draft}
            source={source}
            sensitivity={sensitivity}
            isAnalyzing={isAnalyzing}
            state={state}
            pendingNotes={pendingNotes}
            voiceStatus={voiceStatus}
            voiceMessage={voiceMessage}
            speechMode={state.settings.speechMode}
            onDraftChange={setDraft}
            onSourceChange={setSource}
            onSensitivityChange={setSensitivity}
            onAnalyze={analyzeDraft}
            onGoReview={() => setActiveView("review")}
            onToggleTask={toggleTask}
            onStartVoice={startVoiceInput}
            onStopVoice={stopVoiceInput}
          />
        ) : null}
        {activeView === "review" ? (
          <ReviewView
            pendingNotes={pendingNotes}
            selectedNote={selectedNote}
            onSelect={setSelectedNoteId}
            onConfirm={confirmNote}
            onDismiss={dismissNote}
          />
        ) : null}
        {activeView === "people" ? (
          <PeopleView
            state={state}
            searchTerm={searchTerm}
            onSearch={setSearchTerm}
            onSave={savePerson}
            onDelete={deletePerson}
          />
        ) : null}
        {activeView === "organizations" ? (
          <OrganizationsView
            state={state}
            searchTerm={searchTerm}
            onSearch={setSearchTerm}
            onSave={saveOrganization}
            onDelete={deleteOrganization}
          />
        ) : null}
        {activeView === "network" ? <NetworkView state={state} /> : null}
        {activeView === "ask" ? (
          <AskView query={query} answer={answer} onQuery={setQuery} onAsk={runQuestion} />
        ) : null}
        {activeView === "settings" ? (
          <SettingsView
            state={state}
            onChange={(settings) => setState((prev) => ({ ...prev, settings }))}
          />
        ) : null}
      </main>
    </div>
  );
}

function Topbar({
  state,
  onExport,
  onReset,
  onToggleTheme,
}: {
  state: WorkbenchState;
  onExport: () => void;
  onReset: () => void;
  onToggleTheme: () => void;
}) {
  const ThemeIcon = state.settings.theme === "dark" ? Sun : Moon;

  return (
    <header className="topbar">
      <div>
        <h1>人脉关系外脑</h1>
        <p>事实入库、来源追踪、AI 草稿确认后沉淀。</p>
      </div>
      <div className="topActions">
        <Badge tone="green">
          <Database size={14} />
          {state.settings.retrievalMode === "hybrid" ? "混合检索" : "关键词检索"}
        </Badge>
        <Badge tone="amber">
          <Bot size={14} />
          Mock AI
        </Badge>
        <button
          className="iconButton"
          onClick={onToggleTheme}
          title={state.settings.theme === "dark" ? "切换日间模式" : "切换夜间模式"}
        >
          <ThemeIcon size={17} />
        </button>
        <button className="iconTextButton" onClick={onExport} title="导出 JSON">
          <Download size={17} />
          <span>导出</span>
        </button>
        <button className="iconButton" onClick={onReset} title="恢复样例数据">
          <RefreshCcw size={17} />
        </button>
      </div>
    </header>
  );
}

function Dashboard({
  stats,
  draft,
  source,
  sensitivity,
  isAnalyzing,
  state,
  pendingNotes,
  voiceStatus,
  voiceMessage,
  speechMode,
  onDraftChange,
  onSourceChange,
  onSensitivityChange,
  onAnalyze,
  onGoReview,
  onToggleTask,
  onStartVoice,
  onStopVoice,
}: {
  stats: Array<{ label: string; value: number; icon: LucideIcon }>;
  draft: string;
  source: string;
  sensitivity: Sensitivity;
  isAnalyzing: boolean;
  state: WorkbenchState;
  pendingNotes: Note[];
  voiceStatus: VoiceStatus;
  voiceMessage: string;
  speechMode: WorkbenchState["settings"]["speechMode"];
  onDraftChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSensitivityChange: (value: Sensitivity) => void;
  onAnalyze: () => void;
  onGoReview: () => void;
  onToggleTask: (taskId: string) => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
}) {
  const activeTasks = state.tasks.filter((task) => task.status !== "完成");
  const recentInteractions = state.interactions.slice(0, 4);

  return (
    <div className="viewStack">
      <section className="statsGrid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="statTile" key={stat.label}>
              <Icon size={18} />
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          );
        })}
      </section>

      <section className="workGrid">
        <div className="panel composerPanel">
          <SectionTitle icon={NotebookPen} title="快速记事" action="AI 草稿先确认再入库" />
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            className="noteTextarea"
            placeholder="输入盛老师的文字记事、会后记录或人脉线索..."
          />
          <VoiceInputBar
            status={voiceStatus}
            message={voiceMessage}
            speechMode={speechMode}
            onStart={onStartVoice}
            onStop={onStopVoice}
          />
          <div className="composerControls">
            <label>
              <span>来源</span>
              <input value={source} onChange={(event) => onSourceChange(event.target.value)} />
            </label>
            <label>
              <span>密级</span>
              <select
                value={sensitivity}
                onChange={(event) => onSensitivityChange(event.target.value as Sensitivity)}
              >
                <option>普通</option>
                <option>团队内部</option>
                <option>客户机密</option>
                <option>敏感</option>
              </select>
            </label>
            <button className="primaryButton" onClick={onAnalyze} disabled={!draft.trim() || isAnalyzing}>
              <Bot size={18} />
              <span>{isAnalyzing ? "分析中" : "生成待确认草稿"}</span>
            </button>
          </div>
        </div>

        <div className="panel">
          <SectionTitle icon={CheckCircle2} title="待确认队列" action={`${pendingNotes.length} 条`} />
          {pendingNotes.length ? (
            <div className="compactList">
              {pendingNotes.slice(0, 4).map((note) => (
                <button className="noteRow" key={note.id} onClick={onGoReview}>
                  <span>{note.analysis?.summary ?? note.text}</span>
                  <small>{formatDateTime(note.createdAt)}</small>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={Archive} text="没有等待确认的 AI 草稿" />
          )}
        </div>
      </section>

      <section className="lowerGrid">
        <div className="panel">
          <SectionTitle icon={FileText} title="最近互动" action="来源可追踪" />
          <div className="timeline">
            {recentInteractions.map((interaction) => (
              <InteractionRow key={interaction.id} interaction={interaction} state={state} />
            ))}
          </div>
        </div>

        <div className="panel">
          <SectionTitle icon={CircleHelp} title="下一步动作" action="关系维护" />
          <div className="taskList">
            {activeTasks.length ? (
              activeTasks.map((task) => (
                <TaskRow key={task.id} task={task} state={state} onToggle={onToggleTask} />
              ))
            ) : (
              <EmptyState icon={CheckCircle2} text="暂无待办动作" />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function VoiceInputBar({
  status,
  message,
  speechMode,
  onStart,
  onStop,
}: {
  status: VoiceStatus;
  message: string;
  speechMode: WorkbenchState["settings"]["speechMode"];
  onStart: () => void;
  onStop: () => void;
}) {
  const isListening = status === "listening";
  const isDisabled = !isListening && (status === "unsupported" || speechMode === "localAsr");
  const modeLabel = speechMode === "localAsr" ? "内网 ASR 预留" : "浏览器转写";

  return (
    <div className={`voiceBar ${isListening ? "listening" : ""} ${status === "error" ? "error" : ""}`}>
      <div className="voiceMeta">
        <AudioLines size={18} />
        <div>
          <strong>智能语音输入</strong>
          <span>{message}</span>
        </div>
      </div>
      <div className="voiceActions">
        <span className="voiceMode">{modeLabel}</span>
        <button
          className={`secondaryButton voiceButton ${isListening ? "recording" : ""}`}
          onClick={isListening ? onStop : onStart}
          disabled={isDisabled}
          title={isListening ? "停止语音转写" : "开始语音转写"}
        >
          {isListening ? <MicOff size={17} /> : <Mic size={17} />}
          <span>{isListening ? "停止转写" : "开始口述"}</span>
        </button>
      </div>
    </div>
  );
}

function ReviewView({
  pendingNotes,
  selectedNote,
  onSelect,
  onConfirm,
  onDismiss,
}: {
  pendingNotes: Note[];
  selectedNote?: Note;
  onSelect: (id: string) => void;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (!pendingNotes.length || !selectedNote?.analysis) {
    return (
      <section className="panel fullPanel">
        <EmptyState icon={CheckCircle2} text="待确认队列为空" />
      </section>
    );
  }

  const analysis = selectedNote.analysis;

  return (
    <div className="reviewLayout">
      <aside className="reviewList">
        {pendingNotes.map((note) => (
          <button
            className={`reviewListItem ${note.id === selectedNote.id ? "active" : ""}`}
            key={note.id}
            onClick={() => onSelect(note.id)}
          >
            <strong>{note.analysis?.interactions[0]?.title ?? "记事草稿"}</strong>
            <span>{formatDateTime(note.createdAt)}</span>
          </button>
        ))}
      </aside>

      <section className="reviewMain">
        <div className="panel">
          <SectionTitle icon={NotebookPen} title="原始记事" action={selectedNote.sensitivity} />
          <p className="sourceText">{selectedNote.text}</p>
          <div className="reviewActions">
            <button className="primaryButton" onClick={() => onConfirm(selectedNote.id)}>
              <CheckCircle2 size={18} />
              <span>确认并入库</span>
            </button>
            <button className="secondaryButton" onClick={() => onDismiss(selectedNote.id)}>
              <Archive size={18} />
              <span>暂不入库</span>
            </button>
          </div>
        </div>
        <AnalysisPreview analysis={analysis} />
      </section>
    </div>
  );
}

function AnalysisPreview({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="analysisGrid">
      <CandidatePanel title="人物" icon={UsersRound} count={analysis.people.length}>
        {analysis.people.map((person) => (
          <div className="miniCard" key={person.tempId}>
            <div className="miniHeader">
              <strong>{person.name}</strong>
              <ConfidenceBadge confidence={person.confidence} />
            </div>
            <p>{person.role}</p>
            <TagList tags={[...person.tags, ...person.needs].slice(0, 5)} />
          </div>
        ))}
      </CandidatePanel>
      <CandidatePanel title="机构" icon={Building2} count={analysis.organizations.length}>
        {analysis.organizations.map((org) => (
          <div className="miniCard" key={org.tempId}>
            <div className="miniHeader">
              <strong>{org.name}</strong>
              <Badge tone="gray">{org.industry}</Badge>
            </div>
            <p>{org.relationshipStatus}</p>
            <TagList tags={org.legalNeeds.length ? org.legalNeeds : org.tags} />
          </div>
        ))}
      </CandidatePanel>
      <CandidatePanel title="关系" icon={Link2} count={analysis.relationships.length}>
        {analysis.relationships.map((rel) => (
          <div className="relationLine" key={rel.tempId}>
            <span>{rel.fromName}</span>
            <b>{rel.label}</b>
            <span>{rel.toName}</span>
          </div>
        ))}
      </CandidatePanel>
      <CandidatePanel title="机会/动作" icon={BriefcaseBusiness} count={analysis.opportunities.length}>
        {analysis.opportunities.map((opportunity) => (
          <OpportunityDraft key={opportunity.tempId} opportunity={opportunity} />
        ))}
        {analysis.tasks.map((task) => (
          <div className="miniCard" key={task.tempId}>
            <strong>{task.title}</strong>
            <p>{task.dueText}</p>
          </div>
        ))}
      </CandidatePanel>
      <div className="panel cautionsPanel">
        <SectionTitle icon={ShieldCheck} title="确认边界" action="人工复核" />
        {analysis.cautions.map((caution) => (
          <p key={caution} className="cautionLine">
            {caution}
          </p>
        ))}
      </div>
    </div>
  );
}

function PeopleView({
  state,
  searchTerm,
  onSearch,
  onSave,
  onDelete,
}: {
  state: WorkbenchState;
  searchTerm: string;
  onSearch: (value: string) => void;
  onSave: (person: Person) => void;
  onDelete: (personId: string) => void;
}) {
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const people = filterItems(state.people, searchTerm, (person) =>
    [person.name, person.role, person.organizationName, person.tags.join(" "), person.needs.join(" ")].join(" "),
  );

  return (
    <div className="viewStack">
      <div className="databaseToolbar">
        <SearchBar value={searchTerm} onChange={onSearch} placeholder="搜索人物、角色、标签、业务需求..." />
        <button className="primaryButton" onClick={() => setEditingPerson(createBlankPerson())}>
          <Plus size={18} />
          <span>新增人物</span>
        </button>
      </div>
      <div className="cardGrid">
        {people.map((person) => (
          <article className="entityCard" key={person.id}>
            <div className="entityTop">
              <div>
                <h2>{person.name}</h2>
                <p>{person.role}</p>
              </div>
              <div className="entityTopRight">
                <div className="entityActions">
                  <button className="iconButton small" onClick={() => setEditingPerson(person)} title="编辑人物">
                    <Pencil size={15} />
                  </button>
                  <button
                    className="iconButton small danger"
                    onClick={() => {
                      if (window.confirm(`确认删除人物「${person.name}」？相关关系和任务引用也会清理。`)) {
                        onDelete(person.id);
                      }
                    }}
                    title="删除人物"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <Temperature value={person.relationshipTemperature} />
              </div>
            </div>
            <div className="entityMeta">
              {person.organizationName ? <Badge tone="green">{person.organizationName}</Badge> : null}
              <ConfidenceBadge confidence={person.confidence} />
              <Badge tone="gray">{person.sensitivity}</Badge>
            </div>
            <InfoLine label="介绍路径" value={person.introPath} />
            <InfoLine label="资源" value={person.resources.join("、") || "待补充"} />
            <InfoLine label="可能需求" value={person.needs.join("、") || "待判断"} />
            <TagList tags={person.tags} />
          </article>
        ))}
      </div>
      {editingPerson ? (
        <PersonEditor
          key={editingPerson.id}
          person={editingPerson}
          organizations={state.organizations}
          onCancel={() => setEditingPerson(null)}
          onSave={(person) => {
            onSave(person);
            setEditingPerson(null);
          }}
        />
      ) : null}
    </div>
  );
}

function OrganizationsView({
  state,
  searchTerm,
  onSearch,
  onSave,
  onDelete,
}: {
  state: WorkbenchState;
  searchTerm: string;
  onSearch: (value: string) => void;
  onSave: (organization: Organization) => void;
  onDelete: (organizationId: string) => void;
}) {
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const organizations = filterItems(state.organizations, searchTerm, (org) =>
    [org.name, org.industry, org.relationshipStatus, org.legalNeeds.join(" "), org.tags.join(" ")].join(" "),
  );

  return (
    <div className="viewStack">
      <div className="databaseToolbar">
        <SearchBar value={searchTerm} onChange={onSearch} placeholder="搜索公司、集团、行业、法律需求..." />
        <button className="primaryButton" onClick={() => setEditingOrganization(createBlankOrganization())}>
          <Plus size={18} />
          <span>新增机构</span>
        </button>
      </div>
      <div className="cardGrid">
        {organizations.map((org) => {
          const keyPeople = org.keyPeopleIds.map((id) => findPerson(state, id)).filter(Boolean) as Person[];
          return (
            <article className="entityCard" key={org.id}>
              <div className="entityTop">
                <div>
                  <h2>{org.name}</h2>
                  <p>{org.industry}</p>
                </div>
                <div className="entityTopRight">
                  <div className="entityActions">
                    <button className="iconButton small" onClick={() => setEditingOrganization(org)} title="编辑机构">
                      <Pencil size={15} />
                    </button>
                    <button
                      className="iconButton small danger"
                      onClick={() => {
                        if (window.confirm(`确认删除机构「${org.name}」？人物归属和相关引用也会清理。`)) {
                          onDelete(org.id);
                        }
                      }}
                      title="删除机构"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <Badge tone="amber">{org.relationshipStatus}</Badge>
                </div>
              </div>
              <div className="entityMeta">
                <ConfidenceBadge confidence={org.confidence} />
                <Badge tone="gray">{org.sensitivity}</Badge>
              </div>
              <InfoLine label="关键人物" value={keyPeople.map((person) => person.name).join("、") || "待补充"} />
              <InfoLine label="法律需求" value={org.legalNeeds.join("、") || "待判断"} />
              <p className="entityNote">{org.notes}</p>
              <TagList tags={org.tags} />
            </article>
          );
        })}
      </div>
      {editingOrganization ? (
        <OrganizationEditor
          key={editingOrganization.id}
          organization={editingOrganization}
          onCancel={() => setEditingOrganization(null)}
          onSave={(organization) => {
            onSave(organization);
            setEditingOrganization(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PersonEditor({
  person,
  organizations,
  onSave,
  onCancel,
}: {
  person: Person;
  organizations: Organization[];
  onSave: (person: Person) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Person>({ ...person });

  function update<K extends keyof Person>(key: K, value: Person[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    const org = form.organizationId ? organizations.find((item) => item.id === form.organizationId) : undefined;
    onSave({
      ...form,
      name: form.name.trim(),
      role: form.role.trim() || "待补充",
      organizationName: org?.name,
      tags: unique(form.tags.map((item) => item.trim()).filter(Boolean)),
      resources: unique(form.resources.map((item) => item.trim()).filter(Boolean)),
      needs: unique(form.needs.map((item) => item.trim()).filter(Boolean)),
      introPath: form.introPath.trim() || "待补充",
      notes: form.notes.trim(),
      confidence: form.confidence,
      sensitivity: form.sensitivity,
    });
  }

  return (
    <div className="editorOverlay" role="dialog" aria-modal="true">
      <div className="editorDialog">
        <div className="editorHeader">
          <div>
            <strong>{person.name ? "编辑人物" : "新增人物"}</strong>
            <span>手动维护后的内容会直接进入事实库</span>
          </div>
          <button className="iconButton small" onClick={onCancel} title="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="editorGrid">
          <label>
            <span>姓名</span>
            <input value={form.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <label>
            <span>角色/身份</span>
            <input value={form.role} onChange={(event) => update("role", event.target.value)} />
          </label>
          <label>
            <span>所属机构</span>
            <select
              value={form.organizationId ?? ""}
              onChange={(event) => update("organizationId", event.target.value || undefined)}
            >
              <option value="">未归属机构</option>
              {organizations.map((org) => (
                <option value={org.id} key={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>关系温度</span>
            <input
              type="number"
              min={1}
              max={5}
              value={form.relationshipTemperature}
              onChange={(event) => update("relationshipTemperature", clamp(Number(event.target.value), 1, 5))}
            />
          </label>
          <label>
            <span>置信度</span>
            <select value={form.confidence} onChange={(event) => update("confidence", event.target.value as Confidence)}>
              <option>已确认</option>
              <option>AI 推测</option>
              <option>待核实</option>
            </select>
          </label>
          <label>
            <span>密级</span>
            <select value={form.sensitivity} onChange={(event) => update("sensitivity", event.target.value as Sensitivity)}>
              <option>普通</option>
              <option>团队内部</option>
              <option>客户机密</option>
              <option>敏感</option>
            </select>
          </label>
          <label className="span2">
            <span>介绍路径</span>
            <input value={form.introPath} onChange={(event) => update("introPath", event.target.value)} />
          </label>
          <label className="span2">
            <span>标签</span>
            <input value={joinList(form.tags)} onChange={(event) => update("tags", splitList(event.target.value))} />
          </label>
          <label className="span2">
            <span>资源</span>
            <input
              value={joinList(form.resources)}
              onChange={(event) => update("resources", splitList(event.target.value))}
            />
          </label>
          <label className="span2">
            <span>可能需求</span>
            <input value={joinList(form.needs)} onChange={(event) => update("needs", splitList(event.target.value))} />
          </label>
          <label className="span2">
            <span>备注</span>
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} />
          </label>
        </div>

        <div className="editorActions">
          <button className="secondaryButton" onClick={onCancel}>
            <X size={17} />
            <span>取消</span>
          </button>
          <button className="primaryButton" onClick={submit} disabled={!form.name.trim()}>
            <Save size={17} />
            <span>保存人物</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function OrganizationEditor({
  organization,
  onSave,
  onCancel,
}: {
  organization: Organization;
  onSave: (organization: Organization) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Organization>({ ...organization });

  function update<K extends keyof Organization>(key: K, value: Organization[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    onSave({
      ...form,
      name: form.name.trim(),
      industry: form.industry.trim() || "待补充",
      tags: unique(form.tags.map((item) => item.trim()).filter(Boolean)),
      legalNeeds: unique(form.legalNeeds.map((item) => item.trim()).filter(Boolean)),
      relationshipStatus: form.relationshipStatus.trim() || "待补充",
      notes: form.notes.trim(),
      confidence: form.confidence,
      sensitivity: form.sensitivity,
    });
  }

  return (
    <div className="editorOverlay" role="dialog" aria-modal="true">
      <div className="editorDialog">
        <div className="editorHeader">
          <div>
            <strong>{organization.name ? "编辑机构" : "新增机构"}</strong>
            <span>适合维护公司、集团、律所、基金、商会等对象</span>
          </div>
          <button className="iconButton small" onClick={onCancel} title="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="editorGrid">
          <label>
            <span>机构名称</span>
            <input value={form.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <label>
            <span>行业/类型</span>
            <input value={form.industry} onChange={(event) => update("industry", event.target.value)} />
          </label>
          <label>
            <span>关系状态</span>
            <input value={form.relationshipStatus} onChange={(event) => update("relationshipStatus", event.target.value)} />
          </label>
          <label>
            <span>置信度</span>
            <select value={form.confidence} onChange={(event) => update("confidence", event.target.value as Confidence)}>
              <option>已确认</option>
              <option>AI 推测</option>
              <option>待核实</option>
            </select>
          </label>
          <label>
            <span>密级</span>
            <select value={form.sensitivity} onChange={(event) => update("sensitivity", event.target.value as Sensitivity)}>
              <option>普通</option>
              <option>团队内部</option>
              <option>客户机密</option>
              <option>敏感</option>
            </select>
          </label>
          <label className="span2">
            <span>标签</span>
            <input value={joinList(form.tags)} onChange={(event) => update("tags", splitList(event.target.value))} />
          </label>
          <label className="span2">
            <span>法律需求</span>
            <input
              value={joinList(form.legalNeeds)}
              onChange={(event) => update("legalNeeds", splitList(event.target.value))}
            />
          </label>
          <label className="span2">
            <span>备注</span>
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} />
          </label>
        </div>

        <div className="editorActions">
          <button className="secondaryButton" onClick={onCancel}>
            <X size={17} />
            <span>取消</span>
          </button>
          <button className="primaryButton" onClick={submit} disabled={!form.name.trim()}>
            <Save size={17} />
            <span>保存机构</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function NetworkView({ state }: { state: WorkbenchState }) {
  const nodes = buildNetworkNodes(state);
  const topRelations = state.relationships.slice(0, 8);

  return (
    <div className="networkLayout">
      <section className="panel networkPanel">
        <SectionTitle icon={Network} title="关系图谱" action={`${state.relationships.length} 条关系`} />
        <div className="networkCanvas">
          {nodes.map((node, index) => (
            <div
              className={`networkNode ${node.kind}`}
              key={`${node.kind}-${node.id}`}
              style={{ "--x": `${node.x}%`, "--y": `${node.y}%`, "--delay": `${index * 30}ms` } as never}
              title={node.subtitle}
            >
              <span>{node.label}</span>
              <small>{node.subtitle}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <SectionTitle icon={Link2} title="关键路径" action="可用于引荐判断" />
        <div className="relationList">
          {topRelations.map((relation) => (
            <div className="relationPath" key={relation.id}>
              <span>{entityName(state, relation.fromKind, relation.fromId)}</span>
              <b>{relation.label}</b>
              <span>{entityName(state, relation.toKind, relation.toId)}</span>
              <Temperature value={relation.strength} compact />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AskView({
  query,
  answer,
  onQuery,
  onAsk,
}: {
  query: string;
  answer: AnswerResult | null;
  onQuery: (value: string) => void;
  onAsk: () => void;
}) {
  return (
    <div className="askLayout">
      <section className="panel">
        <SectionTitle icon={Search} title="检索问答" action="只基于已入库资料" />
        <textarea
          className="questionBox"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="例如：明天见王总，我要准备什么？"
        />
        <button className="primaryButton" onClick={onAsk} disabled={!query.trim()}>
          <Search size={18} />
          <span>检索并生成回答</span>
        </button>
      </section>

      <section className="panel answerPanel">
        <SectionTitle icon={Bot} title="回答草稿" action={answer ? `${answer.sources.length} 条来源` : "等待检索"} />
        {answer ? (
          <>
            <p className="answerText">{answer.text}</p>
            <div className="sourceList">
              {answer.sources.map((source) => (
                <div className="sourceItem" key={`${source.kind}-${source.id}`}>
                  <Badge tone={source.kind === "人物" ? "green" : source.kind === "机构" ? "amber" : "gray"}>
                    {source.kind}
                  </Badge>
                  <div>
                    <strong>{source.title}</strong>
                    <p>{source.excerpt}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState icon={Search} text="输入问题后生成基于记忆库的回答" />
        )}
      </section>
    </div>
  );
}

function SettingsView({
  state,
  onChange,
}: {
  state: WorkbenchState;
  onChange: (settings: WorkbenchState["settings"]) => void;
}) {
  const settings = state.settings;

  return (
    <div className="settingsGrid">
      <section className="panel">
        <SectionTitle icon={Bot} title="LLM Provider" action="可插拔" />
        <div className="settingsRows">
          <label>
            <span>当前模式</span>
            <select
              value={settings.provider}
              onChange={(event) => onChange({ ...settings, provider: event.target.value as "mock" | "localDeepSeek" })}
            >
              <option value="mock">Mock 本地分析器</option>
              <option value="localDeepSeek">本地 DeepSeek 预留</option>
            </select>
          </label>
          <label>
            <span>内网接口</span>
            <input
              value={settings.localEndpoint}
              onChange={(event) => onChange({ ...settings, localEndpoint: event.target.value })}
            />
          </label>
          <label>
            <span>模型名称</span>
            <input
              value={settings.localModel}
              onChange={(event) => onChange({ ...settings, localModel: event.target.value })}
            />
          </label>
          <label>
            <span>检索模式</span>
            <select
              value={settings.retrievalMode}
              onChange={(event) => onChange({ ...settings, retrievalMode: event.target.value as "keyword" | "hybrid" })}
            >
              <option value="hybrid">混合检索：字段 + 关键词 + 语义预留</option>
              <option value="keyword">关键词检索</option>
            </select>
          </label>
          <label>
            <span>界面主题</span>
            <select
              value={settings.theme}
              onChange={(event) => onChange({ ...settings, theme: event.target.value as WorkbenchState["settings"]["theme"] })}
            >
              <option value="light">日间：珍珠白</option>
              <option value="dark">夜间：深红灰</option>
            </select>
          </label>
          <label>
            <span>语音输入模式</span>
            <select
              value={settings.speechMode}
              onChange={(event) =>
                onChange({ ...settings, speechMode: event.target.value as WorkbenchState["settings"]["speechMode"] })
              }
            >
              <option value="browser">浏览器语音识别</option>
              <option value="localAsr">内网 ASR 预留</option>
            </select>
          </label>
          <label>
            <span>语音识别语言</span>
            <select
              value={settings.speechLanguage}
              onChange={(event) => onChange({ ...settings, speechLanguage: event.target.value })}
            >
              <option value="zh-CN">普通话 zh-CN</option>
              <option value="zh-Hans-CN">简体中文 zh-Hans-CN</option>
              <option value="en-US">英语 en-US</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <SectionTitle icon={ShieldCheck} title="隐私与事实边界" action="MVP 规则" />
        <div className="ruleList">
          <p>原始记事完整保留，AI 只生成待确认草稿。</p>
          <p>人物、机构、关系、机会入库后保留来源 noteId。</p>
          <p>检索问答只读取相关片段，不把整库塞进上下文。</p>
          <p>本地 DeepSeek 接入后替换 provider，不改变业务数据结构。</p>
          <p>浏览器语音识别仅作为便捷入口；敏感场景建议切换为后续内网 ASR。</p>
        </div>
      </section>
    </div>
  );
}

function CandidatePanel({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="panel candidatePanel">
      <SectionTitle icon={Icon} title={title} action={`${count} 项`} />
      <div className="candidateStack">{count ? children : <EmptyState icon={Archive} text="未抽取到内容" />}</div>
    </div>
  );
}

function OpportunityDraft({ opportunity }: { opportunity: CandidateOpportunity }) {
  return (
    <div className="miniCard">
      <strong>{opportunity.title}</strong>
      <p>{opportunity.nextStep}</p>
      <TagList tags={opportunity.practiceAreas} />
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: string;
}) {
  return (
    <div className="sectionTitle">
      <div>
        <Icon size={18} />
        <strong>{title}</strong>
      </div>
      {action ? <span>{action}</span> : null}
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="searchBar">
      <Search size={18} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function InteractionRow({ interaction, state }: { interaction: Interaction; state: WorkbenchState }) {
  const participants = interaction.participantIds.map((id) => findPerson(state, id)?.name).filter(Boolean);
  const orgs = interaction.organizationIds.map((id) => findOrg(state, id)?.name).filter(Boolean);

  return (
    <div className="timelineItem">
      <time>{interaction.date}</time>
      <div>
        <strong>{interaction.title}</strong>
        <p>{interaction.summary}</p>
        <TagList tags={[...participants, ...orgs] as string[]} />
      </div>
    </div>
  );
}

function TaskRow({
  task,
  state,
  onToggle,
}: {
  task: FollowUpTask;
  state: WorkbenchState;
  onToggle: (id: string) => void;
}) {
  const links = [
    ...task.linkedPersonIds.map((id) => findPerson(state, id)?.name),
    ...task.linkedOrganizationIds.map((id) => findOrg(state, id)?.name),
  ].filter(Boolean) as string[];

  return (
    <button className="taskRow" onClick={() => onToggle(task.id)}>
      <CheckCircle2 size={18} />
      <div>
        <strong>{task.title}</strong>
        <span>{task.dueText}</span>
        <TagList tags={links.slice(0, 3)} />
      </div>
    </button>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="infoLine">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  const compactTags = unique(tags).filter(Boolean).slice(0, 6);
  if (!compactTags.length) return null;
  return (
    <div className="tagList">
      {compactTags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}

function Badge({ tone = "gray", children }: { tone?: "green" | "amber" | "red" | "gray"; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const tone = confidence === "已确认" ? "green" : confidence === "待核实" ? "amber" : "gray";
  return <Badge tone={tone}>{confidence}</Badge>;
}

function Temperature({ value, compact = false }: { value: number; compact?: boolean }) {
  const score = clamp(value, 1, 5);
  return (
    <div className={`temperature ${compact ? "compact" : ""}`} title={`关系温度 ${score}/5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <i key={index} className={index < score ? "active" : ""} />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="emptyState">
      <Icon size={22} />
      <span>{text}</span>
    </div>
  );
}

function createBlankPerson(): Person {
  return {
    id: makeId("person"),
    name: "",
    role: "",
    tags: [],
    resources: [],
    needs: [],
    introPath: "",
    relationshipTemperature: 3,
    confidence: "已确认",
    sensitivity: "团队内部",
    sourceNoteIds: [],
    notes: "",
  };
}

function createBlankOrganization(): Organization {
  return {
    id: makeId("org"),
    name: "",
    industry: "",
    tags: [],
    keyPeopleIds: [],
    legalNeeds: [],
    relationshipStatus: "待补充",
    confidence: "已确认",
    sensitivity: "团队内部",
    sourceNoteIds: [],
    notes: "",
  };
}

function splitList(value: string) {
  return unique(
    value
      .split(/[、,，;\n]/g)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function joinList(items: string[]) {
  return items.join("、");
}

function upsertPersonIntoState(prev: WorkbenchState, person: Person): WorkbenchState {
  const organization = person.organizationId
    ? prev.organizations.find((item) => item.id === person.organizationId)
    : undefined;
  const saved: Person = {
    ...person,
    organizationId: organization?.id,
    organizationName: organization?.name,
    tags: unique(person.tags),
    resources: unique(person.resources),
    needs: unique(person.needs),
    sourceNoteIds: person.sourceNoteIds ?? [],
  };
  const exists = prev.people.some((item) => item.id === saved.id);

  return {
    ...prev,
    people: exists ? prev.people.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev.people],
    organizations: prev.organizations.map((org) => {
      let keyPeopleIds = org.keyPeopleIds.filter((id) => id !== saved.id);
      if (org.id === saved.organizationId) keyPeopleIds = unique([...keyPeopleIds, saved.id]);
      return { ...org, keyPeopleIds };
    }),
  };
}

function deletePersonFromState(prev: WorkbenchState, personId: string): WorkbenchState {
  return {
    ...prev,
    people: prev.people.filter((person) => person.id !== personId),
    organizations: prev.organizations.map((org) => ({
      ...org,
      keyPeopleIds: org.keyPeopleIds.filter((id) => id !== personId),
    })),
    relationships: prev.relationships.filter(
      (rel) =>
        !(
          (rel.fromKind === "person" && rel.fromId === personId) ||
          (rel.toKind === "person" && rel.toId === personId)
        ),
    ),
    interactions: prev.interactions.map((interaction) => ({
      ...interaction,
      participantIds: interaction.participantIds.filter((id) => id !== personId),
    })),
    opportunities: prev.opportunities.map((opportunity) => ({
      ...opportunity,
      peopleIds: opportunity.peopleIds.filter((id) => id !== personId),
    })),
    tasks: prev.tasks.map((task) => ({
      ...task,
      linkedPersonIds: task.linkedPersonIds.filter((id) => id !== personId),
    })),
  };
}

function upsertOrganizationIntoState(prev: WorkbenchState, organization: Organization): WorkbenchState {
  const relatedPersonIds = prev.people
    .filter((person) => person.organizationId === organization.id)
    .map((person) => person.id);
  const saved: Organization = {
    ...organization,
    tags: unique(organization.tags),
    keyPeopleIds: unique([...organization.keyPeopleIds, ...relatedPersonIds]),
    legalNeeds: unique(organization.legalNeeds),
    sourceNoteIds: organization.sourceNoteIds ?? [],
  };
  const exists = prev.organizations.some((item) => item.id === saved.id);

  return {
    ...prev,
    organizations: exists
      ? prev.organizations.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...prev.organizations],
    people: prev.people.map((person) =>
      person.organizationId === saved.id ? { ...person, organizationName: saved.name } : person,
    ),
  };
}

function deleteOrganizationFromState(prev: WorkbenchState, organizationId: string): WorkbenchState {
  return {
    ...prev,
    organizations: prev.organizations.filter((org) => org.id !== organizationId),
    people: prev.people.map((person) =>
      person.organizationId === organizationId
        ? { ...person, organizationId: undefined, organizationName: undefined }
        : person,
    ),
    relationships: prev.relationships.filter(
      (rel) =>
        !(
          (rel.fromKind === "organization" && rel.fromId === organizationId) ||
          (rel.toKind === "organization" && rel.toId === organizationId)
        ),
    ),
    interactions: prev.interactions.map((interaction) => ({
      ...interaction,
      organizationIds: interaction.organizationIds.filter((id) => id !== organizationId),
    })),
    opportunities: prev.opportunities.map((opportunity) => ({
      ...opportunity,
      organizationId: opportunity.organizationId === organizationId ? undefined : opportunity.organizationId,
    })),
    tasks: prev.tasks.map((task) => ({
      ...task,
      linkedOrganizationIds: task.linkedOrganizationIds.filter((id) => id !== organizationId),
    })),
  };
}

function buildStats(state: WorkbenchState) {
  return [
    { label: "人物", value: state.people.length, icon: UserRound },
    { label: "机构", value: state.organizations.length, icon: Building2 },
    { label: "关系", value: state.relationships.length, icon: Link2 },
    { label: "机会", value: state.opportunities.length, icon: BriefcaseBusiness },
    { label: "记事", value: state.notes.length, icon: FileText },
  ];
}

function confirmAnalysisIntoState(prev: WorkbenchState, noteId: string): WorkbenchState {
  const note = prev.notes.find((item) => item.id === noteId);
  if (!note?.analysis) return prev;

  const analysis = note.analysis;
  const next: WorkbenchState = {
    ...prev,
    notes: prev.notes.map((item) => (item.id === noteId ? { ...item, status: "已入库" } : item)),
    people: [...prev.people],
    organizations: [...prev.organizations],
    relationships: [...prev.relationships],
    interactions: [...prev.interactions],
    opportunities: [...prev.opportunities],
    tasks: [...prev.tasks],
  };

  const orgIdByName = new Map(next.organizations.map((org) => [normalizeName(org.name), org.id]));
  const personIdByName = new Map(next.people.map((person) => [normalizeName(person.name), person.id]));

  analysis.organizations.forEach((candidate) => {
    const key = normalizeName(candidate.name);
    const existingIndex = next.organizations.findIndex((org) => normalizeName(org.name) === key);
    if (existingIndex >= 0) {
      const existing = next.organizations[existingIndex];
      next.organizations[existingIndex] = {
        ...existing,
        industry: existing.industry === "待补充" ? candidate.industry : existing.industry,
        tags: unique([...existing.tags, ...candidate.tags]),
        legalNeeds: unique([...existing.legalNeeds, ...candidate.legalNeeds]),
        sourceNoteIds: unique([...existing.sourceNoteIds, noteId]),
        sensitivity: mergeSensitivity(existing.sensitivity, candidate.sensitivity),
        notes: mergeNotes(existing.notes, candidate.notes),
      };
      orgIdByName.set(key, existing.id);
      return;
    }

    const id = makeId("org");
    const org: Organization = {
      id,
      name: candidate.name,
      industry: candidate.industry,
      tags: candidate.tags,
      keyPeopleIds: [],
      legalNeeds: candidate.legalNeeds,
      relationshipStatus: candidate.relationshipStatus,
      confidence: candidate.confidence,
      sensitivity: candidate.sensitivity,
      lastInteractionAt: todayISO(),
      sourceNoteIds: [noteId],
      notes: candidate.notes,
    };
    next.organizations.push(org);
    orgIdByName.set(key, id);
  });

  analysis.people.forEach((candidate) => {
    const key = normalizeName(candidate.name);
    const orgId = candidate.organizationName ? orgIdByName.get(normalizeName(candidate.organizationName)) : undefined;
    const existingIndex = next.people.findIndex((person) => normalizeName(person.name) === key);
    if (existingIndex >= 0) {
      const existing = next.people[existingIndex];
      next.people[existingIndex] = {
        ...existing,
        role: existing.role === "待补充" ? candidate.role : existing.role,
        organizationId: existing.organizationId ?? orgId,
        organizationName: existing.organizationName ?? candidate.organizationName,
        tags: unique([...existing.tags, ...candidate.tags]),
        resources: unique([...existing.resources, ...candidate.resources]),
        needs: unique([...existing.needs, ...candidate.needs]),
        introPath: existing.introPath === "待补充" ? candidate.introPath : existing.introPath,
        relationshipTemperature: Math.max(existing.relationshipTemperature, candidate.relationshipTemperature),
        sensitivity: mergeSensitivity(existing.sensitivity, candidate.sensitivity),
        sourceNoteIds: unique([...existing.sourceNoteIds, noteId]),
        notes: mergeNotes(existing.notes, candidate.notes),
      };
      personIdByName.set(key, existing.id);
      return;
    }

    const id = makeId("person");
    const person: Person = {
      id,
      name: candidate.name,
      role: candidate.role,
      organizationId: orgId,
      organizationName: candidate.organizationName,
      tags: candidate.tags,
      resources: candidate.resources,
      needs: candidate.needs,
      introPath: candidate.introPath,
      relationshipTemperature: candidate.relationshipTemperature,
      confidence: candidate.confidence,
      sensitivity: candidate.sensitivity,
      lastInteractionAt: todayISO(),
      sourceNoteIds: [noteId],
      notes: candidate.notes,
    };
    next.people.push(person);
    personIdByName.set(key, id);
    if (orgId) {
      next.organizations = next.organizations.map((org) =>
        org.id === orgId ? { ...org, keyPeopleIds: unique([...org.keyPeopleIds, id]) } : org,
      );
    }
  });

  analysis.relationships.forEach((candidate) => {
    const fromId = resolveEntityId(candidate.fromKind, candidate.fromName, personIdByName, orgIdByName);
    const toId = resolveEntityId(candidate.toKind, candidate.toName, personIdByName, orgIdByName);
    if (!fromId || !toId) return;
    const exists = next.relationships.some(
      (rel) =>
        rel.fromId === fromId &&
        rel.toId === toId &&
        rel.fromKind === candidate.fromKind &&
        rel.toKind === candidate.toKind &&
        rel.label === candidate.label,
    );
    if (exists) return;
    next.relationships.push({
      id: makeId("rel"),
      fromKind: candidate.fromKind,
      fromId,
      toKind: candidate.toKind,
      toId,
      label: candidate.label,
      strength: candidate.strength,
      confidence: candidate.confidence,
      sensitivity: candidate.sensitivity,
      sourceNoteIds: [noteId],
    });
  });

  const opportunityIdByTitle = new Map<string, string>();
  analysis.opportunities.forEach((candidate) => {
    const opportunity = createOpportunity(candidate, noteId, personIdByName, orgIdByName);
    next.opportunities.push(opportunity);
    opportunityIdByTitle.set(candidate.title, opportunity.id);
  });

  analysis.interactions.forEach((candidate) => {
    const participantIds = candidate.participantNames
      .map((name) => personIdByName.get(normalizeName(name)))
      .filter(Boolean) as string[];
    const organizationIds = candidate.organizationNames
      .map((name) => orgIdByName.get(normalizeName(name)))
      .filter(Boolean) as string[];
    next.interactions.unshift({
      id: makeId("inter"),
      date: candidate.date,
      title: candidate.title,
      summary: candidate.summary,
      participantIds,
      organizationIds,
      opportunityIds: Array.from(opportunityIdByTitle.values()),
      sensitivity: candidate.sensitivity,
      sourceNoteId: noteId,
    });
  });

  analysis.tasks.forEach((candidate) => {
    next.tasks.unshift({
      id: makeId("task"),
      title: candidate.title,
      dueText: candidate.dueText,
      status: "待办",
      linkedPersonIds: candidate.linkedPersonNames
        .map((name) => personIdByName.get(normalizeName(name)))
        .filter(Boolean) as string[],
      linkedOrganizationIds: candidate.linkedOrganizationNames
        .map((name) => orgIdByName.get(normalizeName(name)))
        .filter(Boolean) as string[],
      linkedOpportunityIds: Array.from(opportunityIdByTitle.values()),
      sourceNoteIds: [noteId],
    });
  });

  return next;
}

function createOpportunity(
  candidate: CandidateOpportunity,
  noteId: string,
  personIdByName: Map<string, string>,
  orgIdByName: Map<string, string>,
): Opportunity {
  return {
    id: makeId("opp"),
    title: candidate.title,
    stage: candidate.stage,
    organizationId: candidate.organizationName ? orgIdByName.get(normalizeName(candidate.organizationName)) : undefined,
    peopleIds: candidate.peopleNames.map((name) => personIdByName.get(normalizeName(name))).filter(Boolean) as string[],
    practiceAreas: candidate.practiceAreas,
    nextStep: candidate.nextStep,
    sensitivity: candidate.sensitivity,
    sourceNoteIds: [noteId],
  };
}

function resolveEntityId(
  kind: EntityKind,
  name: string,
  personIdByName: Map<string, string>,
  orgIdByName: Map<string, string>,
) {
  return kind === "person" ? personIdByName.get(normalizeName(name)) : orgIdByName.get(normalizeName(name));
}

function mergeNotes(a: string, b: string) {
  if (!a) return b;
  if (!b || a.includes(b)) return a;
  return `${a}\n${b}`;
}

function mergeSensitivity(a: Sensitivity, b: Sensitivity): Sensitivity {
  const order: Sensitivity[] = ["普通", "团队内部", "客户机密", "敏感"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

function filterItems<T>(items: T[], term: string, haystack: (item: T) => string) {
  const normalized = normalizeName(term);
  if (!normalized) return items;
  return items.filter((item) => normalizeName(haystack(item)).includes(normalized));
}

function findPerson(state: WorkbenchState, id: string) {
  return state.people.find((person) => person.id === id);
}

function findOrg(state: WorkbenchState, id: string) {
  return state.organizations.find((org) => org.id === id);
}

function entityName(state: WorkbenchState, kind: EntityKind, id: string) {
  return kind === "person" ? findPerson(state, id)?.name ?? "未知人物" : findOrg(state, id)?.name ?? "未知机构";
}

function buildNetworkNodes(state: WorkbenchState) {
  const people = state.people.slice(0, 8).map((person, index) => ({
    kind: "person",
    id: person.id,
    label: person.name,
    subtitle: person.role,
    x: 18 + (index % 4) * 21,
    y: index < 4 ? 22 : 70,
  }));
  const orgs = state.organizations.slice(0, 4).map((org, index) => ({
    kind: "organization",
    id: org.id,
    label: org.name,
    subtitle: org.industry,
    x: 26 + index * 20,
    y: 46,
  }));
  return [...people, ...orgs];
}

interface AnswerSource {
  kind: "人物" | "机构" | "关系" | "机会" | "记事";
  id: string;
  title: string;
  excerpt: string;
  score: number;
}

interface AnswerResult {
  text: string;
  sources: AnswerSource[];
}

function answerQuestion(state: WorkbenchState, question: string): AnswerResult {
  const terms = buildSearchTerms(state, question);
  const sources: AnswerSource[] = [
    ...state.people.map((person) => ({
      kind: "人物" as const,
      id: person.id,
      title: person.name,
      excerpt: `${person.role}。机构：${person.organizationName ?? "待补充"}。介绍路径：${person.introPath}。资源：${person.resources.join("、") || "待补充"}。需求：${person.needs.join("、") || "待判断"}。${person.notes}`,
      score: 0,
    })),
    ...state.organizations.map((org) => ({
      kind: "机构" as const,
      id: org.id,
      title: org.name,
      excerpt: `${org.industry}。关系状态：${org.relationshipStatus}。法律需求：${org.legalNeeds.join("、") || "待判断"}。${org.notes}`,
      score: 0,
    })),
    ...state.opportunities.map((opportunity) => ({
      kind: "机会" as const,
      id: opportunity.id,
      title: opportunity.title,
      excerpt: `阶段：${opportunity.stage}。业务：${opportunity.practiceAreas.join("、")}。下一步：${opportunity.nextStep}`,
      score: 0,
    })),
    ...state.relationships.map((relationship) => ({
      kind: "关系" as const,
      id: relationship.id,
      title: `${entityName(state, relationship.fromKind, relationship.fromId)} → ${entityName(
        state,
        relationship.toKind,
        relationship.toId,
      )}`,
      excerpt: `${relationship.label}，关系强度 ${relationship.strength}/5，置信度：${relationship.confidence}`,
      score: 0,
    })),
    ...state.notes.map((note) => ({
      kind: "记事" as const,
      id: note.id,
      title: `${note.source} · ${formatDateTime(note.createdAt)}`,
      excerpt: note.text,
      score: 0,
    })),
  ];

  const ranked = sources
    .map((source) => ({
      ...source,
      score: terms.reduce((score, term) => {
        const content = normalizeName(`${source.title}${source.excerpt}`);
        return score + (content.includes(normalizeName(term)) ? term.length : 0);
      }, 0),
    }))
    .filter((source) => source.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (!ranked.length) {
    return {
      text: "系统暂无足够依据。建议先补充相关人物、机构或互动记事，再生成会前简报或关系判断。",
      sources: [],
    };
  }

  const people = ranked.filter((source) => source.kind === "人物").slice(0, 2);
  const orgs = ranked.filter((source) => source.kind === "机构").slice(0, 2);
  const opportunities = ranked.filter((source) => source.kind === "机会").slice(0, 2);
  const relations = ranked.filter((source) => source.kind === "关系").slice(0, 2);

  const parts = [
    people.length ? `相关人物：${people.map((source) => `${source.title}（${source.excerpt.split("。")[0]}）`).join("；")}。` : "",
    orgs.length ? `相关机构：${orgs.map((source) => `${source.title}（${source.excerpt.split("。")[0]}）`).join("；")}。` : "",
    opportunities.length
      ? `可切入机会：${opportunities.map((source) => `${source.title}，${source.excerpt}`).join("；")}。`
      : "",
    relations.length ? `关系路径：${relations.map((source) => `${source.title}，${source.excerpt}`).join("；")}。` : "",
    "建议输出前再次核对来源记录，尤其是客户机密、承诺事项和间接引荐路径。",
  ].filter(Boolean);

  return {
    text: parts.join("\n"),
    sources: ranked,
  };
}

function buildSearchTerms(state: WorkbenchState, question: string) {
  const terms = [
    ...state.people.filter((person) => question.includes(person.name)).map((person) => person.name),
    ...state.organizations.filter((org) => question.includes(org.name)).map((org) => org.name),
    ...["并购", "争议", "合规", "基金", "投融资", "新能源", "半导体", "法务", "董秘", "介绍", "约见"].filter((term) =>
      question.includes(term),
    ),
    ...((question.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,8}/g) ?? []).filter((term) => term.length >= 2)),
  ];
  return unique(terms);
}
