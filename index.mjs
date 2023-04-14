import axios from "axios";
import chalk from "chalk";
import dotenv from "dotenv";

dotenv.config();

const jiraEmail = process.env.JIRA_EMAIL;
const jiraApiToken = process.env.JIRA_API_TOKEN;
const jiraDomain = process.env.JIRA_DOMAIN;

const jqlQuery = process.argv[2];

if (!jqlQuery) {
  console.error("Please provide a JQL query as a command line argument.");
  process.exit(1);
}

const jiraClient = axios.create({
  baseURL: `https://${jiraDomain}/rest/api/3`,
  auth: {
    username: jiraEmail,
    password: jiraApiToken,
  },
  headers: {
    Accept: "application/json",
  },
});

const devStatusClient = axios.create({
  baseURL: `https://${jiraDomain}/rest/dev-status/latest`,
  auth: {
    username: jiraEmail,
    password: jiraApiToken,
  },
  headers: {
    Accept: "application/json",
  },
});

async function getJiraIssues(jql) {
  try {
    const response = await jiraClient.get("/search", {
      params: { jql },
    });

    return response.data.issues;
  } catch (error) {
    console.error("Error fetching Jira issues:", error.message);
    process.exit(1);
  }
}

async function getIssueDevelopmentInformation(issueKey) {
  try {
    const response = await devStatusClient.get("/issue/detail", {
      params: {
        issueId: issueKey,
        applicationType: "GitHub",
        dataType: "branch",
      },
    });

    return response.data.detail && response.data.detail[0];
  } catch (error) {
    console.error("Error fetching development information:", error.message);
    process.exit(1);
  }
}

function extractGitHubRepositories(detail) {
  if (!detail || !detail.pullRequests) return [];

  return detail.pullRequests.map((pr) => {
    const match = pr.url.match(/https:\/\/github\.com\/([^/]+\/[^/]+)/);
    const repo = match ? match[1] : "";
    const approved = pr.reviewers.some((reviewer) => reviewer.approved);

    return {
      repo,
      status: pr.status,
      approved,
    };
  });
}

function createJiraTicketLink(key) {
  return `https://${jiraDomain}/browse/${key}`;
}

function getStatusEmoji(status) {
  switch (status) {
    case "MERGED":
      return "✅";
    case "DECLINED":
      return "❌";
    case "OPEN":
      return "🟡";
    default:
      return "❓";
  }
}

(async () => {
  const issues = await getJiraIssues(jqlQuery);

  for (const issue of issues) {
    const jiraTicketLink = createJiraTicketLink(issue.key);
    const devInfo = await getIssueDevelopmentInformation(issue.id);

    const repositories = extractGitHubRepositories(devInfo);

    console.log(chalk.blue(jiraTicketLink), "-", issue.fields.summary);

    for (const repo of repositories) {
      const statusEmoji = getStatusEmoji(repo.status);
      const approvalEmoji = repo.approved ? "🟢" : "🔴";

      console.log(
        "  ",
        statusEmoji,
        repo.repo,
        "-",
        chalk.green("Status:"),
        repo.status,
        chalk.green("Approved:"),
        approvalEmoji
      );
    }
  }
})();
