# Locational Organizer

Bookmark places on a map of LA County and attach files to them. Proof of concept:
plain HTML/CSS/JS frontend with Leaflet + OpenStreetMap, Node/Express backend,
SQLite database, uploads stored on local disk.

## Run

Requires Node.js 22.13+ (uses the built-in `node:sqlite` module).

```sh
npm install
npm start
```

Then open http://localhost:3000. Set `PORT` to use a different port.

## Use

- **Add a place:** click the map, enter a name and notes, then save.
- **Find an address:** use the search box, pick a result, then "Bookmark this place".
- **Attach files:** open a place, then drop files on the panel or choose them
  (images, PDF, text, CSV, Word, Excel; 10 MB max each).
- **Edit / delete:** open a place and use the buttons in the panel. Deleting a place
  also deletes its files from disk.

## Layout

```
server/            Express app
  index.js         entry point, static files, error handler
  config.js        paths, LA County bounds, upload limits and allowed types
  db.js            SQLite schema (locations, files)
  uploads.js       multer setup and on-disk file helpers
  routes/          locations, files, geocode (Nominatim proxy)
public/            frontend (no build step)
  js/app.js        wires map, panel, and search together
data/app.db        created on first run (gitignored)
uploads/           uploaded files, stored under random names (gitignored)
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | /api/locations | list places |
| POST | /api/locations | create `{name, description, lat, lng}` |
| PUT | /api/locations/:id | update `{name, description}` |
| DELETE | /api/locations/:id | delete place and its files |
| GET | /api/locations/:id/files | list files |
| POST | /api/locations/:id/files | upload (multipart field `file`) |
| GET | /api/files/:id | download |
| DELETE | /api/files/:id | delete file |
| GET | /api/geocode?q= | address search, limited to LA County |
