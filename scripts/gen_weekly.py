# -*- coding: utf-8 -*-
"""
每周汇总生成脚本
================
读取 public/brief-history.json（每日简报快照数组），取最近 7 天，
将各板块去重整合为一份周总结，写入 public/weekly-summary.json。

输出结构：
  {
    "weekStart", "weekEnd", "daysCovered", "generatedAt",
    "overview": "本周概览（模板，自动化可由 Agent 改写润色）",
    "highlights": ["关键要点1", ...],
    "sections": { "industry":[...], "drug":[...], "regulatory":[...] }
  }

用法：python gen_weekly.py
"""
import json
import os
from datetime import datetime, timezone, timedelta

CST = timezone(timedelta(hours=8))
HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    hist_path = os.path.join(HERE, "..", "public", "brief-history.json")
    out = os.path.join(HERE, "..", "public", "weekly-summary.json")
    if not os.path.exists(hist_path):
        print("[warn] 未找到 brief-history.json，跳过周汇总生成")
        return

    with open(hist_path, "r", encoding="utf-8") as f:
        history = json.load(f)
    if not history:
        print("[warn] brief-history.json 为空，跳过")
        return

    # 按日期降序，取最近 7 天
    history.sort(key=lambda x: x.get("date", ""), reverse=True)
    last7 = history[:7]

    # 各板块按 url 去重合并（旧->新）
    merged = {"industry": [], "drug": [], "regulatory": []}
    seen = set()
    for snap in reversed(last7):
        for k in merged:
            for it in snap.get("sections", {}).get(k, []):
                u = it.get("url")
                if u in seen:
                    continue
                seen.add(u)
                merged[k].append(it)

    dates = [s.get("date", "") for s in last7 if s.get("date")]
    week_start = min(dates) if dates else ""
    week_end = max(dates) if dates else ""
    total = sum(len(v) for v in merged.values())

    overview = (
        f"本周（统计周期 {week_start} ~ {week_end}，覆盖 {len(last7)} 天）"
        f"共汇总 {total} 条宠物与医药行业资讯，其中行业动态 {len(merged['industry'])} 条、"
        f"药品信息 {len(merged['drug'])} 条、监管动态 {len(merged['regulatory'])} 条。"
    )

    # 关键要点：每板块取前几条标题（外文取 titleZh）
    highlights = []
    for k in ("regulatory", "drug", "industry"):
        for it in merged[k][:3]:
            h = it.get("titleZh") or it.get("title") or ""
            if h:
                highlights.append(h)
    highlights = highlights[:8]

    payload = {
        "weekStart": week_start,
        "weekEnd": week_end,
        "daysCovered": len(last7),
        "generatedAt": datetime.now(CST).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "overview": overview,
        "highlights": highlights,
        "sections": merged,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[done] weekly-summary.json · 覆盖 {len(last7)} 天 · {total} 条 "
          f"(行业{len(merged['industry'])}/药品{len(merged['drug'])}/监管{len(merged['regulatory'])})")


if __name__ == "__main__":
    main()
