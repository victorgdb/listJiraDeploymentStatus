import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

const jiraEmail = process.env.JIRA_EMAIL;
const jiraApiToken = process.env.JIRA_API_TOKEN;
const jiraDomain = process.env.JIRA_DOMAIN;

const jqlQuery = process.argv[2];

if (!jqlQuery) {
  console.error('Please provide a JQL query as a command line argument.');
  process.exit(1);
}

const jiraClient = axios.create({
  baseURL: `https://${jiraDomain}/rest/api/3`,
  auth: {
    username: jiraEmail,
    password: jiraApiToken
  },
  headers: {
    Accept: 'application/json'
  }
});

const devStatusClient = axios.create({
  baseURL: `https://${jiraDomain}/rest/dev-status/latest`,
  auth: {
    username: jiraEmail,
    password: jiraApiToken
  },
  headers: {
    Accept: 'application/json'
  }
});

async function getJiraIssues(jql) {
  try {
    const response = await jiraClient.get('/search', {
      params: { jql }
    });

    return response.data.issues;
  } catch (error) {
    console.error('Error fetching Jira issues:', error.message);
    process.exit(1);
  }
}

async function getIssueDevelopmentInformation(issueKey) {
  try {
    const response = await devStatusClient.get('/issue/detail', {
      params: {
        issueId: issueKey,
        applicationType: 'GitHub',
        dataType: 'branch'
      }
    });

    return response.data.detail && response.data.detail[0];
  } catch (error) {
    console.error('Error fetching development information:', error.message);
    process.exit(1);
  }
}

function extractGitHubRepositories(detail) {
  if (!detail || !detail.pullRequests) return [];

  return detail.pullRequests.map((pr) => {
    const match = pr.url.match(/https:\/\/github\.com\/([^/]+\/[^/]+)/);
    const repo = match ? match[1] : '';
    const approved = pr.reviewers.some((reviewer) => reviewer.approved);

    return {
      repo,
      status: pr.status,
      approved,
      title: pr.name
    };
  });
}

function createJiraTicketLink(key) {
  return `https://${jiraDomain}/browse/${key}`;
}

function getStatusEmoji(status) {
  switch (status) {
    case 'MERGED':
      return '✅';
    case 'DECLINED':
      return '❌';
    case 'OPEN':
      return '🟡';
    default:
      return '❓';
  }
}

(async () => {
  const issues = await getJiraIssues(jqlQuery);
  const issuesDevInfo = await Promise.all(
    issues.map((issue) => getIssueDevelopmentInformation(issue.id))
  );

  const issuesWithPRs = issues.filter((_, index) => {
    const devInfo = issuesDevInfo[index];
    return devInfo && devInfo.pullRequests && devInfo.pullRequests.length > 0;
  });

  const issuesWithoutPRs = issues.filter((_, index) => {
    const devInfo = issuesDevInfo[index];
    return (
      !devInfo || !devInfo.pullRequests || devInfo.pullRequests.length === 0
    );
  });
  const statusOrder = [
    'Backlog',
    'To Do',
    'Doing',
    'To Review',
    'To check by Product',
    'To test',
    'To deploy in Dev',
    'To deploy in staging',
    'To deploy in Production',
    'Done'
  ];

  function sortByStatus(a, b) {
    const aStatusIndex = statusOrder.indexOf(a.fields.status.name);
    const bStatusIndex = statusOrder.indexOf(b.fields.status.name);

    return aStatusIndex - bStatusIndex;
  }

  issuesWithPRs.sort(sortByStatus);

  for (const issue of issuesWithPRs) {
    const jiraTicketLink = createJiraTicketLink(issue.key);
    const devInfo = issuesDevInfo[issues.indexOf(issue)];
    const repositories = extractGitHubRepositories(devInfo);

    console.log(chalk.blue(jiraTicketLink), '-', issue.fields.summary);

    for (const repo of repositories) {
      const statusEmoji = getStatusEmoji(repo.status);
      const approvalEmoji = repo.approved ? '🟢' : '🔴';

      console.log(
        '  ',
        chalk.cyan(issue.fields.status.name),
        '-',
        statusEmoji,
        repo.repo,
        chalk.magenta(repo.title),
        '-',
        chalk.green('Status:'),
        repo.status,
        chalk.green('Approved:'),
        approvalEmoji,
        '\n'
      );
    }
  }
  console.log(chalk.yellow('Tickets without PR information:'));

  for (const issue of issuesWithoutPRs) {
    const jiraTicketLink = createJiraTicketLink(issue.key);
    console.log(
      chalk.blue(jiraTicketLink),
      '-',
      issue.fields.summary,
      chalk.cyan(issue.fields.status.name)
    );
  }
})();
