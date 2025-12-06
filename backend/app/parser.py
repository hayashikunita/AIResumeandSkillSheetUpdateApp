import re
from typing import Dict, List


def sanitize(text: str) -> str:
    if text is None:
        return ""
    return "".join(ch for ch in text if (ord(ch) >= 32 or ch in "\n\r\t"))


def split_lines(text: str) -> List[str]:
    lines = []
    for ln in text.splitlines():
        ln = ln.strip().lstrip("・")
        if ln:
            lines.append(ln)
    return lines


def parse_sections(text: str) -> Dict[str, str]:
    sections = {}
    if not text:
        return sections
    # pattern like 【見出し】
    pattern = r"【([^】]+)】"
    matches = list(re.finditer(pattern, text))
    for idx, m in enumerate(matches):
        title = m.group(1)
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        sections[title] = body
    return sections


def parse_to_schema(text: str) -> Dict[str, object]:
    text = sanitize(text or "")
    sections = parse_sections(text)

    def get_str(key: str) -> str:
        return sections.get(key, "").strip() or "未設定"

    def get_arr(key: str) -> List[str]:
        body = sections.get(key, "").strip()
        if not body:
            return []
        return split_lines(body)

    scale_raw = sections.get("規模・人数", "").strip()
    scale_obj = {
        "チーム人数": "Z人",
        "規模": "Z規模",
    }
    if scale_raw:
        lines = split_lines(scale_raw)
        for ln in lines:
            if "チーム人数" in ln:
                scale_obj["チーム人数"] = ln.split(":")[-1].strip()
            if "規模" in ln:
                scale_obj["規模"] = ln.split(":")[-1].strip()

    schema = {
        "期間": get_str("期間"),
        "担当プロジェクト概要": get_str("担当プロジェクト概要"),
        "勤務先": get_str("勤務先"),
        "案件名": get_str("案件名"),
        "業務内容": get_str("業務内容"),
        "環境": get_arr("環境"),
        "言語": get_arr("言語"),
        "ツール": get_arr("ツール"),
        "フレームワーク": get_arr("フレームワーク"),
        "ライブラリ": get_arr("ライブラリ"),
        "規模・人数": scale_obj,
        "役割・役職": get_str("役割・役職"),
        "担当工程：要件定義、基本設計、詳細設計、実装、単テスト、結テスト、保守運用": get_arr("担当工程：要件定義、基本設計、詳細設計、実装、単テスト、結テスト、保守運用"),
    }
    return schema
