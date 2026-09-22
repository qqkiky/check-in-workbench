#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
move_to_ddrive.py
将指定目录下的所有数据文件递归移动到 D 盘目标文件夹。

特性:
  1. 递归处理子目录中的所有文件
  2. 移动前检查 D 盘剩余空间是否充足
  3. 在目标位置保留原始相对目录结构
  4. 遇到同名文件自动重命名 (追加 _1, _2 ... 后缀)
  5. 移动完成后输出操作日志 (CSV 文件 + 控制台摘要)
  6. 单文件出错时跳过并记录错误, 不中断整体流程

用法:
  python move_to_ddrive.py <源目录> <D盘目标目录> [选项]

选项:
  --dry-run            只模拟, 不真正移动 (用于预览将要进行的操作)
  --include EXT        仅移动指定扩展名, 逗号分隔, 如 .txt,.csv (默认: 全部文件)
  --force              即使 D 盘空间不足也继续移动
  --clean-empty-dirs   移动完成后删除源目录中已变空的文件夹
"""
import os
import sys
import shutil
import argparse
import csv
from datetime import datetime


def log(msg, level="INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}][{level}] {msg}")


def get_drive_free(target):
    """返回 target 所在磁盘的剩余字节数。"""
    drive = os.path.splitdrive(os.path.abspath(target))[0]
    root = (drive + os.sep) if drive else target
    try:
        return shutil.disk_usage(root).free
    except Exception:
        return shutil.disk_usage(target).free


def human(n):
    """把字节数转成可读字符串。"""
    f = float(n)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if f < 1024:
            return f"{f:.2f} {unit}"
        f /= 1024
    return f"{f:.2f} PB"


def scan_files(source, include):
    """递归收集待移动文件, 支持按扩展名过滤。"""
    exts = None
    if include:
        exts = {
            (e.lower() if e.startswith(".") else "." + e.lower())
            for e in include.split(",")
            if e.strip()
        }
    result = []
    for dirpath, _, filenames in os.walk(source):
        for name in filenames:
            if exts is not None:
                ext = os.path.splitext(name)[1].lower()
                if ext not in exts:
                    continue
            result.append(os.path.join(dirpath, name))
    return result


def unique_target(target):
    """若目标已存在则追加 _1/_2... 后缀, 返回不冲突的路径。"""
    if not os.path.exists(target):
        return target
    base, ext = os.path.splitext(target)
    i = 1
    while True:
        cand = f"{base}_{i}{ext}"
        if not os.path.exists(cand):
            return cand
        i += 1
        if i > 99999:
            cand = f"{base}_{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
            return cand


def main():
    ap = argparse.ArgumentParser(description="递归移动文件到 D 盘目标文件夹")
    ap.add_argument("source", help="源目录")
    ap.add_argument("target", help="D 盘目标目录")
    ap.add_argument("--dry-run", action="store_true", help="只模拟, 不移动")
    ap.add_argument("--include", help="仅移动这些扩展名, 逗号分隔, 如 .txt,.csv")
    ap.add_argument("--force", action="store_true", help="空间不足也继续移动")
    ap.add_argument(
        "--clean-empty-dirs",
        action="store_true",
        help="移动完成后删除源目录中已变空的文件夹",
    )
    args = ap.parse_args()

    source = os.path.abspath(args.source)
    target = os.path.abspath(args.target)

    # 1) 校验源目录
    if not os.path.isdir(source):
        log(f"源目录不存在: {source}", "ERROR")
        sys.exit(1)

    # 2) 校验目标在 D 盘 (Windows 下)
    drive = os.path.splitdrive(target)[0].upper()
    if os.name == "nt" and drive != "D:":
        log(f"目标目录必须在 D 盘 (当前: {drive or '未知'})", "ERROR")
        sys.exit(1)

    # 3) 防止目标位于源目录内部, 避免递归自包含
    nested = False
    try:
        nested = (
            os.path.commonpath([source, target]) == source
            or target.startswith(source + os.sep)
        )
    except ValueError:
        nested = False
    if nested:
        log("目标目录不能位于源目录内部, 已中止", "ERROR")
        sys.exit(1)

    # 4) 收集文件
    files = scan_files(source, args.include)
    total = len(files)
    log(f"扫描到 {total} 个文件")
    if total == 0:
        log("没有需要移动的文件, 退出")
        return

    # 5) 计算总大小
    total_size = 0
    for f in files:
        try:
            total_size += os.path.getsize(f)
        except OSError:
            pass
    log(f"待移动总大小: {human(total_size)}")

    # 6) 空间检查 (需求 2)
    free = get_drive_free(target)
    log(f"D 盘剩余空间: {human(free)}")
    if free < total_size:
        log(f"空间不足! 需要 {human(total_size)}, 仅剩 {human(free)}", "ERROR")
        if not args.force:
            log("可加 --force 忽略此检查并继续", "ERROR")
            sys.exit(1)
        log("已使用 --force, 继续移动", "WARN")

    # 7) 准备日志文件
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = os.path.join(os.getcwd(), f"move_log_{stamp}.csv")
    log_file = open(log_path, "w", newline="", encoding="utf-8-sig")
    writer = csv.writer(log_file)
    writer.writerow(["源路径", "目标路径", "状态", "错误信息"])

    moved = errors = 0

    # 8) 逐文件移动 (需求 1/3/4/6)
    for src in files:
        rel = os.path.relpath(src, source)
        dst = unique_target(os.path.join(target, rel))
        try:
            if args.dry_run:
                status = "DRY-RUN"
            else:
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.move(src, dst)  # 跨盘自动 copy+delete
                status = "MOVED"
                moved += 1
            writer.writerow([src, dst, status, ""])
        except Exception as e:  # 单文件失败: 记录并跳过
            errors += 1
            writer.writerow([src, dst, "ERROR", str(e)])
            log(f"失败: {src} -> {e}", "ERROR")

    log_file.close()

    # 9) 可选: 清理空目录
    if args.clean_empty_dirs and not args.dry_run:
        for dirpath, _dirnames, _filenames in os.walk(source, topdown=False):
            try:
                if not os.listdir(dirpath):
                    os.rmdir(dirpath)
            except Exception:
                pass

    # 10) 摘要 (需求 5)
    log("==== 完成 ====")
    log(f"成功移动: {moved} | 错误: {errors} | 总计: {total}")
    log(f"操作日志: {log_path}")


if __name__ == "__main__":
    main()
