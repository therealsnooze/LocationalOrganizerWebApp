# Locational Organizer

Bookmark places on a map of LA County and attach files to them. Proof of concept:
plain HTML/CSS/JS frontend with Leaflet + OpenStreetMap, Node/Express backend,
SQLite database (a local file, or Turso when deployed), uploads on local disk
(or Vercel Blob when deployed).

## Run

Requires Node.js 22.13+.

```sh
npm install
npm start
```

Then open http://localhost:3000. Set `PORT` to use a different port.

## Deploy to Vercel

`public/` is served by Vercel's CDN and `api/index.js` runs the Express app as a
serverless function (`vercel.json` sends every `/api/*` request there). Vercel's disk
doesn't persist, so the deployed app needs:

- **Turso** (hosted SQLite): set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- **Vercel Blob** (a *private* store) connected to the project, which sets
  `BLOB_READ_WRITE_TOKEN`.

Without those variables the server uses `data/app.db` and `uploads/`. Uploads are
capped at 4 MB because Vercel rejects request bodies over 4.5 MB.

## Use

- **Add a place:** click the map, enter a name and notes, then save.
- **Find an address:** use the search box, pick a result, then "Bookmark this place".
- **Attach files:** open a place, then drop files on the panel or choose them
  (images, PDF, text, CSV, Word, Excel; 4 MB max each).
- **Edit / delete:** open a place and use the buttons in the panel. Deleting a place
  also deletes its files from disk.

## Layout

```
api/index.js       Vercel serverless entry point (re-exports server/app.js)
server/            Express app
  app.js           routes, static files, error handler
  index.js         local entry point (app.listen)
  config.js        paths, LA County bounds, upload limits and allowed types
  db.js            database client (Turso or local file) and schema
  uploads.js       multer setup and file storage (Vercel Blob or local disk)
  routes/          locations, files, geocode (Nominatim proxy)
public/            frontend (no build step)
  js/app.js        wires map, panel, and search together
data/app.db        local database, created on first run (gitignored)
uploads/           local uploads, stored under random names (gitignored)
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
