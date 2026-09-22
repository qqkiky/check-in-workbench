# -*- coding: utf-8 -*-
"""
每日快照追加脚本
================
读取 public/consult-data.json，将当日完整三板块快照追加到
public/brief-history.json（按 date 去重），供 gen_weekly.py 累积生成周汇总。

用法：python append_history.py
"""
import json
import os
from datetime import datetime, timezone, timedelta

CST = timezone(timedelta(hours=8))
HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    data_path = os.path.join(HERE, "..", "public", "consult-data.json")
    hist_path = os.path.join(HERE, "..", "public", "brief-history.json")
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    today = datetime.now(CST).strftime("%Y-%m-%d")
    snap = {
        "date": today,
        "generatedAt": data.get("generatedAt"),
        "sections": data.get("sections", {}),
    }

    history = []
    if os.path.exists(hist_path):
        with open(hist_path, "r", encoding="utf-8") as f:
            history = json.load(f)

    # 同日去重后追加
    history = [s for s in history if s.get("date") != today]
    history.append(snap)
    history.sort(key=lambda x: x.get("date", ""))

    with open(hist_path, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)
    print(f"[done] brief-history.json · 追加 {today} · 现共 {len(history)} 天")


if __name__ == "__main__":
    main()
