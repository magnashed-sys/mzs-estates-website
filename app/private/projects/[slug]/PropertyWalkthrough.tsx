"use client";

import {useTranslations} from "next-intl";


import Image from "next/image";
import { useRef, useState } from "react";
import {localizedPhotoChapters} from "./localizedPhotoChapters";
import styles from "./propertyWalkthrough.module.css";

export default function PropertyWalkthrough() {
  const t = useTranslations("ProjectUI");

  const chapters = localizedPhotoChapters(t);
  const [position, setPosition] = useState({ chapter: 0, photo: 0 });
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const chapter = chapters[position.chapter];
  const photo = chapter.photos[position.photo];
  const move = (direction: number) => setPosition((current) => {
    const next = current.photo + direction;
    if (next >= 0 && next < chapters[current.chapter].photos.length) return { ...current, photo: next };
    const nextChapter = (current.chapter + direction + chapters.length) % chapters.length;
    return { chapter: nextChapter, photo: direction > 0 ? 0 : chapters[nextChapter].photos.length - 1 };
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
            <button key={item.title} type="button" aria-current={position.chapter === index ? "step" : undefined}
              onClick={() => setPosition({ chapter: index, photo: 0 })}>
              <span>{String(index + 1).padStart(2, "0")}</span>{item.title}<span aria-hidden="true">↗</span>
            </button>
          ))}
        </nav>
        <div className={styles.viewer}>
          <div className={styles.canvas} tabIndex={0} role="group" aria-label={t("p148")}
            onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }}
            onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
            onTouchEnd={(event) => { const start = touchStart.current; touchStart.current = null; if (!start) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1); }}>
            <Image key={photo.src} src={photo.src} alt={photo.alt} fill sizes="(max-width: 800px) 100vw, 75vw" className={styles.image} />
            <span className={styles.count}>{position.photo + 1} / {chapter.photos.length}</span>
          </div>
          <div className={styles.controls}>
            <button type="button" onClick={() => move(-1)} aria-label={t("p149")}>←</button>
            <div aria-live="polite" aria-atomic="true"><h3>{photo.caption}</h3><p>{chapter.description}</p></div>
            <button type="button" onClick={() => move(1)} aria-label={t("p150")}>→</button>
          </div>
          <div className={styles.thumbnails} aria-label={t("p151")}>
            {chapter.photos.map((item, index) => (
              <button type="button" key={item.src} onClick={() => setPosition({ ...position, photo: index })} aria-label={t("viewCaption", {caption: item.caption})} aria-pressed={position.photo === index}>
                <Image src={item.src} alt="" fill sizes="100px" />
              </button>
            ))}
          </div>
          {photo.retouched ? <p className={styles.note}>{t("p152")}</p> : null}
        </div>
      </div>
    </section>
  );
}
