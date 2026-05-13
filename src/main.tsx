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
import "./styles.css";

type LampSize = "Mini" | "Classic" | "Gallery";
type LightTone = "Warm" | "Soft white" | "Amber";

const sizes: Array<{ label: LampSize; price: number; detail: string }> = [
  { label: "Mini", price: 199, detail: "10 cm" },
  { label: "Classic", price: 299, detail: "15 cm" },
  { label: "Gallery", price: 429, detail: "20 cm" },
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
  const [fileName, setFileName] = useState("");
  const [size, setSize] = useState<LampSize>("Classic");
  const [tone, setTone] = useState<LightTone>("Warm");
  const [quantity, setQuantity] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSize = sizes.find((item) => item.label === size) ?? sizes[1];
  const selectedTone = lightTones.find((item) => item.label === tone) ?? lightTones[0];
  const subtotal = useMemo(() => selectedSize.price * quantity, [quantity, selectedSize.price]);
  const formattedSubtotal = currencyFormatter.format(subtotal);

  function readFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(String(reader.result));
      setFileName(file.name);
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
                {card.steps ? (
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
              accept="image/*"
              onChange={handleFileChange}
            />

            <div className="upload-preview">
              {uploadedImage ? (
                <>
                  <img src={uploadedImage} alt="Uploaded preview" />
                  <button
                    className="icon-button remove-photo"
                    type="button"
                    onClick={() => {
                      setUploadedImage(null);
                      setFileName("");
                      if (inputRef.current) inputRef.current.value = "";
                    }}
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
            </div>

            <div className="upload-copy">
              <div>
                <h3>{uploadedImage ? "Photo ready" : "Upload photo"}</h3>
                <p>{fileName || "JPG, PNG, HEIC"}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
                <ImagePlus size={17} aria-hidden="true" />
                Choose file
              </button>
            </div>
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
                    onClick={() => setSize(item.label)}
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
              <p>{tone} LED, matte black case, printed proof included.</p>
            </div>

            <button className="primary-button wide" type="button">
              <Wand2 size={18} aria-hidden="true" />
              Create preview
            </button>
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

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
