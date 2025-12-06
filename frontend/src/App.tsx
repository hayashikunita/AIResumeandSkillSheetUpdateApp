import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

type Tab = 'extract' | 'text' | 'resume' | 'skill' | 'strengths' | 'selfpr';

type GenResponse = {
  download_path?: string;
  text?: string;
};

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [schema, setSchema] = useState<any | null>(null);
  const [schemaTs, setSchemaTs] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [manualText, setManualText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('extract');
  const [textPreview, setTextPreview] = useState<string>('');
  const [downloads, setDownloads] = useState<Record<string, string>>({});
  const [strengths, setStrengths] = useState<string>('');
  const [selfPr, setSelfPr] = useState<string>('');

  const busy = useMemo(() => Object.values(loading).some(Boolean), [loading]);

  const setBusy = (key: string, val: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: val }));
  };

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

  // Sync strengths/selfPR from schema when it updates
  useEffect(() => {
    if (!schema) return;
    if (schema['自分の強み'] && typeof schema['自分の強み'] === 'string') {
      setStrengths(schema['自分の強み']);
    }
    if (schema['自己PR'] && typeof schema['自己PR'] === 'string') {
      setSelfPr(schema['自己PR']);
    }
  }, [schema]);

  const onUpload = async () => {
    setBusy('upload', true);
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
      setSchema(res.data.schema ?? res.data);
      setSchemaTs(res.data.timestamp ?? null);
      setActiveTab('text');
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      setError(`Upload failed status=${status ?? 'unknown'}`);
      console.error('extract error', { status, data, error: e });
    } finally {
      setBusy('upload', false);
    }
  };

  const loadLatestSchema = async () => {
    setBusy('latest', true);
    setError(null);
    try {
      const res = await axios.get(`${backend}/latest-schema`);
      setSchema(res.data.schema);
      setSchemaTs(res.data.timestamp ?? null);
      setResult(res.data);
    } catch (e: any) {
      setError('最新のスキーマを取得できませんでした');
    } finally {
      setBusy('latest', false);
    }
  };

  const triggerGen = async (path: string, key: string) => {
    setBusy(key, true);
    setError(null);
    try {
      const body = schema ? { schema } : {};
      const res = await axios.post<GenResponse>(`${backend}${path}`, body);
      if (res.data.text) {
        setTextPreview(res.data.text);
      }
      if (res.data.download_path) {
        setDownloads((prev) => ({ ...prev, [key]: res.data.download_path as string }));
      }
      // /generate/temp-files returns multiple download paths
      const anyPaths = (res.data as any).download_paths;
      if (anyPaths) {
        setDownloads((prev) => ({ ...prev, ...anyPaths }));
      }
    } catch (e: any) {
      setError(`生成に失敗しました (${key})`);
    } finally {
      setBusy(key, false);
    }
  };

  const isActive = (tab: Tab) => tab === activeTab;

  const navBtn = (tab: Tab, label: string) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        border: isActive(tab) ? '1px solid #0f766e' : '1px solid #d0d7de',
        background: isActive(tab) ? '#0f766e' : '#f8fafc',
        color: isActive(tab) ? '#fff' : '#0f172a',
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 18,
    marginBottom: 8,
    fontWeight: 700,
  };

  const smallInfo = (label: string, value?: string | null) => (
    <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
      <strong>{label}</strong>: {value || '—'}
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: '32px auto', padding: '0 20px', fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>AI Resume & SkillSheet</h2>
          <div style={{ color: '#475569', marginTop: 4 }}>抽出 → テキスト → 職務経歴書 → スキルシート → 自分の強み → 自己PR</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {navBtn('extract', 'Extract')}
          {navBtn('text', 'Text')}
          {navBtn('resume', 'Resume')}
          {navBtn('skill', 'SkillSheet')}
          {navBtn('strengths', '自分の強み')}
          {navBtn('selfpr', '自己PR')}
        </div>
      </div>

      {error && <div style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</div>}

      {isActive('extract') && (
        <div style={card}>
          <div style={sectionTitle}>1. データ抽出</div>
          <p style={{ marginTop: 0, color: '#475569' }}>PDF/Word/Excel/TXT/画像から1案件分の情報を抽出し、スキーマJSONを生成します。</p>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              multiple
              onChange={(e) => upsertFiles(e.target.files)}
              accept=".pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg,.bmp,.tif,.tiff"
            />
            <button
              onClick={onUpload}
              disabled={(!files.length && !manualText.trim()) || busy}
              style={{ padding: '8px 12px' }}
            >
              {loading['upload'] ? '抽出中…' : '抽出する'}
            </button>
            <button onClick={() => setFiles([])} disabled={!files.length || busy} style={{ padding: '8px 12px' }}>
              クリア
            </button>
            <button onClick={loadLatestSchema} disabled={busy} style={{ padding: '8px 12px' }}>
              最新のスキーマを呼び出す
            </button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="manualText"><strong>自由入力（テキスト直接貼り付け）</strong></label>
            <textarea
              id="manualText"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={8}
              style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
              placeholder="職務経歴や業務内容を貼り付け。ファイルなしでも送信できます。"
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
                      <button onClick={() => removeFile(key)} style={{ marginLeft: 8 }} disabled={busy}>
                        削除
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {schema && (
            <div style={{ marginTop: 12 }}>
              <strong>抽出スキーマ</strong>
              {smallInfo('timestamp', schemaTs)}
              <pre style={{ background: '#f8fafc', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(schema, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {isActive('text') && (
        <div style={card}>
          <div style={sectionTitle}>2. テキスト生成</div>
          <p style={{ marginTop: 0, color: '#475569' }}>スキーマからテキスト素案を作ります（pre-view）。</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button onClick={() => triggerGen('/generate/text', 'text')} disabled={busy} style={{ padding: '8px 12px' }}>
              テキスト生成
            </button>
            <button onClick={loadLatestSchema} disabled={busy} style={{ padding: '8px 12px' }}>
              最新スキーマ読み込み
            </button>
            {downloads['text'] && (
              <a href={`${backend}${downloads['text']}`} style={{ padding: '8px 12px' }} target="_blank" rel="noreferrer">
                テキストをダウンロード
              </a>
            )}
          </div>
          {smallInfo('スキーマ timestamp', schemaTs)}
          {textPreview && (
            <pre style={{ background: '#f8fafc', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{textPreview}</pre>
          )}
          {!textPreview && (schema?.['自分の強み'] || schema?.['自己PR']) && (
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, display: 'grid', gap: 8 }}>
              {schema?.['自分の強み'] && (
                <div>
                  <strong>自分の強み</strong>
                  <div style={{ marginTop: 4, color: '#0f172a', whiteSpace: 'pre-wrap' }}>{schema['自分の強み']}</div>
                </div>
              )}
              {schema?.['自己PR'] && (
                <div>
                  <strong>自己PR</strong>
                  <div style={{ marginTop: 4, color: '#0f172a', whiteSpace: 'pre-wrap' }}>{schema['自己PR']}</div>
                </div>
              )}
            </div>
          )}
          {!textPreview && schema && (
            <pre style={{ background: '#f8fafc', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(schema, null, 2)}
            </pre>
          )}
        </div>
      )}

      {isActive('resume') && (
        <div style={card}>
          <div style={sectionTitle}>3. 職務経歴書 (DOCX)</div>
          <p style={{ marginTop: 0, color: '#475569' }}>スキーマから職務経歴書の雛形を作成します。</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button onClick={() => triggerGen('/generate/resume', 'resume_docx')} disabled={busy} style={{ padding: '8px 12px' }}>
              DOCX生成
            </button>
            {downloads['resume_docx'] && (
              <a href={`${backend}${downloads['resume_docx']}`} style={{ padding: '8px 12px' }} target="_blank" rel="noreferrer">
                DOCXをダウンロード
              </a>
            )}
          </div>
          {smallInfo('スキーマ timestamp', schemaTs)}
          {!schema && <div style={{ color: '#475569' }}>先に抽出または「最新スキーマを呼び出す」を実行してください。</div>}
        </div>
      )}

      {isActive('skill') && (
        <div style={card}>
          <div style={sectionTitle}>4. スキルシート (XLSX)</div>
          <p style={{ marginTop: 0, color: '#475569' }}>スキーマからスキルシートを生成します。</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button onClick={() => triggerGen('/generate/skill-sheet', 'skill_xlsx')} disabled={busy} style={{ padding: '8px 12px' }}>
              XLSX生成
            </button>
            {downloads['skill_xlsx'] && (
              <a href={`${backend}${downloads['skill_xlsx']}`} style={{ padding: '8px 12px' }} target="_blank" rel="noreferrer">
                XLSXをダウンロード
              </a>
            )}
          </div>
          {smallInfo('スキーマ timestamp', schemaTs)}
          {!schema && <div style={{ color: '#475569' }}>先に抽出または「最新スキーマを呼び出す」を実行してください。</div>}
        </div>
      )}

      {isActive('strengths') && (
        <div style={card}>
          <div style={sectionTitle}>5. 自分の強み</div>
          <p style={{ marginTop: 0, color: '#475569' }}>抽出結果に追記したい「強み」をここで編集し、スキーマに保存します。</p>
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            rows={8}
            style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
            placeholder="例: セキュリティ設計とID管理領域での経験、要件定義〜結合テストまでの一貫対応..."
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              onClick={() => setSchema((prev: any) => ({ ...(prev || {}), '自分の強み': strengths }))}
              disabled={!schema || busy}
              style={{ padding: '8px 12px' }}
            >
              スキーマに保存
            </button>
            <button onClick={loadLatestSchema} disabled={busy} style={{ padding: '8px 12px' }}>
              最新スキーマを呼び出す
            </button>
          </div>
          {smallInfo('スキーマ timestamp', schemaTs)}
        </div>
      )}

      {isActive('selfpr') && (
        <div style={card}>
          <div style={sectionTitle}>6. 自己PR</div>
          <p style={{ marginTop: 0, color: '#475569' }}>自己PR文を下書きし、スキーマに保存します。必要に応じて履歴書/DOCXやスキルシートに組み込む際の素材として活用できます。</p>
          <textarea
            value={selfPr}
            onChange={(e) => setSelfPr(e.target.value)}
            rows={10}
            style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
            placeholder="例: ID基盤の設計・構築に強みがあり、要件定義から移行までリードした経験..."
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              onClick={() => setSchema((prev: any) => ({ ...(prev || {}), '自己PR': selfPr }))}
              disabled={!schema || busy}
              style={{ padding: '8px 12px' }}
            >
              スキーマに保存
            </button>
            <button onClick={loadLatestSchema} disabled={busy} style={{ padding: '8px 12px' }}>
              最新スキーマを呼び出す
            </button>
          </div>
          {smallInfo('スキーマ timestamp', schemaTs)}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...card, marginTop: 12 }}>
            <div style={sectionTitle}>レスポンス詳細</div>
            <pre style={{ background: '#f8fafc', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
