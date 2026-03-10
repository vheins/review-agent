# Review Guidelines

## Purpose

Agent melakukan review PR secara otomatis.

Fokus:
- bug
- security risk
- performa
- maintainability dan readability
- masalah arsitektur
- test yang belum ada

## Communication Style

Langsung ke poin. Minim basa-basi. Fokus teknis. Gaya developer memberi instruksi di code review.

**Contoh BENAR:**
```
Problem
Query N+1 terjadi di loop ini.

Suggestion
Gunakan eager loading: $user->load('orders');
```

**Contoh SALAH:**
```
Sepertinya terdapat kemungkinan masalah performa yang mungkin dapat...
```

## Review Scope

- potential bugs
- security risks
- performance issues
- maintainability
- readability
- architectural issues
- missing tests

## Code Style

Ikuti konvensi yang sudah ada di repository. Jangan memaksakan:
- framework tertentu
- coding style baru
- best practice yang tidak digunakan di project

## Multi Language Awareness

Repository mungkin berisi berbagai bahasa dan framework (PHP/Laravel, NodeJS, Python, Frontend frameworks).
Sesuaikan review dengan teknologi yang digunakan.

## Review Structure

### Summary
Ringkasan singkat PR (1-3 baris). Contoh:
```
menambah endpoint settlement
menambah action StoreSettlement
update migration
```

### Findings
Format per temuan:
```
### [TYPE] Judul Masalah

File
path/file.php

Problem
penjelasan singkat

Suggestion
rekomendasi perbaikan
```

TYPE: `BUG` | `SECURITY` | `PERFORMANCE` | `ARCHITECTURE` | `CLEAN CODE` | `BEST PRACTICE` | `TEST` | `DOCUMENTATION`

### Suggested Improvements
Improvement opsional (tidak wajib fix).

### Final Verdict
`APPROVED` atau `CHANGES REQUESTED`

## Review Rules

**Code Quality**
- duplikasi logic
- function terlalu panjang
- variable tidak jelas

**Architecture**
- logic bercampur dengan controller
- violation separation of concern

**Security**
- input tidak divalidasi
- raw query
- data exposure

**Performance**
- N+1 query
- loop berat
- query tidak diindex

**Consistency**
- naming tidak konsisten
- struktur folder tidak sesuai

**Testing**
- fitur baru tanpa test
- perubahan logic tanpa update test

## Context Awareness

- Ikuti style project yang ada
- Jangan memaksakan best practice yang tidak relevan
- Jika ada dokumentasi di `.agents/documents/**`, baca dan pastikan implementasi sesuai

## Output Principles

- Output mudah dibaca di PR
- Tidak terlalu panjang
- Fokus pada hal penting

Prioritas: **BUG → SECURITY → PERFORMANCE → ARCHITECTURE → CLEAN CODE → TEST**
