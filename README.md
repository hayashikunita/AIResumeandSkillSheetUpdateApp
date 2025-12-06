## AI Resume/Skill JSON Extractor

Windows環境で、PDF/Word/Excel/TXT/画像(PNG/JPG/TIFF)から指定のJSONスキーマに沿った情報を抽出するFastAPIバックエンドの最小構成です。

### セットアップ (backend)
```powershell
python -m venv .venv
./.venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

画像OCRを使う場合は Tesseract 本体が必要です (pytesseractが呼び出します)。例: Chocolatey を使用する場合
```powershell
choco install tesseract
```
インストール後に PowerShell を再起動してください。

### エンドポイント
- `GET /health` … ヘルスチェック
- `POST /extract` … ファイルアップロード（複数可）→ 全ファイルをまとめて1件のJSONスキーマに要約して返却。原則 1 案件分のみを入力してください。PDF/Word/Excel/TXT/画像(PNG/JPG/TIFF)と、自由入力テキスト(`manual_text`)をサポート。クエリ `save_schema_file=true` を付けると、`data/temp/<timestamp>/schema.json` にスキーマだけを書き出します（通常の `items.json` も残ります）。モデルは環境変数 `OPENAI_MODEL`（例: gpt-4o-mini / gpt-4.1 / o4-mini）またはクエリ `model` で上書きできます。

リクエスト例（PowerShell）:
```powershell
$form = @{ files = Get-Item "c:\path\to\your.pdf" }
Invoke-WebRequest -Uri "http://localhost:8000/extract" -Method Post -Form $form | Select-Object -ExpandProperty Content
```

スキーマだけのファイルも保存したい場合（PowerShell例）:
```powershell
$form = @{ files = Get-Item "c:\path\to\your.pdf" }
Invoke-WebRequest -Uri "http://localhost:8000/extract?save_schema_file=true" -Method Post -Form $form | Select-Object -ExpandProperty Content
```

自由入力テキストだけで送る場合（PowerShell例）:
```powershell
$form = @{ manual_text = "ここに職務経歴テキスト" }
Invoke-WebRequest -Uri "http://localhost:8000/extract" -Method Post -Form $form | Select-Object -ExpandProperty Content
```

モデルを切り替えたい場合（PowerShell例）:
```powershell
$form = @{ files = Get-Item "c:\path\to\your.pdf" }
Invoke-WebRequest -Uri "http://localhost:8000/extract?model=gpt-4.1" -Method Post -Form $form | Select-Object -ExpandProperty Content
```

レスポンス例:
```json
{
	"status": "ok",
	"schema": {
		"期間": "…",
		"担当プロジェクト概要": "…",
		"勤務先": "…",
		"案件名": "…",
		"業務内容": "…",
		"環境": ["…"],
		"言語": ["…"],
		"ツール": ["…"],
		"フレームワーク": ["…"],
		"ライブラリ": ["…"],
		"規模・人数": {"チーム人数": "…", "規模": "…"},
		"役割・役職": "…",
		"担当工程：要件定義、基本設計、詳細設計、実装、単テスト、結テスト、保守運用": ["…"]
	},
	"files": [
		{"filename": "your.pdf", "raw_text": "抽出したプレーンテキスト"}
	],
	"ai_used": true,
	"model_used": "gpt-4.1"
}
```

### スキーマについて
すべてのrequiredフィールドを必ず返却します（期間/担当プロジェクト概要/勤務先/案件名/業務内容/環境/言語/ツール/フレームワーク/ライブラリ/規模・人数/役割・役職/担当工程）。項目が抽出できない場合はプレースホルダー（例: "未設定" や空配列）で埋めます。

### 今後の拡張の余地
- フロントエンド（React/TypeScript）によるアップロードUI
- OpenAI等を用いた精度向上・自由入力（自己PR/強み/職務経歴書自動生成）
- 項目ごとの正規化・辞書マッピング
