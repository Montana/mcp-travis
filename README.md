# mcp-travis
Model Context Protocol (MCP) server that exposes Travis CI as tools/resources.

## Usage

https://github.com/user-attachments/assets/0e8cfa5b-f78f-4a27-8348-8a38e518bf98

Once you've seen you triggered a build right inside of Claude, you can then go to the repository in question: 

<img width="1239" height="400" alt="Screenshot 2025-10-27 at 10 35 49 AM" src="https://github.com/user-attachments/assets/4b00b3ec-32d3-4e87-9c9c-f6286cc5d070" />

As you can see it's been triggered by Travis MCP. 

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
variables are available in the client's environment/session.

## Author

Michael Mendy (c) 2025. 
