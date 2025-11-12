import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import process from "node:process";
import { request } from "undici";

interface TravisRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
}

interface TravisJob {
  id: number;
  number: string;
  state: string;
  config?: any;
  allow_failure?: boolean;
}

interface TravisBuild {
  id: number;
  number: string;
  state: string;
  jobs?: TravisJob[];
}

interface JobLog {
  jobId: number;
  jobNumber: string;
  state: string;
  log: string;
}

const API_URL = process.env.TRAVIS_API_URL || "https://api.travis-ci.com";
const API_TOKEN = process.env.TRAVIS_API_TOKEN || "";
const USER_AGENT = process.env.TRAVIS_USER_AGENT || "mcp-travis/0.1";

if (!API_TOKEN) {
  console.error("Missing TRAVIS_API_TOKEN in environment.");
  process.exit(1);
}

async function travis(path: string, init: TravisRequestOptions = {}): Promise<any> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const headers: Record<string, string> = {
    "Travis-API-Version": "3",
    "Authorization": `token ${API_TOKEN}`,
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json"
  };
  const res = await request(url, {
    method: init.method ?? "GET",
    headers: { ...headers, ...(init.headers ?? {}) },
    body: init.body
  });
  const text = await res.body.text();
  const ok = res.statusCode >= 200 && res.statusCode < 300;
  if (!ok) {
    throw new Error(`Travis API error ${res.statusCode}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const resourceTemplates = [
  {
    uriTemplate: "travis:recent-builds?repo={owner}/{name}&limit={limit}",
    name: "Recent builds",
    description: "List recent builds for a repo slug like owner/name",
    mimeType: "application/json"
  },
  {
    uriTemplate: "travis:env-vars?repo={owner}/{name}",
    name: "Repo environment variables",
    description: "List environment variables for a repo",
    mimeType: "application/json"
  },
  {
    uriTemplate: "travis:build-log?jobId={jobId}",
    name: "Build log by Job ID",
    description: "Fetch raw log for a job",
    mimeType: "text/plain"
  }
];

const tools = [
  {
    name: "travis_triggerBuild",
    description: "⚠️ TRIGGER/START a NEW build for a repo and branch. WARNING: This starts a new CI build. DO NOT use this to view existing build logs - use travis_getBuildLogs instead.",
    inputSchema: {
      type: "object",
      required: ["repo", "branch"],
      properties: {
        repo: { type: "string", description: "Repo slug like owner/name" },
        branch: { type: "string", description: "Git branch to build" },
        message: { type: "string", description: "Request message", default: "Triggered via MCP" },
        config: { type: "object", description: "Optional .travis.yml overrides (object form)" }
      }
    }
  },
  {
    name: "travis_restartBuild",
    description: "Restart a build by buildId.",
    inputSchema: {
      type: "object",
      required: ["buildId"],
      properties: { buildId: { type: "integer" } }
    }
  },
  {
    name: "travis_cancelBuild",
    description: "Cancel a build by buildId.",
    inputSchema: {
      type: "object",
      required: ["buildId"],
      properties: { buildId: { type: "integer" } }
    }
  },
  {
    name: "travis_getBuildJobs",
    description: "Get all job IDs and details for a specific build. Use this to find job IDs before fetching logs.",
    inputSchema: {
      type: "object",
      required: ["buildId"],
      properties: {
        buildId: { type: "integer", description: "The build ID to get jobs for" }
      }
    }
  },
  {
    name: "travis_getBuildLogs",
    description: "VIEW/READ/FETCH build logs for an existing build. Use this to get, show, see, read, or view logs from a build by its build ID. Returns combined logs from all jobs. This is a READ-ONLY operation.",
    inputSchema: {
      type: "object",
      required: ["buildId"],
      properties: {
        buildId: { type: "integer", description: "The build ID to get all logs for" }
      }
    }
  },
  {
    name: "travis_getOwnerStats",
    description: "Get statistics and information for a Travis CI user or organization. Shows active repos, build counts, and account details.",
    inputSchema: {
      type: "object",
      required: ["owner"],
      properties: {
        owner: { type: "string", description: "GitHub username or organization name (e.g., 'travis-ci' or 'rails')" }
      }
    }
  },
  {
    name: "travis_getServiceStatus",
    description: "Check the operational status of Travis CI services. Shows if Travis CI is up, having issues, or down. Use this to check if Travis CI itself is working properly.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "travis_compareBuilds",
    description: "Compare two builds to see what changed between them. Useful for debugging why one build passed and another failed. Shows differences in commits, configuration, duration, and job outcomes.",
    inputSchema: {
      type: "object",
      required: ["buildId1", "buildId2"],
      properties: {
        buildId1: { type: "integer", description: "First build ID to compare" },
        buildId2: { type: "integer", description: "Second build ID to compare" }
      }
    }
  },
  {
    name: "travis_getBuildInsights",
    description: "Get aggregated build statistics and insights for a repository. Shows build trends, pass/fail rates, duration analysis, and identifies patterns over time.",
    inputSchema: {
      type: "object",
      required: ["repo"],
      properties: {
        repo: { type: "string", description: "Repository slug like owner/name" },
        limit: { type: "integer", description: "Number of recent builds to analyze (default: 50, max: 100)", default: 50 },
        branch: { type: "string", description: "Optional: Filter by specific branch" }
      }
    }
  },
  {
    name: "travis_getOptimizationRecommendations",
    description: "Analyze build logs to provide optimization recommendations. Identifies slow steps, suggests caching opportunities, detects redundant operations, and recommends parallelization improvements.",
    inputSchema: {
      type: "object",
      required: ["buildId"],
      properties: {
        buildId: { type: "integer", description: "The build ID to analyze for optimization opportunities" }
      }
    }
  }
];

const server = new Server({
  name: "mcp-travis",
  version: "0.1.0",
  resources: [],
  resourceTemplates,
  tools
}, {
  capabilities: {
    tools: {},
    resources: {},
    resourceTemplates: {}
  }
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates
}));

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: []
}));

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const uri = req.params.uri;
  const u = new URL(uri);
  if (u.protocol !== "travis:") throw new Error("Unsupported protocol");
  if (u.hostname === "recent-builds") {
    const repo = `${u.searchParams.get("repo")}`;
    const limit = Number(u.searchParams.get("limit") ?? "20");
    const data = await travis(`/repo/${encodeURIComponent(repo)}/builds?limit=${limit}`);
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
  }
  if (u.hostname === "env-vars") {
    const repo = `${u.searchParams.get("repo")}`;
    const data = await travis(`/repo/${encodeURIComponent(repo)}/env_vars`);
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
  }
  if (u.hostname === "build-log") {
    const jobId = `${u.searchParams.get("jobId")}`;
    const data = await travis(`/job/${jobId}/log.txt`);
    return { contents: [{ uri, mimeType: "text/plain", text: data }] };
  }
  throw new Error("Unknown resource");
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    if (name === "travis_triggerBuild") {
      const repo = args?.repo as string;
      const branch = args?.branch as string;

      if (!repo || !branch) {
        throw new Error("Both 'repo' and 'branch' parameters are required");
      }

      const message = args?.message ?? "Triggered via MCP";
      const config = args?.config;
      const body = JSON.stringify({ request: { message, branch, config } });
      const res = await travis(`/repo/${encodeURIComponent(repo)}/requests`, { method: "POST", body });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    if (name === "travis_restartBuild") {
      const buildId = args?.buildId as number;

      if (!buildId) {
        throw new Error("Parameter 'buildId' is required");
      }

      const res = await travis(`/build/${buildId}/restart`, { method: "POST" });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    if (name === "travis_cancelBuild") {
      const buildId = args?.buildId as number;

      if (!buildId) {
        throw new Error("Parameter 'buildId' is required");
      }

      const res = await travis(`/build/${buildId}/cancel`, { method: "POST" });
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
    if (name === "travis_getBuildJobs") {
      const buildId = args?.buildId as number;

      if (!buildId) {
        throw new Error("Parameter 'buildId' is required");
      }

      const res: TravisBuild = await travis(`/build/${buildId}`);
      const jobs = res.jobs || [];
      const jobDetails = jobs.map((job: TravisJob) => ({
        id: job.id,
        number: job.number,
        state: job.state,
        config: job.config,
        allow_failure: job.allow_failure
      }));
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ buildId, jobs: jobDetails }, null, 2)
        }]
      };
    }

    if (name === "travis_getBuildLogs") {
      const buildId = args?.buildId as number;

      if (!buildId) {
        throw new Error("Parameter 'buildId' is required");
      }

      const buildData: TravisBuild = await travis(`/build/${buildId}`);
      const jobs = buildData.jobs || [];

      if (jobs.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No jobs found for this build."
          }]
        };
      }

      const logPromises = jobs.map(async (job: TravisJob): Promise<JobLog> => {
        try {
          const log = await travis(`/job/${job.id}/log.txt`);
          return {
            jobId: job.id,
            jobNumber: job.number,
            state: job.state,
            log: log
          };
        } catch (error) {
          return {
            jobId: job.id,
            jobNumber: job.number,
            state: job.state,
            log: `Error fetching log: ${error}`
          };
        }
      });

      const logs: JobLog[] = await Promise.all(logPromises);

      let output = `Build #${buildId} - Logs for ${logs.length} job(s)\n\n`;
      output += "=".repeat(80) + "\n\n";

      for (const jobLog of logs) {
        output += `Job #${jobLog.jobNumber} (ID: ${jobLog.jobId}) - State: ${jobLog.state}\n`;
        output += "-".repeat(80) + "\n";
        output += jobLog.log + "\n";
        output += "=".repeat(80) + "\n\n";
      }

      return { content: [{ type: "text", text: output }] };
    }

    if (name === "travis_getOwnerStats") {
      const owner = args?.owner as string;

      if (!owner) {
        throw new Error("Parameter 'owner' is required");
      }

      const ownerData = await travis(`/owner/${encodeURIComponent(owner)}`);

      const reposData = await travis(`/owner/${encodeURIComponent(owner)}/repos?limit=100&sort_by=last_started_at:desc`);

      let output = `Travis CI Statistics for: ${owner}\n`;
      output += "=".repeat(80) + "\n\n";

      output += `Owner Type: ${ownerData.login ? 'User' : 'Organization'}\n`;
      output += `Name: ${ownerData.name || owner}\n`;
      output += `GitHub ID: ${ownerData.github_id || 'N/A'}\n`;
      if (ownerData.avatar_url) output += `Avatar: ${ownerData.avatar_url}\n`;
      output += `\n`;

      const repos = reposData.repositories || [];
      const activeRepos = repos.filter((r: any) => r.active);

      output += `Repository Statistics:\n`;
      output += `-`.repeat(80) + `\n`;
      output += `Total Repositories: ${repos.length}\n`;
      output += `Active Repositories: ${activeRepos.length}\n`;
      output += `\n`;

      if (activeRepos.length > 0) {
        output += `Recent Active Repositories:\n`;
        output += `-`.repeat(80) + `\n`;

        for (const repo of activeRepos.slice(0, 10)) {
          const lastBuild = repo.last_build;
          if (lastBuild) {
            const state = lastBuild.state || 'unknown';
            const emoji = state === 'passed' ? '✓' : state === 'failed' ? '✗' : '○';
            output += `${emoji} ${repo.slug}\n`;
            output += `   Last Build: #${lastBuild.number} - ${state} (${lastBuild.finished_at || 'in progress'})\n`;
          } else {
            output += `○ ${repo.slug}\n`;
            output += `   No builds yet\n`;
          }
        }

        if (activeRepos.length > 10) {
          output += `\n... and ${activeRepos.length - 10} more active repositories\n`;
        }
      }

      return { content: [{ type: "text", text: output }] };
    }

    if (name === "travis_getServiceStatus") {
      try {
        const statusRes = await request("https://www.traviscistatus.com/api/v2/status.json");
        const statusText = await statusRes.body.text();
        const statusData = JSON.parse(statusText);

        const summaryRes = await request("https://www.traviscistatus.com/api/v2/summary.json");
        const summaryText = await summaryRes.body.text();
        const summaryData = JSON.parse(summaryText);

        let output = `Travis CI Service Status\n`;
        output += "=".repeat(80) + "\n\n";

        const indicator = statusData.status?.indicator || 'unknown';
        const description = statusData.status?.description || 'Unknown';

        const statusEmoji: Record<string, string> = {
          'none': '✓',
          'minor': '⚠',
          'major': '⚠⚠',
          'critical': '✗'
        };

        output += `Overall Status: ${statusEmoji[indicator] || '?'} ${description.toUpperCase()}\n`;
        output += `Last Updated: ${statusData.page?.updated_at || 'Unknown'}\n`;
        output += `\n`;

        const components = summaryData.components || [];
        if (components.length > 0) {
          output += `Service Components:\n`;
          output += `-`.repeat(80) + `\n`;

          for (const component of components) {
            const compStatus = component.status || 'unknown';
            const compEmoji = compStatus === 'operational' ? '✓' :
                            compStatus === 'degraded_performance' ? '⚠' :
                            compStatus === 'partial_outage' ? '⚠⚠' :
                            compStatus === 'major_outage' ? '✗' : '?';

            output += `${compEmoji} ${component.name}: ${compStatus.replace(/_/g, ' ')}\n`;
          }
        }

        const incidents = summaryData.incidents || [];
        if (incidents.length > 0) {
          output += `\n`;
          output += `Active Incidents:\n`;
          output += `-`.repeat(80) + `\n`;

          for (const incident of incidents) {
            output += `⚠ ${incident.name}\n`;
            output += `   Status: ${incident.status}\n`;
            output += `   Impact: ${incident.impact}\n`;
            if (incident.shortlink) output += `   More info: ${incident.shortlink}\n`;
          }
        } else {
          output += `\n✓ No active incidents\n`;
        }

        // Scheduled maintenance
        const maintenance = summaryData.scheduled_maintenances || [];
        if (maintenance.length > 0) {
          output += `\n`;
          output += `Scheduled Maintenance:\n`;
          output += `-`.repeat(80) + `\n`;

          for (const maint of maintenance) {
            output += `⏰ ${maint.name}\n`;
            output += `   Scheduled: ${maint.scheduled_for}\n`;
            if (maint.shortlink) output += `   More info: ${maint.shortlink}\n`;
          }
        }

        output += `\n`;
        output += `Status Page: https://www.traviscistatus.com\n`;

        return { content: [{ type: "text", text: output }] };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Unable to fetch Travis CI status: ${error instanceof Error ? error.message : String(error)}\n\nYou can check manually at: https://www.traviscistatus.com`
          }]
        };
      }
    }

    if (name === "travis_compareBuilds") {
      const buildId1 = args?.buildId1 as number;
      const buildId2 = args?.buildId2 as number;

      if (!buildId1 || !buildId2) {
        throw new Error("Both 'buildId1' and 'buildId2' parameters are required");
      }

      const [build1, build2] = await Promise.all([
        travis(`/build/${buildId1}`),
        travis(`/build/${buildId2}`)
      ]);

      let output = `Build Comparison\n`;
      output += "=".repeat(80) + "\n\n";

      output += `Build #${buildId1} vs Build #${buildId2}\n`;
      output += `-`.repeat(80) + `\n\n`;

      const state1 = build1.state || 'unknown';
      const state2 = build2.state || 'unknown';
      const emoji1 = state1 === 'passed' ? '✓' : state1 === 'failed' ? '✗' : '○';
      const emoji2 = state2 === 'passed' ? '✓' : state2 === 'failed' ? '✗' : '○';

      output += `Build States:\n`;
      output += `  Build #${buildId1}: ${emoji1} ${state1}\n`;
      output += `  Build #${buildId2}: ${emoji2} ${state2}\n`;
      if (state1 !== state2) {
        output += `  ⚠ States differ!\n`;
      }
      output += `\n`;

      const repo1 = build1.repository?.slug || 'unknown';
      const repo2 = build2.repository?.slug || 'unknown';
      output += `Repository:\n`;
      output += `  Build #${buildId1}: ${repo1}\n`;
      output += `  Build #${buildId2}: ${repo2}\n`;
      if (repo1 !== repo2) {
        output += `  ⚠ Different repositories!\n`;
      }
      output += `\n`;

      const branch1 = build1.branch?.name || 'unknown';
      const branch2 = build2.branch?.name || 'unknown';
      output += `Branch:\n`;
      output += `  Build #${buildId1}: ${branch1}\n`;
      output += `  Build #${buildId2}: ${branch2}\n`;
      if (branch1 !== branch2) {
        output += `  ⚠ Different branches!\n`;
      }
      output += `\n`;

      const commit1 = build1.commit;
      const commit2 = build2.commit;
      output += `Commits:\n`;
      if (commit1) {
        output += `  Build #${buildId1}:\n`;
        output += `    SHA: ${commit1.sha?.substring(0, 8) || 'unknown'}\n`;
        output += `    Message: ${commit1.message?.split('\n')[0] || 'N/A'}\n`;
        output += `    Author: ${commit1.author_name || 'unknown'}\n`;
        output += `    Date: ${commit1.committed_at || 'unknown'}\n`;
      }
      if (commit2) {
        output += `  Build #${buildId2}:\n`;
        output += `    SHA: ${commit2.sha?.substring(0, 8) || 'unknown'}\n`;
        output += `    Message: ${commit2.message?.split('\n')[0] || 'N/A'}\n`;
        output += `    Author: ${commit2.author_name || 'unknown'}\n`;
        output += `    Date: ${commit2.committed_at || 'unknown'}\n`;
      }
      if (commit1?.sha !== commit2?.sha) {
        output += `  ⚠ Different commits!\n`;
      }
      output += `\n`;

      const duration1 = build1.duration || 0;
      const duration2 = build2.duration || 0;
      output += `Build Duration:\n`;
      output += `  Build #${buildId1}: ${Math.floor(duration1 / 60)}m ${duration1 % 60}s\n`;
      output += `  Build #${buildId2}: ${Math.floor(duration2 / 60)}m ${duration2 % 60}s\n`;
      if (duration1 && duration2) {
        const diff = Math.abs(duration1 - duration2);
        const faster = duration1 < duration2 ? buildId1 : buildId2;
        output += `  Build #${faster} was ${diff}s faster\n`;
      }
      output += `\n`;

      output += `Timeline:\n`;
      output += `  Build #${buildId1}:\n`;
      output += `    Started: ${build1.started_at || 'N/A'}\n`;
      output += `    Finished: ${build1.finished_at || 'N/A'}\n`;
      output += `  Build #${buildId2}:\n`;
      output += `    Started: ${build2.started_at || 'N/A'}\n`;
      output += `    Finished: ${build2.finished_at || 'N/A'}\n`;
      output += `\n`;

      const jobs1 = build1.jobs || [];
      const jobs2 = build2.jobs || [];
      output += `Jobs:\n`;
      output += `  Build #${buildId1}: ${jobs1.length} job(s)\n`;
      output += `  Build #${buildId2}: ${jobs2.length} job(s)\n`;

      if (jobs1.length > 0 || jobs2.length > 0) {
        output += `\n`;
        output += `Job States:\n`;
        output += `-`.repeat(80) + `\n`;

        if (jobs1.length > 0) {
          output += `  Build #${buildId1}:\n`;
          for (const job of jobs1) {
            const jobState = job.state || 'unknown';
            const jobEmoji = jobState === 'passed' ? '✓' : jobState === 'failed' ? '✗' : '○';
            output += `    ${jobEmoji} Job #${job.number}: ${jobState}`;
            if (job.config?.language) output += ` (${job.config.language})`;
            if (job.config?.node_js) output += ` - Node ${job.config.node_js}`;
            if (job.config?.python) output += ` - Python ${job.config.python}`;
            if (job.config?.ruby) output += ` - Ruby ${job.config.ruby}`;
            output += `\n`;
          }
        }

        if (jobs2.length > 0) {
          output += `  Build #${buildId2}:\n`;
          for (const job of jobs2) {
            const jobState = job.state || 'unknown';
            const jobEmoji = jobState === 'passed' ? '✓' : jobState === 'failed' ? '✗' : '○';
            output += `    ${jobEmoji} Job #${job.number}: ${jobState}`;
            if (job.config?.language) output += ` (${job.config.language})`;
            if (job.config?.node_js) output += ` - Node ${job.config.node_js}`;
            if (job.config?.python) output += ` - Python ${job.config.python}`;
            if (job.config?.ruby) output += ` - Ruby ${job.config.ruby}`;
            output += `\n`;
          }
        }

        const passed1 = jobs1.filter((j: any) => j.state === 'passed').length;
        const failed1 = jobs1.filter((j: any) => j.state === 'failed').length;
        const passed2 = jobs2.filter((j: any) => j.state === 'passed').length;
        const failed2 = jobs2.filter((j: any) => j.state === 'failed').length;

        output += `\n`;
        output += `Summary:\n`;
        output += `  Build #${buildId1}: ${passed1} passed, ${failed1} failed\n`;
        output += `  Build #${buildId2}: ${passed2} passed, ${failed2} failed\n`;
      }

      output += `\n`;
      output += `Recommendation:\n`;
      if (state1 === 'passed' && state2 === 'failed') {
        output += `  • Build #${buildId1} passed but #${buildId2} failed\n`;
        output += `  • Check commit differences and failed job logs for #${buildId2}\n`;
        output += `  • Use: "Show me logs for build ${buildId2}" to investigate\n`;
      } else if (state1 === 'failed' && state2 === 'passed') {
        output += `  • Build #${buildId2} passed but #${buildId1} failed\n`;
        output += `  • Check commit differences and failed job logs for #${buildId1}\n`;
        output += `  • Use: "Show me logs for build ${buildId1}" to investigate\n`;
      } else if (state1 === state2) {
        output += `  • Both builds have the same state: ${state1}\n`;
        if (commit1?.sha !== commit2?.sha) {
          output += `  • Different commits may have different behaviors\n`;
        }
        if (duration1 && duration2 && Math.abs(duration1 - duration2) > 60) {
          output += `  • Significant duration difference - check for performance changes\n`;
        }
      }

      return { content: [{ type: "text", text: output }] };
    }

    if (name === "travis_getBuildInsights") {
      const repo = args?.repo as string;
      const limit = Math.min((args?.limit as number) || 50, 100);
      const branch = args?.branch as string | undefined;

      if (!repo) {
        throw new Error("Parameter 'repo' is required");
      }

      let buildPath = `/repo/${encodeURIComponent(repo)}/builds?limit=${limit}`;
      if (branch) {
        buildPath += `&branch.name=${encodeURIComponent(branch)}`;
      }

      const buildsData = await travis(buildPath);
      const builds = buildsData.builds || [];

      if (builds.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No builds found for repository: ${repo}${branch ? ` (branch: ${branch})` : ''}`
          }]
        };
      }

      let totalBuilds = builds.length;
      let passedBuilds = 0;
      let failedBuilds = 0;
      let canceledBuilds = 0;
      let erroredBuilds = 0;
      let totalDuration = 0;
      let buildsWithDuration = 0;
      let durations: number[] = [];

      const stateCount: Record<string, number> = {};
      const branchStats: Record<string, { passed: number; failed: number; total: number }> = {};

      for (const build of builds) {
        const state = build.state || 'unknown';
        stateCount[state] = (stateCount[state] || 0) + 1;

        if (state === 'passed') passedBuilds++;
        else if (state === 'failed') failedBuilds++;
        else if (state === 'canceled') canceledBuilds++;
        else if (state === 'errored') erroredBuilds++;

        if (build.duration && build.duration > 0) {
          totalDuration += build.duration;
          durations.push(build.duration);
          buildsWithDuration++;
        }

        const branchName = build.branch?.name || 'unknown';
        if (!branchStats[branchName]) {
          branchStats[branchName] = { passed: 0, failed: 0, total: 0 };
        }
        branchStats[branchName].total++;
        if (state === 'passed') branchStats[branchName].passed++;
        if (state === 'failed') branchStats[branchName].failed++;
      }

      durations.sort((a, b) => a - b);
      const avgDuration = buildsWithDuration > 0 ? totalDuration / buildsWithDuration : 0;
      const medianDuration = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;
      const minDuration = durations.length > 0 ? durations[0] : 0;
      const maxDuration = durations.length > 0 ? durations[durations.length - 1] : 0;

      const completedBuilds = passedBuilds + failedBuilds + erroredBuilds;
      const passRate = completedBuilds > 0 ? (passedBuilds / completedBuilds) * 100 : 0;

      const recentBuilds = builds.slice(0, Math.min(10, builds.length));
      const recentPassed = recentBuilds.filter((b: any) => b.state === 'passed').length;
      const recentFailed = recentBuilds.filter((b: any) => b.state === 'failed').length;
      const recentCompletedBuilds = recentPassed + recentFailed;
      const recentPassRate = recentCompletedBuilds > 0 ? (recentPassed / recentCompletedBuilds) * 100 : 0;

      const recentFailures = builds.filter((b: any) => b.state === 'failed' || b.state === 'errored').slice(0, 5);

      let output = `Build Insights for: ${repo}\n`;
      if (branch) output += `Branch: ${branch}\n`;
      output += "=".repeat(80) + "\n\n";

      output += `Analyzing ${totalBuilds} most recent build(s)\n`;
      output += `\n`;

      output += `Overall Statistics:\n`;
      output += `-`.repeat(80) + `\n`;
      output += `✓ Passed: ${passedBuilds} (${passRate.toFixed(1)}%)\n`;
      output += `✗ Failed: ${failedBuilds}\n`;
      if (erroredBuilds > 0) output += `⚠ Errored: ${erroredBuilds}\n`;
      if (canceledBuilds > 0) output += `○ Canceled: ${canceledBuilds}\n`;
      output += `\n`;

      output += `Recent Trend (Last 10 Builds):\n`;
      output += `-`.repeat(80) + `\n`;
      output += `Pass Rate: ${recentPassRate.toFixed(1)}%`;
      if (recentPassRate > passRate + 5) {
        output += ` 📈 Improving!\n`;
      } else if (recentPassRate < passRate - 5) {
        output += ` 📉 Declining\n`;
      } else {
        output += ` ➡ Stable\n`;
      }
      output += `\n`;

      if (buildsWithDuration > 0) {
        output += `Build Duration Analysis:\n`;
        output += `-`.repeat(80) + `\n`;
        output += `Average: ${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s\n`;
        output += `Median: ${Math.floor(medianDuration / 60)}m ${medianDuration % 60}s\n`;
        output += `Fastest: ${Math.floor(minDuration / 60)}m ${minDuration % 60}s\n`;
        output += `Slowest: ${Math.floor(maxDuration / 60)}m ${maxDuration % 60}s\n`;
        output += `\n`;
      }

      if (!branch && Object.keys(branchStats).length > 1) {
        output += `Branch Breakdown:\n`;
        output += `-`.repeat(80) + `\n`;

        const sortedBranches = Object.entries(branchStats)
          .sort(([, a], [, b]) => b.total - a.total)
          .slice(0, 5);

        for (const [branchName, stats] of sortedBranches) {
          const branchPassRate = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
          output += `${branchName}: ${stats.total} builds, ${branchPassRate.toFixed(1)}% pass rate\n`;
        }
        output += `\n`;
      }

      if (recentFailures.length > 0) {
        output += `Recent Failures:\n`;
        output += `-`.repeat(80) + `\n`;
        for (const build of recentFailures) {
          const buildNumber = build.number || build.id;
          const branchName = build.branch?.name || 'unknown';
          const commitMsg = build.commit?.message?.split('\n')[0] || 'N/A';
          const finishedAt = build.finished_at ? new Date(build.finished_at).toISOString().split('T')[0] : 'N/A';
          output += `✗ Build #${buildNumber} (${branchName}) - ${finishedAt}\n`;
          output += `  "${commitMsg.substring(0, 60)}${commitMsg.length > 60 ? '...' : ''}"\n`;
        }
        output += `\n`;
      }

      output += `Insights & Recommendations:\n`;
      output += `-`.repeat(80) + `\n`;

      if (passRate >= 90) {
        output += `✓ Excellent build stability! ${passRate.toFixed(1)}% pass rate\n`;
      } else if (passRate >= 75) {
        output += `⚠ Good build stability at ${passRate.toFixed(1)}%, but there's room for improvement\n`;
      } else if (passRate >= 50) {
        output += `⚠ Moderate build stability at ${passRate.toFixed(1)}%. Consider investigating common failure patterns\n`;
      } else {
        output += `✗ Low build stability at ${passRate.toFixed(1)}%. Urgent attention needed\n`;
      }

      if (recentPassRate < passRate - 10) {
        output += `📉 Recent builds are failing more frequently. Investigate recent changes\n`;
      }

      if (maxDuration > avgDuration * 1.5) {
        output += `⏱ Some builds are significantly slower than average. Check for performance issues\n`;
      }

      if (failedBuilds > passedBuilds) {
        output += `⚠ More failures than passes. Review recent commits and build configuration\n`;
      }

      return { content: [{ type: "text", text: output }] };
    }

    if (name === "travis_getOptimizationRecommendations") {
      const buildId = args?.buildId as number;

      if (!buildId) {
        throw new Error("Parameter 'buildId' is required");
      }

      // Fetch build details and all job logs
      const buildData: TravisBuild = await travis(`/build/${buildId}`);
      const jobs = buildData.jobs || [];

      if (jobs.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No jobs found for this build."
          }]
        };
      }

      // Fetch logs for all jobs
      const logPromises = jobs.map(async (job: TravisJob): Promise<{ jobId: number; jobNumber: string; log: string; duration?: number }> => {
        try {
          const log = await travis(`/job/${job.id}/log.txt`);
          const jobDetails = await travis(`/job/${job.id}`);
          return {
            jobId: job.id,
            jobNumber: job.number,
            log: log,
            duration: jobDetails.duration
          };
        } catch (error) {
          return {
            jobId: job.id,
            jobNumber: job.number,
            log: `Error fetching log: ${error}`,
            duration: undefined
          };
        }
      });

      const jobLogs = await Promise.all(logPromises);

      // Analysis patterns
      const findings: { category: string; detail: string }[] = [];

      // Analyze each job's log
      for (const jobLog of jobLogs) {
        const log = jobLog.log;
        const lines = log.split('\n');

        // Pattern 1: Detect slow dependency installation
        const npmInstallLines = lines.filter(line =>
          line.includes('npm install') ||
          line.includes('npm ci') ||
          line.includes('yarn install') ||
          line.includes('pip install') ||
          line.includes('bundle install')
        );

        if (npmInstallLines.length > 0) {
          findings.push({
            category: "Dependency Installation",
            detail: `Job #${jobLog.jobNumber}: Detected package installation. Consider caching dependencies.`
          });
        }

        // Pattern 2: Check for cache usage
        const cacheHitPattern = /cache.*hit|using cached|cache.*restored/i;
        const cacheMissPattern = /cache.*miss|cache.*not found|downloading/i;
        const hasCacheHit = lines.some(line => cacheHitPattern.test(line));
        const hasCacheMiss = lines.some(line => cacheMissPattern.test(line));

        if (hasCacheMiss && !hasCacheHit) {
          findings.push({
            category: "Caching",
            detail: `Job #${jobLog.jobNumber}: Cache misses detected. Verify cache configuration.`
          });
        }

        // Pattern 3: Detect compilation/build steps
        const compilationPatterns = [
          /tsc|typescript compiler/i,
          /webpack|rollup|vite/i,
          /mvn compile|gradle build/i,
          /cargo build|go build/i,
          /npm run build|yarn build/i
        ];

        for (const pattern of compilationPatterns) {
          if (lines.some(line => pattern.test(line))) {
            findings.push({
              category: "Build Process",
              detail: `Job #${jobLog.jobNumber}: Build/compilation detected. Consider caching build artifacts.`
            });
            break;
          }
        }

        // Pattern 4: Detect test execution time
        const testPatterns = [
          /(\d+)\s+tests?,\s+(\d+)\s+passed/i,
          /test suites?:.*\d+.*passed/i,
          /tests?.*completed in.*(\d+\.?\d*)\s*(s|ms|min)/i,
          /finished in.*(\d+\.?\d*)\s*seconds?/i
        ];

        for (const pattern of testPatterns) {
          const match = log.match(pattern);
          if (match) {
            findings.push({
              category: "Testing",
              detail: `Job #${jobLog.jobNumber}: Tests detected. Consider test splitting for parallel execution.`
            });
            break;
          }
        }

        // Pattern 5: Detect Docker operations
        if (log.includes('docker pull') || log.includes('docker build')) {
          findings.push({
            category: "Docker",
            detail: `Job #${jobLog.jobNumber}: Docker operations found. Consider using Docker layer caching.`
          });
        }

        // Pattern 6: Detect repeated operations across jobs
        const setupSteps = lines.filter(line =>
          line.includes('Setting up') ||
          line.includes('Installing') ||
          line.includes('Downloading')
        );

        if (setupSteps.length > 10) {
          findings.push({
            category: "Setup Overhead",
            detail: `Job #${jobLog.jobNumber}: Multiple setup operations detected (${setupSteps.length} steps).`
          });
        }
      }

      // Generate recommendations based on findings
      const categoryCount: Record<string, number> = {};
      for (const finding of findings) {
        categoryCount[finding.category] = (categoryCount[finding.category] || 0) + 1;
      }

      // Build output
      let output = `Build Optimization Recommendations for Build #${buildId}\n`;
      output += "=".repeat(80) + "\n\n";

      output += `Analyzed ${jobs.length} job(s) across this build\n`;
      output += `\n`;

      // Key findings summary
      output += `Key Findings:\n`;
      output += `-`.repeat(80) + `\n`;

      if (Object.keys(categoryCount).length === 0) {
        output += `✓ No obvious optimization opportunities detected.\n`;
        output += `  Your build appears to be well-optimized!\n`;
      } else {
        for (const [category, count] of Object.entries(categoryCount)) {
          output += `• ${category}: ${count} occurrence(s)\n`;
        }
      }
      output += `\n`;

      // Detailed findings
      if (findings.length > 0) {
        output += `Detailed Analysis:\n`;
        output += `-`.repeat(80) + `\n`;

        const grouped: Record<string, string[]> = {};
        for (const finding of findings) {
          if (!grouped[finding.category]) {
            grouped[finding.category] = [];
          }
          grouped[finding.category].push(finding.detail);
        }

        for (const [category, details] of Object.entries(grouped)) {
          output += `\n${category}:\n`;
          for (const detail of details) {
            output += `  • ${detail}\n`;
          }
        }
        output += `\n`;
      }

      // Generate actionable recommendations
      output += `Optimization Recommendations:\n`;
      output += `-`.repeat(80) + `\n`;

      if (categoryCount["Dependency Installation"]) {
        output += `\n📦 Dependency Caching:\n`;
        output += `  • Enable Travis CI's built-in cache for dependencies\n`;
        output += `  • Add to .travis.yml:\n`;
        output += `    cache:\n`;
        output += `      directories:\n`;
        output += `        - node_modules  # for Node.js\n`;
        output += `        - ~/.npm\n`;
        output += `        - ~/.cache/pip  # for Python\n`;
        output += `        - vendor/bundle # for Ruby\n`;
        output += `  • Use 'npm ci' instead of 'npm install' for faster, reproducible builds\n`;
      }

      if (categoryCount["Build Process"]) {
        output += `\n🔨 Build Artifact Caching:\n`;
        output += `  • Cache compiled/built artifacts between builds\n`;
        output += `  • Add build output directories to cache configuration\n`;
        output += `  • Consider incremental compilation if supported by your tooling\n`;
        output += `  • Example: cache: { directories: ['dist', 'build', '.next'] }\n`;
      }

      if (categoryCount["Testing"]) {
        output += `\n🧪 Test Optimization:\n`;
        output += `  • Split tests across multiple jobs for parallel execution\n`;
        output += `  • Use test sharding/splitting based on timing data\n`;
        output += `  • Consider running unit tests before slower integration tests\n`;
        output += `  • Run only affected tests for PR builds\n`;
        output += `  • Example: Use build matrix to run test suites in parallel\n`;
      }

      if (categoryCount["Docker"]) {
        output += `\n🐳 Docker Optimization:\n`;
        output += `  • Enable Docker layer caching in Travis CI\n`;
        output += `  • Use multi-stage builds to reduce image size\n`;
        output += `  • Pull images before build to cache them\n`;
        output += `  • Consider using smaller base images (alpine variants)\n`;
      }

      if (categoryCount["Caching"]) {
        output += `\n💾 Cache Configuration:\n`;
        output += `  • Review cache key strategy to ensure proper invalidation\n`;
        output += `  • Verify cache paths are correct for your project structure\n`;
        output += `  • Monitor cache hit rates in subsequent builds\n`;
        output += `  • Clear cache if seeing stale dependency issues\n`;
      }

      if (categoryCount["Setup Overhead"]) {
        output += `\n⚡ Reduce Setup Overhead:\n`;
        output += `  • Consolidate similar setup steps\n`;
        output += `  • Use custom Docker images with pre-installed tools\n`;
        output += `  • Move one-time setup to 'before_install' phase\n`;
        output += `  • Reduce unnecessary installs and downloads\n`;
      }

      // General recommendations
      output += `\n🎯 General Best Practices:\n`;
      output += `  • Use 'fast_finish: true' in build matrix to fail fast\n`;
      output += `  • Leverage build stages for dependent job execution\n`;
      output += `  • Consider conditional builds (skip builds for doc-only changes)\n`;
      output += `  • Monitor build times regularly and set up alerts for regressions\n`;

      // Job duration analysis
      if (jobLogs.some(j => j.duration)) {
        output += `\n`;
        output += `Job Duration Analysis:\n`;
        output += `-`.repeat(80) + `\n`;

        const sortedJobs = jobLogs
          .filter(j => j.duration)
          .sort((a, b) => (b.duration || 0) - (a.duration || 0));

        if (sortedJobs.length > 0) {
          output += `Slowest jobs:\n`;
          for (const job of sortedJobs.slice(0, 3)) {
            const minutes = Math.floor((job.duration || 0) / 60);
            const seconds = (job.duration || 0) % 60;
            output += `  • Job #${job.jobNumber}: ${minutes}m ${seconds}s\n`;
          }

          if (sortedJobs[0].duration && sortedJobs[0].duration > 300) {
            output += `\n⚠ Slowest job takes over 5 minutes - consider optimization strategies above\n`;
          }
        }
      }

      output += `\n`;
      output += `Next Steps:\n`;
      output += `-`.repeat(80) + `\n`;
      output += `1. Review the recommendations above\n`;
      output += `2. Update your .travis.yml with caching configuration\n`;
      output += `3. Monitor subsequent build times for improvements\n`;
      output += `4. Use 'travis_compareBuilds' to compare before/after optimization\n`;

      return { content: [{ type: "text", text: output }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: `Error: ${errorMessage}`
      }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-travis server is ready (stdio).");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});