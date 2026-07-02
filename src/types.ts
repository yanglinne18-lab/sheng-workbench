export type EntityKind = "person" | "organization";

export type Sensitivity = "普通" | "团队内部" | "客户机密" | "敏感";

export type Confidence = "已确认" | "AI 推测" | "待核实";

export type NoteStatus = "原始" | "待确认" | "已入库";

export type OpportunityStage = "线索" | "接触中" | "方案准备" | "已委托" | "暂缓";

export type TaskStatus = "待办" | "进行中" | "完成";

export type ThemeMode = "light" | "dark";

export type SpeechMode = "browser" | "localAsr";

export interface Note {
  id: string;
  text: string;
  source: string;
  sensitivity: Sensitivity;
  status: NoteStatus;
  createdAt: string;
  analysis?: AnalysisResult;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  organizationId?: string;
  organizationName?: string;
  tags: string[];
  resources: string[];
  needs: string[];
  introPath: string;
  relationshipTemperature: number;
  confidence: Confidence;
  sensitivity: Sensitivity;
  lastInteractionAt?: string;
  sourceNoteIds: string[];
  notes: string;
}

export interface Organization {
  id: string;
  name: string;
  industry: string;
  tags: string[];
  keyPeopleIds: string[];
  legalNeeds: string[];
  relationshipStatus: string;
  confidence: Confidence;
  sensitivity: Sensitivity;
  lastInteractionAt?: string;
  sourceNoteIds: string[];
  notes: string;
}

export interface Relationship {
  id: string;
  fromKind: EntityKind;
  fromId: string;
  toKind: EntityKind;
  toId: string;
  label: string;
  strength: number;
  confidence: Confidence;
  sensitivity: Sensitivity;
  sourceNoteIds: string[];
}

export interface Interaction {
  id: string;
  date: string;
  title: string;
  summary: string;
  participantIds: string[];
  organizationIds: string[];
  opportunityIds: string[];
  sensitivity: Sensitivity;
  sourceNoteId?: string;
}

export interface Opportunity {
  id: string;
  title: string;
  stage: OpportunityStage;
  organizationId?: string;
  peopleIds: string[];
  practiceAreas: string[];
  nextStep: string;
  sensitivity: Sensitivity;
  sourceNoteIds: string[];
}

export interface FollowUpTask {
  id: string;
  title: string;
  dueText: string;
  status: TaskStatus;
  linkedPersonIds: string[];
  linkedOrganizationIds: string[];
  linkedOpportunityIds: string[];
  sourceNoteIds: string[];
}

export interface CandidatePerson {
  tempId: string;
  name: string;
  role: string;
  organizationName?: string;
  tags: string[];
  resources: string[];
  needs: string[];
  introPath: string;
  relationshipTemperature: number;
  confidence: Confidence;
  sensitivity: Sensitivity;
  notes: string;
}

export interface CandidateOrganization {
  tempId: string;
  name: string;
  industry: string;
  tags: string[];
  legalNeeds: string[];
  relationshipStatus: string;
  confidence: Confidence;
  sensitivity: Sensitivity;
  notes: string;
}

export interface CandidateRelationship {
  tempId: string;
  fromKind: EntityKind;
  fromName: string;
  toKind: EntityKind;
  toName: string;
  label: string;
  strength: number;
  confidence: Confidence;
  sensitivity: Sensitivity;
}

export interface CandidateInteraction {
  tempId: string;
  date: string;
  title: string;
  summary: string;
  participantNames: string[];
  organizationNames: string[];
  sensitivity: Sensitivity;
}

export interface CandidateOpportunity {
  tempId: string;
  title: string;
  stage: OpportunityStage;
  organizationName?: string;
  peopleNames: string[];
  practiceAreas: string[];
  nextStep: string;
  sensitivity: Sensitivity;
}

export interface CandidateTask {
  tempId: string;
  title: string;
  dueText: string;
  linkedPersonNames: string[];
  linkedOrganizationNames: string[];
}

export interface AnalysisResult {
  summary: string;
  people: CandidatePerson[];
  organizations: CandidateOrganization[];
  relationships: CandidateRelationship[];
  interactions: CandidateInteraction[];
  opportunities: CandidateOpportunity[];
  tasks: CandidateTask[];
  cautions: string[];
}

export interface LLMProvider {
  id: string;
  name: string;
  mode: "mock" | "local";
  analyzeNote(input: {
    text: string;
    sensitivity: Sensitivity;
    now: string;
  }): Promise<AnalysisResult>;
}

export interface WorkbenchState {
  notes: Note[];
  people: Person[];
  organizations: Organization[];
  relationships: Relationship[];
  interactions: Interaction[];
  opportunities: Opportunity[];
  tasks: FollowUpTask[];
  settings: {
    provider: "mock" | "localDeepSeek";
    localEndpoint: string;
    localModel: string;
    retrievalMode: "keyword" | "hybrid";
    theme: ThemeMode;
    speechMode: SpeechMode;
    speechLanguage: string;
  };
}
