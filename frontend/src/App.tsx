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
        borderRadius: 999,
        border: isActive(tab) ? '1px solid #0ea5e9' : '1px solid #d0d7de',
        background: isActive(tab)
          ? 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%)'
          : '#f8fafc',
        color: isActive(tab) ? '#fff' : '#0f172a',
        cursor: 'pointer',
        fontWeight: 700,
        boxShadow: isActive(tab) ? '0 8px 18px rgba(14,165,233,0.25)' : 'none',
      }}
    >
      {label}
    </button>
  );

  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: 18,
    boxShadow: '0 12px 28px rgba(15,23,42,0.06)',
    position: 'relative',
    overflow: 'hidden',
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

  const pageStyle: React.CSSProperties = {
    maxWidth: 1150,
    margin: '32px auto',
    padding: '0 20px 48px',
    fontFamily: '"Space Grotesk", "Segoe UI", "Hiragino Sans", sans-serif',
  };

  const hero: React.CSSProperties = {
    background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 50%, #a855f7 100%)',
    color: '#fff',
    borderRadius: 18,
    padding: '18px 20px',
    boxShadow: '0 18px 30px rgba(14,165,233,0.28)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  const backdrop: React.CSSProperties = {
    background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 35%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.12), transparent 30%), radial-gradient(circle at 60% 80%, rgba(255,255,255,0.12), transparent 25%)',
    inset: 0,
    position: 'absolute',
    pointerEvents: 'none',
  };

  const primaryBtn: React.CSSProperties = {
    padding: '9px 14px',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(34,197,94,0.35)',
  };

  return (
    <div style={{ background: 'linear-gradient(180deg, #f4f7fb 0%, #e9eff7 100%)', minHeight: '100vh' }}>
      <div style={pageStyle}>
        <div style={hero}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.7 }}>
            <div style={backdrop} />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ margin: 0, letterSpacing: 0.2, fontSize: 22 }}>AI Resume & SkillSheet</h2>
            <div style={{ marginTop: 4, opacity: 0.92, fontWeight: 600 }}>
              抽出 → テキスト → 職務経歴書 → スキルシート → 自分の強み → 自己PR
            </div>
          </div>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {navBtn('extract', 'Extract')}
            {navBtn('text', 'Text')}
            {navBtn('resume', 'Resume')}
            {navBtn('skill', 'SkillSheet')}
            {navBtn('strengths', '自分の強み')}
            {navBtn('selfpr', '自己PR')}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>

      {error && <div style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</div>}

      {isActive('extract') && (
        <div style={card}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(125,211,252,0.04) 60%, rgba(59,130,246,0.06) 100%)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
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
                style={primaryBtn}
              >
                {loading['upload'] ? '抽出中…' : '抽出する'}
              </button>
              <button onClick={() => setFiles([])} disabled={!files.length || busy} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff' }}>
                クリア
              </button>
              <button onClick={loadLatestSchema} disabled={busy} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff' }}>
                最新のスキーマを呼び出す
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="manualText" style={{ fontWeight: 700 }}>自由入力（テキスト直接貼り付け）</label>
              <textarea
                id="manualText"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={8}
                style={{ width: '100%', marginTop: 8, padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc' }}
                placeholder="職務経歴や業務内容を貼り付け。ファイルなしでも送信できます。"
              />
            </div>

            {files.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <strong>選択中のファイル ({files.length})</strong>
                <ul style={{ paddingLeft: 16 }}>
                  {files.map((f) => {
                    const key = `${f.name}-${f.size}-${f.lastModified}`;
                    const kb = Math.max(1, Math.round(f.size / 1024));
                    return (
                      <li key={key} style={{ marginTop: 6 }}>
                        {f.name} ({kb} KB)
                        <button onClick={() => removeFile(key)} style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }} disabled={busy}>
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
                <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 12, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                  {JSON.stringify(schema, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {isActive('text') && (
        <div style={card}>
          <div style={sectionTitle}>2. テキスト生成</div>
          <p style={{ marginTop: 0, color: '#475569' }}>スキーマからテキスト素案を作ります（preview）。生成前でも強み/自己PRを確認できます。</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button onClick={() => triggerGen('/generate/text', 'text')} disabled={busy} style={primaryBtn}>
              テキスト生成
            </button>
            <button onClick={loadLatestSchema} disabled={busy} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff' }}>
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
            <button onClick={() => triggerGen('/generate/resume', 'resume_docx')} disabled={busy} style={primaryBtn}>
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
            <button onClick={() => triggerGen('/generate/skill-sheet', 'skill_xlsx')} disabled={busy} style={primaryBtn}>
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
            style={{ width: '100%', marginTop: 8, padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc' }}
            placeholder="例: セキュリティ設計とID管理領域での経験、要件定義〜結合テストまでの一貫対応..."
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              onClick={() => setSchema((prev: any) => ({ ...(prev || {}), '自分の強み': strengths }))}
              disabled={!schema || busy}
              style={primaryBtn}
            >
              スキーマに保存
            </button>
            <button onClick={loadLatestSchema} disabled={busy} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff' }}>
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
            style={{ width: '100%', marginTop: 8, padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', background: '#f8fafc' }}
            placeholder="例: ID基盤の設計・構築に強みがあり、要件定義から移行までリードした経験..."
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button
              onClick={() => setSchema((prev: any) => ({ ...(prev || {}), '自己PR': selfPr }))}
              disabled={!schema || busy}
              style={primaryBtn}
            >
              スキーマに保存
            </button>
            <button onClick={loadLatestSchema} disabled={busy} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff' }}>
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
                <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 12, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
