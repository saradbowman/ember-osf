# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Ability to pass query parameters with adapterOptions.query
- methods to the file model:
  - rename()
  - getGuid()
  - getContents()
  - updateContents()
- file-widget, a file browser widget for quick files
- humanFileSize, converting size number to a readable version like 5kB
- toastr as an npm dependency

### Changed
- Use delete link for delete url, if present
- file-browser-item now formatted to fit in with file-widget
- file-browser-item now supports icons for different file extensions
- dropzone-widget now has custom dropzone class that extends dropzone functionality to conditionally disallow folders and multiple files from being dropped
- 'Search' button in navbar to link to search page
- Moved ember-metrics and ember-toastr to dependencies
- Upgraded ember-toastr to 1.7.0

### Removed
- toastr from bower dependencies

## [0.11.1] - 2017-10-16
### Changed
- Allow non-term level locked filter by using bool in dicover page component

## [0.11.0] - 2017-10-11
### Changed
- In the discover page component, filter by `shareSource` instead of `name` if `shareSource` is set for a provider
- Change navbar links from buttons to anchors
- Point Bower to new Bower registry (https://registry.bower.io)