# Jira-GitHub Pull Request Information

This Node.js script fetches Jira issues based on a provided JQL query and displays related GitHub pull request information, such as the status of the pull request and whether it has been approved.

## Prerequisites

Node.js
npm
A Jira Cloud instance with GitHub integration set up
An Atlassian API token

## Installation

Clone this repository or download the script file jira-github.js.
Run npm init and follow the prompts to create a package.json file.
Install the required dependencies:

```
yarn add axios dotenv chalk
```

Create a .env file in the project root directory and add the following environment variables with your own credentials:

```
JIRA_EMAIL=your_jira_email@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_DOMAIN=your_jira_domain.atlassian.net
```

Replace your_jira_email@example.com, your_jira_api_token, and your_jira_domain.atlassian.net with your Jira email address, API token, and domain, respectively.

## Usage

To run the script, use the following command, replacing your_jql_query with your desired JQL query:

`node index.mjs "your_jql_query"`
For example:

```
node index.mj "project = MYPROJECT and status = 'In Progress'"
```

The script will fetch the Jira issues based on the JQL query and display the related GitHub pull request information.
