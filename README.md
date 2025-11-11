# mcp-travis

Model Context Protocol (MCP) server that exposes Travis CI API as tools and resources for Claude and other MCP-compatible clients.

**Features:**
- 🚀 Trigger, restart, and cancel builds
- 📊 View build logs and job details
- 📈 Get organization/user statistics
- 🔍 Monitor Travis CI service status
- 🔧 Manage builds through natural language

## Usage

https://github.com/user-attachments/assets/0e8cfa5b-f78f-4a27-8348-8a38e518bf98

Once you've seen you triggered a build right inside of Claude, you can then go to the repository in question: 

<img width="1239" height="400" alt="Screenshot 2025-10-27 at 10 35 49 AM" src="https://github.com/user-attachments/assets/4b00b3ec-32d3-4e87-9c9c-f6286cc5d070" />

As you can see it's been triggered by Travis MCP. What's more, if you have a build number that you want to restart, you can do that as well: 

<img width="778" height="593" alt="Screenshot 2025-10-27 at 12 01 41 PM" src="https://github.com/user-attachments/assets/67dbac45-9d03-4419-ba4c-d35f8dfcfe8e" />

Things you need to make sure of is that you have `mcp-travis` activated, see below:

<img width="527" height="294" alt="Screenshot 2025-10-27 at 12 03 24 PM" src="https://github.com/user-attachments/assets/c165cf07-e0f5-4d1b-97b5-1beb637fb9d7" />

Below I'll explain more about what you can do with the Travis MCP server.

## Quick Examples

Here are some things you can ask Claude with this MCP server:

- **"Show me the logs for Travis build 276783990"** - View complete build logs
- **"Trigger a build for travis-ci/travis-web on branch deploy_2025.11.10"** - Start a new build
- **"What's the Travis CI status for the rails organization?"** - Get org statistics
- **"Is Travis CI down?"** - Check service operational status
- **"Restart build 276783990"** - Restart a failed build
- **"Cancel build 276783990"** - Stop a running build
- **"Get job details for build 276783990"** - See individual job configurations

## Features

### Resources

| Resource | Description |
|----------|-------------|
| `travis:recent-builds?repo=owner/name&limit=20` | Retrieve recent builds for a repository with optional limit |
| `travis:env-vars?repo=owner/name` | Get environment variables for a repository |
| `travis:build-log?jobId=123456789` | Fetch build log for a specific job ID |

### Tools

| Tool | Description |
|------|-------------|
| `travis_triggerBuild` | Trigger a build for a repository/branch with optional config overrides |
| `travis_restartBuild` | Restart a build using its build ID |
| `travis_cancelBuild` | Cancel a build using its build ID |
| `travis_getBuildJobs` | Get all job IDs and details for a specific build |
| `travis_getBuildLogs` | Fetch and combine logs from all jobs in a build (convenience tool) |
| `travis_getOwnerStats` | Get statistics and information for a Travis CI user or organization |
| `travis_getServiceStatus` | Check the operational status of Travis CI services |

### Getting Build Logs

There are multiple ways to retrieve build logs:

#### 1. Quick Method (Recommended)
Use `travis_getBuildLogs` with just a build ID to get all logs at once:

```
Ask Claude: "Show me all logs for build 276783990"
```

This automatically fetches all jobs and their logs in a single request.

#### 2. Detailed Method
When you need more control, first get job details, then fetch specific logs:

**Step 1:** Get all job IDs and their details
```
Ask Claude: "Get job details for build 276783990"
```

This uses `travis_getBuildJobs` and returns:
```json
{
  "buildId": 276783990,
  "jobs": [
    {
      "id": 123456789,
      "number": "276783990.1",
      "state": "passed",
      "config": { "language": "node_js", "node_js": "18" },
      "allow_failure": false
    },
    {
      "id": 123456790,
      "number": "276783990.2",
      "state": "failed",
      "config": { "language": "node_js", "node_js": "20" },
      "allow_failure": false
    }
  ]
}
```

**Step 2:** Fetch log for a specific job
```
Ask Claude: "Show me the log for job 123456790"
```

This uses the `travis:build-log?jobId={jobId}` resource to fetch just that job's log.

**Use case:** This method is useful when:
- You want to inspect only failed jobs
- You need to see job configurations before viewing logs
- You're debugging specific test matrix configurations

#### 3. Resource Method
Directly use the resource URI for individual job logs:
```
travis:build-log?jobId=123456789
```

### Getting Organization/User Statistics

Use `travis_getOwnerStats` to get an overview of a user or organization's Travis CI activity:

```
Ask Claude: "Show me Travis CI stats for travis-ci"
Ask Claude: "Get statistics for the rails organization"
```

This returns:
- Owner type (User/Organization)
- Name and GitHub ID
- Total and active repository counts
- Recent active repositories with their last build status
- Visual indicators: ✓ (passed), ✗ (failed), ○ (no builds)

**Example output:**
```
Travis CI Statistics for: travis-ci
================================================================================

Owner Type: User
Name: Travis CI
GitHub ID: 639823

Repository Statistics:
--------------------------------------------------------------------------------
Total Repositories: 100
Active Repositories: 100

Recent Active Repositories:
--------------------------------------------------------------------------------
✓ travis-ci/travis-web
   Last Build: #12345 - passed (2025-11-10T10:30:00Z)
✗ travis-ci/travis-api
   Last Build: #67890 - failed (2025-11-09T15:20:00Z)
```

### Checking Travis CI Service Status

Use `travis_getServiceStatus` to check if Travis CI is experiencing issues:

```
Ask Claude: "Is Travis CI down?"
Ask Claude: "Check Travis CI status"
Ask Claude: "What's the Travis CI service status?"
```

This returns:
- Overall operational status
- Status of individual components (API, builds, notifications, etc.)
- Active incidents (if any)
- Scheduled maintenance (if any)
- Link to the full status page

**Use case:** Quickly determine if build failures are due to Travis CI infrastructure issues or your code.

**Example output:**
```
Travis CI Service Status
================================================================================

Overall Status: ✓ ALL SYSTEMS OPERATIONAL
Last Updated: 2025-11-11T00:55:49.971Z

Service Components:
--------------------------------------------------------------------------------
✓ Log Processing: operational
✓ API: operational
✓ Builds Processing: operational
...

✓ No active incidents

Status Page: https://www.traviscistatus.com
```

## Setup

### Requirements

| Requirement | Version |
|------------|---------|
| Node.js | 18+ |

### Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `TRAVIS_API_URL` | Travis CI API endpoint | `https://api.travis-ci.com` |
| `TRAVIS_API_TOKEN` | Your Travis CI API token | `xxxxxxxxxxxxxxxxxxxx` |
| `TRAVIS_USER_AGENT` | User agent for API requests | `mcp-travis/0.1` |

> **Note:** Travis CI API v3 is used. Ensure your token has API access.

## Development

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

## Using with MCP Clients

Add an entry to your MCP-compatible client pointing to `mcp-travis` (the built binary) and ensure the environment variables are available in the client's environment/session.

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-travis": {
      "command": "node",
      "args": [
        "/path/to/mcp-travis/dist/index.js"
      ],
      "env": {
        "TRAVIS_API_URL": "https://api.travis-ci.com",
        "TRAVIS_API_TOKEN": "your_travis_token_here",
        "TRAVIS_USER_AGENT": "mcp-travis/0.1"
      }
    }
  }
}
```

**Getting your Travis CI API token:**
1. Go to https://travis-ci.com (or your Travis CI instance)
2. Click on your profile picture → Settings
3. Go to "Settings" tab
4. Find the "API authentication" section
5. Copy your token

After configuration, restart Claude Desktop to load the MCP server.

## Author

Michael Mendy © 2025