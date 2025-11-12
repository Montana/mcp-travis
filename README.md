# mcp-travis

Model Context Protocol (MCP) server that exposes Travis CI API as tools and resources for Claude and other MCP-compatible clients.

**Features:**
- Trigger, restart, and cancel builds
- View build logs and job details
- Compare builds to debug failures
- Get organization/user statistics
- Analyze build trends and performance metrics
- Get intelligent optimization recommendations
- Monitor Travis CI service status
- Manage builds through natural language

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
- **"Compare builds 276783990 and 276783991"** - See what changed between two builds
- **"Show me build insights for travis-ci/travis-web"** - Analyze build trends and performance
- **"How can I optimize build 276783990?"** - Get optimization recommendations for faster builds
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
| `travis_compareBuilds` | Compare two builds to see what changed between them |
| `travis_getBuildInsights` | Get aggregated build statistics and insights for a repository over time |
| `travis_getOptimizationRecommendations` | Analyze build logs to provide optimization recommendations for caching, parallelization, and performance |

### Getting Build Logs

There are multiple ways to retrieve build logs:

#### 1. Quick Method (Recommended)
Use `travis_getBuildLogs` with just a build ID to get all logs at once:

```
Ask Claude: "Show me all logs for build 276783990"
```

This automatically fetches all jobs and their logs in a single request, as you'll see in this video below:

[![Watch the video](https://github.com/user-attachments/assets/93cb09b1-2dbd-4dd4-8cd6-1cbf9cb2a1a2)](https://github.com/user-attachments/assets/93cb09b1-2dbd-4dd4-8cd6-1cbf9cb2a1a2)


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

Owner Information:
┌─────────────────────┬────────────────────────────┐
│ Owner Type          │ User                       │
│ Name                │ Travis CI                  │
│ GitHub ID           │ 639823                     │
└─────────────────────┴────────────────────────────┘

Repository Statistics:
--------------------------------------------------------------------------------
Total Repositories:     100  ████████████████████████████████████████
Active Repositories:    100  ████████████████████████████████████████
Inactive Repositories:    0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

Recent Active Repositories:
--------------------------------------------------------------------------------
Status  Repository                Last Build           Date
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓     travis-ci/travis-web      #12345 - passed     2025-11-10
  ✗     travis-ci/travis-api      #67890 - failed     2025-11-09

Build Health Overview:
[✓] Passed: 1   ████████████████████
[✗] Failed: 1   ████████████████████
```

### Checking Travis CI Service Status

<img width="1246" height="439" alt="Screenshot 2025-11-10 at 10 34 26 PM" src="https://github.com/user-attachments/assets/fd0305e6-a63d-445e-b585-a7f8f45d371f" />

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

┌────────────────────────────────────────────────────────────┐
│  Overall Status: ✓ ALL SYSTEMS OPERATIONAL                │
│  Last Updated: 2025-11-11T00:55:49.971Z                   │
└────────────────────────────────────────────────────────────┘

Service Components Health:
--------------------------------------------------------------------------------
Component              Status          Uptime
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Log Processing       operational     ████████████████████ 100%
✓ API                  operational     ████████████████████ 100%
✓ Builds Processing    operational     ████████████████████ 100%
✓ GitHub Integration   operational     ████████████████████ 100%
✓ Notifications        operational     ████████████████████ 100%

Incidents & Maintenance:
--------------------------------------------------------------------------------
✓ No active incidents
✓ No scheduled maintenance

Status Dashboard: https://www.traviscistatus.com
```

### Comparing Builds

<img width="1412" height="847" alt="Screenshot 2025-11-10 at 10 37 28 PM" src="https://github.com/user-attachments/assets/fc5b5b0b-9552-4263-ad87-1e91eab09350" />

Use `travis_compareBuilds` to understand what changed between two builds:

```
Ask Claude: "Compare Travis builds 276783990 and 276783991"
Ask Claude: "Why did build 100 pass but build 101 fail?"
```

This returns a detailed comparison showing:
- Build states (passed/failed) with visual indicators
- Repository and branch information
- Commit differences (SHA, message, author, date)
- Build duration comparison
- Timeline (started/finished times)
- Job-by-job comparison with configurations
- Pass/fail summary for each build
- Smart recommendations for next steps

**Example output:**
```
Build Comparison
================================================================================

Build #276783990 vs Build #276783991
--------------------------------------------------------------------------------

Build States:
┌──────────────────┬────────────┬────────────┐
│                  │  #276783990│  #276783991│
├──────────────────┼────────────┼────────────┤
│ State            │    ✓ PASS  │    ✗ FAIL  │
│ Duration         │      5m 30s│      3m 15s│
│ Jobs Passed      │          2 │          1 │
│ Jobs Failed      │          0 │          1 │
└──────────────────┴────────────┴────────────┘
⚠ States differ!

Repository:
  Build #276783990: travis-ci/travis-web
  Build #276783991: travis-ci/travis-web

Branch:
  Build #276783990: main
  Build #276783991: main

Commits:
  Build #276783990:
    SHA: a5962064
    Message: Release_251110
    Author: John Doe
    Date: 2025-11-10T10:00:00Z
  Build #276783991:
    SHA: b7a83f21
    Message: Update dependencies
    Author: Jane Smith
    Date: 2025-11-10T14:00:00Z
  ⚠ Different commits!

Build Duration:
  Build #276783990: 5m 30s  ████████████████████████████████████████
  Build #276783991: 3m 15s  ███████████████████░░░░░░░░░░░░░░░░░░░░
  Build #276783991 was 135s faster (40% improvement)

Job States:
  Build #276783990:                     Build #276783991:
  ┌─────────────────────────┐          ┌─────────────────────────┐
  │ ✓ Job #1.1: PASS        │          │ ✓ Job #2.1: PASS        │
  │   Node.js 18            │          │   Node.js 18            │
  ├─────────────────────────┤          ├─────────────────────────┤
  │ ✓ Job #1.2: PASS        │          │ ✗ Job #2.2: FAIL        │
  │   Node.js 20            │          │   Node.js 20            │
  └─────────────────────────┘          └─────────────────────────┘
       2/2 Jobs Passed                       1/2 Jobs Passed

Matrix Health:
Node 18  ✓✓  [100% pass]  ████████████████████
Node 20  ✓✗  [ 50% pass]  ██████████░░░░░░░░░░

Recommendation:
  • Build #276783990 passed but #276783991 failed
  • Check commit differences and failed job logs for #276783991
  • Use: "Show me logs for build 276783991" to investigate
```

**Use cases:**
- Debug why a previously passing build started failing
- Identify performance regressions (duration changes)
- Compare matrix builds with different configurations
- Track down which commit introduced a failure
- Understand environmental differences between builds

### Getting Build Insights & Metrics

Use `travis_getBuildInsights` to analyze build trends and get aggregated statistics:

```
Ask Claude: "Show me build insights for travis-ci/travis-web"
Ask Claude: "What are the build trends for owner/repo?"
Ask Claude: "Analyze recent builds for owner/repo on the main branch"
```

This returns comprehensive analytics including:
- Overall pass/fail rates across multiple builds
- Recent trend analysis (improving/declining/stable)
- Build duration statistics (average, median, fastest, slowest)
- Per-branch breakdown of build success rates
- Recent failures with commit information
- Actionable insights and recommendations

**Parameters:**
- `repo` (required): Repository slug (e.g., "travis-ci/travis-web")
- `limit` (optional): Number of recent builds to analyze (default: 50, max: 100)
- `branch` (optional): Filter analysis to a specific branch

**Example output:**
```
Build Insights for: travis-ci/travis-web
================================================================================

Analyzing 50 most recent build(s)

Overall Statistics:
--------------------------------------------------------------------------------
Passed: 42 (84.0%)  ████████████████████████████████████████░░░░░░
Failed: 8           ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

Recent Trend (Last 10 Builds):
--------------------------------------------------------------------------------
Pass Rate: 90.0% [IMPROVING]

  100% ┤
   90% ┤                                  ●━━━━━━━━
   80% ┤                           ●━━━━━━
   70% ┤                    ●━━━━━━
   60% ┤             ●━━━━━━
   50% ┤      ●━━━━━━
   40% ┤━━━━━━
       └──────────────────────────────────────────
        Build #1 → #10 (Most Recent)

Build Duration Analysis:
--------------------------------------------------------------------------------
Average: 5m 30s  ████████████████████████░░░░
Median:  5m 15s  ███████████████████████░░░░░
Fastest: 3m 20s  ███████████████░░░░░░░░░░░░░
Slowest: 8m 45s  ████████████████████████████████████████

Branch Breakdown:
--------------------------------------------------------------------------------
Branch            Builds    Pass Rate    ████████████████████
main                  35      85.7%      ████████████████████████████████████░░░░
develop               10      80.0%      ████████████████████████████████░░░░░░░░
feature/new-ui         5      80.0%      ████████████████████████████████░░░░░░░░

Recent Failures:
--------------------------------------------------------------------------------
✗ Build #276783991 (main) - 2025-11-10
  "Update dependencies to latest versions"
✗ Build #276783985 (develop) - 2025-11-09
  "Fix authentication bug in user login flow"

Insights & Recommendations:
--------------------------------------------------------------------------------
✓ Excellent build stability! 84.0% pass rate
  Recent builds are improving - great work!
```

**Use cases:**
- Monitor overall project health and build stability
- Identify trends in build success/failure rates
- Spot performance regressions in build times
- Compare branch stability across your repository
- Make data-driven decisions about CI/CD improvements
- Track the impact of recent changes on build reliability

### Getting Build Optimization Recommendations

Use `travis_getOptimizationRecommendations` to analyze build logs and get actionable optimization suggestions:

```
Ask Claude: "How can I optimize build 276783990?"
Ask Claude: "Give me optimization recommendations for build 276783990"
Ask Claude: "What can I do to speed up build 276783990?"
```

This will show you a few things, a summary of what can be changed:


<img width="858" height="936" alt="Screenshot 2025-11-12 at 9 34 13 AM" src="https://github.com/user-attachments/assets/cdc50db0-b397-4539-b130-ab03dc3540bb" />

Then how much time in aggregate it should save you: 

<img width="918" height="733" alt="Screenshot 2025-11-12 at 9 36 41 AM" src="https://github.com/user-attachments/assets/1db53bd0-96cb-4e60-8fb4-187e8d2dca8f" />

This tool analyzes all job logs from a build and provides intelligent recommendations for:
- **Dependency Caching**: Detects package installations and suggests caching strategies
- **Build Artifact Caching**: Identifies compilation steps that could benefit from caching
- **Test Optimization**: Suggests test parallelization and splitting strategies
- **Docker Optimization**: Recommends Docker layer caching and image optimizations
- **Setup Overhead Reduction**: Identifies redundant setup operations
- **Job Duration Analysis**: Highlights the slowest jobs for targeted optimization

**What it detects:**
- Package manager operations (npm, yarn, pip, bundle, etc.)
- Build/compilation steps (TypeScript, Webpack, Maven, Gradle, Go, Rust, etc.)
- Test execution patterns
- Docker operations (pull, build)
- Cache hits and misses
- Redundant setup operations

See it in action:

[![Watch the video](https://github.com/user-attachments/assets/93cb09b1-2dbd-4dd4-8cd6-1cbf9cb2a1a2)](https://github.com/user-attachments/assets/93cb09b1-2dbd-4dd4-8cd6-1cbf9cb2a1a2)

**Example output:**
```
Build Optimization Recommendations for Build #276783990
================================================================================

Analyzed 3 job(s) across this build

Key Findings:
--------------------------------------------------------------------------------
Category                   Occurrences    ████████████████████
Dependency Installation           3       ████████████████████
Build Process                     3       ████████████████████
Testing                           3       ████████████████████
Setup Overhead                    0       ░░░░░░░░░░░░░░░░░░░░
Docker Operations                 0       ░░░░░░░░░░░░░░░░░░░░

Detailed Analysis:
--------------------------------------------------------------------------------

Dependency Installation:
  • Job #276783990.1: Detected package installation. Consider caching dependencies.
  • Job #276783990.2: Detected package installation. Consider caching dependencies.
  • Job #276783990.3: Detected package installation. Consider caching dependencies.

Build Process:
  • Job #276783990.1: Build/compilation detected. Consider caching build artifacts.
  • Job #276783990.2: Build/compilation detected. Consider caching build artifacts.
  • Job #276783990.3: Build/compilation detected. Consider caching build artifacts.

Testing:
  • Job #276783990.1: Tests detected. Consider test splitting for parallel execution.
  • Job #276783990.2: Tests detected. Consider test splitting for parallel execution.
  • Job #276783990.3: Tests detected. Consider test splitting for parallel execution.

Optimization Recommendations:
--------------------------------------------------------------------------------

📦 Dependency Caching:
  • Enable Travis CI's built-in cache for dependencies
  • Add to .travis.yml:
    cache:
      directories:
        - node_modules  # for Node.js
        - ~/.npm
        - ~/.cache/pip  # for Python
        - vendor/bundle # for Ruby
  • Use 'npm ci' instead of 'npm install' for faster, reproducible builds

Build Artifact Caching:
  • Cache compiled/built artifacts between builds
  • Add build output directories to cache configuration
  • Consider incremental compilation if supported by your tooling
  • Example: cache: { directories: ['dist', 'build', '.next'] }

Test Optimization:
  • Split tests across multiple jobs for parallel execution
  • Use test sharding/splitting based on timing data
  • Consider running unit tests before slower integration tests
  • Run only affected tests for PR builds
  • Example: Use build matrix to run test suites in parallel

General Best Practices:
  • Use 'fast_finish: true' in build matrix to fail fast
  • Leverage build stages for dependent job execution
  • Consider conditional builds (skip builds for doc-only changes)
  • Monitor build times regularly and set up alerts for regressions

Job Duration Analysis:
--------------------------------------------------------------------------------
Job Performance Comparison:

Job #276783990.1  5m 30s  ████████████████████████████████████████
Job #276783990.2  5m 15s  ██████████████████████████████████████
Job #276783990.3  5m 10s  █████████████████████████████████████

Timeline:
0:00    1:00    2:00    3:00    4:00    5:00    6:00
├───────┼───────┼───────┼───────┼───────┼───────┤
│       │       │       │       │       │       │
Job 1   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█████
Job 2   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░███████
Job 3   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█████████

⚠ Slowest job takes over 5 minutes - consider optimization strategies above

Next Steps:
--------------------------------------------------------------------------------
1. Review the recommendations above
2. Update your .travis.yml with caching configuration
3. Monitor subsequent build times for improvements
4. Use 'travis_compareBuilds' to compare before/after optimization
```

**Use cases:**
- Speed up slow builds with targeted recommendations
- Reduce CI costs by optimizing build efficiency
- Identify caching opportunities automatically
- Get actionable steps to improve build performance
- Learn CI/CD best practices through intelligent analysis
- Validate that your builds are following optimization guidelines

## Setup

### Quick Setup (Recommended)

Run the automated setup script:

```bash
cd mcp-travis
./setup.sh
```

The script will:
- Check system requirements (Node.js 18+)
- Install dependencies
- Build the project
- Configure environment variables (prompts for your Travis CI API token)
- Set up Claude Desktop integration automatically

After setup completes, just **restart Claude Desktop** and you're ready to go!

### Manual Setup

If you prefer to set up manually:

#### Requirements

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
