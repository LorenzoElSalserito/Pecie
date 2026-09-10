# Changelog

Tutte le modifiche rilevanti a Pecie sono documentate in questo file secondo
[Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

## [Unreleased]

## [0.1.9] - 2026-09-10

### Fixed
- Conversione RPM con database temporaneo privato e spec separato dal contenuto installabile; escluso il segnaposto `.gitkeep` del runtime dal pacchetto Debian.

### Changed
- `npm run dist` seleziona gli artefatti per il sistema corrente: DEB, RPM e AppImage su Linux, installer EXE su Windows e DMG su macOS.

## [0.1.8] - 2026-09-10

### Fixed
- L'importazione dei pacchetti condivisi attende il completamento della manutenzione automatica Git, evitando scritture in background e l'errore intermittente `ENOTEMPTY` durante la pulizia delle cartelle nei test di release.

## [0.1.7] - 2026-09-08

### Changed
- Sostituite le icone applicative Linux, Windows, macOS e dell'interfaccia con la nuova identità visiva.

### Fixed
- Risolto il percorso runtime dell'icona Electron su Linux, così barra delle applicazioni e finestre usano l'asset Pecie invece del fallback Electron.
- Applicata un'ombra bianca permanente all'icona mostrata nello splash, nel wizard e nel launcher, indipendentemente dal tema.

## [0.1.6] - 2026-08-30

### Added
- Pacchetto Linux portabile AppImage pubblicato insieme agli altri artefatti di release.

### Fixed
- Pipeline GitHub Actions resa indipendente da `alien` per le build Debian e AppImage; la toolchain RPM viene installata e usata soltanto nello step dedicato.

## [0.1.5] - 2026-08-30


## [0.1.4] - 2026-08-30

### Changed
- Pipeline di release automatizzata, versionata e conforme alle policy Debian.

## [0.1.2] - 2026-08-01

### Fixed
- Correzioni applicative e nuove icone.

## [0.1.1] - 2026-07-04

### Changed
- Versione finale 0.1.1.

## [0.1.0] - 2026-06-22

### Added
- Prima release pubblica di Pecie.
