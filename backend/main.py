from fastapi import FastAPI, UploadFile, File, Query, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import json
from datetime import datetime
from dotenv import load_dotenv

from app.ingest import extract_text
from app.parser import parse_to_schema
from app.ai_extract import extract_with_openai

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
TEMP_DIR = os.path.join(DATA_DIR, "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

load_dotenv(os.path.join(BASE_DIR, ".env"))

app = FastAPI(title="Schema Extractor")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/extract")
async def extract(
    save_schema_file: bool = Query(False, description="Save schema-only JSON as schema.json"),
    model: str | None = Query(None, description="Override OpenAI model name (optional)"),
    files: List[UploadFile] | None = File(None),
    manual_text: str | None = Form(None, description="Optional free-form text input"),
):
    texts: List[str] = []
    file_records: List[dict] = []

    if files:
        for f in files:
            content = await f.read()
            text = extract_text(f.filename, content)
            texts.append(text)
            file_records.append({"filename": f.filename, "raw_text": text})

    if manual_text:
        texts.append(manual_text)
        file_records.append({"filename": "manual_input.txt", "raw_text": manual_text})

    if not texts:
        raise HTTPException(status_code=400, detail="No files or manual_text provided")

    ai_used = False
    ai_error = None
    model_used = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    try:
        prompt_texts = [f"# File: {rec['filename']}\n{rec['raw_text']}" for rec in file_records]
        schema = extract_with_openai(prompt_texts, model=model_used)
        ai_used = True
    except Exception as e:
        merged = "\n\n".join(texts)
        schema = parse_to_schema(merged)
        ai_error = str(e)

    result = {
        "status": "ok",
        "schema": schema,
        "ai_used": ai_used,
        "ai_error": ai_error,
        "model_used": model_used,
        "files": file_records,
    }

    # Save artifacts (schema and raw) per request
    try:
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        out_dir = os.path.join(TEMP_DIR, ts)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "items.json"), "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        if save_schema_file:
            with open(os.path.join(out_dir, "schema.json"), "w", encoding="utf-8") as f:
                json.dump({"schema": schema}, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
