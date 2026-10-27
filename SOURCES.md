# Sources, verification and content status

Prepared 24 October 2026.

## Primary source

**Kurikulum Pendidikan Pemandu Motokar dan Motosikal (Gabungan), Edisi Keempat 2025**, JPJ / Akademi Pengangkutan Jalan Malaysia (file `MSBT5.pdf`, 202 pages).

- All 202 pages were read. Text came from the PDF text layer plus OCR (Tesseract). Many sign pages use a scrambled font encoding, so OCR text was used there.
- Sign tables, the sign-type table (p. 31), licence flowcharts (pp. 17, 19), OKU sticker page (p. 28) and the anti-corruption diagram (p. 103) were checked visually.
- **Page numbers:** the printed footer number equals the PDF page index throughout (verified on pp. 17, 19, 28, 30, 31, 40, 57–64, 103). Each question stores both `pdfPage` and `printedPage`.
- Some early pages contain leftover overlaid text from an older layout (e.g. p. 11 shows both "56/70" and "56/80"). The current value was confirmed online (see below).

## Online verification (checked 24 Oct 2026; format re-checked 27 Oct 2026, no newer official format found)

| Key | Source | Confirms |
|---|---|---|
| JPJ-FAQ | [FAQ KPP Gabungan, JPJ](https://www.jpj.gov.my/wp-content/uploads/2025/10/FAQ-KPP-GABUNGAN-NEW.pdf) | 70 questions, 1 h 15 min, pass 56/70, effective 29 Aug 2025, all classes except E. Old format was separate 50-question tests (45 min, 42/50). |
| MYGOV-JENIS | [MyGOV: Jenis Lesen Memandu](https://www.malaysia.gov.my/my/categories/pengangkutan/lesen-memandu/jenis-lesen-memandu) | LDL 3 or 6 months (max 2 years); PDL 2 years; apply for PDL within 1 year of passing. |
| MYGOV-KELAS | [MyGOV: Lesen Mengikut Kelas](https://www.malaysia.gov.my/my/categories/pengangkutan/lesen-memandu/lesen-mengikut-kelas-kenderaan-) | Classes A/A1 (OKU, ages 16/17), B2 ≤250cc, B >500cc, D/DA <3,500 kg, E >7,500 kg. |
| MYGOV-KEJARA | [MyGOV: Kenali Sistem KEJARA](https://www.malaysia.gov.my/my/categories/pengangkutan/lesen-memandu/kenali-sistem-kejara) | Demerit-point system; half the points removed after 1 year without a new offence. |

No newer combined-exam format than the October 2025 FAQ was found.

## Conflicts and exclusions

| Question | Issue | Decision |
|---|---|---|
| B1-KJR-X01 | Book (Table 6, p. 95): 20+ points first time = warning, second time = 6–8 month suspension. MyGOV: 20 points = 6-month suspension, 40 = 12 months, 60 = revoked. | **Excluded** from all scored tests until confirmed with JPJ. |
| B1-KJR-X02 | Fine for driving while suspended (RM3,000–RM10,000 or up to 3 years) appears only in the book. | **Excluded**: penalty not confirmed online. |
| B1-LES-X01 | PDL revoked at 20 demerit points (p. 15): book only, and related KEJARA thresholds conflict. | **Excluded**. |
| B1-LES-011 | p. 11 shows overlaid "56/80" text. | Used 56/70, confirmed by JPJ FAQ. |
| (not written) | Skid recovery (p. 160) wording "arah berlawanan dengan gelinciran" is ambiguous against standard steer-into-the-skid guidance. | No question written. |
| (not written) | IDP fee (RM150) and the 19 May 2025 halt on foreign licence conversion: changeable, not confirmed online. | No question written. |

Other licence rules taken from the book without separate online confirmation (e.g. PDL alcohol 0.00%, CDL validity 1–10 years, "P" sign placement, vocational licence ages) are marked with the book page only.

## Content status (27 Oct 2026)

- **393 scored questions** (+3 excluded) across all six chapters. Chapter 1: 179, Chapter 2: 20, Chapter 3: 68, Chapter 4: 43, Chapter 5: 45, Chapter 6: 38.
- Vehicle: 295 shared, 48 car-specific, 50 motorcycle-specific.
- 54 questions show a sign, marking or traffic-light image (53 original SVG illustrations drawn to match the shapes, colours and symbols in the book).
- 22 picture-answer questions: 20 "pick the sign/light/marking" questions (Bab 1, pp. 34–64) and 2 junction-path questions based on the book's turning diagrams (pp. 130–131). Visible answer text describes each picture without naming its meaning.
- 48 questions carry a diagram: junction layouts with direction arrows, safe following distance (2-/4-second rule), and car/motorcycle side views with the named component highlighted. A diagram is only attached when it depicts what the question already states; mappings that would reveal the answer (e.g. the 2-second counting question, the "which marker" question) were deliberately left out.
- Exams never include two questions about the same picture.
- Every question records book chapter, section, PDF and printed page, review status, and web sources with verification dates where used. Full list: `reports/question-bank.csv`.

### Not done / limits

- Questions were written and checked against the textbook text by Claude. A certified driving instructor has not reviewed them. A human review pass using `reports/question-bank.csv` is recommended before relying on it commercially.
- Police and driver hand-signal diagrams (pp. 35–36), information signs (hospital, petrol, parking), temporary work-zone signs and railway-crossing signs are covered by text questions only, not illustrated.
- Chapter 2 has 20 questions for an exam quota of 5, so after about three exams Chapter 2 questions start repeating.
- The road scene is a side view (slightly elevated). Left-hand traffic is shown with the player in the far lane and oncoming traffic in the near lane; road curves are not animated.
- Vehicle and scenery artwork is original and simplified; it does not depict specific car or motorcycle models.
