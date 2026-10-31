"use client";
import ArrowUpRightIcon from "../../../components/ArrowUpRightIcon";

import {useTranslations, useLocale} from "next-intl";


import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {localizedPhotoChapters, sourcePhotoChapters} from "./localizedPhotoChapters";
import styles from "./propertyWalkthrough.module.css";

export default function PropertyWalkthrough() {
  const t = useTranslations("ProjectUI");
  const locale = useLocale();
  const rtl = locale === "ar";

  const chapters = localizedPhotoChapters(t, locale);
  const [position, setPosition] = useState({ chapter: "pool", photo: 0 });
  const photoCanvas = useRef<HTMLDivElement | null>(null);
  // Stable IDs keep map links and navigation aligned with locale-specific chapters.
  useEffect(() => {
    const sourceChapters = sourcePhotoChapters(locale);
    function selectChapter(id: unknown) {
      if (typeof id === "string" && sourceChapters.some(item => item.id === id)) {
        setPosition({chapter: id, photo: 0});
      }
    }
    function selectFromHash() {
      const id = window.location.hash.slice(1);
      if (id.startsWith("tour-")) selectChapter(id.slice(5));
    }
    function selectFromMap(event: Event) {
      const id = (event as CustomEvent<unknown>).detail;
      selectChapter(id);
    }
    selectFromHash();
    window.addEventListener("mzs-photo-chapter", selectFromMap);
    window.addEventListener("hashchange", selectFromHash);
    return () => { window.removeEventListener("hashchange", selectFromHash); window.removeEventListener("mzs-photo-chapter", selectFromMap); };
  }, [locale]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const chapter = chapters.find(item => item.id === position.chapter) || chapters[0];
  const photoIndex = Math.min(position.photo, chapter.photos.length - 1);
  const photo = chapter.photos[photoIndex];
  const move = (direction: number) => setPosition((current) => {
    const currentChapter = Math.max(0, chapters.findIndex(item => item.id === current.chapter));
    const currentPhoto = Math.min(current.photo, chapters[currentChapter].photos.length - 1);
    const next = currentPhoto + direction;
    if (next >= 0 && next < chapters[currentChapter].photos.length) return { chapter: chapters[currentChapter].id, photo: next };
    const nextChapter = (currentChapter + direction + chapters.length) % chapters.length;
    return { chapter: chapters[nextChapter].id, photo: direction > 0 ? 0 : chapters[nextChapter].photos.length - 1 };
  });

  return (
    <section id="walkthrough" className={styles.tour} aria-labelledby="tour-title">
      <div className={styles.heading}>
        <div><p className={styles.kicker}>{t("p144")}</p><h2 id="tour-title">{t("p145")}</h2></div>
        <p>{t("p146")}</p>
      </div>
      <div className={styles.layout}>
        <nav className={styles.chapters} aria-label={t("p147")}>
          {chapters.map((item, index) => (
            <button key={item.id} type="button" aria-current={chapter.id === item.id ? "step" : undefined} aria-controls="tour-photo"
              onClick={() => {
                setPosition({ chapter: item.id, photo: 0 });
                photoCanvas.current?.scrollIntoView({block: "start", inline: "nearest"});
              }}>
              <span>{String(index + 1).padStart(2, "0")}</span>{item.title}<span aria-hidden="true"><ArrowUpRightIcon /></span>
            </button>
          ))}
        </nav>
        <div className={styles.viewer}>
          <div id="tour-photo" ref={photoCanvas} className={styles.canvas} tabIndex={0} role="group" aria-label={t("p148")}
            onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move((event.key === "ArrowLeft" ? -1 : 1) * (rtl ? -1 : 1)); } }}
            onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
            onTouchEnd={(event) => { const start = touchStart.current; touchStart.current = null; if (!start) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) move((dx < 0 ? 1 : -1) * (rtl ? -1 : 1)); }}>
            {/* Every section link lands at the same photo top, never on a lower menu row. */}
            {chapters.map(item => <span key={item.id} id={`tour-${item.id}`} className={styles.chapterAnchor} aria-hidden="true" />)}
            <Image key={photo.src} src={photo.src} alt={photo.alt} fill sizes="(max-width: 800px) 100vw, 75vw" className={styles.image} />
            <span className={styles.count}>{photoIndex + 1} / {chapter.photos.length}</span>
          </div>
          <div className={styles.controls}>
            <button type="button" onClick={() => move(-1)} aria-label={t("p149")}>{rtl ? "→" : "←"}</button>
            <div aria-live="polite" aria-atomic="true"><h3>{photo.caption}</h3><p>{chapter.description}</p></div>
            <button type="button" onClick={() => move(1)} aria-label={t("p150")}>{rtl ? "←" : "→"}</button>
          </div>
          <div className={styles.thumbnails} aria-label={t("p151")}>
            {chapter.photos.map((item, index) => (
              <button type="button" key={item.src} onClick={() => setPosition({ chapter: chapter.id, photo: index })} aria-label={t("viewCaption", {caption: item.caption})} aria-pressed={photoIndex === index}>
                <Image src={item.src} alt="" fill sizes="100px" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

