'use client';

import React, { useState, useMemo } from 'react';
import { useUi, useErrorLog, type ErrorLogEntry } from '@hit/ui-kit';

// =============================================================================
// TYPES
// =============================================================================

type SortField = 'timestamp' | 'status' | 'userEmail' | 'pageUrl';
type SortDirection = 'asc' | 'desc';

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function getStatusBadgeVariant(status: number): 'error' | 'warning' | 'info' | 'default' {
  if (status === 0) return 'warning'; // Network error
  if (status >= 500) return 'error';
  if (status >= 400) return 'warning';
  return 'info';
}

function getStatusLabel(status: number): string {
  if (status === 0) return 'Network';
  return String(status);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ErrorLog() {
  const { Page, Card, Button, Input, Badge, Modal, EmptyState, Spinner, Alert, Tabs } = useUi();
  const {
    errors,
    enabled,
    maxEntries,
    clearErrors,
    clearError,
    setEnabled,
    exportErrors,
  } = useErrorLog();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '4xx' | '5xx' | 'network'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'form' | 'fetch' | 'manual'>('all');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedError, setSelectedError] = useState<ErrorLogEntry | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filtered and sorted errors
  const filteredErrors = useMemo(() => {
    let result = [...errors];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.message.toLowerCase().includes(query) ||
          e.pageUrl.toLowerCase().includes(query) ||
          e.endpoint?.toLowerCase().includes(query) ||
          e.userEmail?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter === '4xx') {
      result = result.filter((e) => e.status >= 400 && e.status < 500);
    } else if (statusFilter === '5xx') {
      result = result.filter((e) => e.status >= 500);
    } else if (statusFilter === 'network') {
      result = result.filter((e) => e.status === 0);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      result = result.filter((e) => e.source === sourceFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'timestamp':
          cmp = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'status':
          cmp = a.status - b.status;
          break;
        case 'userEmail':
          cmp = (a.userEmail || '').localeCompare(b.userEmail || '');
          break;
        case 'pageUrl':
          cmp = a.pageUrl.localeCompare(b.pageUrl);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [errors, searchQuery, statusFilter, sourceFilter, sortField, sortDirection]);

  // Stats
  const stats = useMemo(() => {
    const total = errors.length;
    const clientErrors = errors.filter((e: ErrorLogEntry) => e.status >= 400 && e.status < 500).length;
    const serverErrors = errors.filter((e: ErrorLogEntry) => e.status >= 500).length;
    const networkErrors = errors.filter((e: ErrorLogEntry) => e.status === 0).length;
    const last24h = errors.filter(
      (e: ErrorLogEntry) => e.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;
    return { total, clientErrors, serverErrors, networkErrors, last24h };
  }, [errors]);

  const handleExport = () => {
    const json = exportErrors();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    clearErrors();
    setShowClearConfirm(false);
  };

  // Styles
  const tableStyles: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  };

  const thStyles: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '1px solid rgba(148,163,184,0.2)',
    fontWeight: 600,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: 0.8,
    cursor: 'pointer',
    userSelect: 'none',
  };

  const tdStyles: React.CSSProperties = {
    padding: '12px',
    borderBottom: '1px solid rgba(148,163,184,0.12)',
    verticalAlign: 'top',
  };

  const rowStyles: React.CSSProperties = {
    cursor: 'pointer',
    transition: 'background 150ms ease',
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return <span style={{ marginLeft: 4 }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <Page
      title="Error Log"
      description={`API errors captured during this session (max ${maxEntries} entries)`}
    >
      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          padding: 16,
        }}
      >
        <Card>
          <div style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {stats.total}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: 4 }}>Total Errors</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#ef4444',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {stats.serverErrors}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: 4 }}>5xx Server</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#f59e0b',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {stats.clientErrors}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: 4 }}>4xx Client</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#6366f1',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {stats.last24h}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: 4 }}>Last 24h</div>
          </div>
        </Card>
      </div>

      {/* Controls */}
      <div
        style={{
          padding: '0 16px 16px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 200px', minWidth: 200 }}>
          <Input
            placeholder="Search errors..."
            value={searchQuery}
            onChange={(v: string | React.ChangeEvent<HTMLInputElement>) => setSearchQuery(typeof v === 'string' ? v : v.target?.value ?? '')}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Status:</span>
          {(['all', '4xx', '5xx', 'network'] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'primary' : 'secondary'}
              onClick={() => setStatusFilter(s)}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              {s === 'all' ? 'All' : s === 'network' ? 'Network' : s}
            </Button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Source:</span>
          {(['all', 'form', 'fetch'] as const).map((s) => (
            <Button
              key={s}
              variant={sourceFilter === s ? 'primary' : 'secondary'}
              onClick={() => setSourceFilter(s)}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            onClick={() => setEnabled(!enabled)}
            style={{ fontSize: 12 }}
          >
            {enabled ? '⏸ Pause' : '▶ Resume'}
          </Button>
          <Button variant="secondary" onClick={handleExport} style={{ fontSize: 12 }}>
            Export JSON
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowClearConfirm(true)}
            disabled={errors.length === 0}
            style={{ fontSize: 12 }}
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {!enabled && (
        <div style={{ padding: '0 16px 16px' }}>
          <Alert variant="warning" title="Logging Paused">
            Error logging is currently paused. New errors will not be captured.
          </Alert>
        </div>
      )}

      {/* Error Table */}
      <div style={{ padding: '0 16px 16px' }}>
        <Card>
          {filteredErrors.length === 0 ? (
            <div style={{ padding: 40 }}>
              <EmptyState
                title={errors.length === 0 ? 'No Errors Captured' : 'No Matching Errors'}
                description={
                  errors.length === 0
                    ? 'API errors will appear here when they occur.'
                    : 'Try adjusting your search or filters.'
                }
              />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyles}>
                <thead>
                  <tr>
                    <th style={thStyles} onClick={() => handleSort('timestamp')}>
                      Time {sortIndicator('timestamp')}
                    </th>
                    <th style={thStyles} onClick={() => handleSort('status')}>
                      Status {sortIndicator('status')}
                    </th>
                    <th style={thStyles}>Source</th>
                    <th style={thStyles} onClick={() => handleSort('userEmail')}>
                      User {sortIndicator('userEmail')}
                    </th>
                    <th style={thStyles} onClick={() => handleSort('pageUrl')}>
                      Page {sortIndicator('pageUrl')}
                    </th>
                    <th style={thStyles}>Message</th>
                    <th style={thStyles}>Duration</th>
                    <th style={{ ...thStyles, width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredErrors.map((err) => (
                    <tr
                      key={err.id}
                      style={rowStyles}
                      onClick={() => setSelectedError(err)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(148,163,184,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={tdStyles}>
                        <div style={{ whiteSpace: 'nowrap' }}>
                          {formatRelativeTime(err.timestamp)}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.6 }}>
                          {formatDate(err.timestamp).split(',')[1]}
                        </div>
                      </td>
                      <td style={tdStyles}>
                        <Badge variant={getStatusBadgeVariant(err.status)}>
                          {getStatusLabel(err.status)}
                        </Badge>
                      </td>
                      <td style={tdStyles}>
                        <Badge variant="default">{err.source}</Badge>
                      </td>
                      <td style={tdStyles}>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12,
                            opacity: err.userEmail ? 1 : 0.5,
                          }}
                        >
                          {err.userEmail || '—'}
                        </span>
                      </td>
                      <td style={tdStyles}>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12,
                            maxWidth: 180,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                          title={err.pageUrl}
                        >
                          {err.pageUrl}
                        </span>
                      </td>
                      <td style={tdStyles}>
                        <span
                          style={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                          title={err.message}
                        >
                          {err.message}
                        </span>
                      </td>
                      <td style={tdStyles}>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12,
                            opacity: err.responseTimeMs ? 1 : 0.5,
                          }}
                        >
                          {err.responseTimeMs ? `${err.responseTimeMs}ms` : '—'}
                        </span>
                      </td>
                      <td style={tdStyles}>
                        <Button
                          variant="secondary"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            clearError(err.id);
                          }}
                          style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                          ✕
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Error Detail Modal */}
      <Modal
        open={!!selectedError}
        onClose={() => setSelectedError(null)}
        title="Error Details"
      >
        {selectedError && (
          <div style={{ padding: 16 }}>
            <Tabs
              tabs={[
                {
                  id: 'overview',
                  label: 'Overview',
                  content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
                      <DetailRow label="Timestamp" value={formatDate(selectedError.timestamp)} />
                      <DetailRow label="Status" value={getStatusLabel(selectedError.status)} />
                      <DetailRow label="Source" value={selectedError.source} />
                      <DetailRow label="User" value={selectedError.userEmail || 'Anonymous'} />
                      <DetailRow label="Page URL" value={selectedError.pageUrl} mono />
                      <DetailRow label="Endpoint" value={selectedError.endpoint || '—'} mono />
                      <DetailRow label="Method" value={selectedError.method || '—'} />
                      <DetailRow label="Response Time" value={selectedError.responseTimeMs ? `${selectedError.responseTimeMs}ms` : '—'} />
                      <DetailRow label="Message" value={selectedError.message} />
                    </div>
                  ),
                },
                {
                  id: 'fieldErrors',
                  label: 'Field Errors',
                  content: (
                    <div style={{ paddingTop: 16 }}>
                      {selectedError.fieldErrors && Object.keys(selectedError.fieldErrors).length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {Object.entries(selectedError.fieldErrors as Record<string, string>).map(([field, msg]) => (
                            <div
                              key={field}
                              style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 8,
                                padding: '8px 12px',
                              }}
                            >
                              <strong style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                                {field}:
                              </strong>{' '}
                              <span style={{ fontSize: 13 }}>{msg}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ opacity: 0.6, fontSize: 13 }}>No field-level errors.</div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'payload',
                  label: 'Payload',
                  content: (
                    <div style={{ paddingTop: 16 }}>
                      {selectedError.payload ? (
                        <pre
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            padding: 12,
                            borderRadius: 8,
                            overflow: 'auto',
                            fontSize: 12,
                            fontFamily: 'JetBrains Mono, monospace',
                            maxHeight: 300,
                          }}
                        >
                          {JSON.stringify(selectedError.payload, null, 2)}
                        </pre>
                      ) : (
                        <div style={{ opacity: 0.6, fontSize: 13 }}>No payload captured.</div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'raw',
                  label: 'Raw Error',
                  content: (
                    <div style={{ paddingTop: 16 }}>
                      {selectedError.rawError ? (
                        <pre
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            padding: 12,
                            borderRadius: 8,
                            overflow: 'auto',
                            fontSize: 12,
                            fontFamily: 'JetBrains Mono, monospace',
                            maxHeight: 300,
                          }}
                        >
                          {JSON.stringify(selectedError.rawError, null, 2)}
                        </pre>
                      ) : (
                        <div style={{ opacity: 0.6, fontSize: 13 }}>No raw error details.</div>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* Clear Confirmation Modal */}
      <Modal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All Errors?"
      >
        <div style={{ padding: 16 }}>
          <p style={{ marginBottom: 16 }}>
            This will permanently delete all {errors.length} logged errors. This action cannot be
            undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleClearAll}>Clear All</Button>
          </div>
        </div>
      </Modal>
    </Page>
  );
}

// =============================================================================
// DETAIL ROW COMPONENT
// =============================================================================

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ width: 120, flexShrink: 0, fontSize: 12, opacity: 0.7, fontWeight: 500 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default ErrorLog;
