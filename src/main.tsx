import React, { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUp,
  BadgeCheck,
  Check,
  ClipboardList,
  Gift,
  ImagePlus,
  LampDesk,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { LithophaneViewer } from "./LithophaneViewer";
import "./styles.css";

type LampSize = "Small" | "Medium" | "Large";
type LightTone = "Warm" | "Soft white" | "Amber";
type Orientation = "Portrait" | "Landscape" | "Square";
type JobStatus = "idle" | "ready" | "uploading" | "queued" | "processing" | "complete" | "failed";
type CropState = { zoom: number; panX: number; panY: number };
type ImageSize = { width: number; height: number };

type LithophaneJob = {
  jobId: string;
  status: Exclude<JobStatus, "idle" | "ready" | "uploading">;
  stlUrl?: string;
  glbUrl?: string;
  error?: string;
  metadata?: {
    width_mm: number;
    height_mm: number;
    min_thickness_mm: number;
    max_thickness_mm: number;
    vertices: number;
    faces: number;
    is_watertight: boolean;
  };
};

const sizes: Array<{ label: LampSize; price: number; detail: string }> = [
  { label: "Small", price: 199, detail: "10 x 10 cm" },
  { label: "Medium", price: 299, detail: "15 x 15 cm" },
  { label: "Large", price: 429, detail: "20 x 20 cm" },
];

const orientations: Array<{ label: Orientation; detail: string }> = [
  { label: "Portrait", detail: "3:4" },
  { label: "Landscape", detail: "4:3" },
  { label: "Square", detail: "1:1" },
];

const currencyFormatter = new Intl.NumberFormat("ro-RO", {
  style: "currency",
  currency: "RON",
  maximumFractionDigits: 0,
});

const lightTones: Array<{ label: LightTone; color: string }> = [
  { label: "Warm", color: "#ffd082" },
  { label: "Soft white", color: "#fff2cf" },
  { label: "Amber", color: "#f3a23a" },
];

const DEFAULT_CROP: CropState = { zoom: 1, panX: 0, panY: 0 };
const CROP_EXPORT_MAX_PIXELS = 1600;

const gallery = [
  {
    title: "Wedding frame",
    color: "#ef7d60",
    image:
      "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Family portrait",
    color: "#2d9c91",
    image:
      "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Pet keepsake",
    color: "#f1b34b",
    image:
      "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=900&q=80",
  },
];

const storyCards = [
  {
    title: "How it works?",
    icon: ClipboardList,
    color: "#2d9c91",
    steps: ["Upload photo", "Select configuration", "You receive it"],
  },
  {
    title: "Why choose a lithophane?",
    icon: Gift,
    color: "#ef7d60",
    copy:
      "It turns a favorite memory into an emotional gift: personal, warm, and made to be seen every evening.",
  },
  {
    title: "Premium quality",
    icon: BadgeCheck,
    color: "#f1b34b",
    copy:
      "We check every photo before printing, tune the relief for clean detail, and finish each lamp with a fitted light base.",
  },
];

function App() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropImageSize, setCropImageSize] = useState<ImageSize | null>(null);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [fileName, setFileName] = useState("");
  const [size, setSize] = useState<LampSize>("Medium");
  const [orientation, setOrientation] = useState<Orientation>("Square");
  const [tone, setTone] = useState<LightTone>("Warm");
  const [quantity, setQuantity] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [job, setJob] = useState<LithophaneJob | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [jobError, setJobError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cropFrameRef = useRef<HTMLDivElement>(null);
  const cropDragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const selectedSize = sizes.find((item) => item.label === size) ?? sizes[1];
  const selectedTone = lightTones.find((item) => item.label === tone) ?? lightTones[0];
  const subtotal = useMemo(() => selectedSize.price * quantity, [quantity, selectedSize.price]);
  const formattedSubtotal = currencyFormatter.format(subtotal);

  function readFile(file?: File) {
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setJobError("Only JPG and PNG photos are supported.");
      setJobStatus("failed");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = String(reader.result);
      const image = new Image();
      image.onload = () => {
        setCropImageSize({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.src = imageUrl;
      setSelectedFile(file);
      setUploadedImage(imageUrl);
      setPreviewImage(null);
      setCrop(DEFAULT_CROP);
      setFileName(file.name);
      setJob(null);
      setJobError("");
      setJobStatus("ready");
    };
    reader.readAsDataURL(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    readFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    readFile(event.dataTransfer.files?.[0]);
  }

  function markPreviewDirty() {
    if (!selectedFile) return;
    setJob(null);
    setPreviewImage(null);
    setJobError("");
    setJobStatus("ready");
  }

  function updateCrop(nextCrop: CropState) {
    setCrop(limitCrop(nextCrop));
    markPreviewDirty();
  }

  function handleCropPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!cropImageSize) return;
    cropDragRef.current = { x: event.clientX, y: event.clientY, panX: crop.panX, panY: crop.panY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCropPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current;
    const frame = cropFrameRef.current;
    if (!drag || !frame || !cropImageSize) return;

    const cropBounds = getCropBounds(cropImageSize, crop.zoom, orientation);
    const widthTravel = (cropBounds.maxOffsetX / cropBounds.sourceWidth) * frame.clientWidth;
    const heightTravel = (cropBounds.maxOffsetY / cropBounds.sourceHeight) * frame.clientHeight;
    const nextPanX = widthTravel > 0 ? drag.panX - (event.clientX - drag.x) / widthTravel : 0;
    const nextPanY = heightTravel > 0 ? drag.panY - (event.clientY - drag.y) / heightTravel : 0;
    updateCrop({ ...crop, panX: nextPanX, panY: nextPanY });
  }

  function handleCropPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    cropDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function buildCroppedImage() {
    if (!uploadedImage || !cropImageSize) {
      throw new Error("Could not prepare cropped photo.");
    }

    const source = await loadImage(uploadedImage);
    const cropBounds = getCropBounds(cropImageSize, crop.zoom, orientation);
    const centerX = cropImageSize.width / 2 + crop.panX * cropBounds.maxOffsetX;
    const centerY = cropImageSize.height / 2 + crop.panY * cropBounds.maxOffsetY;
    const sx = clamp(centerX - cropBounds.sourceWidth / 2, 0, cropImageSize.width - cropBounds.sourceWidth);
    const sy = clamp(centerY - cropBounds.sourceHeight / 2, 0, cropImageSize.height - cropBounds.sourceHeight);
    const exportSize = getExportSize(orientation);

    const canvas = document.createElement("canvas");
    canvas.width = exportSize.width;
    canvas.height = exportSize.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare cropped photo.");

    context.drawImage(
      source,
      sx,
      sy,
      cropBounds.sourceWidth,
      cropBounds.sourceHeight,
      0,
      0,
      exportSize.width,
      exportSize.height,
    );

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not prepare cropped photo.");

    return { blob, dataUrl: canvas.toDataURL("image/png") };
  }

  async function createPreview() {
    if (!selectedFile) {
      setJobError("Choose a JPG or PNG photo first.");
      setJobStatus("failed");
      return;
    }

    setJobError("");
    setJob(null);
    setJobStatus("uploading");

    try {
      const croppedImage = await buildCroppedImage();
      const formData = new FormData();
      formData.append("image", croppedImage.blob, `${selectedFile.name.replace(/\.[^.]+$/, "")}-crop.png`);
      formData.append("size", size);
      formData.append("orientation", orientation);
      setPreviewImage(croppedImage.dataUrl);

      const response = await fetch("/api/lithophanes", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.detail ?? "Could not start lithophane generation.");
      }

      const queuedJob = (await response.json()) as LithophaneJob;
      setJob(queuedJob);
      setJobStatus(queuedJob.status);
      void pollJob(queuedJob.jobId);
    } catch (error) {
      setJobError(error instanceof Error ? error.message : "Could not create preview.");
      setJobStatus("failed");
    }
  }

  async function pollJob(jobId: string) {
    try {
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        const response = await fetch(`/api/lithophanes/${jobId}`);
        if (!response.ok) throw new Error("Could not read preview status.");

        const nextJob = (await response.json()) as LithophaneJob;
        setJob(nextJob);
        setJobStatus(nextJob.status);

        if (nextJob.status === "complete") return;
        if (nextJob.status === "failed") {
          setJobError(nextJob.error ?? "Lithophane generation failed.");
          return;
        }
      }

      setJobStatus("failed");
      setJobError("Generation timed out. Try a smaller photo.");
    } catch (error) {
      setJobStatus("failed");
      setJobError(error instanceof Error ? error.message : "Could not read preview status.");
    }
  }

  function resetPhoto() {
    setSelectedFile(null);
    setUploadedImage(null);
    setPreviewImage(null);
    setCropImageSize(null);
    setCrop(DEFAULT_CROP);
    setFileName("");
    setJob(null);
    setJobError("");
    setJobStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  const canCreatePreview = Boolean(selectedFile) && !["uploading", "queued", "processing"].includes(jobStatus);
  const cropImageStyle = uploadedImage && cropImageSize ? getCropImageStyle(cropImageSize, crop, orientation) : undefined;
  const cropFrameStyle = getCropFrameStyle(orientation);
  const statusLabel =
    jobStatus === "uploading"
      ? "Uploading photo"
      : jobStatus === "queued"
        ? "Queued"
        : jobStatus === "processing"
          ? "Generating STL and GLB"
          : jobStatus === "complete"
            ? "3D preview ready"
            : jobStatus === "failed"
              ? "Preview failed"
              : selectedFile
                ? "Ready to generate"
                : "Choose a JPG or PNG photo";

  return (
    <main className="app-shell">
      <header className="site-header" aria-label="Site header">
        <a className="brand" href="#top" aria-label="LumaRelief home">
          <span className="brand-mark">
            <LampDesk size={19} aria-hidden="true" />
          </span>
          <span>LumaRelief</span>
        </a>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Photo-built light keepsakes</p>
          <h1 id="hero-title">LumaRelief</h1>
          <p className="hero-text">
            Custom 3D printed lithophane lamps with a fitted case, warm LED core, and photo-to-light preview.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#upload">
              <ImagePlus size={18} aria-hidden="true" />
              Upload photo
            </a>
            <a className="ghost-button" href="#gallery">
              View lamps
            </a>
          </div>
          <div className="trust-row" aria-label="Order highlights">
            <span>
              <ShieldCheck size={16} aria-hidden="true" />
              2 day proof
            </span>
            <span>
              <Check size={16} aria-hidden="true" />
              USB-C light base
            </span>
          </div>
        </div>

        <div className="lamp-stage" aria-label="Lithophane lamp preview">
          <div className="lamp-glow" style={{ background: selectedTone.color }} />
          <div className="lamp-case">
            <div className="case-top" />
            <div className="lithophane-panel">
              <div
                className="panel-photo"
                style={{
                  backgroundImage: uploadedImage
                    ? `url(${uploadedImage})`
                    : "url(https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=900&q=80)",
                }}
              />
              <div className="panel-ridges" />
            </div>
            <div className="case-base">
              <span />
              <span />
            </div>
          </div>
          <div className="lamp-shadow" />
        </div>
      </section>

      <section className="story-section" aria-labelledby="story-title">
        <div className="section-heading">
          <p className="eyebrow">Your memory, made luminous</p>
          <h2 id="story-title">Because every photo tells a story, let us help you tell yours</h2>
        </div>

        <div className="story-grid">
          {storyCards.map((card) => {
            const Icon = card.icon;

            return (
              <article className="story-card" key={card.title}>
                <div className="story-icon" style={{ background: card.color }}>
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3>{card.title}</h3>
                {"steps" in card ? (
                  <ol>
                    {card.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p>{card.copy}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="studio" id="upload" aria-labelledby="studio-title">
        <div className="section-heading">
          <p className="eyebrow">Build your lamp</p>
          <h2 id="studio-title">Photo studio</h2>
        </div>

        <div className="studio-grid">
          <div
            className={`upload-zone ${isDragging ? "is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              className="sr-only"
              id="photo-upload"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
            />

            <div className="upload-preview">
              {job?.status === "complete" && job.glbUrl ? (
                <LithophaneViewer glbUrl={job.glbUrl} imageUrl={previewImage ?? uploadedImage} lightColor={selectedTone.color} />
              ) : uploadedImage ? (
                <>
                  <div
                    className="crop-frame"
                    ref={cropFrameRef}
                    style={cropFrameStyle}
                    onPointerDown={handleCropPointerDown}
                    onPointerMove={handleCropPointerMove}
                    onPointerUp={handleCropPointerUp}
                    onPointerCancel={handleCropPointerUp}
                  >
                    <img className="crop-image" src={uploadedImage} alt="Uploaded preview" style={cropImageStyle} />
                    <div className="crop-grid" aria-hidden="true" />
                  </div>
                  <button
                    className="icon-button remove-photo"
                    type="button"
                    onClick={resetPhoto}
                    aria-label="Remove photo"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <div className="empty-preview" aria-hidden="true">
                  <Upload size={38} />
                </div>
              )}
              {["uploading", "queued", "processing"].includes(jobStatus) ? (
                <div className="preview-status" role="status">
                  <span />
                  {statusLabel}
                </div>
              ) : null}
            </div>

            <div className="upload-copy">
              <div>
                <h3>{statusLabel}</h3>
                <p>{fileName || "JPG or PNG"}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
                <ImagePlus size={17} aria-hidden="true" />
                Choose file
              </button>
            </div>
            {uploadedImage && jobStatus !== "complete" ? (
              <label className="zoom-control">
                <span>Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.01"
                  value={crop.zoom}
                  onChange={(event) => updateCrop({ ...crop, zoom: Number(event.target.value) })}
                />
              </label>
            ) : null}
            {jobError ? <p className="error-text">{jobError}</p> : null}
          </div>

          <aside className="config-panel" id="design" aria-label="Lamp options">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Design</p>
                <h3>Case and light</h3>
              </div>
              <Sparkles size={22} aria-hidden="true" />
            </div>

            <fieldset>
              <legend>Size</legend>
              <div className="segmented-control">
                {sizes.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={item.label === size ? "active" : ""}
                    onClick={() => {
                      setSize(item.label);
                      markPreviewDirty();
                    }}
                  >
                    <span>{item.label}</span>
                    <small>{getSizeDetail(item.label, orientation)}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Orientation</legend>
              <div className="segmented-control">
                {orientations.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={item.label === orientation ? "active" : ""}
                    onClick={() => {
                      setOrientation(item.label);
                      setCrop(DEFAULT_CROP);
                      markPreviewDirty();
                    }}
                  >
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Light tone</legend>
              <div className="swatch-row">
                {lightTones.map((item) => (
                  <button
                    key={item.label}
                    className={item.label === tone ? "swatch active" : "swatch"}
                    type="button"
                    onClick={() => setTone(item.label)}
                    aria-label={item.label}
                  >
                    <span style={{ background: item.color }} />
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="quantity-row">
              <span>Quantity</span>
              <div className="stepper" aria-label="Quantity">
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
                <output>{quantity}</output>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setQuantity((value) => Math.min(9, value + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="summary-card">
              <div>
                <span>{size} lamp</span>
                <strong>{formattedSubtotal}</strong>
              </div>
              <p>
                {orientation} {tone.toLowerCase()} LED, matte black case
                {job?.metadata
                  ? `, ${job.metadata.width_mm} x ${job.metadata.height_mm} mm lithophane`
                  : ", printed proof included"}
                .
              </p>
            </div>

            <button className="primary-button wide" type="button" disabled={!canCreatePreview} onClick={createPreview}>
              <Wand2 size={18} aria-hidden="true" />
              {["uploading", "queued", "processing"].includes(jobStatus) ? "Creating preview" : "Create preview"}
            </button>
            {job?.status === "complete" && job.stlUrl ? (
              <a className="download-link" href={job.stlUrl} download>
                Download STL
              </a>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="gallery-section" id="gallery" aria-labelledby="gallery-title">
        <div className="section-heading">
          <p className="eyebrow">Lamp styles</p>
          <h2 id="gallery-title">Made from moments</h2>
        </div>
        <div className="gallery-grid">
          {gallery.map((item) => (
            <article className="gallery-card" key={item.title}>
              <div className="gallery-image">
                <img src={item.image} alt={item.title} />
                <span style={{ background: item.color }} />
              </div>
              <div>
                <h3>{item.title}</h3>
                <p>Curved lithophane panel, fitted acrylic case, dimmable light.</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <a className="brand" href="#top" aria-label="LumaRelief home">
          <span className="brand-mark">
            <LampDesk size={19} aria-hidden="true" />
          </span>
          <span>LumaRelief</span>
        </a>
        <button className="ghost-button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <ArrowUp size={17} aria-hidden="true" />
          Back to top
        </button>
      </footer>
    </main>
  );
}

function limitCrop(crop: CropState): CropState {
  return {
    zoom: clamp(crop.zoom, 1, 4),
    panX: clamp(crop.panX, -1, 1),
    panY: clamp(crop.panY, -1, 1),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSizeDetail(size: LampSize, orientation: Orientation) {
  const squareCm: Record<LampSize, string> = {
    Small: "10 x 10 cm",
    Medium: "15 x 15 cm",
    Large: "20 x 20 cm",
  };
  const portraitCm: Record<LampSize, string> = {
    Small: "8.7 x 11.6 cm",
    Medium: "13 x 17.3 cm",
    Large: "17.3 x 23.1 cm",
  };
  const landscapeCm: Record<LampSize, string> = {
    Small: "11.6 x 8.7 cm",
    Medium: "17.3 x 13 cm",
    Large: "23.1 x 17.3 cm",
  };

  if (orientation === "Portrait") return portraitCm[size];
  if (orientation === "Landscape") return landscapeCm[size];
  return squareCm[size];
}

function getOrientationAspect(orientation: Orientation) {
  if (orientation === "Portrait") return 3 / 4;
  if (orientation === "Landscape") return 4 / 3;
  return 1;
}

function getExportSize(orientation: Orientation) {
  if (orientation === "Portrait") return { width: 1200, height: CROP_EXPORT_MAX_PIXELS };
  if (orientation === "Landscape") return { width: CROP_EXPORT_MAX_PIXELS, height: 1200 };
  return { width: 1200, height: 1200 };
}

function getCropBounds(imageSize: ImageSize, zoom: number, orientation: Orientation) {
  const targetAspect = getOrientationAspect(orientation);
  const imageAspect = imageSize.width / imageSize.height;
  const baseWidth = imageAspect > targetAspect ? imageSize.height * targetAspect : imageSize.width;
  const baseHeight = imageAspect > targetAspect ? imageSize.height : imageSize.width / targetAspect;
  const sourceWidth = baseWidth / zoom;
  const sourceHeight = baseHeight / zoom;

  return {
    sourceWidth,
    sourceHeight,
    maxOffsetX: Math.max(0, (imageSize.width - sourceWidth) / 2),
    maxOffsetY: Math.max(0, (imageSize.height - sourceHeight) / 2),
  };
}

function getCropFrameStyle(orientation: Orientation): React.CSSProperties {
  return {
    aspectRatio: orientation === "Portrait" ? "3 / 4" : orientation === "Landscape" ? "4 / 3" : "1",
    width: orientation === "Portrait" ? "min(100%, 330px)" : "min(100%, 430px)",
  };
}

function getCropImageStyle(imageSize: ImageSize, crop: CropState, orientation: Orientation): React.CSSProperties {
  const cropBounds = getCropBounds(imageSize, crop.zoom, orientation);
  const centerOffsetX = crop.panX * cropBounds.maxOffsetX;
  const centerOffsetY = crop.panY * cropBounds.maxOffsetY;

  return {
    width: `${(imageSize.width / cropBounds.sourceWidth) * 100}%`,
    height: `${(imageSize.height / cropBounds.sourceHeight) * 100}%`,
    left: `${50 - (centerOffsetX / cropBounds.sourceWidth) * 100}%`,
    top: `${50 - (centerOffsetY / cropBounds.sourceHeight) * 100}%`,
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read uploaded photo."));
    image.src = src;
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
