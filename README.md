# Confluence MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with Confluence. Read, create, update, and delete pages, manage spaces, search content, and more.

## Features

- **Page Operations**: Get, create, update, delete pages
- **Space Operations**: List spaces, get space details, browse space content
- **Search**: Full CQL support, search by text or title
- **Labels**: Get, add, remove page labels
- **Comments**: Read and add page comments
- **Attachments**: List page attachments
- **Special**: Extract DONE sections from daily reports

## Installation

### Using npx (recommended, no install required)

No installation needed! Just configure Claude Desktop or Claude Code as shown below.

### Global Installation

```bash
npm install -g @vinhnguyen/confluence-mcp
```

### From Source

```bash
git clone https://github.com/vinhnguyen/confluence-mcp.git
cd confluence-mcp
npm install
```

## Configuration

### Prerequisites

The MCP server requires Atlassian credentials:

| Variable | Description | Example |
|----------|-------------|---------|
| `ATLASSIAN_EMAIL` | Your Atlassian account email | `user@company.com` |
| `ATLASSIAN_API_TOKEN` | API token from Atlassian | `ATATT3xFfGF0...` |
| `ATLASSIAN_DOMAIN` | Your Confluence domain | `company.atlassian.net` |

### Getting an API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a label and copy the token

### Claude Desktop

Add the server to your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Using npx (recommended, no install required):

```json
{
  "mcpServers": {
    "confluence": {
      "command": "npx",
      "args": ["-y", "@vinhnguyen/confluence-mcp"],
      "env": {
        "ATLASSIAN_EMAIL": "your.email@company.com",
        "ATLASSIAN_API_TOKEN": "your_api_token",
        "ATLASSIAN_DOMAIN": "your-domain.atlassian.net"
      }
    }
  }
}
```

Or if installed globally via npm:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "confluence-mcp",
      "env": {
        "ATLASSIAN_EMAIL": "your.email@company.com",
        "ATLASSIAN_API_TOKEN": "your_api_token",
        "ATLASSIAN_DOMAIN": "your-domain.atlassian.net"
      }
    }
  }
}
```

Or from source:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "node",
      "args": ["/path/to/confluence-mcp/index.js"],
      "env": {
        "ATLASSIAN_EMAIL": "your.email@company.com",
        "ATLASSIAN_API_TOKEN": "your_api_token",
        "ATLASSIAN_DOMAIN": "your-domain.atlassian.net"
      }
    }
  }
}
```

### Claude Code

Add to your `~/.claude.json` (project) or `~/.claude/settings.json` (global):

Using npx (recommended):

```json
{
  "mcpServers": {
    "confluence": {
      "command": "npx",
      "args": ["-y", "@vinhnguyen/confluence-mcp"],
      "env": {
        "ATLASSIAN_EMAIL": "your.email@company.com",
        "ATLASSIAN_API_TOKEN": "your_api_token",
        "ATLASSIAN_DOMAIN": "your-domain.atlassian.net"
      }
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "confluence": {
      "command": "confluence-mcp",
      "env": {
        "ATLASSIAN_EMAIL": "your.email@company.com",
        "ATLASSIAN_API_TOKEN": "your_api_token",
        "ATLASSIAN_DOMAIN": "your-domain.atlassian.net"
      }
    }
  }
}
```

**Restart Claude Desktop or Claude Code after updating the config.**

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ATLASSIAN_EMAIL` | Your Atlassian account email | Yes |
| `ATLASSIAN_API_TOKEN` | API token from Atlassian | Yes |
| `ATLASSIAN_DOMAIN` | Your Confluence domain (e.g., `company.atlassian.net`) | Yes |

## Available Tools

### Page Operations

| Tool | Description |
|------|-------------|
| `confluence_get_page` | Get page details including content, version, metadata |
| `confluence_get_page_content` | Get page content as text or HTML |
| `confluence_get_child_pages` | Get all child pages of a parent (with pagination) |
| `confluence_create_page` | Create a new page in a space |
| `confluence_update_page` | Update an existing page |
| `confluence_delete_page` | Delete a page (moves to trash) |

### Space Operations

| Tool | Description |
|------|-------------|
| `confluence_list_spaces` | List all accessible spaces |
| `confluence_get_space` | Get space details |
| `confluence_get_space_content` | Get pages or blogposts in a space |

### Search Operations

| Tool | Description |
|------|-------------|
| `confluence_search` | Search using CQL query |
| `confluence_search_by_text` | Search pages by text content |
| `confluence_search_by_title` | Search pages by title |

### Labels Operations

| Tool | Description |
|------|-------------|
| `confluence_get_page_labels` | Get labels on a page |
| `confluence_add_page_label` | Add a label to a page |
| `confluence_remove_page_label` | Remove a label from a page |

### Comments & Attachments

| Tool | Description |
|------|-------------|
| `confluence_get_page_comments` | Get comments on a page |
| `confluence_add_page_comment` | Add a comment to a page |
| `confluence_get_page_attachments` | List attachments on a page |

### Special Tools

| Tool | Description |
|------|-------------|
| `confluence_extract_done_sections` | Extract DONE sections from daily reports |

## Example Usage

### Get a page and its content

```
Use confluence_get_page with pageId "12345678"
```

### Create a new page

```
Use confluence_create_page with:
- spaceKey: "DEV"
- title: "Weekly Report - Week 5"
- content: "<h1>Weekly Summary</h1><p>This week we completed...</p>"
- parentId: "87654321" (optional)
```

### Search for pages

```
Use confluence_search_by_title with title "Daily Report" and spaceKey "TEAM"
```

### Extract DONE sections for report generation

```
Use confluence_extract_done_sections with pageId "12345678"
```

## Content Format

When creating or updating pages, use Confluence storage format (XHTML):

```html
<h1>Heading 1</h1>
<h2>Heading 2</h2>
<p>Paragraph text</p>
<ul>
  <li>List item 1</li>
  <li>List item 2</li>
</ul>
<ac:structured-macro ac:name="code">
  <ac:plain-text-body><![CDATA[code here]]></ac:plain-text-body>
</ac:structured-macro>
```

## CQL Query Examples

Confluence Query Language (CQL) is used for advanced searches:

```
# Pages in a specific space
type=page AND space=DEV

# Pages modified recently
type=page AND lastmodified > now("-7d")

# Pages with specific label
type=page AND label=weekly-report

# Pages by creator
type=page AND creator=currentUser()

# Combined query
type=page AND space=TEAM AND text ~ "report" AND lastmodified > now("-30d")
```

## License

MIT
