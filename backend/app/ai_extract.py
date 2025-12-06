import os
import json
from typing import Dict, List, Optional
from openai import OpenAI
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SCHEMA_JSON = {
    "type": "object",
    "properties": {
        "期間": {"type": "string"},
        "担当プロジェクト概要": {"type": "string"},
        "勤務先": {"type": "string"},
        "案件名": {"type": "string"},
        "業務内容": {"type": "string"},
        "環境": {"type": "array", "items": {"type": "string"}},
        "言語": {"type": "array", "items": {"type": "string"}},
        "ツール": {"type": "array", "items": {"type": "string"}},
        "フレームワーク": {"type": "array", "items": {"type": "string"}},
        "ライブラリ": {"type": "array", "items": {"type": "string"}},
        "規模・人数": {
            "type": "object",
            "properties": {
                "チーム人数": {"type": "string"},
                "規模": {"type": "string"}
            },
            "required": ["チーム人数", "規模"]
        },
        "役割・役職": {"type": "string"},
        "担当工程：要件定義、基本設計、詳細設計、実装、単テスト、結テスト、保守運用": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": ["要件定義", "基本設計", "詳細設計", "実装", "単体テスト", "結合テスト", "保守運用"]
            }
        }
    },
    "required": [
        "期間",
        "担当プロジェクト概要",
        "勤務先",
        "案件名",
        "業務内容",
        "環境",
        "言語",
        "ツール",
        "フレームワーク",
        "ライブラリ",
        "規模・人数",
        "役割・役職",
        "担当工程：要件定義、基本設計、詳細設計、実装、単テスト、結テスト、保守運用"
    ]
}

SYSTEM_PROMPT = """
You are an assistant that extracts Japanese project experience into the given JSON schema. Rules:
- Focus on職務経歴/プロジェクト情報のみ。資格・自己PR・スキル羅列は無視または補助として扱う。
- 期間は西暦の年月範囲（例: 2022-04〜2023-03）を優先。見つからなければ"未設定"。
- 担当プロジェクト概要は1-2行で要約。
- 勤務先（会社名/部署）は分かれば1行で。なければ"未設定"。
- 案件名は必ず箇条書きで（1件でも行頭に「・」を付ける）。プロジェクト名がなければ"未設定"。
- 業務内容は各案件ごとに対応する内容を箇条書き(「・」)で1-5行にまとめる。行頭に必ず「・」を付け、不要な前置きや資格列挙は入れない。
- 複数案件が含まれる場合、案件名と業務内容は同じ行順・件数で対応させる。件数が合わない場合は主要案件に対応する業務内容だけ残し、余分な行は捨てる。
- 環境/言語/ツール/フレームワーク/ライブラリは実際に使用された主要なものを短く列挙。関係ない箇条書きは含めない。
- 規模・人数は分かる範囲で。なければ {"チーム人数": "Z人", "規模": "Z規模"}。
- 役割・役職は"開発者"など短く。
- 担当工程は enum 値のみを配列で。なければ空配列。
- JSONのみ返す。説明は禁止。"""

USER_PROMPT_TEMPLATE = """
以下のテキスト群は複数ファイルからの抽出結果です。職務経歴/プロジェクトに関する情報だけを使い、次のスキーマでJSONを返してください。資格や自己PRなど職務外の情報は含めないでください。JSONのみ返し、説明文は禁止です。

スキーマ:
{schema}

テキスト:
{text}
"""


def extract_with_openai(texts: List[str], model: Optional[str] = None) -> Dict:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")

    client = OpenAI(api_key=api_key)
    merged = "\n\n".join(t for t in texts if t)
    prompt = USER_PROMPT_TEMPLATE.format(schema=json.dumps(SCHEMA_JSON, ensure_ascii=False), text=merged)

    model_name = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    req_kwargs = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    }
    # gpt-5系はtemperature固定のため指定しない
    if not model_name.lower().startswith("gpt-5"):
        req_kwargs["temperature"] = 0.1

    resp = client.chat.completions.create(**req_kwargs)
    content = resp.choices[0].message.content or "{}"
    try:
        return json.loads(content)
    except Exception as e:
        # propagate with context so caller can log/fallback
        raise ValueError(f"OpenAI returned non-JSON response: {content[:200]}") from e
