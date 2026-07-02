import type {
  AnalysisResult,
  CandidateOpportunity,
  CandidateOrganization,
  CandidatePerson,
  CandidateRelationship,
  Confidence,
  LLMProvider,
  Sensitivity,
} from "./types";
import { makeId, todayISO, unique } from "./utils";

const practiceKeywordMap: Array<[string, string]> = [
  ["并购", "并购重组"],
  ["收购", "并购重组"],
  ["投资", "投融资"],
  ["融资", "投融资"],
  ["基金", "基金/资管"],
  ["争议", "争议解决"],
  ["诉讼", "争议解决"],
  ["仲裁", "争议解决"],
  ["合规", "合规监管"],
  ["涉外", "涉外业务"],
  ["出海", "涉外业务"],
  ["劳动", "劳动人事"],
  ["知识产权", "知识产权"],
  ["上市", "资本市场"],
  ["董秘", "资本市场"],
];

const industryKeywordMap: Array<[string, string]> = [
  ["新能源", "新能源"],
  ["装备", "先进制造"],
  ["半导体", "半导体"],
  ["医药", "生物医药"],
  ["基金", "投资机构"],
  ["资本", "投资机构"],
  ["园区", "产业园区"],
  ["地产", "房地产"],
  ["银行", "金融"],
];

function findAll(text: string, regex: RegExp) {
  const matches = text.match(regex) ?? [];
  return unique(matches.map((item) => item.replace(/[，。；、,.]/g, "").trim())).filter(
    (item) => item.length > 1,
  );
}

function cleanPersonName(raw: string) {
  const title = raw.match(/(合伙人|律师|老师|主任|法务|董秘|博士|教授|先生|女士|经理|总)$/)?.[1];
  if (!title) return "";
  const fragments = raw
    .replace(/[，。；、,.]/g, "")
    .split(
      /今天|昨天|明天|上周|本周|下周|与|和|跟|由|通过|是|认识|提到|他们|她们|可以|帮忙|协助|约|一次|最早|最近|下次|见面|集团法务|公司法务|法务负责人/,
    )
    .map((item) => item.trim())
    .filter(Boolean);
  const name = fragments.at(-1) ?? raw.trim();
  const nestedTitle = name.match(/(?:法务|董秘)([\u4e00-\u9fa5A-Za-z]{1,4}(?:法务|董秘))$/)?.[1];
  if (nestedTitle) return nestedTitle;
  if (name === title || name.length > 6) return "";
  return name.endsWith(title) ? name : "";
}

function cleanOrganizationName(raw: string) {
  const fragments = raw
    .replace(/[，。；、,.]/g, "")
    .split(
      /今天|昨天|明天|上周|本周|下周|与|和|跟|由|通过|是|认识|提到|他们|她们|可以|帮忙|协助|约|一次|最早|最近|下次|见面|希望|了解|关注|在看|一家|一个|担心|处理|服务过/,
    )
    .map((item) => item.trim())
    .filter(Boolean);
  const name = fragments.at(-1) ?? raw.trim();
  if (!/(集团|公司|律所|律师事务所|银行|基金|协会|商会|园区|资本|投资|控股|科技|实业)$/.test(name)) return "";
  if (/总|律师|老师|主任|法务|董秘/.test(name)) return "";
  return name.length > 1 && name.length <= 24 ? name : "";
}

function detectPracticeAreas(text: string) {
  return unique(practiceKeywordMap.filter(([keyword]) => text.includes(keyword)).map(([, area]) => area));
}

function detectIndustry(text: string) {
  return industryKeywordMap.find(([keyword]) => text.includes(keyword))?.[1] ?? "待补充";
}

function relationshipTemperature(text: string) {
  if (/信任|很熟|核心|关系很好|多年/.test(text)) return 5;
  if (/熟|比较熟|关系还可以|不错/.test(text)) return 4;
  if (/认识|聊过|接触/.test(text)) return 3;
  if (/待核实|可能|听说/.test(text)) return 2;
  return 3;
}

function confidenceFromText(text: string): Confidence {
  if (/可能|大概|听说|似乎|待核实/.test(text)) return "待核实";
  return "AI 推测";
}

function roleFromName(name: string) {
  if (name.includes("律师")) return "律师/合作方";
  if (name.includes("法务")) return "法务负责人";
  if (name.includes("董秘")) return "董秘/资本市场联系人";
  if (name.includes("老师")) return "团队负责人";
  if (name.includes("主任")) return "负责人";
  if (name.includes("总")) return "企业高管/客户联系人";
  return "待补充";
}

function guessTags(text: string, name: string) {
  const tags = [];
  if (/介绍|引荐|约/.test(text)) tags.push("可引荐");
  if (/法务|董秘|合规/.test(name + text)) tags.push("法律需求入口");
  if (/客户|集团|公司/.test(text)) tags.push("客户资源");
  if (/合伙人|律师/.test(name + text)) tags.push("专业合作方");
  if (/基金|投资|资本/.test(text)) tags.push("资本资源");
  return unique(tags.length ? tags : ["待分类"]);
}

function makePeople(text: string, sensitivity: Sensitivity): CandidatePerson[] {
  const names = unique(
    findAll(
      text,
      /[\u4e00-\u9fa5A-Za-z]{1,12}(?:总|律师|老师|主任|法务|董秘|博士|教授|先生|女士|经理|合伙人)/g,
    ).map(cleanPersonName),
  ).filter((name) => name && !["律师事务所", "法务总", "董秘"].includes(name));

  return names.map((name) => ({
    tempId: makeId("cp"),
    name,
    role: roleFromName(name),
    organizationName: undefined,
    tags: guessTags(text, name),
    resources: /资源|渠道|介绍|引荐|约/.test(text) ? ["关系引荐/资源连接"] : [],
    needs: detectPracticeAreas(text),
    introPath: /介绍|引荐/.test(text) ? "原文提到存在介绍/引荐关系，需人工确认路径" : "待补充",
    relationshipTemperature: relationshipTemperature(text),
    confidence: confidenceFromText(text),
    sensitivity,
    notes: "由本地 mock 分析从记事中抽取，入库前建议确认身份和关系边界。",
  }));
}

function makeOrganizations(text: string, sensitivity: Sensitivity): CandidateOrganization[] {
  const names = unique(
    findAll(
      text,
      /[\u4e00-\u9fa5A-Za-z0-9]{2,28}(?:集团|公司|律所|律师事务所|银行|基金|协会|商会|园区|资本|投资|控股|科技|实业)/g,
    ).map(cleanOrganizationName),
  ).filter((name) => name && name !== "律师事务所");

  return names.map((name) => ({
    tempId: makeId("co"),
    name,
    industry: detectIndustry(name + text),
    tags: unique(["机构档案", ...detectPracticeAreas(text)]),
    legalNeeds: detectPracticeAreas(text),
    relationshipStatus: /做过|服务过|委托/.test(text)
      ? "已有服务记录"
      : /约|见|聊|接触/.test(text)
        ? "接触中"
        : "待补充",
    confidence: confidenceFromText(text),
    sensitivity,
    notes: "由记事抽取的机构线索，建议补充工商主体、关键联系人与历史服务记录。",
  }));
}

function makeRelationships(
  text: string,
  people: CandidatePerson[],
  organizations: CandidateOrganization[],
  sensitivity: Sensitivity,
): CandidateRelationship[] {
  const relationships: CandidateRelationship[] = [];
  const firstOrg = organizations[0];

  people.forEach((person) => {
    if (firstOrg && /集团|公司|法务|董秘|客户/.test(text + person.name)) {
      relationships.push({
        tempId: makeId("cr"),
        fromKind: "person",
        fromName: person.name,
        toKind: "organization",
        toName: firstOrg.name,
        label: /法务|董秘/.test(person.name) ? "关键联系人" : "关联/待确认",
        strength: relationshipTemperature(text),
        confidence: confidenceFromText(text),
        sensitivity,
      });
    }
  });

  if (/介绍|引荐|约/.test(text) && people.length >= 2) {
    relationships.push({
      tempId: makeId("cr"),
      fromKind: "person",
      fromName: people[0].name,
      toKind: "person",
      toName: people[1].name,
      label: text.includes("约") ? "可协助约见" : "介绍/引荐",
      strength: relationshipTemperature(text),
      confidence: confidenceFromText(text),
      sensitivity,
    });
  }

  return relationships;
}

function makeOpportunity(
  text: string,
  people: CandidatePerson[],
  organizations: CandidateOrganization[],
  sensitivity: Sensitivity,
): CandidateOpportunity[] {
  const practiceAreas = detectPracticeAreas(text);
  if (!practiceAreas.length && !/机会|需求|项目|合作|委托|切入|跟进|约/.test(text)) return [];

  const firstOrg = organizations[0];
  const titleSubject = firstOrg?.name ?? people[0]?.name ?? "待确认对象";

  return [
    {
      tempId: makeId("cop"),
      title: `${titleSubject} - ${practiceAreas[0] ?? "潜在法律服务"}机会`,
      stage: /方案|报价|投标/.test(text) ? "方案准备" : /委托|确定/.test(text) ? "已委托" : "线索",
      organizationName: firstOrg?.name,
      peopleNames: people.slice(0, 3).map((person) => person.name),
      practiceAreas: practiceAreas.length ? practiceAreas : ["待判断"],
      nextStep: /约|见/.test(text)
        ? "确认合适的引荐路径并准备会前简报"
        : /下次|跟进/.test(text)
          ? "建立跟进任务并补充关键决策人"
          : "补充需求背景和决策链",
      sensitivity,
    },
  ];
}

export const mockLLMProvider: LLMProvider = {
  id: "mock-local",
  name: "Mock 本地分析器",
  mode: "mock",
  async analyzeNote({ text, sensitivity, now }): Promise<AnalysisResult> {
    const people = makePeople(text, sensitivity);
    const organizations = makeOrganizations(text, sensitivity);
    const relationships = makeRelationships(text, people, organizations, sensitivity);
    const opportunities = makeOpportunity(text, people, organizations, sensitivity);
    const interactionDate = now.slice(0, 10) || todayISO();

    return {
      summary:
        text.length > 120
          ? `${text.slice(0, 118)}...`
          : text || "空白记事",
      people,
      organizations,
      relationships,
      interactions: [
        {
          tempId: makeId("ci"),
          date: interactionDate,
          title: people.length || organizations.length ? "人脉互动记录" : "原始记事",
          summary: text,
          participantNames: people.map((person) => person.name),
          organizationNames: organizations.map((org) => org.name),
          sensitivity,
        },
      ],
      opportunities,
      tasks:
        /下次|跟进|约|准备|提醒|回访/.test(text) || opportunities.length
          ? [
              {
                tempId: makeId("ct"),
                title: opportunities[0]?.nextStep ?? "补充关系档案并安排下一步",
                dueText: "待排期",
                linkedPersonNames: people.slice(0, 2).map((person) => person.name),
                linkedOrganizationNames: organizations.slice(0, 1).map((org) => org.name),
              },
            ]
          : [],
      cautions: [
        "AI 抽取结果为待确认草稿，确认前不作为事实档案。",
        "涉及客户机密、承诺、利益冲突和敏感身份的信息需人工复核。",
      ],
    };
  },
};
