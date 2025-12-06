import React, { useState } from 'react';
import axios from 'axios';

const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualText, setManualText] = useState<string>("");

  const upsertFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    setFiles((prev) => {
      const merged = [...prev, ...incoming];
      const seen = new Set<string>();
      const uniq: File[] = [];
      for (const f of merged) {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniq.push(f);
        }
      }
      return uniq;
    });
  };

  const removeFile = (key: string) => {
    setFiles((prev) => prev.filter((f) => `${f.name}-${f.size}-${f.lastModified}` !== key));
  };

  const onUpload = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      if (manualText.trim()) {
        form.append('manual_text', manualText.trim());
      }
      const res = await axios.post(`${backend}/extract`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      setError(`Upload failed status=${status ?? 'unknown'}`);
      console.error('extract error', { status, data, error: e });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h2>Schema Extractor (FastAPI + React)</h2>
      <p>PDF/Word/Excel/TXT/画像(PNG/JPG/TIFF)から指定スキーマのJSONを抽出します。複数ファイルを一度にアップロードできます。</p>
      <p style={{ color: '#444' }}>※ 原則 1 案件分のみで入力してください。単一のスキーマとして出力されます。</p>

      <div style={{ marginBottom: 12 }}>
        <input
          type="file"
          multiple
          onChange={(e) => upsertFiles(e.target.files)}
          accept=".pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg,.bmp,.tif,.tiff"
        />
        <button onClick={onUpload} disabled={(!files.length && !manualText.trim()) || loading} style={{ marginLeft: 8 }}>
          {loading ? '抽出中…' : '抽出する'}
        </button>
        <button onClick={() => setFiles([])} disabled={!files.length || loading} style={{ marginLeft: 8 }}>
          クリア
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="manualText"><strong>自由入力（テキストを直接貼り付け）</strong></label>
        <textarea
          id="manualText"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          rows={8}
          style={{ width: '100%', marginTop: 8, padding: 8 }}
          placeholder="ここに職務経歴や業務内容を直接記入できます。1案件分のみで入力してください。ファイルがなくても送信できます。"
        />
      </div>

      {files.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <strong>選択中のファイル ({files.length})</strong>
          <ul>
            {files.map((f) => {
              const key = `${f.name}-${f.size}-${f.lastModified}`;
              const kb = Math.max(1, Math.round(f.size / 1024));
              return (
                <li key={key}>
                  {f.name} ({kb} KB)
                  <button onClick={() => removeFile(key)} style={{ marginLeft: 8 }} disabled={loading}>
                    削除
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && <div style={{ color: 'red' }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 16 }}>
          <h3>結果</h3>
          <div style={{ marginTop: 12 }}>
            <strong>スキーマ</strong>
            <pre style={{ background: '#f7f7f7', padding: 12, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(result.schema ?? result, null, 2)}
            </pre>
          </div>
          <div style={{ marginTop: 12 }}>
            <strong>レスポンス全体</strong>
            <pre style={{ background: '#f7f7f7', padding: 12, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
