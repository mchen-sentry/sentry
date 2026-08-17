/**
 * Shared Pawn Patrol data: the org, the project, the user, the team and the
 * client config used to boot the SPA without a backend.
 *
 * Shapes are copied from `tests/js/fixtures/*` — that alias only exists in the
 * jest/test build, so the app bundle cannot import it.
 *
 * Other chess-mode domains should import from here rather than inventing their
 * own org/project/user so everything is consistent.
 */
import type {Config} from 'sentry/types/system';

export const CHESS_ORG_SLUG = 'pawn-patrol';
export const CHESS_ORG_ID = '1';
export const CHESS_PROJECT_SLUG = 'chess';
export const CHESS_PROJECT_ID = '11';
export const CHESS_TEAM_SLUG = 'grandmasters';

/**
 * Organization feature flags turned on for the demo. Add to this list if a
 * chess-mode view needs a flag — unknown flags are simply ignored.
 */
export const CHESS_ORG_FEATURES: string[] = [
  'discover-basic',
  'discover-query',
  'performance-view',
  'session-replay',
  'session-replay-ui',
  'ownership-suggestions',
  'global-views',
  'open-membership',
  'insights-entry-points',
  'insights-initial-modules',
  'insights-addon-modules',
  'visibility-explore-view',
  'gen-ai-features',
  'issue-stream-custom-views',
  'user-feedback-ui',
  'dashboards-basic',
  'dashboards-edit',
];

export const CHESS_USER: any = {
  id: '1',
  username: 'magnus@pawn-patrol.dev',
  email: 'magnus@pawn-patrol.dev',
  name: 'Magnus Sentry',
  isAuthenticated: true,
  options: {
    clock24Hours: false,
    timezone: 'UTC',
    language: 'en',
    theme: 'dark',
    defaultIssueEvent: 'recommended',
    avatarType: 'letter_avatar',
    stacktraceOrder: -1,
    prefersIssueDetailsStreamlinedUI: true,
  },
  ip_address: '127.0.0.1',
  hasPasswordAuth: true,
  authenticators: [],
  canReset2fa: false,
  dateJoined: '2024-01-01T00:00:00.000Z',
  emails: [{id: '1', email: 'magnus@pawn-patrol.dev', is_verified: true}],
  has2fa: false,
  identities: [],
  isActive: true,
  isManaged: false,
  isStaff: false,
  isSuperuser: false,
  isSuspended: false,
  lastActive: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  permissions: new Set<string>(),
  flags: {newsletter_consent_prompt: false},
  avatar: {avatarType: 'letter_avatar', avatarUuid: null, avatarUrl: null},
};

const ORG_ACCESS = [
  'org:read',
  'org:write',
  'org:admin',
  'org:integrations',
  'project:read',
  'project:write',
  'project:releases',
  'project:admin',
  'team:read',
  'team:write',
  'team:admin',
  'alerts:read',
  'alerts:write',
  'member:read',
  'member:write',
  'event:read',
  'event:write',
  'event:admin',
];

export const CHESS_TEAM: any = {
  id: '1',
  slug: CHESS_TEAM_SLUG,
  name: 'Grandmasters',
  access: ['team:read', 'team:write', 'team:admin'],
  teamRole: 'admin',
  isMember: true,
  memberCount: 4,
  avatar: {avatarType: 'letter_avatar', avatarUuid: null},
  flags: {'idp:provisioned': false},
  externalTeams: [],
  projects: [],
  hasAccess: true,
  isPending: false,
  dateCreated: '2024-01-01T00:00:00.000Z',
};

export const CHESS_PROJECT: any = {
  id: CHESS_PROJECT_ID,
  slug: CHESS_PROJECT_SLUG,
  name: 'Chess',
  platform: 'javascript',
  access: ['project:read', 'project:write', 'project:admin'],
  hasAccess: true,
  isMember: true,
  isBookmarked: true,
  isInternal: false,
  isPublic: false,
  status: 'active',
  color: '#6c5fc7',
  platforms: ['javascript'],
  team: CHESS_TEAM,
  teams: [CHESS_TEAM],
  environments: ['blitz', 'rapid', 'classical'],
  features: [],
  dateCreated: '2024-01-01T00:00:00.000Z',
  firstEvent: '2024-01-02T00:00:00.000Z',
  firstTransactionEvent: true,
  hasFeedbacks: false,
  hasNewFeedbacks: false,
  hasMinifiedStackTrace: false,
  hasProfiles: false,
  hasReplays: true,
  hasFlags: false,
  hasTraceMetrics: false,
  hasSessions: true,
  hasMonitors: false,
  hasLogs: false,
  hasInsightsHttp: true,
  hasInsightsDb: false,
  hasInsightsAssets: false,
  hasInsightsAppStart: false,
  hasInsightsScreenLoad: false,
  hasInsightsVitals: true,
  hasInsightsCaches: false,
  hasInsightsQueues: false,
  hasInsightsAgentMonitoring: false,
  hasInsightsMCP: false,
  latestRelease: null,
  avatar: {avatarType: 'letter_avatar', avatarUuid: null},
  eventProcessing: {symbolicationDegraded: false},
};

export const CHESS_PROJECTS: any[] = [CHESS_PROJECT];

const ORG_ROLE_LIST = [
  {
    id: 'member',
    name: 'Member',
    desc: 'Members can view and act on games.',
    scopes: ORG_ACCESS,
    allowed: true,
    isAllowed: true,
    isRetired: false,
    isTeamRolesAllowed: true,
    minimumTeamRole: 'contributor',
  },
  {
    id: 'owner',
    name: 'Owner',
    desc: 'Full control over the board.',
    scopes: ORG_ACCESS,
    allowed: true,
    isAllowed: true,
    isRetired: false,
    isTeamRolesAllowed: true,
    minimumTeamRole: 'admin',
  },
];

const TEAM_ROLE_LIST = [
  {
    id: 'contributor',
    name: 'Contributor',
    desc: 'Can view games.',
    scopes: ['team:read'],
    allowed: true,
    isAllowed: true,
    isRetired: false,
    isMinimumRoleFor: null,
  },
  {
    id: 'admin',
    name: 'Team Admin',
    desc: 'Runs the team.',
    scopes: ['team:read', 'team:write', 'team:admin'],
    allowed: true,
    isAllowed: true,
    isRetired: false,
    isMinimumRoleFor: null,
  },
];

export const CHESS_ORG: any = {
  id: CHESS_ORG_ID,
  slug: CHESS_ORG_SLUG,
  name: 'Pawn Patrol',
  links: {
    organizationUrl: `https://${CHESS_ORG_SLUG}.sentry.io`,
    regionUrl: 'https://us.sentry.io',
  },
  access: ORG_ACCESS,
  status: {id: 'active', name: 'active'},
  features: CHESS_ORG_FEATURES,
  scrapeJavaScript: true,
  onboardingTasks: [],
  alertsMemberWrite: true,
  allowJoinRequests: false,
  allowMemberInvite: true,
  allowMemberProjectCreation: true,
  allowSuperuserAccess: false,
  allowSharedIssues: false,
  autoEnableCodeReview: false,
  autoOpenPrs: false,
  attachmentsRole: 'member',
  availableRoles: [],
  avatar: {avatarType: 'default', avatarUuid: null, avatarUrl: null},
  dataScrubber: false,
  dataScrubberDefaults: false,
  dateCreated: '2024-01-01T00:00:00.000Z',
  debugFilesRole: 'member',
  defaultAutomatedRunStoppingPoint: 'root_cause',
  defaultCodeReviewTriggers: [],
  defaultCodingAgentIntegrationId: null,
  defaultCodingAgent: 'seer',
  defaultRole: 'member',
  enhancedPrivacy: false,
  eventsMemberAdmin: true,
  hideAiFeatures: false,
  isDefault: true,
  isDynamicallySampled: false,
  isEarlyAdopter: true,
  issueAlertsThreadFlag: false,
  metricAlertsThreadFlag: false,
  openMembership: true,
  pendingAccessRequests: 0,
  targetSampleRate: 1,
  quota: {
    accountLimit: null,
    maxRate: null,
    maxRateInterval: null,
    projectLimit: null,
  },
  relayDsnEndpoint: null,
  relayPiiConfig: null,
  require2FA: false,
  requiresSso: false,
  streamlineOnly: true,
  safeFields: [],
  samplingMode: 'organization',
  scrubIPAddresses: false,
  sensitiveFields: [],
  aggregatedDataConsent: true,
  enableSeerCoding: true,
  storeCrashReports: 0,
  trustedRelays: [],
  defaultAutofixAutomationTuning: 'off',
  orgRoleList: ORG_ROLE_LIST,
  teamRoleList: TEAM_ROLE_LIST,
  hasGranularReplayPermissions: false,
  replayAccessMembers: [],
  role: 'owner',
  orgRole: 'owner',
  projects: CHESS_PROJECTS,
  teams: [CHESS_TEAM],
};

/**
 * Stand-in for the `/api/client-config/` payload the Django backend normally
 * renders. Consumed by `sentry/bootstrap` before the app mounts.
 */
export function chessConfig(): Config {
  return {
    theme: 'dark',
    user: CHESS_USER,
    messages: [],
    languageCode: 'en',
    csrfCookieName: 'sc',
    cells: [],
    superUserCookieName: 'su',
    superUserCookieDomain: null,
    validateSUForm: false,
    features: new Set<string>(['organizations:create']),
    // Must stay true: it gates OrganizationContextProvider and the org/projects/
    // teams queries. Nothing is actually preloaded — `bootstrap()` returns
    // before `preloadOrganizationData` runs, so `window.__sentry_preload` is
    // never set and those queries fall through to the (intercepted) api client.
    shouldPreloadData: true,
    signupLocalities: ['us'],
    singleOrganization: true,
    enableAnalytics: false,
    urlPrefix: window.location.origin,
    needsUpgrade: false,
    supportEmail: 'support@pawn-patrol.dev',
    invitesEnabled: false,
    privacyUrl: null,
    termsUrl: null,
    isOnPremise: false,
    isSelfHosted: false,
    isSelfHostedErrorsOnly: false,
    sentryMode: 'SAAS',
    // Drives the `/` redirect in `sentry/views/app/root`.
    lastOrganization: CHESS_ORG_SLUG,
    localities: [{name: 'us', url: window.location.origin}],
    gravatarBaseUrl: 'https://gravatar.com',
    initialTrace: {baggage: '', sentry_trace: ''},
    dsn: '',
    userIdentity: {
      ip_address: '127.0.0.1',
      email: CHESS_USER.email,
      id: CHESS_USER.id,
      isStaff: false,
    },
    isAuthenticated: true,
    version: {
      current: 'pawn-patrol',
      latest: 'pawn-patrol',
      build: 'hackweek',
      upgradeAvailable: false,
    },
    // An empty dsn disables the SDK transport entirely: nothing leaves the tab.
    sentryConfig: {
      dsn: '',
      release: 'pawn-patrol',
      allowUrls: [],
      tracePropagationTargets: [],
    },
    distPrefix: '',
    disableU2FForSUForm: false,
    apmSampling: 0,
    demoMode: false,
    // Non-customer-domain routing, so urls stay /organizations/pawn-patrol/...
    customerDomain: null,
    links: {
      sentryUrl: window.location.origin,
      organizationUrl: window.location.origin,
      // Must stay undefined, otherwise the api client prefixes every request
      // with /region/<name>.
      regionUrl: undefined,
    },
  };
}
