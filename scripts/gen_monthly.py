# -*- coding: utf-8 -*-
"""
每月资讯压缩脚本
================
读取 public/consult-data.json（累积的全量数据），按条目 date 的 YYYY-MM 分组，
将每个月压缩为一份月报，写入 public/monthly-summary.json。

每月归档结构：
  months: {
    "2026-08": {
      "month": "2026-08",
      "overview": "本月概览（各板块条数）",
      "keyPoints": ["本月核心要点（各板块前 3 条的中文译文/标题）", ...],
      "sections": { "industry": [...], "drug": [...], "regulatory": [...] }
    },
    ...
  }

要点说明：
  - 每次日常更新只向 consult-data.json 追加，不删除；本脚本据此生成逐月压缩归档。
  - 压缩 = 概览 + 核心要点 + 三板块条目（字段做精简，去除冗长 summary 以减小体积）。
  - 历史月份也会保留，App「每月资讯」Tab 可逐月展开回看。

用法：
  python gen_monthly.py
  python gen_monthly.py --data X.json --out Y.json
"""
import argparse
import json
import os
from datetime import datetime, timezone, timedelta

CST = timezone(timedelta(hours=8))
HERE = os.path.dirname(os.path.abspath(__file__))
SECS = ("industry", "drug", "regulatory")


def load(p):
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[warn] 读取 {p} 失败: {e}", file=__import__("sys").stderr)
        return None


def compact(it):
    """精简单条，保留前端渲染所需字段。"""
    out = {}
    for k in ("title", "url", "source", "date", "lang", "titleZh", "zhSummary"):
        v = it.get(k)
        if v not in (None, ""):
            out[k] = v
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(HERE, "..", "public", "consult-data.json"))
    ap.add_argument("--out", default=os.path.join(HERE, "..", "public", "monthly-summary.json"))
    args = ap.parse_args()

    data = load(args.data)
    sections = (data or {}).get("sections", {})

    months = {}
    for sec in SECS:
        for it in sections.get(sec, []):
            m = (it.get("date") or "")[:7]
            if not m or len(m) != 7:
                continue
            months.setdefault(m, {s: [] for s in SECS})
            months[m][sec].append(it)

    result = {
        "generatedAt": datetime.now(CST).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "months": {},
    }

    for m in sorted(months.keys(), reverse=True):
        secs = months[m]
        total = sum(len(v) for v in secs.values())
        key_points = []
        for sec in SECS:
            for it in secs[sec][:3]:
                kp = it.get("zhSummary") or it.get("titleZh") or it.get("summary") or it.get("title")
                if kp:
                    key_points.append(kp)
        overview = (
            f"{m} 共汇总 {total} 条宠物与医药行业资讯"
            f"（行业动态 {len(secs['industry'])} / 药品信息 {len(secs['drug'])} / 监管动态 {len(secs['regulatory'])}）。"
        )
        result["months"][m] = {
            "month": m,
            "overview": overview,
            "keyPoints": key_points,
            "sections": {sec: [compact(it) for it in secs[sec]] for sec in SECS},
        }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"[done] monthly-summary.json · 覆盖月份 {list(result['months'].keys())} · 共 {len(result['months'])} 个月")


if __name__ == "__main__":
    main()
