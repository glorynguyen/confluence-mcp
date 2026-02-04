#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { convert } from "html-to-text";

// ============================================================================
// Configuration
// ============================================================================

const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;
const ATLASSIAN_DOMAIN = process.env.ATLASSIAN_DOMAIN;

function getAuth() {
  if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
    throw new Error(
      "Missing required environment variables: ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN"
    );
  }
  return Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString(
    "base64"
  );
}

function getBaseUrl() {
  if (!ATLASSIAN_DOMAIN) {
    throw new Error("Missing required environment variable: ATLASSIAN_DOMAIN");
  }
  return `https://${ATLASSIAN_DOMAIN}`;
}

// ============================================================================
// Confluence API Client
// ============================================================================

class ConfluenceClient {
  constructor() {
    this.baseUrl = getBaseUrl();
    this.auth = getAuth();
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${this.auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Confluence API error (${response.status}): ${errorText}`
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  // Convert HTML to plain text
  htmlToText(html) {
    return convert(html, {
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      ],
    });
  }

  // -------------------------------------------------------------------------
  // Page Operations
  // -------------------------------------------------------------------------

  async getPage(pageId, expand = "body.storage,version,space") {
    const data = await this.request(
      `/wiki/rest/api/content/${pageId}?expand=${expand}`
    );
    return {
      id: data.id,
      title: data.title,
      spaceKey: data.space?.key,
      version: data.version?.number,
      content: data.body?.storage?.value,
      contentAsText: data.body?.storage?.value
        ? this.htmlToText(data.body.storage.value)
        : null,
      webUrl: data._links?.webui
        ? `${this.baseUrl}/wiki${data._links.webui}`
        : null,
    };
  }

  async getPageContent(pageId, format = "text") {
    const data = await this.request(
      `/wiki/rest/api/content/${pageId}?expand=body.storage`
    );
    const html = data.body?.storage?.value || "";
    return format === "html" ? html : this.htmlToText(html);
  }

  async getChildPages(parentId, limit = 250) {
    const allChildren = [];
    let nextUrl = `/wiki/api/v2/pages/${parentId}/children?limit=${limit}`;

    while (nextUrl) {
      const url = nextUrl.startsWith("http")
        ? nextUrl
        : `${this.baseUrl}${nextUrl}`;
      const data = await this.request(url);

      if (data.results) {
        allChildren.push(
          ...data.results.map((page) => ({
            id: page.id,
            title: page.title,
            status: page.status,
          }))
        );
      }

      nextUrl = data._links?.next || null;
    }

    return allChildren;
  }

  async createPage(spaceKey, title, content, parentId = null) {
    const body = {
      type: "page",
      title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: content,
          representation: "storage",
        },
      },
    };

    if (parentId) {
      body.ancestors = [{ id: parentId }];
    }

    const data = await this.request("/wiki/rest/api/content", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      id: data.id,
      title: data.title,
      webUrl: data._links?.webui
        ? `${this.baseUrl}/wiki${data._links.webui}`
        : null,
    };
  }

  async updatePage(pageId, title, content, version) {
    const body = {
      type: "page",
      title,
      body: {
        storage: {
          value: content,
          representation: "storage",
        },
      },
      version: {
        number: version + 1,
      },
    };

    const data = await this.request(`/wiki/rest/api/content/${pageId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    return {
      id: data.id,
      title: data.title,
      version: data.version?.number,
      webUrl: data._links?.webui
        ? `${this.baseUrl}/wiki${data._links.webui}`
        : null,
    };
  }

  async deletePage(pageId) {
    await this.request(`/wiki/rest/api/content/${pageId}`, {
      method: "DELETE",
    });
    return { success: true, deletedPageId: pageId };
  }

  // -------------------------------------------------------------------------
  // Space Operations
  // -------------------------------------------------------------------------

  async listSpaces(limit = 25) {
    const data = await this.request(`/wiki/rest/api/space?limit=${limit}`);
    return data.results.map((space) => ({
      key: space.key,
      name: space.name,
      type: space.type,
      webUrl: space._links?.webui
        ? `${this.baseUrl}/wiki${space._links.webui}`
        : null,
    }));
  }

  async getSpace(spaceKey) {
    const data = await this.request(
      `/wiki/rest/api/space/${spaceKey}?expand=description.plain,homepage`
    );
    return {
      key: data.key,
      name: data.name,
      type: data.type,
      description: data.description?.plain?.value,
      homepageId: data.homepage?.id,
      webUrl: data._links?.webui
        ? `${this.baseUrl}/wiki${data._links.webui}`
        : null,
    };
  }

  async getSpaceContent(spaceKey, type = "page", limit = 25) {
    const data = await this.request(
      `/wiki/rest/api/space/${spaceKey}/content/${type}?limit=${limit}`
    );
    return data.results.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
    }));
  }

  // -------------------------------------------------------------------------
  // Search Operations
  // -------------------------------------------------------------------------

  async search(cql, limit = 25) {
    const encodedCql = encodeURIComponent(cql);
    const data = await this.request(
      `/wiki/rest/api/content/search?cql=${encodedCql}&limit=${limit}`
    );
    return data.results.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      excerpt: item.excerpt,
    }));
  }

  async searchByText(text, spaceKey = null, limit = 25) {
    let cql = `text ~ "${text}"`;
    if (spaceKey) {
      cql += ` AND space = "${spaceKey}"`;
    }
    return this.search(cql, limit);
  }

  async searchByTitle(title, spaceKey = null, limit = 25) {
    let cql = `title ~ "${title}"`;
    if (spaceKey) {
      cql += ` AND space = "${spaceKey}"`;
    }
    return this.search(cql, limit);
  }

  // -------------------------------------------------------------------------
  // Labels Operations
  // -------------------------------------------------------------------------

  async getPageLabels(pageId) {
    const data = await this.request(
      `/wiki/rest/api/content/${pageId}/label`
    );
    return data.results.map((label) => ({
      name: label.name,
      prefix: label.prefix,
    }));
  }

  async addPageLabel(pageId, labelName) {
    const data = await this.request(
      `/wiki/rest/api/content/${pageId}/label`,
      {
        method: "POST",
        body: JSON.stringify([{ name: labelName, prefix: "global" }]),
      }
    );
    return data.results.map((label) => ({
      name: label.name,
      prefix: label.prefix,
    }));
  }

  async removePageLabel(pageId, labelName) {
    await this.request(
      `/wiki/rest/api/content/${pageId}/label/${labelName}`,
      {
        method: "DELETE",
      }
    );
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Comments Operations
  // -------------------------------------------------------------------------

  async getPageComments(pageId, limit = 25) {
    const data = await this.request(
      `/wiki/rest/api/content/${pageId}/child/comment?expand=body.storage&limit=${limit}`
    );
    return data.results.map((comment) => ({
      id: comment.id,
      content: comment.body?.storage?.value
        ? this.htmlToText(comment.body.storage.value)
        : null,
    }));
  }

  async addPageComment(pageId, content) {
    const body = {
      type: "comment",
      container: { id: pageId, type: "page" },
      body: {
        storage: {
          value: content,
          representation: "storage",
        },
      },
    };

    const data = await this.request("/wiki/rest/api/content", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      id: data.id,
    };
  }

  // -------------------------------------------------------------------------
  // Attachments Operations
  // -------------------------------------------------------------------------

  async getPageAttachments(pageId, limit = 25) {
    const data = await this.request(
      `/wiki/rest/api/content/${pageId}/child/attachment?limit=${limit}`
    );
    return data.results.map((attachment) => ({
      id: attachment.id,
      title: attachment.title,
      mediaType: attachment.metadata?.mediaType,
      fileSize: attachment.extensions?.fileSize,
      downloadUrl: attachment._links?.download
        ? `${this.baseUrl}/wiki${attachment._links.download}`
        : null,
    }));
  }

  // -------------------------------------------------------------------------
  // Extract DONE sections (from existing app)
  // -------------------------------------------------------------------------

  async extractDoneSections(pageId) {
    const content = await this.getPageContent(pageId, "text");
    const doneRegex = /DONE([\s\S]*?)(?=TODO|$)/g;
    const matches = [];
    let match;

    while ((match = doneRegex.exec(content)) !== null) {
      matches.push(match[1].trim());
    }

    return {
      pageId,
      doneSections: matches,
      fullContent: content,
    };
  }
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: "confluence-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const client = new ConfluenceClient();

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS = [
  // Page Operations
  {
    name: "confluence_get_page",
    description:
      "Get a Confluence page by ID, including its content, version, and metadata",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page to retrieve",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "confluence_get_page_content",
    description:
      "Get the content of a Confluence page as plain text or HTML",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page",
        },
        format: {
          type: "string",
          enum: ["text", "html"],
          description: "Output format: 'text' (default) or 'html'",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "confluence_get_child_pages",
    description:
      "Get all child pages of a parent page (handles pagination automatically)",
    inputSchema: {
      type: "object",
      properties: {
        parentId: {
          type: "string",
          description: "The ID of the parent page",
        },
      },
      required: ["parentId"],
    },
  },
  {
    name: "confluence_create_page",
    description:
      "Create a new Confluence page in a space, optionally as a child of another page",
    inputSchema: {
      type: "object",
      properties: {
        spaceKey: {
          type: "string",
          description: "The key of the space (e.g., 'DEV', 'TEAM')",
        },
        title: {
          type: "string",
          description: "The title of the new page",
        },
        content: {
          type: "string",
          description:
            "The content in Confluence storage format (XHTML). Use <p> tags for paragraphs, <h1>-<h6> for headings, etc.",
        },
        parentId: {
          type: "string",
          description:
            "Optional: ID of the parent page if creating a child page",
        },
      },
      required: ["spaceKey", "title", "content"],
    },
  },
  {
    name: "confluence_update_page",
    description:
      "Update an existing Confluence page content and/or title",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page to update",
        },
        title: {
          type: "string",
          description: "The new title of the page",
        },
        content: {
          type: "string",
          description: "The new content in Confluence storage format (XHTML)",
        },
        version: {
          type: "number",
          description:
            "The current version number of the page (required for update)",
        },
      },
      required: ["pageId", "title", "content", "version"],
    },
  },
  {
    name: "confluence_delete_page",
    description:
      "Delete a Confluence page by ID (moves to trash)",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page to delete",
        },
      },
      required: ["pageId"],
    },
  },

  // Space Operations
  {
    name: "confluence_list_spaces",
    description: "List all accessible Confluence spaces",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of spaces to return (default: 25)",
        },
      },
    },
  },
  {
    name: "confluence_get_space",
    description: "Get details about a specific Confluence space",
    inputSchema: {
      type: "object",
      properties: {
        spaceKey: {
          type: "string",
          description: "The key of the space (e.g., 'DEV', 'TEAM')",
        },
      },
      required: ["spaceKey"],
    },
  },
  {
    name: "confluence_get_space_content",
    description: "Get pages or blogposts in a specific space",
    inputSchema: {
      type: "object",
      properties: {
        spaceKey: {
          type: "string",
          description: "The key of the space",
        },
        type: {
          type: "string",
          enum: ["page", "blogpost"],
          description: "Content type: 'page' (default) or 'blogpost'",
        },
        limit: {
          type: "number",
          description: "Maximum number of items to return (default: 25)",
        },
      },
      required: ["spaceKey"],
    },
  },

  // Search Operations
  {
    name: "confluence_search",
    description:
      "Search Confluence using CQL (Confluence Query Language)",
    inputSchema: {
      type: "object",
      properties: {
        cql: {
          type: "string",
          description:
            'CQL query string (e.g., \'type=page AND space=DEV AND text ~ "report"\')',
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 25)",
        },
      },
      required: ["cql"],
    },
  },
  {
    name: "confluence_search_by_text",
    description: "Search Confluence pages by text content",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to search for",
        },
        spaceKey: {
          type: "string",
          description: "Optional: Limit search to a specific space",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 25)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "confluence_search_by_title",
    description: "Search Confluence pages by title",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title text to search for",
        },
        spaceKey: {
          type: "string",
          description: "Optional: Limit search to a specific space",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 25)",
        },
      },
      required: ["title"],
    },
  },

  // Labels Operations
  {
    name: "confluence_get_page_labels",
    description: "Get all labels attached to a page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "confluence_add_page_label",
    description: "Add a label to a page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page",
        },
        labelName: {
          type: "string",
          description: "The label name to add",
        },
      },
      required: ["pageId", "labelName"],
    },
  },
  {
    name: "confluence_remove_page_label",
    description: "Remove a label from a page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page",
        },
        labelName: {
          type: "string",
          description: "The label name to remove",
        },
      },
      required: ["pageId", "labelName"],
    },
  },

  // Comments Operations
  {
    name: "confluence_get_page_comments",
    description: "Get comments on a page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page",
        },
        limit: {
          type: "number",
          description: "Maximum number of comments to return (default: 25)",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "confluence_add_page_comment",
    description: "Add a comment to a page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page",
        },
        content: {
          type: "string",
          description: "The comment content in HTML format",
        },
      },
      required: ["pageId", "content"],
    },
  },

  // Attachments Operations
  {
    name: "confluence_get_page_attachments",
    description: "Get attachments on a page",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page",
        },
        limit: {
          type: "number",
          description: "Maximum number of attachments to return (default: 25)",
        },
      },
      required: ["pageId"],
    },
  },

  // Special Operations
  {
    name: "confluence_extract_done_sections",
    description:
      "Extract DONE sections from a page (useful for daily reports). Returns content between 'DONE' and 'TODO' markers.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The ID of the page to extract DONE sections from",
        },
      },
      required: ["pageId"],
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      // Page Operations
      case "confluence_get_page":
        result = await client.getPage(args.pageId);
        break;

      case "confluence_get_page_content":
        result = await client.getPageContent(args.pageId, args.format || "text");
        break;

      case "confluence_get_child_pages":
        result = await client.getChildPages(args.parentId);
        break;

      case "confluence_create_page":
        result = await client.createPage(
          args.spaceKey,
          args.title,
          args.content,
          args.parentId
        );
        break;

      case "confluence_update_page":
        result = await client.updatePage(
          args.pageId,
          args.title,
          args.content,
          args.version
        );
        break;

      case "confluence_delete_page":
        result = await client.deletePage(args.pageId);
        break;

      // Space Operations
      case "confluence_list_spaces":
        result = await client.listSpaces(args.limit);
        break;

      case "confluence_get_space":
        result = await client.getSpace(args.spaceKey);
        break;

      case "confluence_get_space_content":
        result = await client.getSpaceContent(
          args.spaceKey,
          args.type || "page",
          args.limit
        );
        break;

      // Search Operations
      case "confluence_search":
        result = await client.search(args.cql, args.limit);
        break;

      case "confluence_search_by_text":
        result = await client.searchByText(args.text, args.spaceKey, args.limit);
        break;

      case "confluence_search_by_title":
        result = await client.searchByTitle(
          args.title,
          args.spaceKey,
          args.limit
        );
        break;

      // Labels Operations
      case "confluence_get_page_labels":
        result = await client.getPageLabels(args.pageId);
        break;

      case "confluence_add_page_label":
        result = await client.addPageLabel(args.pageId, args.labelName);
        break;

      case "confluence_remove_page_label":
        result = await client.removePageLabel(args.pageId, args.labelName);
        break;

      // Comments Operations
      case "confluence_get_page_comments":
        result = await client.getPageComments(args.pageId, args.limit);
        break;

      case "confluence_add_page_comment":
        result = await client.addPageComment(args.pageId, args.content);
        break;

      // Attachments Operations
      case "confluence_get_page_attachments":
        result = await client.getPageAttachments(args.pageId, args.limit);
        break;

      // Special Operations
      case "confluence_extract_done_sections":
        result = await client.extractDoneSections(args.pageId);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Confluence MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
