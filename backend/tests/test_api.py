from __future__ import annotations

from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from backend.main import app, jobs


def test_rejects_invalid_file_type() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/lithophanes",
        data={"size": "Mini"},
        files={"image": ("bad.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 400


def test_valid_upload_creates_complete_job() -> None:
    jobs.clear()
    client = TestClient(app)
    response = client.post(
        "/api/lithophanes",
        data={"size": "Mini", "orientation": "Landscape"},
        files={"image": ("photo.png", _png_bytes(), "image/png")},
    )

    assert response.status_code == 202
    job_id = response.json()["jobId"]

    job_response = client.get(f"/api/lithophanes/{job_id}")
    payload = job_response.json()
    assert payload["status"] == "complete"
    assert payload["stlUrl"].endswith(".stl")
    assert payload["glbUrl"].endswith(".glb")
    assert payload["metadata"]["is_watertight"] is True
    assert payload["metadata"]["width_mm"] == 100.0
    assert payload["metadata"]["height_mm"] == 56.25


def _png_bytes() -> bytes:
    image = Image.new("RGB", (16, 12), color=(40, 120, 220))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
