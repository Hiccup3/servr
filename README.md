# MangaBuff code server

This folder is a small Node.js server that stores `collector.js` and serves an installable runner.

## Start

```bash
npm start
```

Default URL:

```text
http://127.0.0.1:8787
```

## Endpoints

- `GET /health` - health check.
- `GET /collector/meta` - metadata and SHA-256 of `collector.js`.
- `GET /download/collector.js` - raw source, protected by token if `DOWNLOAD_TOKEN` is set.
- `GET /download/collector.runner.js` - encrypted self-decrypting runner.
- `GET /install.js` - installer that downloads `collector.runner.js` into the user's current folder.

## User install flow

From an empty folder on the user's machine:

```bash
node install.js
node collector.runner.js
```

If `DOWNLOAD_TOKEN` is enabled, download installer as:

```text
http://host:8787/install.js?token=YOUR_TOKEN
```

## Important security note

The delivered runner is encrypted with AES-GCM, but it must decrypt itself on the user's machine. That means the key is embedded in the runner. This is obfuscation against casual reading, not real protection from reverse engineering.

For real protection, keep important logic on the server and expose only API results to the client.
