#!/usr/bin/env python3
"""Validate cumulative news data before committing or deploying it."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SECTIONS = ("industry", "drug", "regulatory")
CST = timezone(timedelta(hours=8))


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_head_json(relative_path: str):
    result = subprocess.run(
        ["git", "show", f"HEAD:{relative_path}"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    return json.loads(result.stdout)


def fail(message: str) -> None:
    print(f"[error] {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> int:
    current = load_json(PUBLIC / "consult-data.json")
    sections = current.get("sections")
    if not isinstance(sections, dict):
        fail("consult-data.json 缺少 sections 对象")

    generated_at = current.get("generatedAt")
    if not isinstance(generated_at, str) or not generated_at:
        fail("consult-data.json 缺少 generatedAt")

    all_urls: set[str] = set()
    counts: dict[str, int] = {}
    for section in SECTIONS:
        items = sections.get(section)
        if not isinstance(items, list):
            fail(f"板块 {section} 不是数组")
        counts[section] = len(items)
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                fail(f"{section}[{index}] 不是对象")
            url = item.get("url")
            title = item.get("title")
            if not isinstance(url, str) or not url:
                fail(f"{section}[{index}] 缺少 URL")
            if not isinstance(title, str) or not title:
                fail(f"{section}[{index}] 缺少标题")
            if url in all_urls:
                fail(f"发现重复 URL：{url}")
            all_urls.add(url)

    baseline = load_head_json("public/consult-data.json")
    if baseline:
        old_sections = baseline.get("sections", {})
        for section in SECTIONS:
            old_urls = {
                item.get("url")
                for item in old_sections.get(section, [])
                if isinstance(item, dict) and item.get("url")
            }
            new_urls = {
                item.get("url")
                for item in sections.get(section, [])
                if isinstance(item, dict) and item.get("url")
            }
            missing = old_urls - new_urls
            if missing:
                fail(f"{section} 丢失 {len(missing)} 条历史资讯，停止部署")

    history = load_json(PUBLIC / "brief-history.json")
    if not isinstance(history, list) or not history:
        fail("brief-history.json 为空或格式错误")
    today = datetime.now(CST).strftime("%Y-%m-%d")
    if not any(item.get("date") == today for item in history if isinstance(item, dict)):
        fail(f"brief-history.json 未包含今日快照 {today}")

    monthly = load_json(PUBLIC / "monthly-summary.json")
    overseas = load_json(PUBLIC / "overseas.json")
    weekly = load_json(PUBLIC / "weekly-summary.json")
    if not isinstance(monthly.get("months"), dict):
        fail("monthly-summary.json 格式错误")
    if not isinstance(overseas.get("items"), list):
        fail("overseas.json 格式错误")
    if not isinstance(weekly.get("sections"), dict):
        fail("weekly-summary.json 格式错误")

    summary = (
        "## 国内资讯自动更新\n\n"
        f"- 生成时间：{generated_at}\n"
        f"- 行业动态：{counts['industry']} 条\n"
        f"- 药品信息：{counts['drug']} 条\n"
        f"- 监管动态：{counts['regulatory']} 条\n"
        f"- 历史快照：{len(history)} 天\n"
        f"- 海外历史数据：{len(overseas['items'])} 条（本任务不新增）\n"
    )
    print(summary)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
