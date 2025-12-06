## AI Resume/Skill JSON Extractor

Windows環境で、PDF/Word/Excel/TXT/画像(PNG/JPG/TIFF)から指定スキーマのJSONを抽出し、テキスト/DOCX/XLSX/テンプレートファイルを生成する FastAPI + React アプリです。


AI抽出時

https://github.com/user-attachments/assets/c812e6c2-b1b2-4fe4-9d43-9b4e9e25e9cc

データ加工時

https://github.com/user-attachments/assets/9bfbcaf0-ba59-49ba-ba07-c4995963491b



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

### セットアップ (frontend)
```powershell
cd frontend
npm install
npm run dev -- --host --port 3000
```
環境変数 `VITE_BACKEND_URL` を指定しなければ `http://localhost:8000` に向きます。

### エンドポイント
- `GET /health` … ヘルスチェック
- `POST /extract` … ファイルアップロード（複数可）→ 全ファイルを1件のJSONスキーマに要約して返却。PDF/Word/Excel/TXT/画像(PNG/JPG/TIFF)と、自由入力テキスト(`manual_text`)をサポート。`data/temp/<timestamp>/items.json` と `schema.json` を必ず保存します（`save_schema_file` は後方互換用）。モデルは `OPENAI_MODEL` またはクエリ `model` で上書き可能。
- 抽出時にスキーマへ「自分の強み」「自己PR」を自動生成して埋め込みます（OpenAI APIキーがある場合はChatGPTで生成し、キーが無い/失敗時は簡易ルールで補完。同名フィールドが既にあれば保持）。
- `GET /latest-schema` … `data/temp` 最新の `schema.json` を返却。
- `POST /generate/text` … スキーマからテキスト素案を生成し、`/download/{ts}/generated_text.txt` を返す。
- `POST /generate/resume` … スキーマから職務経歴書 DOCX を生成し、`/download/{ts}/resume.docx` を返す。
- `POST /generate/skill-sheet` … スキーマからスキルシート XLSX を生成し、`/download/{ts}/skill_sheet.xlsx` を返す。
- `POST /generate/temp-files` … スキーマを `data/temp/` のテンプレ固定名に書き出しつつ、同内容をタイムスタンプフォルダにも保存（`/download/{ts}/...` リンク同梱）。
- `GET /download/{ts}/{filename}` … タイムスタンプフォルダに保存されたファイルを取得。

リクエスト例（PowerShell）:
```powershell
$form = @{ files = Get-Item "c:\path\to\your.pdf" }
Invoke-WebRequest -Uri "http://localhost:8000/extract" -Method Post -Form $form | Select-Object -ExpandProperty Content
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

### 強み・自己PRの自動生成
- 抽出時、スキーマに「自分の強み」「自己PR」が無い場合は、抽出済みの役割/工程/環境/言語などから簡易文を自動生成して埋め込みます。
- フロントの「自分の強み」「自己PR」タブで手動上書き・保存できます（スキーマに反映）。

### DOCX テンプレ置換仕様（`data/temp/temp_職務経歴書.docx`）
テンプレを見つけた場合、そのスタイルを保持しながら以下の文字列を置換します（段落・表セルを対象、run分割も統合して置換）。テンプレは `backend/data/temp` かプロジェクト直下 `data/temp` のどちらに置いても可。

- 期間: `yyyy-mm〜yyyy-mm` / `yyyy年mm月dd日` / `<期間>` → 可能なら `YYYY年MM月～YYYY年MM月` に整形
- 案件名: `ZZZ` / `<ZZZ>` / `<案件名>`
- 勤務先: `name` / `<name>`
- 担当プロジェクト概要: `職務概要` / `<職務概要>` / `<担当プロジェクト概要>`
- 役割: `<役割・役職>` / `<役割>`
- 規模・人数: `<規模・人数>`（`チーム人数=..., 規模=...`）
- 業務内容・環境・言語・ツール・FW・ライブラリ: `<業務内容>` `<環境>` `<言語>` `<ツール>` `<フレームワーク>` `<ライブラリ>`
- 担当工程チェック: `<要件定義>` `<基本設計>` `<詳細設計>` `<実装>` `<単テスト>` `<結テスト>` `<保守運用>` → スキーマに含まれていれば `〇`、なければ空

### 期間の整形
- `2024-04〜2025-01` や `2024/4~2024/9` のような入力を `2024年04月～2025年01月` に整形。判別できない形式はそのまま残します。

### 保存場所
- 抽出: `data/temp/<timestamp>/items.json` と `schema.json` を毎回保存。
- 生成: `/generate/*` は `data/temp/<timestamp>/...` に成果物を置き、`/download/{ts}/...` で取得可能。
- テンプレ固定名: `/generate/temp-files` は `data/temp/` 直下に以下を上書きし、同内容をタイムスタンプフォルダへスナップショット保存。
	- `temp_職務経歴書_テキスト.txt`
	- `temp_スキルシート_テキスト.txt`
	- `temp_職務経歴書.docx`
	- `temp_スキルシート.xlsx`

### フロントエンド UI 操作フロー
1. **Extract**: ファイル選択または自由入力で送信 → スキーマを表示・保存。
2. **Text**: `/generate/text` でテキスト素案を生成、プレビューとダウンロードリンクを表示。
3. **Resume**: `/generate/resume` で職務経歴書 DOCX を生成しダウンロード。
4. **SkillSheet**: `/generate/skill-sheet` でスキルシート XLSX を生成しダウンロード。
5. **自分の強み**: 抽出済みスキーマに強みの文章を追記・編集し、スキーマへ保存。
6. **自己PR**: 自己PR文を下書きし、スキーマへ保存（後続のテンプレ適用時の素材として利用）。

### 今後の拡張の余地
- フロントエンド（React/TypeScript）によるアップロードUI
- OpenAI等を用いた精度向上・自由入力（自己PR/強み/職務経歴書自動生成）
- 項目ごとの正規化・辞書マッピング
