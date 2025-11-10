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
    description: "Trigger a build for a repo and branch, with optional config overrides.",
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
    description: "Convenience tool to fetch all logs for all jobs in a build. Returns combined logs from all jobs.",
    inputSchema: {
      type: "object",
      required: ["buildId"],
      properties: {
        buildId: { type: "integer", description: "The build ID to get all logs for" }
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

      // First get the build details to find all job IDs
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

      // Format the combined output
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
