# mcp-travis
Model Context Protocol (MCP) server that exposes Travis CI as tools/resources.

## What you get
- **Resources**
  - `travis:recent-builds?repo=owner/name&limit=20`
  - `travis:env-vars?repo=owner/name`
  - `travis:build-log?jobId=123456789`

- **Tools**
  - `travis.triggerBuild` — trigger a build for repo/branch with optional config overrides
  - `travis.restartBuild` — restart a build by buildId
  - `travis.cancelBuild` — cancel a build by buildId

## Setup
1) Node 18+
2) `cp .env.example .env` and fill values.

```
TRAVIS_API_URL=https://api.travis-ci.com
TRAVIS_API_TOKEN=xxxxxxxxxxxxxxxxxxxx
TRAVIS_USER_AGENT=mcp-travis/0.1
```

> Note: Travis CI API v3 is used. Ensure your token has API access.

## Develop
```bash
npm i
npm run dev
```
The server runs over stdio (MCP) and prints minimal startup logs.

## Build
```bash
npm run build
npm start
```

## Using with MCP clients
Add an entry to your MCP-compatible client pointing to `mcp-travis` (the built binary) and ensure the environment
variables are available in the client’s environment/session.
