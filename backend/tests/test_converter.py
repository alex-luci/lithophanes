from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
import trimesh
from PIL import Image

from backend.converter import MAX_THICKNESS_MM, MIN_THICKNESS_MM, InvalidImageError, create_lithophane


@pytest.mark.parametrize(
    ("name", "size", "mode"),
    [
        ("tiny", (2, 2), "RGB"),
        ("wide", (80, 24), "RGB"),
        ("tall", (24, 80), "RGB"),
        ("gray", (40, 40), "L"),
    ],
)
def test_create_lithophane_outputs_watertight_files(tmp_path: Path, name: str, size: tuple[int, int], mode: str) -> None:
    result = create_lithophane(_image_bytes(size, mode), "Classic", tmp_path, name)

    assert result.stl_path.exists()
    assert result.glb_path.exists()
    assert result.metadata.is_watertight
    assert result.metadata.min_thickness_mm == MIN_THICKNESS_MM
    assert result.metadata.max_thickness_mm == MAX_THICKNESS_MM

    mesh = trimesh.load_mesh(result.stl_path)
    assert mesh.is_watertight
    assert mesh.bounds[0][2] >= 0
    assert mesh.bounds[1][2] <= MAX_THICKNESS_MM + 0.01
    assert pytest.approx(max(mesh.extents[0], mesh.extents[1]), abs=0.25) == 150.0


def test_invalid_image_raises(tmp_path: Path) -> None:
    with pytest.raises(InvalidImageError):
        create_lithophane(b"not an image", "Mini", tmp_path, "bad")


def _image_bytes(size: tuple[int, int], mode: str) -> bytes:
    image = Image.new(mode, size)
    pixels = image.load()
    width, height = size
    for y in range(height):
        for x in range(width):
            value = int(255 * (x + y) / max(1, width + height - 2))
            pixels[x, y] = value if mode == "L" else (value, 255 - value, value // 2)

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
