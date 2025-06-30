# Model Context Protocol (MCP) Server + GitHub OAuth + Analytics

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP connections, with GitHub OAuth authentication and built-in analytics tracking powered by [MCP Analytics](https://mcpanalytics.dev).

You can deploy it to your own Cloudflare account, and after you create your own GitHub OAuth client app, you'll have a fully functional remote MCP server with comprehensive analytics. Users will be able to connect to your MCP server by signing in with their GitHub account, and you'll get detailed insights into tool usage, performance, and user behavior.

## Features

- ✅ **GitHub OAuth Authentication** - Secure user authentication via GitHub
- ✅ **Remote MCP Protocol** - Full MCP server implementation  
- ✅ **Analytics Tracking** - Automatic tracking of tool usage, performance, and user metrics
- ✅ **Access Control** - Role-based tool access based on GitHub usernames
- ✅ **Image Generation** - AI-powered image generation for authorized users
- ✅ **Production Ready** - Deployed on Cloudflare Workers with Durable Objects

## Analytics Dashboard

This server automatically tracks:
- 📊 **Tool Usage** - Which tools are used most frequently
- ⏱️ **Performance Metrics** - Execution times and success rates  
- 👥 **User Analytics** - Active users and session data
- 🔧 **Error Tracking** - Failed requests and error details
- 💰 **Revenue Tracking** - Payment events (if using paid tools)

View your analytics at: [https://mcpanalytics.dev](https://mcpanalytics.dev)

## Getting Started

Clone the repo directly & install dependencies:
```bash
git clone <your-repo-url>
cd mcp-github-oauth-analytics
npm install
```

## Setup Instructions

### 1. MCP Analytics Setup

1. Sign up at [https://mcpanalytics.dev](https://mcpanalytics.dev)
2. Create a new project and get your API key
3. Add the API key to your environment:

```bash
# For production
wrangler secret put MCP_ANALYTICS_API_KEY

# For local development (.dev.vars file)
MCP_ANALYTICS_API_KEY=your_api_key_here
```

### 2. GitHub OAuth Setup

#### For Production
Create a new [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app): 
- **Homepage URL**: `https://your-worker-name.your-subdomain.workers.dev`
- **Authorization callback URL**: `https://your-worker-name.your-subdomain.workers.dev/callback`
- Note your Client ID and generate a Client secret

Set secrets via Wrangler:
```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY # Use: openssl rand -hex 32
```

#### For Local Development
Create another GitHub OAuth App for development:
- **Homepage URL**: `http://localhost:8788`
- **Authorization callback URL**: `http://localhost:8788/callback`

Create a `.dev.vars` file:
```bash
GITHUB_CLIENT_ID=your_development_github_client_id
GITHUB_CLIENT_SECRET=your_development_github_client_secret
COOKIE_ENCRYPTION_KEY=your_random_encryption_key
MCP_ANALYTICS_API_KEY=your_analytics_api_key
```

### 3. KV Namespace Setup
```bash
# Create the KV namespace
wrangler kv:namespace create "OAUTH_KV"

# Update wrangler.toml with the returned KV ID
```

### 4. Configure Access Control

Edit the `ALLOWED_USERNAMES` in your main file to control who can access the image generation tool:

```typescript
const ALLOWED_USERNAMES = new Set<string>([
	'yourusername',
	'teammate1',
	'teammate2'
]);
```

## Deployment

Deploy to Cloudflare Workers:
```bash
wrangler deploy
```

Your MCP server will be available at:
`https://your-worker-name.your-subdomain.workers.dev/sse`

## Testing Your Server

### Using MCP Inspector
```bash
npx @modelcontextprotocol/inspector@latest
```
Enter your server URL and test the authentication flow.

### Using Claude Desktop

1. Open Claude Desktop → Settings → Developer → Edit Config
2. Add this configuration:

```json
{
  "mcpServers": {
    "github-mcp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-worker-name.your-subdomain.workers.dev/sse"
      ]
    }
  }
}
```

3. Restart Claude Desktop and complete the OAuth flow
4. Test with: "Could you use the math tool to add 23 and 19?"

### Using Other MCP Clients

**Cursor**: Use command format: `npx mcp-remote https://your-worker-url/sse`

**Windsurf**: Add the same JSON configuration as Claude Desktop

## Available Tools

### `add` (All Users)
Simple math addition tool for testing connectivity.

**Usage**: "Add 5 and 3"

### `generateImage` (Authorized Users Only) 
AI-powered image generation using Cloudflare's Flux model.

**Usage**: "Generate an image of a sunset over mountains"

**Parameters**:
- `prompt`: Description of the image to generate
- `steps`: Quality steps (4-8, higher = better quality)

## Analytics Integration

This server uses the **AnalyticsMcpAgent** which automatically tracks:

- ✅ **Tool Execution Times** - How long each tool takes to run
- ✅ **Success/Failure Rates** - Which tools work reliably  
- ✅ **User Sessions** - Who's using your server and when
- ✅ **Parameter Logging** - What inputs users are providing (safely sanitized)
- ✅ **Error Details** - Full error context for debugging
- ✅ **GitHub User Data** - Email and username from OAuth (for user analytics)

### Viewing Analytics

1. Visit [https://dashboard.mcpanalytics.dev](https://dashboard.mcpanalytics.dev)
2. Sign in with the same account used to create your API key
3. View real-time dashboards showing:
   - Tool usage trends
   - Performance metrics  
   - User activity
   - Error rates and details

## Local Development

Start the development server:
```bash
wrangler dev
```

Your server will be available at `http://localhost:8788/sse`

## Architecture

### OAuth Provider
The OAuth Provider library serves as a complete OAuth 2.1 server implementation, handling:
- MCP client authentication
- GitHub OAuth integration  
- Token management and validation
- Secure state storage in Cloudflare KV

### Analytics Agent
The **AnalyticsMcpAgent** extends the base MCP functionality with:
- Automatic event tracking for all tool calls
- User identification via OAuth props
- Performance monitoring and error tracking
- Safe parameter and result logging

### Durable Objects
Provides persistent state management with:
- User session continuity
- Authentication context preservation
- Scalable real-time connections

## Security & Privacy

- 🔒 **OAuth 2.1** - Industry standard authentication
- 🔐 **Encrypted Tokens** - All auth data encrypted in transit and storage
- 🛡️ **Access Control** - Fine-grained permissions per GitHub user
- 🧹 **Data Sanitization** - Sensitive data automatically redacted from logs
- ⏰ **Token Expiration** - Automatic token refresh and expiration

## Troubleshooting

### Common Issues

**"Invalid API key" in analytics**: Verify your `MCP_ANALYTICS_API_KEY` is set correctly

**OAuth callback errors**: Ensure your GitHub OAuth app URLs match your deployment URLs exactly

**Tools not appearing**: Check that the user's GitHub username is in `ALLOWED_USERNAMES` for restricted tools

**Connection timeouts**: Verify your Worker is deployed and responding at the correct URL


## Support

- 📖 **MCP Analytics Docs**: [https://docs.mcpanalytics.dev](https://docs.mcpanalytics.dev)
- 💬 **GitHub Issues**: For bugs and feature requests
- 📧 **Email Support**: Available for Pro plan users

## License

MIT License - see LICENSE file for details.