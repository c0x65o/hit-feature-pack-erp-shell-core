'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useUi } from '@hit/ui-kit';

// =============================================================================
// TYPES
// =============================================================================

interface AuditEvent {
  id: string;
  entityKind: string;
  entityId: string | null;
  action: string;
  summary: string;
  details: {
    requestBody?: unknown;
    responseBody?: unknown;
    responseStatus?: number;
    durationMs?: number;
  } | null;
  actorId: string | null;
  actorName: string | null;
  actorType: string;
  correlationId: string | null;
  packName: string | null;
  method: string | null;
  path: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditResponse {
  items: AuditEvent[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type SortField = 'createdAt' | 'status' | 'actorName' | 'path';
type SortDirection = 'asc' | 'desc';

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
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

function getStatusBadgeVariant(status: number | undefined): 'error' | 'warning' | 'info' | 'default' {
  if (!status || status === 0) return 'warning';
  if (status >= 500) return 'error';
  if (status >= 400) return 'warning';
  return 'info';
}

function getStatusLabel(status: number | undefined): string {
  if (!status || status === 0) return 'Network';
  return String(status);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ErrorLog() {
  const { Page, Card, Button, Input, Badge, Modal, EmptyState, Spinner, Alert, Tabs } = useUi();

  // Data state
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '4xx' | '5xx' | 'error'>('error');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Fetch data from audit API
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('pageSize', String(pagination.pageSize));
      params.set('page', String(pagination.page));
      
      // Filter for errors (4xx and 5xx)
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      
      if (searchQuery) {
        params.set('q', searchQuery);
      }

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }
      const data: AuditResponse = await res.json();
      setEvents(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, statusFilter, searchQuery]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Stats
  const stats = useMemo(() => {
    const total = pagination.total;
    const clientErrors = events.filter((e) => {
      const s = e.details?.responseStatus;
      return s && s >= 400 && s < 500;
    }).length;
    const serverErrors = events.filter((e) => {
      const s = e.details?.responseStatus;
      return s && s >= 500;
    }).length;
    return { total, clientErrors, serverErrors };
  }, [events, pagination.total]);

  const handleExport = () => {
    const json = JSON.stringify(events, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
      description="API errors persisted in audit log"
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
            onChange={(v: string | React.ChangeEvent<HTMLInputElement>) => {
              setSearchQuery(typeof v === 'string' ? v : v.target?.value ?? '');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Status:</span>
          {(['error', '4xx', '5xx', 'all'] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'primary' : 'secondary'}
              onClick={() => {
                setStatusFilter(s);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              {s === 'error' ? 'All Errors' : s === 'all' ? 'All Events' : s}
            </Button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={fetchEvents} style={{ fontSize: 12 }}>
            ↻ Refresh
          </Button>
          <Button variant="secondary" onClick={handleExport} style={{ fontSize: 12 }}>
            Export JSON
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ padding: '0 16px 16px' }}>
          <Alert variant="error" title="Failed to load">
            {error}
          </Alert>
        </div>
      )}

      {/* Error Table */}
      <div style={{ padding: '0 16px 16px' }}>
        <Card>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Spinner />
            </div>
          ) : events.length === 0 ? (
            <div style={{ padding: 40 }}>
              <EmptyState
                title="No Errors Found"
                description="API errors will appear here when they are logged."
              />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyles}>
                <thead>
                  <tr>
                    <th style={thStyles} onClick={() => handleSort('createdAt')}>
                      Time {sortIndicator('createdAt')}
                    </th>
                    <th style={thStyles} onClick={() => handleSort('status')}>
                      Status {sortIndicator('status')}
                    </th>
                    <th style={thStyles}>Method</th>
                    <th style={thStyles} onClick={() => handleSort('actorName')}>
                      User {sortIndicator('actorName')}
                    </th>
                    <th style={thStyles} onClick={() => handleSort('path')}>
                      Path {sortIndicator('path')}
                    </th>
                    <th style={thStyles}>Summary</th>
                    <th style={thStyles}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      style={rowStyles}
                      onClick={() => setSelectedEvent(event)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(148,163,184,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={tdStyles}>
                        <div style={{ whiteSpace: 'nowrap' }}>
                          {formatRelativeTime(event.createdAt)}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.6 }}>
                          {formatDate(event.createdAt).split(',')[1]}
                        </div>
                      </td>
                      <td style={tdStyles}>
                        <Badge variant={getStatusBadgeVariant(event.details?.responseStatus)}>
                          {getStatusLabel(event.details?.responseStatus)}
                        </Badge>
                      </td>
                      <td style={tdStyles}>
                        <Badge variant="default">{event.method || '—'}</Badge>
                      </td>
                      <td style={tdStyles}>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12,
                            opacity: event.actorName ? 1 : 0.5,
                          }}
                        >
                          {event.actorName || event.actorId || '—'}
                        </span>
                      </td>
                      <td style={tdStyles}>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12,
                            maxWidth: 250,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                          title={event.path || ''}
                        >
                          {event.path || '—'}
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
                          title={event.summary}
                        >
                          {event.summary}
                        </span>
                      </td>
                      <td style={tdStyles}>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12,
                            opacity: event.details?.durationMs ? 1 : 0.5,
                          }}
                        >
                          {event.details?.durationMs ? `${event.details.durationMs}ms` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'center', gap: 8 }}>
          <Button
            variant="secondary"
            disabled={pagination.page <= 1}
            onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
          >
            ← Previous
          </Button>
          <span style={{ padding: '8px 16px', fontSize: 13 }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
          >
            Next →
          </Button>
        </div>
      )}

      {/* Event Detail Modal */}
      <Modal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Error Details"
      >
        {selectedEvent && (
          <div style={{ padding: 16 }}>
            <Tabs
              tabs={[
                {
                  id: 'overview',
                  label: 'Overview',
                  content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
                      <DetailRow label="Timestamp" value={formatDate(selectedEvent.createdAt)} />
                      <DetailRow label="Status" value={getStatusLabel(selectedEvent.details?.responseStatus)} />
                      <DetailRow label="Method" value={selectedEvent.method || '—'} />
                      <DetailRow label="Path" value={selectedEvent.path || '—'} mono />
                      <DetailRow label="Correlation ID" value={selectedEvent.correlationId || '—'} mono />
                      <DetailRow label="User" value={selectedEvent.actorName || selectedEvent.actorId || 'Anonymous'} />
                      <DetailRow label="Duration" value={selectedEvent.details?.durationMs ? `${selectedEvent.details.durationMs}ms` : '—'} />
                      <DetailRow label="Summary" value={selectedEvent.summary} />
                      <DetailRow label="Entity" value={`${selectedEvent.entityKind}${selectedEvent.entityId ? ` #${selectedEvent.entityId}` : ''}`} />
                      <DetailRow label="Pack" value={selectedEvent.packName || '—'} />
                      <DetailRow label="IP" value={selectedEvent.ipAddress || '—'} mono />
                    </div>
                  ),
                },
                {
                  id: 'request',
                  label: 'Request',
                  content: (
                    <div style={{ paddingTop: 16 }}>
                      {selectedEvent.details?.requestBody ? (
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
                          {JSON.stringify(selectedEvent.details.requestBody, null, 2)}
                        </pre>
                      ) : (
                        <div style={{ opacity: 0.6, fontSize: 13 }}>No request body captured.</div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'response',
                  label: 'Response',
                  content: (
                    <div style={{ paddingTop: 16 }}>
                      {selectedEvent.details?.responseBody ? (
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
                          {JSON.stringify(selectedEvent.details.responseBody, null, 2)}
                        </pre>
                      ) : (
                        <div style={{ opacity: 0.6, fontSize: 13 }}>No response body captured.</div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'raw',
                  label: 'Full Event',
                  content: (
                    <div style={{ paddingTop: 16 }}>
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
                        {JSON.stringify(selectedEvent, null, 2)}
                      </pre>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
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
