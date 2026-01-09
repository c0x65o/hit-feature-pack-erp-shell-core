'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useUi } from '@hit/ui-kit';
// =============================================================================
// HELPERS
// =============================================================================
function formatDate(dateStr) {
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
function formatRelativeTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffSecs < 60)
        return `${diffSecs}s ago`;
    if (diffMins < 60)
        return `${diffMins}m ago`;
    if (diffHours < 24)
        return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}
function getStatusBadgeVariant(status) {
    if (!status || status === 0)
        return 'warning';
    if (status >= 500)
        return 'error';
    if (status >= 400)
        return 'warning';
    return 'info';
}
function getStatusLabel(status) {
    if (!status || status === 0)
        return 'Network';
    return String(status);
}
// =============================================================================
// MAIN COMPONENT
// =============================================================================
export function ErrorLog() {
    const { Page, Card, Button, Input, Badge, Modal, EmptyState, Spinner, Alert, Tabs } = useUi();
    // Data state
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('error');
    const [sortField, setSortField] = useState('createdAt');
    const [sortDirection, setSortDirection] = useState('desc');
    const [selectedEvent, setSelectedEvent] = useState(null);
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
            const res = await fetch(`/api/audit-core/audit?${params.toString()}`);
            if (!res.ok) {
                throw new Error(`Failed to fetch: ${res.status}`);
            }
            const data = await res.json();
            setEvents(data.items);
            setPagination(data.pagination);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
        finally {
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
    const tableStyles = {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '13px',
    };
    const thStyles = {
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
    const tdStyles = {
        padding: '12px',
        borderBottom: '1px solid rgba(148,163,184,0.12)',
        verticalAlign: 'top',
    };
    const rowStyles = {
        cursor: 'pointer',
        transition: 'background 150ms ease',
    };
    const sortIndicator = (field) => {
        if (sortField !== field)
            return null;
        return _jsx("span", { style: { marginLeft: 4 }, children: sortDirection === 'asc' ? '↑' : '↓' });
    };
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        }
        else {
            setSortField(field);
            setSortDirection('desc');
        }
    };
    return (_jsxs(Page, { title: "Error Log", description: "API errors persisted in audit log", children: [_jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12,
                    padding: 16,
                }, children: [_jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: stats.total }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Total Errors" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: '#ef4444',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: stats.serverErrors }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "5xx Server" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: '#f59e0b',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: stats.clientErrors }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "4xx Client" })] }) })] }), _jsxs("div", { style: {
                    padding: '0 16px 16px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }, children: [_jsx("div", { style: { flex: '1 1 200px', minWidth: 200 }, children: _jsx(Input, { placeholder: "Search errors...", value: searchQuery, onChange: (v) => {
                                setSearchQuery(typeof v === 'string' ? v : v.target?.value ?? '');
                                setPagination((p) => ({ ...p, page: 1 }));
                            } }) }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 12, opacity: 0.7 }, children: "Status:" }), ['error', '4xx', '5xx', 'all'].map((s) => (_jsx(Button, { variant: statusFilter === s ? 'primary' : 'secondary', onClick: () => {
                                    setStatusFilter(s);
                                    setPagination((p) => ({ ...p, page: 1 }));
                                }, style: { fontSize: 12, padding: '4px 10px' }, children: s === 'error' ? 'All Errors' : s === 'all' ? 'All Events' : s }, s)))] }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 8 }, children: [_jsx(Button, { variant: "secondary", onClick: fetchEvents, style: { fontSize: 12 }, children: "\u21BB Refresh" }), _jsx(Button, { variant: "secondary", onClick: handleExport, style: { fontSize: 12 }, children: "Export JSON" })] })] }), error && (_jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Alert, { variant: "error", title: "Failed to load", children: error }) })), _jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Card, { children: loading ? (_jsx("div", { style: { padding: 40, textAlign: 'center' }, children: _jsx(Spinner, {}) })) : events.length === 0 ? (_jsx("div", { style: { padding: 40 }, children: _jsx(EmptyState, { title: "No Errors Found", description: "API errors will appear here when they are logged." }) })) : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: tableStyles, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { style: thStyles, onClick: () => handleSort('createdAt'), children: ["Time ", sortIndicator('createdAt')] }), _jsxs("th", { style: thStyles, onClick: () => handleSort('status'), children: ["Status ", sortIndicator('status')] }), _jsx("th", { style: thStyles, children: "Method" }), _jsxs("th", { style: thStyles, onClick: () => handleSort('actorName'), children: ["User ", sortIndicator('actorName')] }), _jsxs("th", { style: thStyles, onClick: () => handleSort('path'), children: ["Path ", sortIndicator('path')] }), _jsx("th", { style: thStyles, children: "Summary" }), _jsx("th", { style: thStyles, children: "Duration" })] }) }), _jsx("tbody", { children: events.map((event) => (_jsxs("tr", { style: rowStyles, onClick: () => setSelectedEvent(event), onMouseEnter: (e) => {
                                            e.currentTarget.style.background = 'rgba(148,163,184,0.08)';
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }, children: [_jsxs("td", { style: tdStyles, children: [_jsx("div", { style: { whiteSpace: 'nowrap' }, children: formatRelativeTime(event.createdAt) }), _jsx("div", { style: { fontSize: 11, opacity: 0.6 }, children: formatDate(event.createdAt).split(',')[1] })] }), _jsx("td", { style: tdStyles, children: _jsx(Badge, { variant: getStatusBadgeVariant(event.details?.responseStatus), children: getStatusLabel(event.details?.responseStatus) }) }), _jsx("td", { style: tdStyles, children: _jsx(Badge, { variant: "default", children: event.method || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        fontFamily: 'JetBrains Mono, monospace',
                                                        fontSize: 12,
                                                        opacity: event.actorName ? 1 : 0.5,
                                                    }, children: event.actorName || event.actorId || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        fontFamily: 'JetBrains Mono, monospace',
                                                        fontSize: 12,
                                                        maxWidth: 250,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        display: 'block',
                                                    }, title: event.path || '', children: event.path || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        maxWidth: 300,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        display: 'block',
                                                    }, title: event.summary, children: event.summary }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        fontFamily: 'JetBrains Mono, monospace',
                                                        fontSize: 12,
                                                        opacity: event.details?.durationMs ? 1 : 0.5,
                                                    }, children: event.details?.durationMs ? `${event.details.durationMs}ms` : '—' }) })] }, event.id))) })] }) })) }) }), pagination.totalPages > 1 && (_jsxs("div", { style: { padding: '0 16px 16px', display: 'flex', justifyContent: 'center', gap: 8 }, children: [_jsx(Button, { variant: "secondary", disabled: pagination.page <= 1, onClick: () => setPagination((p) => ({ ...p, page: p.page - 1 })), children: "\u2190 Previous" }), _jsxs("span", { style: { padding: '8px 16px', fontSize: 13 }, children: ["Page ", pagination.page, " of ", pagination.totalPages] }), _jsx(Button, { variant: "secondary", disabled: pagination.page >= pagination.totalPages, onClick: () => setPagination((p) => ({ ...p, page: p.page + 1 })), children: "Next \u2192" })] })), _jsx(Modal, { open: !!selectedEvent, onClose: () => setSelectedEvent(null), title: "Error Details", children: selectedEvent && (_jsx("div", { style: { padding: 16 }, children: _jsx(Tabs, { tabs: [
                            {
                                id: 'overview',
                                label: 'Overview',
                                content: (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }, children: [_jsx(DetailRow, { label: "Timestamp", value: formatDate(selectedEvent.createdAt) }), _jsx(DetailRow, { label: "Status", value: getStatusLabel(selectedEvent.details?.responseStatus) }), _jsx(DetailRow, { label: "Method", value: selectedEvent.method || '—' }), _jsx(DetailRow, { label: "Path", value: selectedEvent.path || '—', mono: true }), _jsx(DetailRow, { label: "User", value: selectedEvent.actorName || selectedEvent.actorId || 'Anonymous' }), _jsx(DetailRow, { label: "Duration", value: selectedEvent.details?.durationMs ? `${selectedEvent.details.durationMs}ms` : '—' }), _jsx(DetailRow, { label: "Summary", value: selectedEvent.summary }), _jsx(DetailRow, { label: "Entity", value: `${selectedEvent.entityKind}${selectedEvent.entityId ? ` #${selectedEvent.entityId}` : ''}` }), _jsx(DetailRow, { label: "Pack", value: selectedEvent.packName || '—' }), _jsx(DetailRow, { label: "IP", value: selectedEvent.ipAddress || '—', mono: true })] })),
                            },
                            {
                                id: 'request',
                                label: 'Request',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: selectedEvent.details?.requestBody ? (_jsx("pre", { style: {
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: 12,
                                            borderRadius: 8,
                                            overflow: 'auto',
                                            fontSize: 12,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            maxHeight: 300,
                                        }, children: JSON.stringify(selectedEvent.details.requestBody, null, 2) })) : (_jsx("div", { style: { opacity: 0.6, fontSize: 13 }, children: "No request body captured." })) })),
                            },
                            {
                                id: 'response',
                                label: 'Response',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: selectedEvent.details?.responseBody ? (_jsx("pre", { style: {
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: 12,
                                            borderRadius: 8,
                                            overflow: 'auto',
                                            fontSize: 12,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            maxHeight: 300,
                                        }, children: JSON.stringify(selectedEvent.details.responseBody, null, 2) })) : (_jsx("div", { style: { opacity: 0.6, fontSize: 13 }, children: "No response body captured." })) })),
                            },
                            {
                                id: 'raw',
                                label: 'Full Event',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: _jsx("pre", { style: {
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: 12,
                                            borderRadius: 8,
                                            overflow: 'auto',
                                            fontSize: 12,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            maxHeight: 300,
                                        }, children: JSON.stringify(selectedEvent, null, 2) }) })),
                            },
                        ] }) })) })] }));
}
// =============================================================================
// DETAIL ROW COMPONENT
// =============================================================================
function DetailRow({ label, value, mono = false, }) {
    return (_jsxs("div", { style: { display: 'flex', gap: 12 }, children: [_jsx("span", { style: { width: 120, flexShrink: 0, fontSize: 12, opacity: 0.7, fontWeight: 500 }, children: label }), _jsx("span", { style: {
                    fontSize: 13,
                    fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
                    wordBreak: 'break-word',
                }, children: value })] }));
}
export default ErrorLog;
