export interface DashboardSnapshot {
  overview: {
    openPRs: number;
    blockingPRs: number;
    avgReviewSeconds: number;
    slaComplianceRate: number;
    avgHealthScore: number;
  };
  metricsOverview: {
    total_reviews: number;
  };
  repositories: Repository[];
  reviewQueue: ReviewPR[];
  recentActivity: ActivityItem[];
  workload: WorkloadItem[];
  configSummary: ConfigSummaryItem[];
  trendData: TrendPoint[];
  approvalByExecutor: ExecutorApproval[];
  rejectionReasons: RejectionReason[];
}

export interface Repository {
  id: number;
  full_name: string;
  default_branch: string;
}

export interface ReviewPR {
  id: number;
  number: number;
  title: string;
  repository: string;
  author: string;
  status: PRStatus;
  priority_score?: number;
  health_score?: number;
  is_blocking?: boolean;
}

export type PRStatus = 'open' | 'merged' | 'closed' | 'rejected';

export interface ActivityItem {
  id?: string;
  title?: string;
  status?: string;
  tone?: string;
  source?: string;
  description?: string;
  message?: string;
  repository?: string;
  occurred_at?: string;
  created_at?: string;
}

export interface WorkloadItem {
  label: string;
  value: number;
}

export interface ConfigSummaryItem {
  repository: string;
  mode: string;
  interval: number;
  autoMerge: boolean;
  threshold: number;
}

export interface TrendPoint {
  bucket: string;
  avg_duration: number;
}

export interface ExecutorApproval {
  executor_type: string;
  approval_rate: number;
  total_reviews: number;
}

export interface RejectionReason {
  issue_type: string;
  count: number;
}

export interface PR {
  id: number;
  number: number;
  title: string;
  repository: string;
  author: string;
  status: PRStatus;
  priority_score?: number;
  health_score?: number;
  risk_score?: number;
  impact_score?: number;
  latest_outcome?: string;
  isDraft?: boolean;
  labels?: string[];
  requested_reviewers?: string[];
  comments_count?: number;
  review_comments_count?: number;
  body?: string;
  url?: string;
  baseBranch?: string;
  base_branch?: string;
  branch?: string;
  head_branch?: string;
  headRefName?: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits_count?: number;
  lead_summary?: string;
  mergedAt?: string;
  merged_at?: string;
  closedAt?: string;
  closed_at?: string;
  updatedAt?: string;
  updated_at?: string;
  createdAt?: string;
  created_at?: string;
  github_conversations?: Conversation[];
}

export interface Conversation {
  id?: string;
  type: 'review' | 'comment';
  author?: string;
  body?: string;
  state?: string;
  url?: string;
  createdAt?: string;
}

export interface PRMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PRFilters {
  status: string;
  repositoryId: string;
  authorId: string;
  search: string;
}

export interface FilterOptions {
  authors: string[];
  repositories: string[];
}

export interface TeamSecurityData {
  developers: Developer[];
  recentAlerts: Alert[];
  securityFindings: SecurityFinding[];
}

export interface Developer {
  id: number;
  display_name: string;
  role: string;
  is_available: boolean;
  unavailable_until?: string;
  current_workload_score?: number;
}

export interface Alert {
  title: string;
  priority: string;
  message: string;
  created_at: string;
}

export interface SecurityFinding {
  title: string;
  severity: string;
  description: string;
  repository: string;
  github_pr_id: number;
  file_path?: string;
  detected_at: string;
}

export interface ConfigData {
  repository: Repository;
  config: RepoConfig;
  rules: CustomRule[];
}

export interface RepoConfig {
  reviewInterval: number;
  reviewMode: string;
  aiExecutor: string;
  autoMerge: boolean;
  severityThreshold: number;
  autoMergeHealthThreshold: number;
  logLevel: string;
  requiredChecks: string[];
}

export interface ConfigFormState {
  reviewInterval: string;
  reviewMode: string;
  aiExecutor: string;
  autoMerge: string;
  severityThreshold: string;
  autoMergeHealthThreshold: string;
  logLevel: string;
  requiredChecks: string;
}

export interface CustomRule {
  id: number;
  rule_name: string;
  rule_type: string;
  severity: string;
  pattern: string;
  message: string;
}

export interface RuleFormState {
  id: string;
  rule_name: string;
  rule_type: string;
  severity: string;
  pattern: string;
  message: string;
  sampleCode: string;
}

export interface RuntimeConfig {
  apiBaseUrl: string;
  wsUrl: string;
  wsUserId: string;
  wsToken: string;
}

export interface LogEntry {
  id: string;
  type: 'info' | 'warn' | 'error';
  message: string;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export type ThemeMode = 'system' | 'dark' | 'light';
export type ViewMode = 'table' | 'kanban';
export type TabId = 'overview' | 'prs' | 'metrics' | 'team' | 'security' | 'config' | 'logs';

export interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}
