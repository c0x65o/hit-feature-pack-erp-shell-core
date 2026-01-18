'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useUi, useErrorLog } from '@hit/ui-kit';
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
    // Source toggle: server (audit log) vs client (useErrorLog)
    const [source, setSource] = useState('server');
    // Client-side error log
    const { errors: clientErrors, clearErrors: clearClientErrors, clearError: clearClientError, exportErrors: exportClientErrors } = useErrorLog();
    const [selectedClientError, setSelectedClientError] = useState(null);
    // Data state (server)
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
            const res = await fetch(`/api/audit?${params.toString()}`);
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
    // Stats for server errors
    const serverStats = useMemo(() => {
        const total = pagination.total;
        const clientErrorCount = events.filter((e) => {
            const s = e.details?.responseStatus;
            return s && s >= 400 && s < 500;
        }).length;
        const serverErrorCount = events.filter((e) => {
            const s = e.details?.responseStatus;
            return s && s >= 500;
        }).length;
        return { total, clientErrorCount, serverErrorCount };
    }, [events, pagination.total]);
    // Stats for client errors
    const clientStats = useMemo(() => {
        const total = clientErrors.length;
        const clientErrorCount = clientErrors.filter((e) => e.status >= 400 && e.status < 500).length;
        const serverErrorCount = clientErrors.filter((e) => e.status >= 500).length;
        const networkErrorCount = clientErrors.filter((e) => e.status === 0).length;
        return { total, clientErrorCount, serverErrorCount, networkErrorCount };
    }, [clientErrors]);
    const handleExport = () => {
        if (source === 'client') {
            const json = exportClientErrors();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `client-errors-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
        else {
            const json = JSON.stringify(events, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `server-errors-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
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
    return (_jsxs(Page, { title: "Error Log", description: source === 'server' ? 'API errors persisted in audit log' : 'Client-side errors from this browser session', children: [_jsxs("div", { style: { padding: '16px 16px 0', display: 'flex', gap: 8 }, children: [_jsx(Button, { variant: source === 'server' ? 'primary' : 'secondary', onClick: () => setSource('server'), style: { fontSize: 13 }, children: "Server Errors (Audit Log)" }), _jsxs(Button, { variant: source === 'client' ? 'primary' : 'secondary', onClick: () => setSource('client'), style: { fontSize: 13 }, children: ["Client Errors (", clientErrors.length, ")"] })] }), _jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12,
                    padding: 16,
                }, children: source === 'server' ? (_jsxs(_Fragment, { children: [_jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                            fontSize: '28px',
                                            fontWeight: 700,
                                            fontFamily: 'JetBrains Mono, monospace',
                                        }, children: serverStats.total }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Total Errors" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                            fontSize: '28px',
                                            fontWeight: 700,
                                            color: '#ef4444',
                                            fontFamily: 'JetBrains Mono, monospace',
                                        }, children: serverStats.serverErrorCount }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "5xx Server" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                            fontSize: '28px',
                                            fontWeight: 700,
                                            color: '#f59e0b',
                                            fontFamily: 'JetBrains Mono, monospace',
                                        }, children: serverStats.clientErrorCount }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "4xx Client" })] }) })] })) : (_jsxs(_Fragment, { children: [_jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                            fontSize: '28px',
                                            fontWeight: 700,
                                            fontFamily: 'JetBrains Mono, monospace',
                                        }, children: clientStats.total }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Total Errors" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                            fontSize: '28px',
                                            fontWeight: 700,
                                            color: '#ef4444',
                                            fontFamily: 'JetBrains Mono, monospace',
                                        }, children: clientStats.serverErrorCount }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "5xx Server" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                            fontSize: '28px',
                                            fontWeight: 700,
                                            color: '#f59e0b',
                                            fontFamily: 'JetBrains Mono, monospace',
                                        }, children: clientStats.clientErrorCount }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "4xx Client" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                            fontSize: '28px',
                                            fontWeight: 700,
                                            color: '#6366f1',
                                            fontFamily: 'JetBrains Mono, monospace',
                                        }, children: clientStats.networkErrorCount }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Network" })] }) })] })) }), _jsxs("div", { style: {
                    padding: '0 16px 16px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }, children: [source === 'server' && (_jsxs(_Fragment, { children: [_jsx("div", { style: { flex: '1 1 200px', minWidth: 200 }, children: _jsx(Input, { placeholder: "Search errors...", value: searchQuery, onChange: (v) => {
                                        setSearchQuery(typeof v === 'string' ? v : v.target?.value ?? '');
                                        setPagination((p) => ({ ...p, page: 1 }));
                                    } }) }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 12, opacity: 0.7 }, children: "Status:" }), ['error', '4xx', '5xx', 'all'].map((s) => (_jsx(Button, { variant: statusFilter === s ? 'primary' : 'secondary', onClick: () => {
                                            setStatusFilter(s);
                                            setPagination((p) => ({ ...p, page: 1 }));
                                        }, style: { fontSize: 12, padding: '4px 10px' }, children: s === 'error' ? 'All Errors' : s === 'all' ? 'All Events' : s }, s)))] })] })), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 8 }, children: [source === 'server' ? (_jsx(Button, { variant: "secondary", onClick: fetchEvents, style: { fontSize: 12 }, children: "\u21BB Refresh" })) : (_jsx(Button, { variant: "secondary", onClick: clearClientErrors, style: { fontSize: 12 }, disabled: clientErrors.length === 0, children: "Clear All" })), _jsx(Button, { variant: "secondary", onClick: handleExport, style: { fontSize: 12 }, children: "Export JSON" })] })] }), source === 'server' && error && (_jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Alert, { variant: "error", title: "Failed to load", children: error }) })), source === 'server' && (_jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Card, { children: loading ? (_jsx("div", { style: { padding: 40, textAlign: 'center' }, children: _jsx(Spinner, {}) })) : events.length === 0 ? (_jsx("div", { style: { padding: 40 }, children: _jsx(EmptyState, { title: "No Errors Found", description: "API errors will appear here when they are logged." }) })) : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: tableStyles, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { style: thStyles, onClick: () => handleSort('createdAt'), children: ["Time ", sortIndicator('createdAt')] }), _jsxs("th", { style: thStyles, onClick: () => handleSort('status'), children: ["Status ", sortIndicator('status')] }), _jsx("th", { style: thStyles, children: "Method" }), _jsxs("th", { style: thStyles, onClick: () => handleSort('actorName'), children: ["User ", sortIndicator('actorName')] }), _jsxs("th", { style: thStyles, onClick: () => handleSort('path'), children: ["Path ", sortIndicator('path')] }), _jsx("th", { style: thStyles, children: "Summary" }), _jsx("th", { style: thStyles, children: "Duration" })] }) }), _jsx("tbody", { children: events.map((event) => (_jsxs("tr", { style: rowStyles, onClick: () => setSelectedEvent(event), onMouseEnter: (e) => {
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
                                                    }, children: event.details?.durationMs ? `${event.details.durationMs}ms` : '—' }) })] }, event.id))) })] }) })) }) })), source === 'client' && (_jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Card, { children: clientErrors.length === 0 ? (_jsx("div", { style: { padding: 40 }, children: _jsx(EmptyState, { title: "No Client Errors", description: "Client-side errors from this browser session will appear here." }) })) : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: tableStyles, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: thStyles, children: "Time" }), _jsx("th", { style: thStyles, children: "Status" }), _jsx("th", { style: thStyles, children: "Method" }), _jsx("th", { style: thStyles, children: "Page" }), _jsx("th", { style: thStyles, children: "Endpoint" }), _jsx("th", { style: thStyles, children: "Message" }), _jsx("th", { style: thStyles, children: "Duration" }), _jsx("th", { style: thStyles })] }) }), _jsx("tbody", { children: clientErrors.map((err) => (_jsxs("tr", { style: rowStyles, onClick: () => setSelectedClientError(err), onMouseEnter: (e) => {
                                            e.currentTarget.style.background = 'rgba(148,163,184,0.08)';
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }, children: [_jsxs("td", { style: tdStyles, children: [_jsx("div", { style: { whiteSpace: 'nowrap' }, children: formatRelativeTime(err.timestamp.toISOString()) }), _jsx("div", { style: { fontSize: 11, opacity: 0.6 }, children: formatDate(err.timestamp.toISOString()).split(',')[1] })] }), _jsx("td", { style: tdStyles, children: _jsx(Badge, { variant: getStatusBadgeVariant(err.status), children: getStatusLabel(err.status) }) }), _jsx("td", { style: tdStyles, children: _jsx(Badge, { variant: "default", children: err.method || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        fontFamily: 'JetBrains Mono, monospace',
                                                        fontSize: 12,
                                                        maxWidth: 150,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        display: 'block',
                                                    }, title: err.pageUrl, children: err.pageUrl || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        fontFamily: 'JetBrains Mono, monospace',
                                                        fontSize: 12,
                                                        maxWidth: 200,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        display: 'block',
                                                    }, title: err.endpoint || '', children: err.endpoint || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        maxWidth: 250,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        display: 'block',
                                                    }, title: err.message, children: err.message }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        fontFamily: 'JetBrains Mono, monospace',
                                                        fontSize: 12,
                                                        opacity: err.responseTimeMs ? 1 : 0.5,
                                                    }, children: err.responseTimeMs ? `${err.responseTimeMs}ms` : '—' }) }), _jsx("td", { style: tdStyles, children: _jsx(Button, { variant: "secondary", onClick: (e) => {
                                                        e.stopPropagation();
                                                        clearClientError(err.id);
                                                    }, style: { fontSize: 11, padding: '2px 8px' }, children: "\u2715" }) })] }, err.id))) })] }) })) }) })), source === 'server' && pagination.totalPages > 1 && (_jsxs("div", { style: { padding: '0 16px 16px', display: 'flex', justifyContent: 'center', gap: 8 }, children: [_jsx(Button, { variant: "secondary", disabled: pagination.page <= 1, onClick: () => setPagination((p) => ({ ...p, page: p.page - 1 })), children: "\u2190 Previous" }), _jsxs("span", { style: { padding: '8px 16px', fontSize: 13 }, children: ["Page ", pagination.page, " of ", pagination.totalPages] }), _jsx(Button, { variant: "secondary", disabled: pagination.page >= pagination.totalPages, onClick: () => setPagination((p) => ({ ...p, page: p.page + 1 })), children: "Next \u2192" })] })), _jsx(Modal, { open: !!selectedEvent, onClose: () => setSelectedEvent(null), title: "Error Details", children: selectedEvent && (_jsx("div", { style: { padding: 16 }, children: _jsx(Tabs, { tabs: [
                            {
                                id: 'overview',
                                label: 'Overview',
                                content: (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }, children: [_jsx(DetailRow, { label: "Timestamp", value: formatDate(selectedEvent.createdAt) }), _jsx(DetailRow, { label: "Status", value: getStatusLabel(selectedEvent.details?.responseStatus) }), _jsx(DetailRow, { label: "Method", value: selectedEvent.method || '—' }), _jsx(DetailRow, { label: "Path", value: selectedEvent.path || '—', mono: true }), _jsx(DetailRow, { label: "Correlation ID", value: selectedEvent.correlationId || '—', mono: true }), _jsx(DetailRow, { label: "User", value: selectedEvent.actorName || selectedEvent.actorId || 'Anonymous' }), _jsx(DetailRow, { label: "Duration", value: selectedEvent.details?.durationMs ? `${selectedEvent.details.durationMs}ms` : '—' }), _jsx(DetailRow, { label: "Summary", value: selectedEvent.summary }), _jsx(DetailRow, { label: "Entity", value: `${selectedEvent.entityKind}${selectedEvent.entityId ? ` #${selectedEvent.entityId}` : ''}` }), _jsx(DetailRow, { label: "Pack", value: selectedEvent.packName || '—' }), _jsx(DetailRow, { label: "IP", value: selectedEvent.ipAddress || '—', mono: true })] })),
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
                        ] }) })) }), _jsx(Modal, { open: !!selectedClientError, onClose: () => setSelectedClientError(null), title: "Client Error Details", children: selectedClientError && (_jsx("div", { style: { padding: 16 }, children: _jsx(Tabs, { tabs: [
                            {
                                id: 'overview',
                                label: 'Overview',
                                content: (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }, children: [_jsx(DetailRow, { label: "Timestamp", value: formatDate(selectedClientError.timestamp.toISOString()) }), _jsx(DetailRow, { label: "Status", value: getStatusLabel(selectedClientError.status) }), _jsx(DetailRow, { label: "Method", value: selectedClientError.method || '—' }), _jsx(DetailRow, { label: "Endpoint", value: selectedClientError.endpoint || '—', mono: true }), _jsx(DetailRow, { label: "Page URL", value: selectedClientError.pageUrl, mono: true }), _jsx(DetailRow, { label: "User", value: selectedClientError.userEmail || 'Anonymous' }), _jsx(DetailRow, { label: "Duration", value: selectedClientError.responseTimeMs ? `${selectedClientError.responseTimeMs}ms` : '—' }), _jsx(DetailRow, { label: "Message", value: selectedClientError.message }), _jsx(DetailRow, { label: "Source", value: selectedClientError.source })] })),
                            },
                            {
                                id: 'payload',
                                label: 'Payload',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: selectedClientError.payload ? (_jsx("pre", { style: {
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: 12,
                                            borderRadius: 8,
                                            overflow: 'auto',
                                            fontSize: 12,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            maxHeight: 300,
                                        }, children: JSON.stringify(selectedClientError.payload, null, 2) })) : (_jsx("div", { style: { opacity: 0.6, fontSize: 13 }, children: "No payload captured." })) })),
                            },
                            {
                                id: 'fieldErrors',
                                label: 'Field Errors',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: selectedClientError.fieldErrors && Object.keys(selectedClientError.fieldErrors).length > 0 ? (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: Object.entries(selectedClientError.fieldErrors).map(([field, msg]) => (_jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsxs("span", { style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }, children: [field, ":"] }), _jsx("span", { style: { fontSize: 13 }, children: msg })] }, field))) })) : (_jsx("div", { style: { opacity: 0.6, fontSize: 13 }, children: "No field errors." })) })),
                            },
                            {
                                id: 'raw',
                                label: 'Raw Error',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: selectedClientError.rawError ? (_jsx("pre", { style: {
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: 12,
                                            borderRadius: 8,
                                            overflow: 'auto',
                                            fontSize: 12,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            maxHeight: 300,
                                        }, children: JSON.stringify(selectedClientError.rawError, null, 2) })) : (_jsx("div", { style: { opacity: 0.6, fontSize: 13 }, children: "No raw error data." })) })),
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
