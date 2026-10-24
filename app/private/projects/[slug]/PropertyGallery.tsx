"use client";

import {useTranslations, useLocale} from "next-intl";


import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import styles from "./propertyPresentation.module.css";

export type PropertyPhoto = {
  src: string;
  alt: string;
  caption: string;
};

type Props = { photos: PropertyPhoto[]; title: string };

export default function PropertyGallery({ photos, title }: Props) {
  const t = useTranslations("ProjectUI");
  const rtl = useLocale() === "ar";

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const lightbox = useRef<HTMLDivElement | null>(null);

  const total = photos.length;
  const activePhoto = activeIndex === null ? null : photos[activeIndex];
  const isOpen = activeIndex !== null;

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveIndex(null);
        requestAnimationFrame(() => opener.current?.focus());
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((index) => index === null ? null : (index + (rtl ? -1 : 1) + total) % total);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((index) => index === null ? null : (index + (rtl ? 1 : -1) + total) % total);
      } else if (event.key === "Tab") {
        // Keep keyboard focus inside the modal while it is open.
        const focusable = Array.from(lightbox.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, total, rtl]);

  // After the lightbox closes, return focus to the original thumbnail.
  const close = () => {
    setActiveIndex(null);
    requestAnimationFrame(() => opener.current?.focus());
  };

  const open = (index: number, event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setActiveIndex(index);
  };

  if (!total) return null;

  return (
    <>
      <div className={styles.galleryMosaic}>
        {photos.slice(0, 5).map((photo, index) => (
          <button
            key={photo.src}
            type="button"
            className={`${styles.galleryTile} ${index === 0 ? styles.galleryTileLarge : ""}`}
            onClick={(event) => open(index, event)}
            aria-label={t("viewPhoto", {index: index + 1, total, caption: photo.caption})}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes={index === 0 ? "(max-width: 720px) 100vw, 58vw" : "(max-width: 720px) 50vw, 22vw"}
              className={styles.galleryTileImage}
            />
            <span className={styles.galleryTileLabel}>
              {index === 4 ? t("viewAll", {count: total}) : photo.caption}
            </span>
          </button>
        ))}
      </div>
      <div className={styles.galleryUnder}>
        <span>{t("photoCount", {count: total})}</span>
        <button
          type="button"
          onClick={(event) => open(0, event)}
          className={styles.galleryAllButton}
        >
          {t("p137")} <span aria-hidden="true">↗</span>
        </button>
      </div>

      {activePhoto && activeIndex !== null && (
        <div
          className={styles.lightbox}
          ref={lightbox}
          role="dialog"
          aria-modal="true"
          aria-label={t("galleryTitle", {title})}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className={styles.lightboxTop}>
            <div>
              <strong>{title}</strong>
              <span>{activeIndex + 1} / {total}</span>
            </div>
            <button type="button" onClick={close} ref={closeButton} aria-label={t("p138")} className={styles.lightboxClose}>{t("p139")}</button>
          </div>

          <div className={styles.lightboxCanvas}>
            <Image
              key={activePhoto.src}
              src={activePhoto.src}
              alt={activePhoto.alt}
              fill
              sizes="100vw"
              className={styles.lightboxImage}
            />
          </div>
          <div className={styles.lightboxBottom}>
            <button type="button" aria-label={t("p140")} onClick={() => setActiveIndex((activeIndex - 1 + total) % total)}>
              {t("p141")}
            </button>
            <p aria-live="polite">{activePhoto.caption}</p>
            <button type="button" aria-label={t("p142")} onClick={() => setActiveIndex((activeIndex + 1) % total)}>
              {t("p143")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
