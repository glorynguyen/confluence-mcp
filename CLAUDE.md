# CLAUDE.md - Confluence MCP Server

This file provides context for AI assistants working with this codebase.

## Project Overview

**confluence-mcp** is a Model Context Protocol (MCP) server that enables LLMs to interact with Atlassian Confluence. It provides tools for reading, creating, updating, and deleting pages, managing spaces, searching content, handling labels/comments/attachments, and extracting report data.

## Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Protocol**: MCP (Model Context Protocol) via `@modelcontextprotocol/sdk`
- **Transport**: Stdio (standard input/output)
- **Dependencies**:
  - `@modelcontextprotocol/sdk` - MCP server implementation
  - `html-to-text` - Convert HTML content to plain text

## Project Structure

```
confluence-mcp/
├── index.js          # Main entry point - contains all server logic
├── package.json      # Project configuration (type: module)
├── README.md         # User documentation
├── CLAUDE.md         # This file - AI assistant context
└── .gitignore        # Git ignore rules
```

## Architecture

The codebase is organized in a single `index.js` file with these sections:

1. **Configuration** (lines ~15-35): Environment variable handling for Atlassian credentials
2. **ConfluenceClient class** (lines ~41-405): API client with all Confluence operations
3. **MCP Server Setup** (lines ~410-420): Server initialization with capabilities
4. **Tool Definitions** (lines ~429-798): Array of tool schemas for MCP
5. **Tool Handlers** (lines ~804-939): Request handlers mapping tools to client methods
6. **Main Entry** (lines ~945-954): Server startup

## Environment Variables

Required for operation:
- `ATLASSIAN_EMAIL` - Atlassian account email
- `ATLASSIAN_API_TOKEN` - API token from Atlassian
- `ATLASSIAN_DOMAIN` - Confluence domain (e.g., `company.atlassian.net`)

## Available MCP Tools

### Page Operations
| Tool | Description |
|------|-------------|
| `confluence_get_page` | Get page by ID with content/version/metadata |
| `confluence_get_page_content` | Get content as text or HTML |
| `confluence_get_child_pages` | Get all child pages (handles pagination) |
| `confluence_create_page` | Create new page in a space |
| `confluence_update_page` | Update existing page (requires version number) |
| `confluence_delete_page` | Delete page (moves to trash) |

### Space Operations
| Tool | Description |
|------|-------------|
| `confluence_list_spaces` | List accessible spaces |
| `confluence_get_space` | Get space details |
| `confluence_get_space_content` | Get pages/blogposts in space |

### Search Operations
| Tool | Description |
|------|-------------|
| `confluence_search` | Search using CQL query |
| `confluence_search_by_text` | Search by text content |
| `confluence_search_by_title` | Search by title |

### Labels, Comments, Attachments
| Tool | Description |
|------|-------------|
| `confluence_get_page_labels` | Get labels on a page |
| `confluence_add_page_label` | Add label to page |
| `confluence_remove_page_label` | Remove label from page |
| `confluence_get_page_comments` | Get page comments |
| `confluence_add_page_comment` | Add comment to page |
| `confluence_get_page_attachments` | List page attachments |

### Special
| Tool | Description |
|------|-------------|
| `confluence_extract_done_sections` | Extract DONE sections between `DONE` and `TODO` markers |

## Key Implementation Details

### Authentication
- Uses HTTP Basic Auth with base64 encoded `email:api_token`
- Auth header: `Authorization: Basic <base64>`

### API Endpoints
- REST API v1: `/wiki/rest/api/content/...` (most operations)
- REST API v2: `/wiki/api/v2/pages/...` (child pages with pagination)

### Content Format
- Confluence uses **storage format** (XHTML) for content
- Use `htmlToText()` method to convert to plain text for reading
- When creating/updating pages, provide XHTML content

### Pagination
- `getChildPages()` handles pagination automatically via `_links.next`
- Other list operations use `limit` parameter

### Version Management
- `updatePage()` requires current version number
- Increments version by 1 automatically
- Get current version via `getPage()` first

## Common Development Tasks

### Run the server
```bash
npm start
# or
node index.js
```

### Test locally
The server uses stdio transport. For testing, configure in Claude Desktop config:
```json
{
  "mcpServers": {
    "confluence": {
      "command": "node",
      "args": ["/path/to/confluence-mcp/index.js"],
      "env": {
        "ATLASSIAN_EMAIL": "...",
        "ATLASSIAN_API_TOKEN": "...",
        "ATLASSIAN_DOMAIN": "..."
      }
    }
  }
}
```

## CQL (Confluence Query Language) Reference

Used with `confluence_search` tool:

```cql
# Basic queries
type=page AND space=DEV
type=page AND label=weekly-report

# Text search
text ~ "search term"
title ~ "report"

# Date filters
lastmodified > now("-7d")
created > "2024-01-01"

# User filters
creator=currentUser()

# Combined
type=page AND space=TEAM AND text ~ "report" AND lastmodified > now("-30d")
```

## Error Handling

- API errors throw with status code and response text
- Tool handlers catch errors and return `isError: true` with message
- 204 responses return `null` (for DELETE operations)

## Adding New Tools

1. Add tool definition to `TOOLS` array with `name`, `description`, `inputSchema`
2. Add method to `ConfluenceClient` class
3. Add case to switch statement in `CallToolRequestSchema` handler
4. Test with MCP client

## Confluence Storage Format Examples

```html
<!-- Headings -->
<h1>Title</h1>
<h2>Subtitle</h2>

<!-- Paragraphs and lists -->
<p>Paragraph text</p>
<ul><li>Item 1</li><li>Item 2</li></ul>
<ol><li>Numbered item</li></ol>

<!-- Code block macro -->
<ac:structured-macro ac:name="code">
  <ac:plain-text-body><![CDATA[code here]]></ac:plain-text-body>
</ac:structured-macro>

<!-- Info panel macro -->
<ac:structured-macro ac:name="info">
  <ac:rich-text-body><p>Info text</p></ac:rich-text-body>
</ac:structured-macro>
```
