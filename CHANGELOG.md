# Changelog

> Ce journal n’est plus tenu depuis la version 0.1.2 (juin 2026). Les changements du site sont décrits dans les pull requests fusionnées sur `main` et dans les rapports datés de `docs/` ([sommaire](docs/README.md)). Le journal de NXT5 Importer reste tenu dans [`importer-app/CHANGELOG.md`](importer-app/CHANGELOG.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.2] - 2026-06-18

### Added

- NXT5 Importer desktop app packaging for Windows and macOS.
- Local JSON export flow from a Riot Game ID for safer match imports.

### Changed

- Importer release artifacts are produced for Windows, Mac x64, and Mac arm64.

## [0.1.0] - 2026-06-18

### Added

- Initial NXT5 web dashboard with React, Vite, Netlify Functions, and Neon PostgreSQL.
- Auth with HttpOnly cookie sessions stored in the database.
- Team creation, team joining, roster management, and player profiles.
- Riot match import, local match-file import, match archive groups, and reports.
- Champion pool views, composition builder, planning tools, and match archive groups.
