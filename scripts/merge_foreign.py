# -*- coding: utf-8 -*-
"""
外文条目合并脚本
================
读取 scripts/_foreign.json（由自动化经 WebFetch 抓取并翻译后的外文条目数组），
按来源路由到 consult-data.json 的对应板块并合并（url 去重）：
  - FDA CVM / EMA                              -> regulatory
  - Yahoo Finance 等企业或行业外文新闻          -> industry
  - 显式 topic='general'（泛财经等）            -> 跳过
每个条目须含：title, url, source, date, lang='en', titleZh, zhSummary。

用法：python merge_foreign.py
"""
import argparse
import json
import os
from datetime import datetime

REG_SOURCES = ("FDA CVM", "EMA")


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
    import re
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y-%m-%d")
        except ValueError:
            pass
    return datetime.min


def sort_sections(sections):
    """三大板块均按日期倒序（最新在上）排列。"""
    for k in sections:
        sections[k].sort(key=lambda it: parse_date(it.get("date", "")), reverse=True)

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(HERE, "..", "public", "consult-data.json"))
    ap.add_argument("--items", default=os.path.join(HERE, "_foreign.json"))
    args = ap.parse_args()

    with open(args.data, "r", encoding="utf-8") as f:
        data = json.load(f)
    with open(args.items, "r", encoding="utf-8") as f:
        new_items = json.load(f)

    sections = data.setdefault("sections", {})
    for k in ("industry", "drug", "regulatory"):
        sections.setdefault(k, [])
    existing = {it.get("url") for sec in sections.values() for it in sec}
    added = 0
    for it in new_items:
        url = it.get("url")
        if not url or url in existing:
            continue
        if it.get("topic") == "general":
            continue
        src = it.get("source", "")
        target = "regulatory" if src in REG_SOURCES else "industry"
        rec = {
            "title": it.get("title", "").strip(),
            "summary": it.get("summary", "")[:160],
            "url": url,
            "source": src,
            "date": it.get("date", ""),
            "lang": "en",
            "titleZh": it.get("titleZh", ""),
            "zhSummary": it.get("zhSummary", ""),
        }
        sections[target].append(rec)
        existing.add(url)
        added += 1

    sort_sections(sections)
    with open(args.data, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[ok] 合并外文 {added} 条（regulatory 现 {len(sections['regulatory'])} / industry 现 {len(sections['industry'])}）")


if __name__ == "__main__":
    main()
