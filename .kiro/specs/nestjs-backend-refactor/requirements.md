# Requirements Document

## Introduction

Dokumen ini menjelaskan requirements untuk refactor backend PR Review Agent dari Express ke NestJS dengan tetap mempertahankan SQLite sebagai database dan kompatibilitas penuh dengan aplikasi Electron desktop yang sudah ada. Refactor ini bertujuan untuk meningkatkan struktur kode, maintainability, dan scalability dengan mengadopsi arsitektur modular NestJS sambil mempertahankan semua fungsionalitas existing.

## Glossary

- **Backend_Server**: Server NestJS yang menyediakan REST API dan WebSocket untuk aplikasi
- **Electron_App**: Aplikasi desktop yang menggunakan Electron framework dengan React UI
- **SQLite_Database**: Database SQLite yang dikelola menggunakan TypeORM
- **Review_Engine**: Komponen yang mengorkestrasi proses review PR
- **AI_Executor**: Komponen yang mengeksekusi review menggunakan berbagai AI tools (Gemini, Copilot, Kiro, dll)
- **WebSocket_Server**: Server WebSocket untuk real-time updates ke dashboard
- **REST_API**: RESTful endpoints di bawah /api/* untuk operasi CRUD
- **Auto_Start_Service**: Service yang memulai Backend_Server secara otomatis saat Electron_App dibuka
- **Config_Manager**: Komponen yang mengelola konfigurasi aplikasi dan repository-specific overrides
- **Database_Manager**: Komponen yang mengelola koneksi dan operasi SQLite database
- **GitHub_Client**: Komponen yang berinteraksi dengan GitHub API
- **Metrics_Collector**: Komponen yang mengumpulkan dan menyimpan metrics review

## Requirements

### Requirement 1: Migrasi Framework Backend ke NestJS

**User Story:** Sebagai developer, saya ingin backend menggunakan NestJS framework, sehingga kode lebih terstruktur dan mudah di-maintain dengan arsitektur modular.

#### Acceptance Criteria

1. THE Backend_Server SHALL menggunakan NestJS framework sebagai pengganti Express
2. THE Backend_Server SHALL menggunakan TypeScript sebagai bahasa pemrograman utama
3. THE Backend_Server SHALL mengorganisir kode dalam modules, controllers, services, dan providers sesuai arsitektur NestJS
4. THE Backend_Server SHALL menggunakan dependency injection pattern untuk semua services
5. THE Backend_Server SHALL mempertahankan ES Modules compatibility untuk interoperabilitas dengan kode existing
6. WHEN Backend_Server dijalankan, THE Backend_Server SHALL mendengarkan pada port yang sama dengan Express server (default 3000)

### Requirement 2: SQLite Database dengan TypeORM

**User Story:** Sebagai developer, saya ingin menggunakan SQLite dengan TypeORM, sehingga database terintegrasi dengan NestJS dan mendukung entity-based operations.

#### Acceptance Criteria

1. THE Database_Manager SHALL menggunakan TypeORM dengan SQLite driver
2. THE Database_Manager SHALL menggunakan Entity classes untuk mendefinisikan schema
3. THE Database_Manager SHALL menyediakan Repository pattern untuk operasi database
4. THE Database_Manager SHALL diimplementasikan sebagai NestJS TypeOrmModule
5. THE Database_Manager SHALL mendukung transaction operations menggunakan TypeORM transaction manager
6. WHEN aplikasi startup, THE Database_Manager SHALL auto-create atau sync database schema dari entities
7. THE Database_Manager SHALL menyimpan database files di direktori data/

### Requirement 3: Kompatibilitas dengan Electron Desktop App

**User Story:** Sebagai user, saya ingin aplikasi Electron tetap berfungsi normal setelah refactor backend, sehingga tidak ada perubahan pada user experience.

#### Acceptance Criteria

1. THE Backend_Server SHALL menyediakan REST API endpoints yang identik dengan Express implementation
2. THE Backend_Server SHALL menyediakan WebSocket server pada endpoint yang sama
3. THE Backend_Server SHALL mendukung CORS untuk komunikasi dengan Electron renderer process
4. WHEN Electron_App mengirim request ke Backend_Server, THE Backend_Server SHALL merespons dengan format data yang sama
5. THE Backend_Server SHALL mendukung API key authentication menggunakan X-API-Key header
6. THE Backend_Server SHALL menyediakan health check endpoint di /health

### Requirement 4: Auto-Start Backend Server dari Electron

**User Story:** Sebagai user, saya ingin backend server otomatis start saat membuka aplikasi Electron, sehingga tidak perlu menjalankan server secara manual.

#### Acceptance Criteria

1. WHEN Electron_App dibuka, THE Auto_Start_Service SHALL memulai Backend_Server sebagai child process
2. WHEN Electron_App ditutup, THE Auto_Start_Service SHALL menghentikan Backend_Server secara graceful
3. THE Auto_Start_Service SHALL menunggu Backend_Server siap sebelum menampilkan UI
4. IF Backend_Server gagal start, THEN THE Auto_Start_Service SHALL menampilkan error notification
5. THE Auto_Start_Service SHALL memonitor Backend_Server health dan restart jika crash
6. THE Backend_Server SHALL menyediakan entry point yang dapat dijalankan sebagai standalone process

### Requirement 5: Migrasi REST API Endpoints

**User Story:** Sebagai developer, saya ingin semua REST API endpoints existing dimigrasikan ke NestJS, sehingga semua fungsionalitas tetap tersedia.

#### Acceptance Criteria

1. THE REST_API SHALL menyediakan endpoints untuk pull requests operations (/api/prs/*)
2. THE REST_API SHALL menyediakan endpoints untuk reviews operations (/api/reviews/*)
3. THE REST_API SHALL menyediakan endpoints untuk metrics operations (/api/metrics/*)
4. THE REST_API SHALL menyediakan endpoints untuk team operations (/api/team/*)
5. THE REST_API SHALL menyediakan endpoints untuk security operations (/api/security/*)
6. THE REST_API SHALL menyediakan endpoints untuk configuration operations (/api/config/*)
7. THE REST_API SHALL menyediakan endpoints untuk webhooks (/api/webhooks/*)
8. WHEN client mengirim request ke endpoint, THE REST_API SHALL merespons dengan status code dan format yang sama dengan Express implementation
9. THE REST_API SHALL menggunakan NestJS decorators untuk routing dan validation

### Requirement 6: Migrasi WebSocket Server

**User Story:** Sebagai user, saya ingin real-time updates tetap berfungsi di dashboard, sehingga saya dapat melihat progress review secara live.

#### Acceptance Criteria

1. THE WebSocket_Server SHALL menggunakan @nestjs/websockets module
2. THE WebSocket_Server SHALL mendukung ws library untuk WebSocket connections
3. WHEN review event terjadi, THE WebSocket_Server SHALL broadcast update ke semua connected clients
4. THE WebSocket_Server SHALL mengirim event types yang sama dengan Express implementation
5. THE WebSocket_Server SHALL mendukung reconnection dari Electron_App
6. THE WebSocket_Server SHALL menggunakan port yang sama dengan Express WebSocket server

### Requirement 7: Migrasi Review Engine

**User Story:** Sebagai developer, saya ingin review engine dimigrasikan ke NestJS service, sehingga logic review tetap berfungsi dengan arsitektur yang lebih baik.

#### Acceptance Criteria

1. THE Review_Engine SHALL diimplementasikan sebagai NestJS service
2. THE Review_Engine SHALL mempertahankan semua logic existing untuk PR review orchestration
3. THE Review_Engine SHALL menggunakan dependency injection untuk mengakses GitHub_Client, AI_Executor, dan Database_Manager
4. WHEN review dimulai, THE Review_Engine SHALL clone repository dan checkout branch
5. WHEN review selesai, THE Review_Engine SHALL post comments atau apply auto-fix sesuai mode
6. THE Review_Engine SHALL emit events ke WebSocket_Server untuk real-time updates
7. THE Review_Engine SHALL mendukung continuous mode dan once mode

### Requirement 8: Migrasi AI Executors

**User Story:** Sebagai developer, saya ingin AI executors dimigrasikan ke NestJS, sehingga integrasi dengan berbagai AI tools tetap berfungsi.

#### Acceptance Criteria

1. THE AI_Executor SHALL diimplementasikan sebagai NestJS service dengan strategy pattern
2. THE AI_Executor SHALL mendukung semua executor existing (Gemini, Copilot, Kiro, Claude, Codex, OpenCode)
3. THE AI_Executor SHALL menggunakan execa untuk menjalankan CLI tools
4. WHEN review diminta, THE AI_Executor SHALL memilih executor berdasarkan konfigurasi
5. THE AI_Executor SHALL parse output dari AI tools menjadi structured comments
6. THE AI_Executor SHALL mendukung auto-fix generation mode

### Requirement 9: Migrasi Configuration Management

**User Story:** Sebagai developer, saya ingin configuration management dimigrasikan ke NestJS, sehingga repository-specific overrides tetap berfungsi.

#### Acceptance Criteria

1. THE Config_Manager SHALL diimplementasikan sebagai NestJS ConfigModule
2. THE Config_Manager SHALL membaca environment variables dari .env file
3. THE Config_Manager SHALL mendukung repository-specific configuration overrides
4. THE Config_Manager SHALL validate configuration values saat startup
5. THE Config_Manager SHALL menyediakan typed configuration objects
6. THE Config_Manager SHALL mendukung configuration versioning

### Requirement 10: Migrasi GitHub Integration

**User Story:** Sebagai developer, saya ingin GitHub integration dimigrasikan ke NestJS, sehingga operasi GitHub API tetap berfungsi.

#### Acceptance Criteria

1. THE GitHub_Client SHALL diimplementasikan sebagai NestJS service
2. THE GitHub_Client SHALL menggunakan gh CLI untuk operasi GitHub
3. THE GitHub_Client SHALL mendukung PR scanning dengan configurable scope
4. THE GitHub_Client SHALL mendukung comment posting secara atomic
5. THE GitHub_Client SHALL mendukung auto-merge dengan health checks
6. THE GitHub_Client SHALL mendukung CI integration dan status checks

### Requirement 11: Migrasi Metrics dan Analytics

**User Story:** Sebagai developer, saya ingin metrics collection dimigrasikan ke NestJS, sehingga tracking dan reporting tetap berfungsi.

#### Acceptance Criteria

1. THE Metrics_Collector SHALL diimplementasikan sebagai NestJS service
2. THE Metrics_Collector SHALL mengumpulkan review metrics ke SQLite_Database
3. THE Metrics_Collector SHALL menghitung PR health scores
4. THE Metrics_Collector SHALL menghitung code quality scores
5. THE Metrics_Collector SHALL track test coverage
6. THE Metrics_Collector SHALL menyediakan data untuk developer dashboard

### Requirement 12: Migrasi Logging System

**User Story:** Sebagai developer, saya ingin logging system dimigrasikan ke NestJS, sehingga log files tetap tersimpan dengan format yang sama.

#### Acceptance Criteria

1. THE Backend_Server SHALL menggunakan NestJS Logger atau custom logger implementation
2. THE Backend_Server SHALL menyimpan logs di direktori logs/ dengan daily rotation
3. THE Backend_Server SHALL mempertahankan log retention 7 hari
4. THE Backend_Server SHALL menggunakan log format yang sama dengan Express implementation
5. THE Backend_Server SHALL mendukung log levels: info, warn, error
6. THE Backend_Server SHALL log semua HTTP requests menggunakan middleware

### Requirement 13: Migrasi Error Handling

**User Story:** Sebagai developer, saya ingin error handling dimigrasikan ke NestJS, sehingga error responses tetap konsisten.

#### Acceptance Criteria

1. THE Backend_Server SHALL menggunakan NestJS exception filters untuk global error handling
2. THE Backend_Server SHALL menggunakan custom exception classes untuk application errors
3. WHEN error terjadi, THE Backend_Server SHALL merespons dengan status code dan format yang sama
4. THE Backend_Server SHALL log semua errors dengan stack trace
5. THE Backend_Server SHALL menyediakan structured error responses dengan error codes

### Requirement 14: Testing Compatibility

**User Story:** Sebagai developer, saya ingin test suite existing tetap berfungsi atau mudah dimigrasikan, sehingga test coverage tetap terjaga.

#### Acceptance Criteria

1. THE Backend_Server SHALL mendukung testing menggunakan Vitest atau Jest
2. THE Backend_Server SHALL menyediakan test utilities untuk mocking NestJS dependencies
3. THE Backend_Server SHALL mendukung test database isolation
4. THE Backend_Server SHALL mempertahankan test coverage yang sama atau lebih baik
5. WHEN tests dijalankan, THE Backend_Server SHALL menggunakan separate test database

### Requirement 15: Build dan Deployment

**User Story:** Sebagai developer, saya ingin build process untuk NestJS backend terintegrasi dengan Electron build, sehingga distribusi aplikasi tetap mudah.

#### Acceptance Criteria

1. THE Backend_Server SHALL dikompilasi menjadi JavaScript output untuk production
2. THE Backend_Server SHALL menyediakan npm scripts untuk build, dev, dan test
3. THE Backend_Server SHALL terintegrasi dengan electron-builder untuk packaging
4. WHEN aplikasi di-build untuk distribusi, THE Backend_Server SHALL di-bundle bersama Electron_App
5. THE Backend_Server SHALL mendukung hot reload untuk development mode
6. THE Backend_Server SHALL menyediakan separate entry points untuk standalone dan embedded mode

### Requirement 16: API Compatibility

**User Story:** Sebagai developer, saya ingin API endpoints tetap kompatibel dengan Electron app, sehingga frontend tidak perlu diubah.

#### Acceptance Criteria

1. THE Backend_Server SHALL menyediakan compatibility layer untuk kode Express existing jika diperlukan
2. THE Backend_Server SHALL mendukung gradual migration dengan feature flags
3. THE Backend_Server SHALL mempertahankan API contract compatibility dengan format response yang sama
4. THE Backend_Server SHALL menyediakan migration guide untuk developer
5. THE Backend_Server SHALL menggunakan fresh database schema dengan TypeORM entities

### Requirement 17: Performance Requirements

**User Story:** Sebagai user, saya ingin aplikasi tetap responsif setelah refactor, sehingga performance tidak menurun.

#### Acceptance Criteria

1. WHEN Backend_Server startup, THE Backend_Server SHALL siap menerima requests dalam waktu kurang dari 5 detik
2. WHEN REST_API menerima request, THE REST_API SHALL merespons dalam waktu kurang dari 200ms untuk operasi sederhana
3. WHEN WebSocket_Server mengirim update, THE WebSocket_Server SHALL broadcast dalam waktu kurang dari 100ms
4. THE Backend_Server SHALL menggunakan memory tidak lebih dari 150% dari Express implementation
5. THE Backend_Server SHALL mendukung concurrent requests minimal sama dengan Express implementation

### Requirement 18: Security Requirements

**User Story:** Sebagai developer, saya ingin security measures existing tetap terjaga, sehingga aplikasi tetap aman.

#### Acceptance Criteria

1. THE Backend_Server SHALL menggunakan helmet middleware untuk security headers
2. THE Backend_Server SHALL validate semua input menggunakan NestJS validation pipes
3. THE Backend_Server SHALL sanitize user input untuk mencegah injection attacks
4. THE Backend_Server SHALL menggunakan API key authentication untuk protected endpoints
5. THE Backend_Server SHALL log semua authentication attempts
6. THE Backend_Server SHALL rate limit requests untuk mencegah abuse
