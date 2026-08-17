/**
 * Chess mode — core domain (owned by CORE).
 *
 * The organization, projects, teams, user, and the ambient endpoints the Sentry
 * shell hits on every page load. This domain is matched LAST (see
 * `registry.tsx`) so its broad patterns never shadow a product domain.
 *
 * Anything not handled here or by another domain falls through to the
 * registry's empty-200 default and is logged as `[chessMode] UNMATCHED`.
 */
import {
  CHESS_ORG,
  CHESS_ORG_SLUG,
  CHESS_PROJECT,
  CHESS_PROJECTS,
  CHESS_TEAM,
  CHESS_USER,
} from 'sentry/chessMode/fixtures';
import type {ChessRoute} from 'sentry/chessMode/registry';

const ENVIRONMENTS = [
  {id: '1', name: 'blitz', displayName: 'blitz', isHidden: false},
  {id: '2', name: 'rapid', displayName: 'rapid', isHidden: false},
  {id: '3', name: 'classical', displayName: 'classical', isHidden: false},
];

const MEMBER = {
  id: '1',
  email: CHESS_USER.email,
  name: CHESS_USER.name,
  user: CHESS_USER,
  role: 'owner',
  orgRole: 'owner',
  roleName: 'Owner',
  orgRoleList: CHESS_ORG.orgRoleList,
  teamRoleList: CHESS_ORG.teamRoleList,
  pending: false,
  expired: false,
  flags: {
    'sso:linked': false,
    'sso:invalid': false,
    'member-limit:restricted': false,
    'idp:provisioned': false,
    'idp:role-restricted': false,
    'partnership:restricted': false,
  },
  dateCreated: '2024-01-01T00:00:00.000Z',
  inviteStatus: 'approved',
  invite_link: null,
  inviterName: null,
  isOnlyOwner: true,
  teams: [CHESS_TEAM.slug],
  teamRoles: [{teamSlug: CHESS_TEAM.slug, role: 'admin'}],
  projects: [CHESS_PROJECT.slug],
  access: CHESS_ORG.access,
};

/**
 * The project detail endpoint returns a superset of the list shape.
 */
const DETAILED_PROJECT = {
  ...CHESS_PROJECT,
  organization: {id: CHESS_ORG.id, slug: CHESS_ORG_SLUG},
  processingIssues: 0,
  allowedDomains: ['*'],
  dataScrubber: false,
  dataScrubberDefaults: false,
  derivedGroupingEnhancements: '',
  digestsMaxDelay: 1800,
  digestsMinDelay: 300,
  dynamicSamplingBiases: null,
  enableAutoReleaseCreation: true,
  fingerprintingRules: '',
  groupingConfig: 'newstyle:2023-01-11',
  groupingEnhancements: '',
  relayPiiConfig: '',
  resolveAge: 0,
  safeFields: [],
  scrapeJavaScript: true,
  scrubIPAddresses: false,
  sensitiveFields: [],
  subjectTemplate: '',
  verifySSL: false,
  storeCrashReports: null,
  plugins: [],
  options: {},
};

function echoWrite(url: string, options: any) {
  // eslint-disable-next-line no-console
  console.info(`[chessMode] core no-op write ${options?.method} ${url}`);
  return options?.data ?? {};
}

const routes: ChessRoute[] = [
  // -- Org, projects, teams, members ---------------------------------------
  {
    url: /^\/organizations\/(\?|$)/,
    handler: () => [CHESS_ORG],
  },
  {
    url: /^\/organizations\/[^/?]+\/(\?|$)/,
    handler: () => CHESS_ORG,
  },
  {
    url: /^\/organizations\/[^/]+\/projects\/(\?|$)/,
    handler: () => CHESS_PROJECTS,
  },
  {
    url: /^\/organizations\/[^/]+\/(user-)?teams\/(\?|$)/,
    handler: () => [{...CHESS_TEAM, projects: CHESS_PROJECTS}],
  },
  {
    url: /^\/organizations\/[^/]+\/members\/me\//,
    handler: () => MEMBER,
  },
  {
    url: /^\/organizations\/[^/]+\/members\/(\?|$)/,
    handler: () => [MEMBER],
  },
  {
    url: /^\/organizations\/[^/]+\/environments\//,
    handler: () => ENVIRONMENTS,
  },
  {
    url: /^\/projects\/[^/]+\/[^/]+\/environments\//,
    handler: () => ENVIRONMENTS,
  },
  {
    url: /^\/projects\/[^/]+\/[^/]+\/(\?|$)/,
    handler: () => DETAILED_PROJECT,
  },
  {
    url: /^\/projects\/(\?|$)/,
    handler: () => CHESS_PROJECTS,
  },

  // -- User / account -------------------------------------------------------
  {
    url: /^\/users\/me\/regions\//,
    handler: () => ({regions: [{name: 'us', url: window.location.origin}]}),
  },
  {
    url: /^\/users\/me\/(\?|$)/,
    handler: () => CHESS_USER,
  },
  {
    // Returns members (each wrapping a user), not bare users.
    url: /^\/organizations\/[^/]+\/users\//,
    handler: () => [MEMBER],
  },
  {
    url: /^\/organizations\/[^/]+\/user-reports\//,
    handler: () => [],
  },
  {
    // Without this the issue stream shows the "waiting for your first event"
    // onboarding state instead of the games.
    url: /^\/organizations\/[^/]+\/sent-first-event\//,
    handler: () => ({sentFirstEvent: true}),
  },

  // -- Ambient chrome calls -------------------------------------------------
  {
    // Guides / product tours. An empty list means nothing pops up over the gag.
    url: /^\/assistant\//,
    handler: () => [],
  },
  {
    url: /^\/(organizations\/[^/]+\/)?broadcasts\//,
    handler: () => [],
  },
  {
    // Dismissed-banner state. `data: null` reads as "never dismissed".
    url: /^\/organizations\/[^/]+\/prompts-activity\//,
    handler: () => ({data: null, features: {}}),
  },
  {
    // getsentry's subscription lookup. An empty object leaves every billing
    // banner unset, which is what we want — Pawn Patrol has no billing story.
    url: /^\/customers\/[^/]+\/(\?|$)/,
    handler: () => ({}),
  },
  {
    url: /^\/internal\/health\//,
    handler: () => ({problems: [], healthy: true}),
  },
  {
    url: /^\/internal\/stats\//,
    handler: () => [],
  },
  {
    url: /^\/organizations\/[^/]+\/sdk-updates\//,
    handler: () => [],
  },
  {
    url: /^\/organizations\/[^/]+\/(recent-searches|searches)\//,
    handler: () => [],
  },
  {
    url: /^\/(organizations\/[^/]+\/)?sentry-apps?(-installations)?\//,
    handler: () => [],
  },
  {
    url: /^\/organizations\/[^/]+\/(onboarding-tasks|quick-start)\//,
    handler: () => [],
  },
  {
    url: /^\/organizations\/[^/]+\/config\/integrations\//,
    handler: () => ({providers: []}),
  },
  {
    url: /^\/organizations\/[^/]+\/integrations\//,
    handler: () => [],
  },
  {
    url: /^\/organizations\/[^/]+\/repos\//,
    handler: () => [],
  },
  {
    url: /^\/organizations\/[^/]+\/code-mappings\//,
    handler: () => [],
  },
  {
    url: /^\/organizations\/[^/]+\/(tags|tagstore)\//,
    handler: () => [],
  },
  {
    url: /^\/organizations\/[^/]+\/projects\/[^/]+\/(\?|$)/,
    handler: () => DETAILED_PROJECT,
  },
  {
    url: /^\/organizations\/[^/]+\/(release-thresholds|releases)\//,
    handler: () => [],
  },
  {
    url: /^\/organizations\/[^/]+\/(alert-rules|combined-rules|monitors|uptime)\//,
    handler: () => [],
  },
  {
    url: /^\/organizations\/[^/]+\/(dynamic-sampling|sampling)\//,
    handler: () => ({}),
  },
  {
    url: /^\/organizations\/[^/]+\/data-export\//,
    handler: () => ({}),
  },
  // Every write in a stubbed app is a no-op: echo the payload back so
  // optimistic UI settles instead of erroring.
  {method: 'PUT', url: /^\//, handler: echoWrite},
  {method: 'POST', url: /^\//, handler: echoWrite},
  {method: 'DELETE', url: /^\//, handler: echoWrite},
];

// Domain modules are lazy-loaded by `require.context` in registry.tsx, which
// reads the default export.
// eslint-disable-next-line @sentry/no-default-exports
export default routes;
