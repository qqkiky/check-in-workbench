# -*- coding: utf-8 -*-
"""
咨询栏目每日内容生成脚本
========================
抓取宠物与医药（兽药）行业公开信源，编译为 public/consult-data.json，供 App「咨询」Tab 读取。
三板块：
  - industry    行业动态（宠物/医药行业新闻、企业动态、市场趋势）
  - drug        药品信息（新药注册审批、公示、变更注册）
  - regulatory  监管动态（国内外监管政策/法规/指南/召回）

国内源使用仓库内置的 fetch_intel.py（urllib 标准库，已实测）。
国际源（FDA / EMA）由本脚本用 urllib 直连解析（仅读，不登录）。

用法：
  python gen_consult.py            # 生成到 ../public/consult-data.json（相对本脚本）
  python gen_consult.py --out X.json
依赖：Python 3.11+ 标准库；默认调用同目录 fetch_intel.py，也可用 FETCH_INTEL 环境变量覆盖。
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

CST = timezone(timedelta(hours=8))

PY = sys.executable
# fetch_intel.py 已随仓库分发，GitHub Actions 与本机使用同一份实现。
DEFAULT_FETCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fetch_intel.py")
FETCH_INTEL = os.environ.get("FETCH_INTEL", DEFAULT_FETCH)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

# 中文源 → 三板块映射（每个源只归一个板块，避免重复）
SRC_DRUG = ["nyncbgg", "gg", "tz"]          # 注册审批 / 公示 / 通知
SRC_REGULATORY = ["flfg"]                   # 法规规章
SRC_INDUSTRY = ["dfxw", "zhdt", "cvda_tz"]  # 行业动态 / 综合要闻 / 协会

DRUG_DOMAINS = ("fda.gov", "ema.europa.eu")


def now_iso():
    return datetime.now(CST).strftime("%Y-%m-%dT%H:%M:%S+08:00")


def parse_date(s):
    """把各类日期字符串解析为 datetime，无法解析返回 datetime.min（排最末）。
    支持：2026-08-24 10:19:00 / 2026-08-24 18:03 / 2026-08-24 / 空。"""
    s = (s or "").strip()
    if not s:
        return datetime.min
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y-%m-%d")
        except ValueError:
            pass
    return datetime.min


def sort_sections(sections):
    """三大板块均按日期倒序（最新在上）排列，日期缺失/相同的保持原相对顺序。"""
    for k in sections:
        lst = sections[k]
        lst.sort(key=lambda it: parse_date(it.get("date", "")), reverse=True)


def detect_lang(title: str) -> str:
    """粗略语言判定：英文字母占比高则视为英文(en)，否则中文(zh)。"""
    title = (title or "").strip()
    if not title:
        return "zh"
    ascii_cnt = sum(1 for ch in title if ord(ch) < 128)
    return "en" if ascii_cnt / max(len(title), 1) > 0.6 else "zh"


def http_get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx()) as r:
        raw = r.read()
    # 尝试按响应头编码，否则 GB18030/UTF-8 兜底
    enc = r.headers.get_content_charset() or "utf-8"
    try:
        return raw.decode(enc, errors="replace")
    except LookupError:
        return raw.decode("utf-8", errors="replace")


def _ssl_ctx():
    try:
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    except Exception:
        return None


def run_fetch_intel(out_path, days=30, limit=15):
    """调用 pet-pharma-intel 抓取中文源，输出 JSON 到 out_path。"""
    sources = ",".join(SRC_DRUG + SRC_REGULATORY + SRC_INDUSTRY)
    cmd = [
        PY, FETCH_INTEL,
        "--sources", sources,
        "--days", str(days),
        "--limit-per-source", str(limit),
        "--detail",
        "--no-company-news",
        "--format", "json",
        "--out", out_path,
    ]
    try:
        subprocess.run(cmd, check=True, timeout=180,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except Exception as e:
        print(f"[warn] fetch_intel 失败: {e}", file=sys.stderr)
        return False


def map_cn_items(items):
    out = {"industry": [], "drug": [], "regulatory": []}
    for it in items:
        sk = it.get("source_key", "")
        kind = it.get("kind", "")
        title = (it.get("title") or "").strip()
        url = it.get("url") or ""
        if not title or not url:
            continue
        date = it.get("published_at") if it.get("published_at") else it.get("date", "")
        src = it.get("origin") or (f'{it.get("source","")}·{it.get("column","")}'.strip("·"))
        summary = it.get("summary") or it.get("excerpt") or ""
        rec = {"title": title, "summary": summary[:160], "url": url,
               "source": src, "date": date}
        if sk in SRC_DRUG:
            out["drug"].append(rec)
        elif sk in SRC_REGULATORY:
            out["regulatory"].append(rec)
        elif sk in SRC_INDUSTRY or kind == "company":
            out["industry"].append(rec)
    return out


def fetch_fda_updates():
    """解析 FDA 动物药品相关更新链接（CVM Updates / 召回 / 指南，均聚合在动物药品主页）。"""
    urls = [
        "https://www.fda.gov/animal-veterinary",
        "https://www.fda.gov/animal-veterinary/cvm-updates",
    ]
    items = []
    seen = set()
    pat = re.compile(
        r'<a[^>]+href="(https://www\.fda\.gov/(?:animal-veterinary/cvm-updates/[^"]+|safety/recalls-market-withdrawals-safety-alerts/[^"]+|regulatory-information/search-fda-guidance-documents/[^"]+))"[^>]*>([^<]{14,160})</a>',
        re.I)
    nav_kw = ("for industry", "for consumers", "for veterinarians", "about fda",
              "back to top", "how to report", "meet the", "who we are",
              "home", "contact", "en espanol", "search", "more cvm", "©")
    for u in urls:
        try:
            html = http_get(u)
        except Exception as e:
            print(f"[warn] FDA 抓取失败 {u}: {e}", file=sys.stderr)
            continue
        for m in pat.finditer(html):
            link, title = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
            if link in seen or link.rstrip("/") in seen:
                continue
            low = title.lower()
            if any(k in low for k in nav_kw):
                continue
            if len(title) < 14 or title.endswith(("|", "›", "»", ":")):
                continue
            seen.add(link.rstrip("/"))
            items.append({
                "title": title,
                "summary": "",
                "url": link,
                "source": "FDA CVM",
                "date": "",
            })
        if len(items) >= 14:
            break
    return items[:14]


def fetch_ema_news():
    """解析 EMA 新闻 / 兽医药品更新链接。"""
    urls = [
        "https://www.ema.europa.eu/en/news",
        "https://www.ema.europa.eu/en/veterinary-medicines",
    ]
    items = []
    seen = set()
    pat = re.compile(
        r'<a[^>]+href="(https://www\.ema\.europa\.eu/en/news/[^"]+)"[^>]*>([^<]{14,160})</a>',
        re.I)
    nav_kw = ("home", "about", "who we are", "contact", "login", "register",
              "accessibility", "terms", "privacy", "careers", "events", "glossary",
              "©", "european medicines agency", "all rights reserved")
    for u in urls:
        try:
            html = http_get(u)
        except Exception as e:
            print(f"[warn] EMA 抓取失败 {u}: {e}", file=sys.stderr)
            continue
        for m in pat.finditer(html):
            link, title = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
            if link in seen or "/en/news?" in link or link.endswith((".pdf", ".doc")):
                continue
            low = title.lower()
            if any(k in low for k in nav_kw):
                continue
            if len(title) < 14:
                continue
            seen.add(link)
            items.append({
                "title": title,
                "summary": "",
                "url": link,
                "source": "EMA",
                "date": "",
            })
        if len(items) >= 12:
            break
    return items[:12]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None, help="输出 JSON 路径")
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--limit", type=int, default=15)
    ap.add_argument("--reset", action="store_true", help="忽略已有数据、全新生成（不累积历史）")
    args = ap.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    out = args.out or os.path.join(here, "..", "public", "consult-data.json")
    tmp = os.path.join(here, "_intel_tmp.json")

    # 累积模式：保留已有条目（含历史月份与已翻译外文），仅追加新的国内源条目。
    # 外文（FDA/EMA/Yahoo 等）由 merge_foreign.py 经 WebFetch 抓取并翻译后并入，
    # 故此处不再直连外文站点（避免产生未翻译重复条目）。
    existing = {"industry": [], "drug": [], "regulatory": []}
    if not args.reset and os.path.exists(out):
        try:
            with open(out, "r", encoding="utf-8") as f:
                old = json.load(f)
            for k in existing:
                existing[k] = old.get("sections", {}).get(k, [])
            print(f"[ok] 读取已有数据 {sum(len(v) for v in existing.values())} 条（累积模式）")
        except Exception as e:
            print(f"[warn] 读取已有数据失败，将全新生成: {e}", file=sys.stderr)

    seen = {it.get("url") for sec in existing.values() for it in sec if it.get("url")}

    # 1) 中文源（仅国内，外文交由 merge_foreign）
    fetch_succeeded = False
    if run_fetch_intel(tmp, days=args.days, limit=args.limit):
        try:
            with open(tmp, "r", encoding="utf-8") as f:
                data = json.load(f)
            meta = data.get("meta", {})
            requested = set(meta.get("source_keys") or (SRC_DRUG + SRC_REGULATORY + SRC_INDUSTRY))
            failed = {e.get("source") for e in meta.get("errors", []) if e.get("source")}
            if requested and requested.issubset(failed):
                raise RuntimeError("全部国内资讯源均抓取失败")
            cn = map_cn_items(data.get("items", []))
            added = 0
            for k in existing:
                for it in cn.get(k, []):
                    if it.get("url") and it["url"] not in seen:
                        existing[k].append(it)
                        seen.add(it["url"])
                        added += 1
            print(f"[ok] 中文源新增 {added} 条")
            fetch_succeeded = True
        except Exception as e:
            print(f"[warn] 解析 fetch_intel 输出失败: {e}", file=sys.stderr)
        finally:
            try:
                os.remove(tmp)
            except Exception:
                pass

    if not fetch_succeeded:
        print("[error] 国内资讯更新失败，保留现有数据文件不变", file=sys.stderr)
        return 1

    sort_sections(existing)
    payload = {"generatedAt": now_iso(), "sections": existing}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    total = sum(len(v) for v in existing.values())
    print(f"[done] 已写入 {out} · 累计 {total} 条 "
          f"(行业{len(existing['industry'])} / 药品{len(existing['drug'])} / 监管{len(existing['regulatory'])})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
