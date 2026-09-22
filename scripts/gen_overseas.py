# -*- coding: utf-8 -*-
"""
海外资讯生成脚本
================
从 public/consult-data.json 中过滤出 lang=='en' 的外文条目，
整理为 public/overseas.json，供「资讯」栏目的「海外资讯」模块读取。

每个条目保留：title（原文）、titleZh（中文译文）、zhSummary（中文核心要点）、
url、source、date、lang。

用法：python gen_overseas.py
"""
import json
import os
from datetime import datetime, timezone, timedelta

CST = timezone(timedelta(hours=8))
HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    data_path = os.path.join(HERE, "..", "public", "consult-data.json")
    out = os.path.join(HERE, "..", "public", "overseas.json")
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    items = []
    for sec in data.get("sections", {}).values():
        for it in sec:
            # 仅纳入外文条目；显式标记 topic='general' 的泛财经等非宠物/医药内容不进海外资讯
            if it.get("lang") == "en" and it.get("topic") != "general":
                items.append(it)

    # 按日期降序（日期为空排最后）
    def keyf(it):
        return it.get("date", "")
    items.sort(key=keyf, reverse=True)

    payload = {
        "generatedAt": datetime.now(CST).strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "items": items,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"[done] overseas.json · {len(items)} 条外文译文")


if __name__ == "__main__":
    main()
