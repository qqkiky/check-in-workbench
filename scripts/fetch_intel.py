# -*- coding: utf-8 -*-
# Vendored from the WorkBuddy pet-pharma-intel skill (MIT License).
# This project uses it as a self-contained domestic-source fetcher in CI.
"""宠物药 / 兽药行业情报抓取器。

从已验证可用的公开源拉取最新条目，支持时间窗过滤、宠物相关过滤与详情元数据补全，
输出结构化 JSON 或 Markdown 简报，供上层生成日报 / 仪表盘。

用法示例：
  python fetch_intel.py --days 7
  python fetch_intel.py --days 30 --pet-only --detail
  python fetch_intel.py --sources nyncbgg,gg --days 60 --format md
  python fetch_intel.py --days 7 --out intel.json
"""
import argparse
import html
import json
import os
import re
import hashlib
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

CST = timezone(timedelta(hours=8))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE

# ---------------------------------------------------------------- 翻译：国际企业新闻 -> 中文重点摘要
# 用户无法访问 Yahoo，故将国际企业新闻（英文）译为「中文标题 + 中文摘要」，保留原文链接。
# 使用 MyMemory 公共翻译接口（无需密钥），并做本地缓存以避免重复调用 / 离线降级。
_TRANS_CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trans_cache.json")
_trans_cache = None


def _load_trans_cache():
    global _trans_cache
    if _trans_cache is not None:
        return
    try:
        with open(_TRANS_CACHE_PATH, encoding="utf-8") as f:
            _trans_cache = json.load(f)
    except Exception:
        _trans_cache = {}


def _save_trans_cache():
    global _trans_cache
    if not _trans_cache:
        return
    try:
        with open(_TRANS_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(_trans_cache, f, ensure_ascii=False)
    except Exception:
        pass


def translate_en2zh(text, maxlen=480):
    """将文本译为中文（MyMemory 公共接口），带本地缓存与降级。失败返回空串。

    通过 de 参数（占位邮箱）提升 MyMemory 匿名每日额度（500 -> 5000 字符），
    并依赖本地缓存避免重复调用；翻译失败 / 超限时返回空串，由调用方回退英文。
    """
    if not text or not text.strip():
        return ""
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > maxlen:
        text = text[:maxlen]
    _load_trans_cache()
    cached = _trans_cache.get(text)
    if cached is not None:
        return cached
    try:
        q = urllib.parse.urlencode({"q": text, "langpair": "en|zh-CN",
                                    "de": "pet-pharma-report@workbuddy.app"})
        req = urllib.request.Request(
            "https://api.mymemory.translated.net/get?" + q,
            headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20, context=_CTX) as r:
            j = json.loads(r.read().decode("utf-8", "ignore"))
        out = ((j.get("responseData") or {}).get("translatedText") or "").strip()
        if out and out != text:
            _trans_cache[text] = out
            return out
    except Exception:
        pass
    return ""


def summarize_intl(item):
    """为国际企业新闻生成中文重点摘要：中文标题 + 中文摘要，保留原文链接。

    字段：title_cn（中文标题）、summary_cn（中文摘要，取正文摘要的译文）。
    翻译失败则回退为英文原文，保证卡片永远有内容。
    """
    title = item.get("title", "")
    ex = item.get("excerpt") or item.get("summary") or ""
    title_cn = translate_en2zh(title)
    # 摘要仅译前 220 字符，控制 MyMemory 每日额度消耗
    ex_cn = translate_en2zh(ex[:220]) if ex else ""
    item["title_cn"] = title_cn or title
    item["summary_cn"] = ex_cn or ex or title
    return item

# ---------------------------------------------------------------- 企业动态·跨运行持久化累积
# 用户要求：每次更新保留之前的信息、避免重复相同信息。故将「企业动态」条目累积进本地归档，
# 跨日运行按（企业 + 归一化标题）去重——已收录的条目不再重复添加，仅保留历史并标注首次收录日期。
ARCHIVE_MAX = 60


def _dedup_key(it):
    """跨运行稳定去重键：企业/地区 + 归一化标题（避免 Yahoo 链接带追踪参数导致无法去重）。"""
    comp = it.get("company") or it.get("region") or "x"
    title = re.sub(r"\W+", "", it.get("title", "")).lower()[:40]
    return (comp, title)


def load_archive(path):
    try:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        if isinstance(d, dict) and "items" in d:
            return d
    except Exception:
        pass
    return {"items": [], "updated_at": ""}


def save_archive(path, data):
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception:
        pass

# ---------------------------------------------------------------- 源定义
# kind: regulatory=监管审批 / notice=公示通知 / news=资讯动态 / association=协会
SOURCES = {
    # --- 中国兽药信息网（中国兽医药品监察所）：主力源，编码 utf-8 ---
    "nyncbgg": {
        "name": "农业农村部公告（兽药注册审批）",
        "url": "http://www.ivdc.org.cn/xxgk/zcfg/nyncbgg/",
        "site": "中国兽药信息网", "kind": "regulatory", "enc": "utf-8", "weight": 1,
    },
    "gg": {
        "name": "公示",
        "url": "http://www.ivdc.org.cn/xxgk/ggtz/gg/",
        "site": "中国兽药信息网", "kind": "notice", "enc": "utf-8", "weight": 2,
    },
    "tz": {
        "name": "通知",
        "url": "http://www.ivdc.org.cn/xxgk/ggtz/tz/",
        "site": "中国兽药信息网", "kind": "notice", "enc": "utf-8", "weight": 2,
    },
    "dfxw": {
        "name": "行业动态",
        "url": "http://www.ivdc.org.cn/xwdt/dfxw/",
        "site": "中国兽药信息网", "kind": "news", "enc": "utf-8", "weight": 3,
    },
    "zhdt": {
        "name": "综合要闻",
        "url": "http://www.ivdc.org.cn/xwdt/zhdt/",
        "site": "中国兽药信息网", "kind": "news", "enc": "utf-8", "weight": 3,
    },
    "flfg": {
        "name": "法规规章",
        "url": "http://www.ivdc.org.cn/xxgk/zcfg/flfg/",
        "site": "中国兽药信息网", "kind": "regulatory", "enc": "utf-8", "weight": 2,
    },
    # --- 中国兽药协会：补充源，编码 gb18030，URL 内嵌日期 ---
    "cvda_tz": {
        "name": "协会通知通告",
        "url": "http://www.cvda.org.cn:8090/a/guanyuxiehui/tongzhitonggao/",
        "site": "中国兽药协会", "kind": "association", "enc": "gb18030", "weight": 4,
    },
    "cvda_bz": {
        "name": "团体标准",
        "url": "http://www.cvda.org.cn:8090/a/tuantibiaozhun/",
        "site": "中国兽药协会", "kind": "association", "enc": "gb18030", "weight": 4,
    },
}
# 协会源宠物含量最高（犬猫器械/信息素等团体标准），默认纳入
DEFAULT_SOURCES = ["nyncbgg", "gg", "tz", "dfxw", "zhdt", "flfg", "cvda_tz", "cvda_bz"]

# ---------------------------------------------------------------- 宠物判定
# 规则来源：宠物药数据收集项目已验证的判定口径
PET_HIT = ["犬", "猫", "宠物", "伴侣动物", "至宠", "爱宠", "毛孩子", "宠", "兔"]
PET_STRONG = ["犬", "猫", "宠物", "伴侣动物"]
PET_EXCLUDE = ["伪狂犬病", "犬瘟热疫苗（狐用", "狐", "貉"]

# 兽药/动物保健上市企业与龙头（用于识别“企业动态”）。按特异性从高到低排列，
# 命中即返回规范企业名。文本可能同段出现多家，取首个匹配。
COMPANY_MAP = [
    ("瑞普生物|天津瑞普|瑞普宠物|瑞普", "瑞普生物"),
    ("普莱柯", "普莱柯"),
    ("中牧股份|中牧实业|中牧", "中牧股份"),
    ("生物股份|金宇保灵|金宇", "生物股份"),
    ("科前生物|武汉科前|科前", "科前生物"),
    ("回盛生物|回盛", "回盛生物"),
    ("金河生物|金河", "金河生物"),
    ("蔚蓝生物", "蔚蓝生物"),
    ("申联生物", "申联生物"),
    ("海利生物", "海利生物"),
    ("鲁抗医药|鲁抗", "鲁抗医药"),
    ("惠中生物|惠中兽药|惠中", "惠中"),
    ("冀中药业|冀中", "冀中药业"),
    ("齐鲁制药|齐鲁", "齐鲁制药"),
    ("青岛易邦|易邦", "青岛易邦"),
    ("哈药", "哈药集团"),
    ("远征药业|远征", "远征药业"),
    ("默沙东|MSD", "默沙东"),
    ("硕腾|Zoetis", "硕腾"),
    ("礼蓝|Elanco", "礼蓝"),
    ("梅里亚|Merial", "梅里亚"),
    ("联邦制药", "联邦制药"),
]
COMPANY_RE = re.compile("|".join("(?:" + p + ")" for p, _ in COMPANY_MAP))


def detect_company(text):
    """从文本中识别兽药/动保企业，返回规范企业名或 None。"""
    if not text:
        return None
    for pat, name in COMPANY_MAP:
        if re.search(pat, text):
            return name
    return None


# ---------------------------------------------------------------- 企业动态·国际公司新闻
# 本环境实测：Google / Bing / 百度 新闻 RSS 均被拦截，东方财富/新浪/同花顺/巨潮
# 等中文个股新闻接口全部 404 / 500 / WAF。唯一稳定可达的「企业级」新闻源是
# Yahoo Finance RSS（按美股代码），恰好覆盖全球动保龙头。 domestic 企业动态仍来自
# 下方官方源反查（见 enrich）。
# 元组：(英文名, 中文规范名, 美股代码, 是否纯动保业务)
INTL_COMPANIES = [
    ("Zoetis", "硕腾", "ZTS", True),
    ("Elanco", "礼蓝", "ELAN", True),
    ("IDEXX", "爱德士", "IDXX", True),
    # MRK 兼人药，仅保留其动保（MSD Animal Health）相关条目
    ("Merck", "默沙东（动物保健）", "MRK", False),
]
YAHOO_RSS = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}"

# 事件类型判定（中英文关键词）。顺序即优先级：
# 新药审批 > 并购 > 融资 > 高管变更 > 业务布局 > 合同公开 > 监管公示
_EVENT_RULES = [
    ("新药审批", ["获批", "新兽药", "注册", "证书", "批准文号", "核发", "变更注册", "approv", "fda",
                 "usda", "regist", "licens", "certificate", "authoriz", "clearance", "label expansion", "new drug"]),
    ("并购", ["并购", "收购", "被收购", "重组", "acquir", "merger", "takeover", "buyout"]),
    ("融资", ["融资", "募资", "定增", "增资", "发债", "增发", "上市", "ipo", "funding", "funded",
              "raises", "raise capital", "capital raise", "debt", "offering", "private placement",
              "series a", "series b", "venture round", "equity raise"]),
    ("高管变更", ["高管", "总裁", "董事长", "总经理", "辞任", "任命", "新任", "换帅", "董事会",
                  "ceo change", "new ceo", "names .*ceo", "appoints .*ceo", "steps down",
                  "resign", "leadership transition", "chairman", "chief executive"]),
    ("业务布局", ["建厂", "投产", "扩建", "基地", "布局", "设立", "子公司", "产能", "项目",
                 "expand", "facility", "plant", "factory", "joint venture", "launch",
                 "manufactur", "capacity", "site", "build"]),
    ("合同公开", ["合同", "中标", "签约", "合作", "订单", "协议", "采购", "contract", "agreement",
                 "partnership", "deal", "collaborat", "supply", "distribut"]),
    ("监管公示", ["公示", "抽检", "监督", "飞行检查", "行政处罚", "召回", "通知", "通报", "inspect",
                 "recall", "warning letter", "suspend"]),
]
EVENT_RE = [(name, re.compile("|".join("(?:" + p + ")" for p in pats), re.I))
            for name, pats in _EVENT_RULES]
# 非纯动保企业（如 MRK）的动保相关性判定
AH_KW = re.compile(r"动物|兽药|宠|犬|猫|兽医|livestock|animal health|veterinar|pet|companion|poultry", re.I)

# 噪声排除：财报电话会 / 季度业绩 / 分析师评级 / 组合调仓 / ESG 等与企业变动无关的低价值资讯。
# 注意：并购、融资、高管变更、业务布局、合同公开、新药审批、监管公示 等「企业变动」信号已在 EVENT_RE 中，
# 此处仅排除上述信号之外的纯市场 / 情绪 / 业绩噪声，故不再排除 appoints?/cfo/ceo/leadership 等词。
_EXCLUDE = [
    # 财报 / 季度业绩
    r"earnings", r"q[1-4]\s*(?:20\d\d|cy20\d\d)", r"q[1-4]\s*earnings", r"reports? q[1-4]",
    r"quarterly", r"second quarter", r"full-year", r"half-year", r"quarter 20\d\d",
    r"announces? .*results", r"reports? .*results", r"revenues? beat", r"results beat",
    r"eps ", r"guidance", r"what key metrics", r"what to expect", r"following earnings",
    # 分析师 / 情绪 / 估值
    r"analyst", r"rating", r"price target", r"price objective", r"upgrade", r"downgrade",
    r"should buy", r"why .* should", r"growth investors should", r"top stock", r"top pick",
    r"stock pick", r"looks attractive", r"attractive on", r"below fair value", r"fair value",
    r"valuation", r"buy rating", r"sell rating", r"hold rating", r"recurring revenue",
    # 组合 / 市场噪声
    r"portfolio", r"buys and", r"shorts", r"puts", r"burry", r"market share",
    r"stock soars", r"stock slips", r"shares (?:rise|fall|up|down|jump|slip)",
    r"quiet winners", r"\betf\b", r"infrastructure", r"consortium",
    # ESG / 可持续（与企业变动无关）
    r"sustainability", r"corporate responsibility", r"\besg\b", r"net zero",
]
EXCLUDE_RE = re.compile("|".join("(?:" + p + ")" for p in _EXCLUDE), re.I)


def classify_event(text):
    """按中英文关键词把企业动态归类为事件类型；无命中归『其他』。"""
    if not text:
        return "其他"
    for name, rg in EVENT_RE:
        if rg.search(text):
            return name
    return "其他"


def extract_focus(text):
    """从文本抽取焦点词（宠物/动物 + 产品/领域），用于『值得关注』理由的具体化。"""
    if not text:
        return ""
    pets = ["犬", "猫", "宠物", "伴侣动物", "动物", "牛羊", "生猪", "家禽", "水产", "牲畜"]
    prods = ["疫苗", "抗生素", "驱虫", "抗原", "生物制品", "化药", "制剂", "诊断", "单抗",
             "注射液", "保健品", "营养", "宠物医院", "连锁"]
    found = []
    for w in pets + prods:
        if w in text:
            found.append(w)
        if len(found) >= 2:
            break
    return "".join(found[:2])


def explain_significance(item):
    """为企业动态生成『值得关注的原因』（基于事件类型 + 企业 + 焦点词的中文化启发式）。

    返回简洁中文句，说明市场影响 / 竞争格局变化 / 技术突破意义，供卡片『值得关注』模块展示。
    纯启发式、离线可用，失败也不影响主流程。
    """
    et = item.get("event_type", "") or "其他"
    comp = item.get("company", "") or "相关企业"
    text = item.get("summary_cn") or item.get("excerpt") or item.get("title") or ""
    if not text and item.get("region") == "国际":
        text = item.get("title", "")
    focus = extract_focus(text) or "宠物药"
    templates = {
        "新药审批": (f"该获批将扩充{comp}在{focus}领域的产品矩阵；若属首仿或改良新剂型，"
                     f"有望改变细分赛道竞争格局并提升其市场份额，对临床可及性有实质意义。"),
        "并购": (f"并购有助于{comp}快速补齐{focus}业务版图、提升市场集中度，"
                 f"可能重塑相关细分领域的竞争态势与渠道格局。"),
        "融资": (f"本轮融资将支撑{comp}在{focus}方向的研发投入与产能建设，加速业务扩张，"
                 f"或推动行业资源整合与资本向头部集中。"),
        "高管变更": (f"管理层调整可能影响{comp}后续战略节奏与执行落地，"
                     f"需持续观察新团队在{focus}等业务上的方向与协同效应。"),
        "业务布局": (f"反映{comp}对{focus}赛道的战略加码（产能 / 渠道 / 区域），"
                     f"可能引导行业资源与资本向该方向集中，带动供给端变化。"),
        "合同公开": (f"该合作将打通{comp}在{focus}的渠道或技术链路，增强商业化与供应链能力，"
                     f"对营收结构与客户黏性有正向作用。"),
        "监管公示": (f"监管动向折射政策导向，{comp}等企业需相应调整在{focus}上的注册与合规策略，"
                     f"也可能影响行业准入门槛。"),
    }
    return templates.get(et, f"该动态涉及{comp}在{focus}领域的变动，值得跟踪其对市场格局与技术路线的影响。")


def _rss_items(xml):
    out = []
    for it in re.findall(r"<item>(.*?)</item>", xml, re.S):
        def g(tag):
            m = re.search(r"<%s>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</%s>" % (tag, tag), it, re.S)
            return m.group(1).strip() if m else ""
        title = html.unescape(g("title"))
        link = g("link")
        desc = html.unescape(re.sub(r"<[^>]+>", " ", g("description")))
        desc = re.sub(r"\s+", " ", desc).strip()
        src = html.unescape(g("source")) or ""
        out.append((title, link, desc, src, g("pubDate")))
    return out


def fetch_intl_company_news(days, limit_per=6):
    """抓全球动保龙头（美股代码）的 Yahoo Finance RSS，归类事件类型，返回 item 列表。

    返回 (items, errors)。items 已是完整 schema（kind=company、region=国际、
    is_pet=True、event_type、_dt 等齐全），不参与 enrich（无官方源详情页）。
    """
    from email.utils import parsedate_to_datetime
    since = datetime.now(CST) - timedelta(days=days)
    out, errs = [], []
    for en, zh, ticker, pure in INTL_COMPANIES:
        url = YAHOO_RSS.format(ticker=ticker)
        try:
            xml = fetch(url, timeout=20, retries=1)
        except Exception as ex:
            errs.append({"source": f"Yahoo:{ticker}", "error": f"{type(ex).__name__}: {str(ex)[:60]}"})
            continue
        kept = 0
        for title, link, desc, src, pd in _rss_items(xml):
            if not title or not link:
                continue
            dt = None
            if pd:
                try:
                    dt = parsedate_to_datetime(pd)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt < since:
                        continue
                except Exception:
                    dt = None
            if not pure and not AH_KW.search(title + " " + desc):
                continue
            full = title + " " + desc
            if EXCLUDE_RE.search(full):
                continue
            event = classify_event(full)
            if event == "其他":
                continue
            out.append({
                "title": title,
                "url": link,
                "date": (dt or since).strftime("%Y-%m-%d"),
                "published_at": dt.strftime("%Y-%m-%d %H:%M") if dt else "",
                "source": src or "Yahoo Finance",
                "column": "企业动态·国际",
                "kind": "company",
                "origin": src or "Yahoo Finance",
                "excerpt": desc[:400],
                "is_pet": True,
                "pet_hits": ["动物保健"],
                "company": zh,
                "is_company": True,
                "region": "国际",
                "event_type": event,
                "_dt": dt or datetime.now(CST),
            })
            kept += 1
            if kept >= limit_per:
                break
    return out, errs


def is_pet_related(text):
    """返回 (是否宠物相关, 命中词列表)。先剔除排除项再匹配。"""
    if not text:
        return False, []
    probe = text
    for bad in PET_EXCLUDE:
        probe = probe.replace(bad, "")
    hits = [k for k in PET_STRONG if k in probe]
    if not hits:
        hits = [k for k in PET_HIT if k in probe]
        hits = [h for h in hits if h not in ("宠",)] or hits
    return bool(hits), hits


# ---------------------------------------------------------------- 网络
def fetch(url, enc="utf-8", timeout=20, retries=2):
    last = None
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
                raw = r.read()
            for e in (enc, "utf-8", "gb18030"):
                try:
                    return raw.decode(e)
                except Exception:
                    continue
            return raw.decode("utf-8", "ignore")
        except Exception as ex:
            last = ex
    raise last


DATE_IN_URL = re.compile(r"/t(\d{4})(\d{2})(\d{2})_\d+\.html?", re.I)
DATE_IN_CVDA = re.compile(r"/(\d{4})/(\d{2})(\d{2})/\d+\.html", re.I)
A_TAG = re.compile(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>\s*([^<]{6,120}?)\s*</a>', re.I)


def parse_list(key, html_text, base_url):
    """从列表页解析条目：标题、URL、日期（由 URL 推导，稳定可靠）。"""
    out, seen = [], set()
    for href, title in A_TAG.findall(html_text):
        if href.startswith(("javascript", "#", "mailto")):
            continue
        m = DATE_IN_URL.search(href) or DATE_IN_CVDA.search(href)
        if not m:
            continue
        y, mo, d = m.groups()
        try:
            dt = datetime(int(y), int(mo), int(d), tzinfo=CST)
        except ValueError:
            continue
        full = urllib.parse.urljoin(base_url, href)
        if full in seen:
            continue
        seen.add(full)
        title = re.sub(r"\s+", " ", title).replace("&nbsp;", " ").strip()
        if len(title) < 6:
            continue
        out.append({
            "title": title,
            "url": full,
            "date": dt.strftime("%Y-%m-%d"),
            "_dt": dt,
            "source_key": key,
            "source": SOURCES[key]["site"],
            "column": SOURCES[key]["name"],
            "kind": SOURCES[key]["kind"],
        })
    return out


META = {
    "title": re.compile(r'<meta[^>]+name=["\']ArticleTitle["\'][^>]+content=["\']([^"\']*)["\']', re.I),
    "pubdate": re.compile(r'<meta[^>]+name=["\']PubDate["\'][^>]+content=["\']([^"\']*)["\']', re.I),
    "origin": re.compile(r'<meta[^>]+name=["\']ContentSource["\'][^>]+content=["\']([^"\']*)["\']', re.I),
    "keywords": re.compile(r'<meta[^>]+name=["\']Keywords["\'][^>]+content=["\']([^"\']*)["\']', re.I),
}
CLEAN_SCRIPT = re.compile(r"(?is)<(script|style)[^>]*>.*?</\1>")
TAGS = re.compile(r"(?s)<[^>]+>")


def _plain(seg):
    seg = CLEAN_SCRIPT.sub(" ", seg)
    txt = TAGS.sub(" ", seg)
    for a, b in (("&nbsp;", " "), ("&amp;", "&"), ("&ldquo;", "“"),
                 ("&rdquo;", "”"), ("&mdash;", "—"), ("&#39;", "'")):
        txt = txt.replace(a, b)
    return re.sub(r"\s+", " ", txt).strip()


NAV_TAIL = re.compile(r"(?:发布时间[：:]\s*20\d{2}[-/]\d{1,2}[-/]\d{1,2}|来源[：:][^ ]{2,20})")


def extract_body(html_text):
    """提取正文。

    站点模板把标题/正文拆在不同容器里，单取第一个匹配容器会只拿到标题区，
    因此收集所有候选容器 + 全文，统一剥标签后取最长者，再裁掉页头导航。
    """
    cands = []
    for pat in (r'(?is)<div[^>]+class="[^"]*(?:TRS_Editor|article|content|conBox|xl_con|view)[^"]*"[^>]*>(.*?)</div>\s*</div>',
                r'(?is)<div[^>]+id="[^"]*(?:zoom|content|Content|xl_con)[^"]*"[^>]*>(.*?)</div>'):
        for m in re.finditer(pat, html_text):
            cands.append(m.group(1))
    texts = [_plain(c) for c in cands]
    full = _plain(html_text)
    texts.append(full)
    body = max(texts, key=len)
    # 若命中的容器明显短于全文，说明模板拆分了正文，直接用全文并裁掉导航
    if len(body) < len(full) * 0.3:
        body = full
    if body is full or len(body) > 1200:
        m = None
        for m in NAV_TAIL.finditer(body):
            pass
        if m:
            body = body[m.end():].strip() or body
    for noise in ("分享到微信朋友圈 ×", "用微信“扫一扫”，点击右上角分享按钮，",
                  "即可将网页分享给您的微信好友或朋友圈。", "打印", "字体：大 中 小",
                  "扫一扫在手机打开当前页", "(责任编辑：admin)", "作者: admin", "点击: 次",
                  "来源: 未知"):
        body = body.replace(noise, " ")
    body = re.sub(r"-{3,}分隔线-{3,}", " ", body)
    body = re.sub(r"时间[:：]\s*20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}", " ", body)
    return re.sub(r"\s+", " ", body).strip()


def archive_page(url, archive_dir, index):
    """抓取外链整页，存为工作台同源静态文件，供 iframe 加载。

    工作台部署在 https，而目标站多为 http；若 iframe 直接加载 http 会被
    mixed content 策略整页拦截（白屏）。改为采集时把整页拉取下来、
    剥离头部/导航/横幅等噪音，只保留正文内容区，重写为带基础样式的
    同源 https 静态文件。带 index 缓存避免重复抓取。
    """
    if not url or not url.startswith(("http://", "https://")):
        return None
    if url in index:
        return index[url]
    try:
        raw = fetch(url, timeout=20)
    except Exception:
        return None
    if not raw:
        return None
    # 去掉脚本/样式/外部样式表（避免执行与无样式噪音）
    html = re.sub(r"(?is)<script\b[^>]*>.*?</script>", "", raw)
    html = re.sub(r"(?is)<style\b[^>]*>.*?</style>", "", html)
    html = re.sub(r"(?is)<link\b[^>]*>", "", html)

    # 提取 body
    m = re.search(r"(?is)<body[^>]*>(.*)</body>", html, re.S)
    body_html = m.group(1) if m else html

    # ---- 剥离头部/导航/横幅/底部等噪音区域 ----
    # 1) 移除常见头部容器类（中国政企站点通用模式）
    for cls_pat in (r"(?is)<div\b[^>]*class=['\"][^'\"]*(?:top|header|head-wrap|"
                    r"banner|nav_ty|navbar|nav-\w+|menu|topbar|toolbar|"
                    r"footer|foot|bottom|copyright|friendlink|sidebar|"
                    r"left-side|right-side|slide|carousel|ad-|ads|"
                    r"contentA\s+(?:top|banner))[^'\"]*['\"][^>]*>.*?</div>",
                    r"(?is)<div\b[^>]*class=['\"][^'\"]*(?:wrap|container)[^'\"]*['\"][^>]*>"
                    r"\s*<div\b[^>]*class=['\"][^'\"]*(?:top|header|banner|nav)[^'\"]*['\"][^>]*>.*?</div>"
                    r".*?</div>"):
        body_html = re.sub(cls_pat, "", body_html)

    # 2) 移除绝对定位的导航块（position:absolute 且含大量链接的 div）
    body_html = re.sub(
        r"(?is)<div\b[^>]*style=['\"][^'\"]*position:\s*absolute[^'\"]*['\"][^>]*>"
        r"(?:(?!</div>).)*<a\b(?:(?!</div>).)*</a>(?:(?!</div>).)*</div>",
        "", body_html)

    # 3) 移除 img 标签（多为装饰性 logo/横幅，http 图片在 https iframe 里也不显示）
    body_html = re.sub(r"(?is)<img\b[^>]*/?\s*>", "", body_html)

    # 4) 清理连续空行和多余空白
    body_html = re.sub(r"\n{3,}", "\n\n", body_html)
    body_html = body_html.strip()

    # 如果剥离后内容过短（可能误删了），回退到保留完整 body
    if len(body_html) < 200:
        m2 = re.search(r"(?is)<body[^>]*>(.*)</body>", html, re.S)
        body_html = m2.group(1) if m2 else html

    style = (
        "<style>"
        "body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;"
        "line-height:1.8;color:#222;max-width:960px;margin:0 auto;padding:16px;"
        "font-size:15px;word-break:break-word;}"
        "h1,h2,h3{line-height:1.4;color:#111;}"
        "h1{font-size:1.5em;margin:0.8em 0 0.4em;border-bottom:2px solid #e53e3e;"
        "padding-bottom:8px;}"
        "h2{font-size:1.25em;margin:0.7em 0 0.3em;}"
        "h3{font-size:1.1em;margin:0.6em 0 0.3em;}"
        "p{margin:0.5em 0;text-align:justify;}"
        "table{border-collapse:collapse;width:100%;margin:12px 0;font-size:0.95em;}"
        "td,th{border:1px solid #ddd;padding:8px 10px;text-align:left;}"
        "th{background:#f8f9fa;font-weight:600;}"
        "a{color:#1a56db;word-break:break-all;}"
        "pre{white-space:pre-wrap;background:#f6f7fb;padding:12px;"
        "border-radius:6px;font-size:0.9em;overflow-x:auto;}"
        ".src-ref{color:#999;font-size:0.85em;margin-top:24px;"
        "padding-top:12px;border-top:1px solid #eee;}"
        "</style>"
    )
    src_line = (
        '<p class="src-ref">'
        f'来源：<a href="{url}" target="_blank">{url}</a>'
        "&nbsp;（本文由原站自动缓存，仅供工作台内阅读）</p>"
    )
    doc = ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
           + style + "</head><body>" + body_html + src_line + "</body></html>")
    try:
        os.makedirs(archive_dir, exist_ok=True)
    except Exception:
        return None
    h = hashlib.md5(url.encode("utf-8")).hexdigest()[:12]
    fn = os.path.join(archive_dir, h + ".html")
    try:
        with open(fn, "w", encoding="utf-8") as f:
            f.write(doc)
    except Exception:
        return None
    rel = "archive/" + h + ".html"
    index[url] = rel
    return rel


FULLTEXT_CAP = 6000  # 单条全文上限字符数，避免 JSON 过大


def _load_cache(path):
    if not path:
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_cache(path, cache):
    if not path:
        return
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def fetch_full_text(url, cache=None, timeout=15):
    """抓回正文全文，供工作台内联「查看全文」使用。带本地缓存，失败返回 None。"""
    if not url or not url.startswith(("http://", "https://")):
        return None
    if cache is not None and url in cache:
        return cache.get(url) or None
    try:
        h = fetch(url, timeout=timeout, retries=1)
        body = extract_body(h).strip()
        if len(body) < 80:           # 太短视为没抓到正文
            body = ""
        if len(body) > FULLTEXT_CAP:
            body = body[:FULLTEXT_CAP] + " …（已截断）"
        if cache is not None:
            cache[url] = body
        return body or None
    except Exception:
        if cache is not None:
            cache[url] = ""          # 记空，避免每日运行反复重试
        return None


def enrich(item, timeout=20):
    """抓详情页，补 meta（发布时间/来源单位/关键词）与正文摘要。"""
    try:
        enc = SOURCES[item["source_key"]]["enc"]
        h = fetch(item["url"], enc=enc, timeout=timeout, retries=1)
    except Exception as ex:
        item["detail_error"] = f"{type(ex).__name__}"
        return item
    for k, pat in META.items():
        m = pat.search(h)
        if m and m.group(1).strip():
            v = m.group(1).strip()
            if k == "title":
                item["title"] = v
            elif k == "pubdate":
                item["published_at"] = v
                item["date"] = v[:10]
            elif k == "origin":
                item["origin"] = v
            elif k == "keywords":
                item["keywords"] = [x for x in re.split(r"[;；,，]", v) if x.strip()]
    # 协会站没有标准 meta，时间/来源以纯文本写在正文头部：
    # "时间: 2026-07-28 15:18 来源: 未知 作者: admin"，需在剥标签后的文本里找
    if not item.get("published_at") or not item.get("origin"):
        flat = _plain(h)
        if not item.get("published_at"):
            m = re.search(r"时间[:：]\s*(20\d{2}-\d{2}-\d{2}\s+\d{1,2}:\d{2})", flat)
            if m:
                item["published_at"] = m.group(1) + ":00"
                item["date"] = m.group(1)[:10]
        if not item.get("origin"):
            m = re.search(r"来源[:：]\s*(\S{2,20}?)\s+(?:作者|点击)", flat)
            if m and m.group(1) not in ("未知", "本站", "admin"):
                item["origin"] = m.group(1)

    body = extract_body(h)
    # 去掉导航噪音：正文通常在站点导航之后，取标题之后的片段
    anchor = item["title"][:12]
    idx = body.rfind(anchor)
    if idx > 0:
        body = body[idx:]
    item["body_len"] = len(body)
    item["excerpt"] = body[:400]
    item["full_text"] = body.strip()[:FULLTEXT_CAP]  # 供工作台内联「查看全文」
    pet, hits = is_pet_related(item["title"] + " " + body)
    item["is_pet"] = pet
    item["pet_hits"] = hits
    # 企业动态识别：在（标题+全文）中找兽药/动保企业名；标记 is_company / company / region / event_type。
    # 是否最终归入「企业动态」版块、以及是否入选每日精选，由 collect 统一决定，
    # 此处不改 kind（未入选的国内企业条目将保留在原栏目，避免重复计数）。
    company = detect_company(item["title"] + " " + body)
    if company:
        item["company"] = company
        item["is_company"] = True
        item["region"] = "国内"
        item["event_type"] = classify_event(item["title"] + " " + body)
    else:
        item["is_company"] = False
        item["region"] = ""
        item["event_type"] = ""
    return item


# ---------------------------------------------------------------- 企业动态·每日精选
def curate_company_digest(items, target=10):
    """从候选企业条目中精选『每日企业动态』：去重 + 当日优先 + 价值排序，目标 8-10 条。

    - 候选：is_company 或 region=国际 的条目；
    - 去重：同一 url 或（企业 + 归一化标题）只保留一条；
    - 时效性：当日条目优先填满，不足再用近期高价值条目补齐（确保精选量可读，并标注日期）；
    - 价值排序：事件类型权重 + 宠物相关 + 国际，再按时间倒序。
    返回 (selected, today_count)。
    """
    cands = [i for i in items if i.get("is_company") or i.get("region") == "国际"]
    seen_t, seen_u, uniq = set(), set(), []
    for i in cands:
        u = i.get("url", "")
        if u in seen_u:
            continue
        seen_u.add(u)
        key = (i.get("company", ""), re.sub(r"\W+", "", i.get("title", ""))[:30])
        if key in seen_t:
            continue
        seen_t.add(key)
        uniq.append(i)

    today = datetime.now(CST).date()

    def days_old(i):
        d = i.get("_dt")
        if not d:
            return 999
        return (today - d.date()).days

    def value_score(i):
        et = i.get("event_type", "") or "其他"
        s = {"新药审批": 6, "并购": 6, "融资": 5, "高管变更": 4,
             "业务布局": 4, "合同公开": 4, "监管公示": 3, "其他": 2}.get(et, 2)
        if i.get("is_pet"):
            s += 2
        if i.get("region") == "国际":
            s += 1
        return s

    uniq.sort(key=lambda x: (0 if days_old(x) == 0 else 1,
                             -value_score(x),
                             -(x.get("_dt").timestamp() if x.get("_dt") else 0)))
    today_items = [i for i in uniq if days_old(i) == 0]
    recent = [i for i in uniq if days_old(i) > 0]
    # 当日优先填满，不足则用近日内最近的高价值条目补齐（确保可阅读的精选量）
    selected = today_items[:target] + recent[:max(0, target - len(today_items))]
    selected = selected[:target]
    return selected, len(today_items)


# ---------------------------------------------------------------- 主流程
def collect(source_keys, days, pet_only, detail, limit_per_source, timeout,
            company_news=True, limit_per_company=15, archive_path=None):
    since = datetime.now(CST) - timedelta(days=days)
    items, errors = [], []
    for key in source_keys:
        cfg = SOURCES.get(key)
        if not cfg:
            errors.append({"source": key, "error": "unknown source key"})
            continue
        try:
            h = fetch(cfg["url"], enc=cfg["enc"], timeout=timeout)
        except Exception as ex:
            errors.append({"source": key, "name": cfg["name"],
                           "error": f"{type(ex).__name__}: {str(ex)[:80]}"})
            continue
        got = parse_list(key, h, cfg["url"])
        got = [g for g in got if g["_dt"] >= since]
        got.sort(key=lambda x: x["_dt"], reverse=True)
        if limit_per_source:
            got = got[:limit_per_source]
        items.extend(got)

    items.sort(key=lambda x: (x["_dt"], -SOURCES[x["source_key"]]["weight"]), reverse=True)

    if detail or pet_only:
        # 串行抓详情在多源场景下会跑到分钟级并被上层超时中断，这里用小并发池
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda x: enrich(x, timeout=timeout), items))
    else:
        for it in items:
            pet, hits = is_pet_related(it["title"])
            it["is_pet"] = pet
            it["pet_hits"] = hits
            it["is_company"] = False
            it["region"] = ""
            it["event_type"] = ""

    if pet_only:
        items = [i for i in items if i.get("is_pet") or i.get("is_company")]

    # 企业动态·国际公司新闻（Yahoo Finance RSS，美股动保龙头）
    if company_news:
        cnews, cerr = fetch_intl_company_news(days, limit_per_company)
        items.extend(cnews)
        errors.extend(cerr)

    # 国际企业新闻翻译为中文重点摘要（保留原文链接）；翻译结果写入本地缓存
    for it in items:
        if it.get("region") == "国际":
            summarize_intl(it)
    _save_trans_cache()

    # ---- 企业动态·每日精选（8-10 条，当日优先 + 价值排序 + 去重 + 噪声已排除）----
    selected, today_n = curate_company_digest(items, target=10)
    sel_info = {}
    for idx, i in enumerate(selected, 1):
        d = i.get("_dt")
        is_today = bool(d and d.date() == datetime.now(CST).date())
        sel_info[i.get("url")] = {
            "rank": idx,
            "why": explain_significance(i),
            "is_today": is_today,
        }

    # ---- 企业动态·持久化累积：保留历史、跨运行去重（避免重复相同信息）----
    arch = load_archive(archive_path) if archive_path else {"items": [], "updated_at": ""}
    arch_map = {_dedup_key(a): a for a in arch.get("items", [])}
    sel_keys = {_dedup_key(i) for i in selected}
    merged, new_n = [], 0
    for i in selected:
        k = _dedup_key(i)
        i.update(sel_info.get(i.get("url"), {}))
        i["kind"] = "company"
        if k in arch_map:
            # 已收录：保留历史首次收录日期，不重复计为新条目
            i["first_seen"] = arch_map[k].get("first_seen") or i.get("date")
            i["is_new"] = False
        else:
            i["first_seen"] = i.get("date") or datetime.now(CST).strftime("%Y-%m-%d")
            i["is_new"] = True
            new_n += 1
        merged.append(i)
    # 保留历史中本次未重新入选的条目（累积，不丢弃）
    for a in arch.get("items", []):
        if _dedup_key(a) not in sel_keys:
            a.setdefault("first_seen", a.get("date", ""))
            a["is_new"] = False
            merged.append(a)
    # 去重保险 + 按日期倒序 + 限容
    seen, deduped = set(), []
    for m in merged:
        kk = _dedup_key(m)
        if kk in seen:
            continue
        seen.add(kk)
        deduped.append(m)
    deduped.sort(key=lambda x: x.get("date", ""), reverse=True)
    deduped = deduped[:ARCHIVE_MAX]
    for idx, m in enumerate(deduped, 1):
        m["rank"] = idx
    if archive_path:
        # _dt 为 datetime，不可 JSON 序列化；存档前剥离，避免写入损坏
        arch["items"] = [{k: v for k, v in m.items() if k != "_dt"} for m in deduped]
        arch["updated_at"] = datetime.now(CST).strftime("%Y-%m-%d %H:%M")
        save_archive(archive_path, arch)

    # 重建 items：移除本次原始企业条目副本，用 retained（含历史）替代，避免重复
    retained_keys = {_dedup_key(m) for m in deduped}
    items = [i for i in items if _dedup_key(i) not in retained_keys] + deduped

    meta_company = {
        "company_selected": len(deduped),
        "company_retained": len(deduped),
        "company_new": new_n,
        "company_today": today_n,
        "company_target": 10,
    }

    items.sort(key=lambda x: x.get("_dt") or datetime(1970, 1, 1, tzinfo=CST), reverse=True)
    for it in items:
        it.pop("_dt", None)
    return items, errors, meta_company


WEEK = "一二三四五六日"


def to_markdown(items, meta):
    lines = [f"## 宠物药 / 兽药行业情报（近 {meta['days']} 天）", ""]
    if not items:
        lines.append("_该时间窗内未检索到条目。_")
    by_kind = {}
    for it in items:
        by_kind.setdefault(it["kind"], []).append(it)
    label = {"regulatory": "监管与审批", "notice": "公示通知",
             "news": "行业动态", "association": "协会与标准", "company": "企业动态"}
    n = 0
    for kind in ("regulatory", "notice", "news", "association", "company"):
        lst = by_kind.get(kind)
        if not lst:
            continue
        lines.append(f"### {label[kind]}（{len(lst)} 条）")
        if kind == "company" and meta.get("company_digest"):
            cd = meta["company_digest"]
            note = (f"*企业动态累积保留 {cd.get('company_retained', len(lst))} 条"
                    f"（本期新收录 {cd.get('company_new', 0)} 条"
                    + (f"，其中当日 {cd.get('company_today', 0)} 条" if cd.get("company_today") else "")
                    + "），已跨运行去重，避免重复相同信息。*")
            lines.append(note)
        for it in lst:
            n += 1
            d = datetime.strptime(it["date"], "%Y-%m-%d")
            human = f"{d.month} 月 {d.day} 日"
            tag = " · 宠物相关" if it.get("is_pet") else ""
            if it.get("event_type"):
                tag += f" · {it['event_type']}"
            if it.get("region"):
                tag += f" · {it['region']}"
            if it.get("is_today"):
                tag += " · 今日"
            title_md = it.get("title_cn") or it["title"]
            lines.append(f"{n}. [{title_md}]({it['url']})")
            lines.append(f"   - {it['source']}·{it['column']} · {human}{tag}")
            if it.get("summary_cn"):
                lines.append(f"   - {it['summary_cn'][:120]}")
            elif it.get("excerpt"):
                lines.append(f"   - {it['excerpt'][:80]}")
            if it.get("why"):
                lines.append(f"   - 值得关注：{it['why'][:140]}")
        lines.append("")
    lines.append("---")
    lines.append(f"共 {len(items)} 条 · 数据源：{meta['sources']} · 采集于 {meta['fetched_at']}")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="宠物药/兽药行业情报抓取")
    ap.add_argument("--days", type=int, default=7, help="时间窗天数，默认 7")
    ap.add_argument("--sources", default=",".join(DEFAULT_SOURCES),
                    help="源 key，逗号分隔；all 表示全部。可选：" + ",".join(SOURCES))
    ap.add_argument("--pet-only", action="store_true", help="仅保留宠物相关（自动抓详情）")
    ap.add_argument("--detail", action="store_true", help="抓详情页补全时间/来源/摘要")
    ap.add_argument("--limit-per-source", type=int, default=0, help="每源最多条数，0 不限")
    ap.add_argument("--timeout", type=int, default=20)
    ap.add_argument("--format", choices=["json", "md"], default="json")
    ap.add_argument("--out", default="", help="输出文件路径，缺省打印到 stdout")
    ap.add_argument("--archive", default="",
                    help="企业动态归档文件路径（跨运行持久化、去重）；缺省由 --out 所在目录推导为 company_archive.json")
    ap.add_argument("--no-company-news", action="store_true",
                    help="不抓取国际企业新闻；用于仅更新国内官方资讯的自动任务")
    ap.add_argument("--list-sources", action="store_true", help="列出全部可用源后退出")
    a = ap.parse_args()

    if a.list_sources:
        for k, v in SOURCES.items():
            print(f"{k:10s} {v['kind']:12s} {v['site']} · {v['name']}  {v['url']}")
        return

    keys = list(SOURCES) if a.sources.strip() == "all" else \
        [s.strip() for s in a.sources.split(",") if s.strip()]

    archive_path = a.archive
    if not archive_path and a.out and not a.no_company_news:
        archive_path = os.path.join(os.path.dirname(os.path.abspath(a.out)),
                                    "company_archive.json")
    items, errors, meta_company = collect(keys, a.days, a.pet_only, a.detail,
                            a.limit_per_source, a.timeout,
                            company_news=not a.no_company_news,
                            archive_path=archive_path)
    # 补全全文（enrich 已抓的会带上；其余有 url 的再补抓，带缓存避免重复请求）
    ft_cache_path = (os.path.join(os.path.dirname(os.path.abspath(a.out)),
                                  "fulltext_cache.json") if a.out else "")
    ft_cache = _load_cache(ft_cache_path)
    for it in items:
        if not it.get("full_text") and it.get("url"):
            ft = fetch_full_text(it["url"], ft_cache, timeout=a.timeout)
            if ft:
                it["full_text"] = ft
    _save_cache(ft_cache_path, ft_cache)
    # 整页存档：供工作台 iframe 同源加载，规避 https 页加载 http 的 mixed content 限制
    if a.out:
        archive_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(a.out))),
                                    "www", "archive")
        archive_index = _load_cache(os.path.join(archive_dir, "index.json"))
        for it in items:
            if it.get("url"):
                ar = archive_page(it["url"], archive_dir, archive_index)
                if ar:
                    it["archive_file"] = ar
        _save_cache(os.path.join(archive_dir, "index.json"), archive_index)
    now = datetime.now(CST)
    meta = {
        "fetched_at": now.strftime("%Y-%m-%d %H:%M") + " 北京时间",
        "days": a.days,
        "sources": "、".join(SOURCES[k]["site"] + "·" + SOURCES[k]["name"]
                             for k in keys if k in SOURCES),
        "source_keys": keys,
        "total": len(items),
        "pet_count": sum(1 for i in items if i.get("is_pet")),
        "company_digest": meta_company,
        "errors": errors,
    }
    payload = {"meta": meta, "items": items}
    text = to_markdown(items, meta) if a.format == "md" else \
        json.dumps(payload, ensure_ascii=False, indent=2)

    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"[ok] {len(items)} 条（宠物相关 {meta['pet_count']} 条）-> {a.out}")
        if errors:
            print("[warn] 失败源:", "; ".join(f"{e.get('name', e['source'])}={e['error']}" for e in errors))
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(text)


if __name__ == "__main__":
    main()
