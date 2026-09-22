# -*- coding: utf-8 -*-
"""
将国际监管源（FDA / EMA）抓取到的条目合并进 consult-data.json 的 regulatory 板块。
输入 items.json 为数组：[{ "title":..., "url":..., "source":..., "date":..., "summary":... }]
去重依据 url；已存在则跳过。

用法：
  python merge_international.py --data public/consult-data.json --items items.json
"""
import argparse
import json
import os


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--items", required=True)
    args = ap.parse_args()

    with open(args.data, "r", encoding="utf-8") as f:
        data = json.load(f)
    with open(args.items, "r", encoding="utf-8") as f:
        new_items = json.load(f)

    reg = data.setdefault("sections", {}).setdefault("regulatory", [])
    existing = {it.get("url") for it in reg}
    added = 0
    for it in new_items:
        url = it.get("url")
        if not url or url in existing:
            continue
        reg.append({
            "title": it.get("title", "").strip(),
            "summary": it.get("summary", "")[:160],
            "url": url,
            "source": it.get("source", "FDA/EMA"),
            "date": it.get("date", ""),
        })
        existing.add(url)
        added += 1

    with open(args.data, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[ok] 合并国际监管 {added} 条（regulatory 现共 {len(reg)} 条）")


if __name__ == "__main__":
    main()
