from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .converter import InvalidImageError, LampSize, create_lithophane

JobStatus = Literal["queued", "processing", "complete", "failed"]

ROOT_DIR = Path(__file__).resolve().parent.parent
GENERATED_DIR = ROOT_DIR / "generated"
GENERATED_DIR.mkdir(exist_ok=True)

app = FastAPI(title="LumaRelief Lithophane API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")

executor = ThreadPoolExecutor(max_workers=2)
jobs: dict[str, dict] = {}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/lithophanes", status_code=202)
async def create_lithophane_job(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    size: LampSize = Form(...),
) -> dict[str, str]:
    if image.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=400, detail="Only JPG and PNG uploads are supported")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image file is empty")

    job_id = uuid4().hex
    jobs[job_id] = {"jobId": job_id, "status": "queued"}
    background_tasks.add_task(_submit_conversion, job_id, image_bytes, size)
    return {"jobId": job_id, "status": "queued"}


@app.get("/api/lithophanes/{job_id}")
def get_lithophane_job(job_id: str) -> dict:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _submit_conversion(job_id: str, image_bytes: bytes, size: LampSize) -> None:
    jobs[job_id] = {"jobId": job_id, "status": "processing"}
    future = executor.submit(create_lithophane, image_bytes, size, GENERATED_DIR, job_id)

    try:
        result = future.result()
    except InvalidImageError as exc:
        jobs[job_id] = {"jobId": job_id, "status": "failed", "error": str(exc)}
    except Exception:
        jobs[job_id] = {"jobId": job_id, "status": "failed", "error": "Lithophane generation failed"}
    else:
        jobs[job_id] = {
            "jobId": job_id,
            "status": "complete",
            "stlUrl": f"/generated/{result.stl_path.name}",
            "glbUrl": f"/generated/{result.glb_path.name}",
            "metadata": asdict(result.metadata),
        }
