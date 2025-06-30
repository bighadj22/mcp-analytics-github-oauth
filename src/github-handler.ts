import { env } from "cloudflare:workers";
import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { Octokit } from "octokit";
import { fetchUpstreamAuthToken, getUpstreamAuthorizeUrl, type Props } from "./utils";
import {
	clientIdAlreadyApproved,
	parseRedirectApproval,
	renderApprovalDialog,
} from "./workers-oauth-utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

app.get("/authorize", async (c) => {
	const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
	const { clientId } = oauthReqInfo;
	if (!clientId) {
		return c.text("Invalid request", 400);
	}

	if (
		await clientIdAlreadyApproved(c.req.raw, oauthReqInfo.clientId, env.COOKIE_ENCRYPTION_KEY)
	) {
		return redirectToGithub(c.req.raw, oauthReqInfo);
	}

	return renderApprovalDialog(c.req.raw, {
		client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
		server: {
			description: "This is a demo MCP Remote Server using GitHub for authentication.",
			logo: "https://avatars.githubusercontent.com/u/314135?s=200&v=4",
			name: "Cloudflare GitHub MCP Server",
		},
		state: { oauthReqInfo },
	});
});

app.post("/authorize", async (c) => {
	const { state, headers } = await parseRedirectApproval(c.req.raw, env.COOKIE_ENCRYPTION_KEY);
	if (!state.oauthReqInfo) {
		return c.text("Invalid request", 400);
	}

	return redirectToGithub(c.req.raw, state.oauthReqInfo, headers);
});

/**
 * Redirects user to GitHub OAuth authorization page
 * 
 * IMPORTANT: Uses "user:email" scope to access private email addresses
 * This is required because GitHub's /user endpoint returns null for email
 * when users have private email settings enabled.
 */
async function redirectToGithub(
	request: Request,
	oauthReqInfo: AuthRequest,
	headers: Record<string, string> = {},
) {
	return new Response(null, {
		headers: {
			...headers,
			location: getUpstreamAuthorizeUrl({
				client_id: env.GITHUB_CLIENT_ID,
				redirect_uri: new URL("/callback", request.url).href,
				scope: "read:user user:email",
				state: btoa(JSON.stringify(oauthReqInfo)),
				upstream_url: "https://github.com/login/oauth/authorize",
			}),
		},
		status: 302,
	});
}

/**
 * GitHub OAuth Callback Handler
 * 
 * This endpoint handles the OAuth callback from GitHub and implements a robust
 * email retrieval strategy to ensure analytics tracking works properly.
 * 
 * EMAIL RETRIEVAL STRATEGY:
 * 1. First, attempts to get email from /user endpoint (works for public emails)
 * 2. If email is null, makes additional call to /user/emails endpoint
 * 3. Prioritizes: Primary verified → Any verified → First available
 * 
 * WHY THIS IS NECESSARY:
 * - GitHub users can set their email to private in profile settings
 * - When email is private, /user endpoint returns email: null
 * - The /user/emails endpoint requires "user:email" scope
 * - This pattern ensures email is captured for analytics tracking
 * 
 * FALLBACK FOR OLD APPROACH:
 * If you need to revert to the old approach (without email):
 * 1. Change scope back to "read:user" 
 * 2. Remove the email fallback logic below
 * 3. Accept that analytics won't have email for private users
 */
app.get("/callback", async (c) => {
	const oauthReqInfo = JSON.parse(atob(c.req.query("state") as string)) as AuthRequest;
	if (!oauthReqInfo.clientId) {
		return c.text("Invalid state", 400);
	}

	// Exchange authorization code for access token
	const [accessToken, errResponse] = await fetchUpstreamAuthToken({
		client_id: c.env.GITHUB_CLIENT_ID,
		client_secret: c.env.GITHUB_CLIENT_SECRET,
		code: c.req.query("code"),
		redirect_uri: new URL("/callback", c.req.url).href,
		upstream_url: "https://github.com/login/oauth/access_token",
	});
	if (errResponse) return errResponse;

	// Fetch user info from GitHub
	const octokit = new Octokit({ auth: accessToken });
	const user = await octokit.rest.users.getAuthenticated();
	let { login, name, email } = user.data;

	/**
	 * EMAIL FALLBACK LOGIC
	 * 
	 * If email is null (user has private email), fetch from /user/emails
	 * This ensures analytics can track user email addresses properly.
	 */
	if (!email) {
		try {
			const emails = await octokit.rest.users.listEmailsForAuthenticatedUser();
			
			// Priority: Primary verified > Any verified > First available
			const primaryEmail = emails.data.find(e => e.primary && e.verified);
			const verifiedEmail = emails.data.find(e => e.verified);
			const anyEmail = emails.data[0];
			
			email = primaryEmail?.email || verifiedEmail?.email || anyEmail?.email || null;
		} catch (error) {
			// Continue without email - analytics will work but won't have email tracking
		}
	}

	// Prepare props for MCP client
	const propsToSend = {
		accessToken,
		email,
		login,
		name,
	} as Props;

	// Complete OAuth authorization and redirect back to MCP client
	const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
		metadata: {
			label: name || login,
		},
		props: propsToSend,
		request: oauthReqInfo,
		scope: oauthReqInfo.scope,
		userId: login,
	});

	return Response.redirect(redirectTo);
});

export { app as GitHubHandler };