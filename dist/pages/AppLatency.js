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
function formatDuration(ms) {
    if (ms == null)
        return '—';
    if (ms < 1000)
        return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}
function getSeverity(ms, threshold) {
    if (ms == null)
        return 'normal';
    if (ms < threshold * 0.5)
        return 'fast';
    if (ms < threshold)
        return 'normal';
    if (ms < threshold * 2)
        return 'slow';
    return 'critical';
}
function getSeverityColor(severity) {
    switch (severity) {
        case 'fast': return '#22c55e';
        case 'normal': return '#3b82f6';
        case 'slow': return '#f59e0b';
        case 'critical': return '#ef4444';
        default: return '#6366f1';
    }
}
function getSeverityBadgeVariant(severity) {
    switch (severity) {
        case 'fast': return 'success';
        case 'normal': return 'info';
        case 'slow': return 'warning';
        case 'critical': return 'error';
        default: return 'info';
    }
}
// =============================================================================
// MAIN COMPONENT
// =============================================================================
export function AppLatency() {
    const { Page, Card, Button, Input, Badge, Modal, EmptyState, Spinner, Tabs, Alert } = useUi();
    // Data state
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [showSlowOnly, setShowSlowOnly] = useState(false);
    const [slowThresholdMs, setSlowThresholdMs] = useState(1000);
    const [sortField, setSortField] = useState('createdAt');
    const [sortDirection, setSortDirection] = useState('desc');
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showThresholdModal, setShowThresholdModal] = useState(false);
    const [newThreshold, setNewThreshold] = useState(String(slowThresholdMs));
    // Fetch data from audit API
    const fetchEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set('pageSize', String(pagination.pageSize));
            params.set('page', String(pagination.page));
            // Only show events with duration data
            if (showSlowOnly) {
                params.set('minDuration', String(slowThresholdMs));
            }
            if (searchQuery) {
                params.set('q', searchQuery);
            }
            const res = await fetch(`/api/audit/audit?${params.toString()}`);
            if (!res.ok) {
                throw new Error(`Failed to fetch: ${res.status}`);
            }
            const data = await res.json();
            // Filter to only events that have duration data
            const withDuration = data.items.filter((e) => e.details?.durationMs != null);
            setEvents(withDuration);
            setPagination(data.pagination);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
        finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.pageSize, showSlowOnly, slowThresholdMs, searchQuery]);
    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);
    // Stats
    const stats = useMemo(() => {
        const total = events.length;
        const slowCount = events.filter((e) => (e.details?.durationMs || 0) >= slowThresholdMs).length;
        const durations = events.map((e) => e.details?.durationMs || 0).filter((d) => d > 0);
        const avgLatency = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const sortedDurations = [...durations].sort((a, b) => a - b);
        const p95Index = Math.floor(sortedDurations.length * 0.95);
        const p95 = sortedDurations[p95Index] || 0;
        return { total, slowCount, avgLatency, p95 };
    }, [events, slowThresholdMs]);
    const handleExport = () => {
        const json = JSON.stringify(events, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `latency-log-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleSetThreshold = () => {
        const ms = parseInt(newThreshold, 10);
        if (!isNaN(ms) && ms > 0) {
            setSlowThresholdMs(ms);
            setShowThresholdModal(false);
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
    return (_jsxs(Page, { title: "App Latency", description: `Track API response times (threshold: ${slowThresholdMs}ms)`, children: [_jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12,
                    padding: 16,
                }, children: [_jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: pagination.total }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Total Requests" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: '#ef4444',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: stats.slowCount }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Slow Requests" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: '#6366f1',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: formatDuration(stats.avgLatency) }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Avg Latency" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: '#f59e0b',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: formatDuration(stats.p95) }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "P95 Latency" })] }) })] }), _jsxs("div", { style: {
                    padding: '0 16px 16px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }, children: [_jsx("div", { style: { flex: '1 1 200px', minWidth: 200 }, children: _jsx(Input, { placeholder: "Search paths, summaries...", value: searchQuery, onChange: (v) => {
                                setSearchQuery(typeof v === 'string' ? v : v.target?.value ?? '');
                                setPagination((p) => ({ ...p, page: 1 }));
                            } }) }), _jsx("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: _jsx(Button, { variant: showSlowOnly ? 'primary' : 'secondary', onClick: () => {
                                setShowSlowOnly(!showSlowOnly);
                                setPagination((p) => ({ ...p, page: 1 }));
                            }, style: { fontSize: 12, padding: '4px 10px' }, children: "\uD83D\uDC0C Slow Only" }) }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 8 }, children: [_jsx(Button, { variant: "secondary", onClick: () => setShowThresholdModal(true), style: { fontSize: 12 }, children: "\u2699\uFE0F Threshold" }), _jsx(Button, { variant: "secondary", onClick: fetchEvents, style: { fontSize: 12 }, children: "\u21BB Refresh" }), _jsx(Button, { variant: "secondary", onClick: handleExport, style: { fontSize: 12 }, children: "Export JSON" })] })] }), error && (_jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Alert, { variant: "error", title: "Failed to load", children: error }) })), _jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Card, { children: loading ? (_jsx("div", { style: { padding: 40, textAlign: 'center' }, children: _jsx(Spinner, {}) })) : events.length === 0 ? (_jsx("div", { style: { padding: 40 }, children: _jsx(EmptyState, { title: "No Requests Found", description: "Latency data will appear here when requests are logged." }) })) : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: tableStyles, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { style: thStyles, onClick: () => handleSort('createdAt'), children: ["Time ", sortIndicator('createdAt')] }), _jsx("th", { style: thStyles, children: "Method" }), _jsxs("th", { style: thStyles, onClick: () => handleSort('path'), children: ["Path ", sortIndicator('path')] }), _jsx("th", { style: thStyles, children: "User" }), _jsxs("th", { style: thStyles, onClick: () => handleSort('durationMs'), children: ["Duration ", sortIndicator('durationMs')] }), _jsx("th", { style: thStyles, children: "Status" })] }) }), _jsx("tbody", { children: events.map((event) => {
                                        const severity = getSeverity(event.details?.durationMs, slowThresholdMs);
                                        return (_jsxs("tr", { style: rowStyles, onClick: () => setSelectedEvent(event), onMouseEnter: (e) => {
                                                e.currentTarget.style.background = 'rgba(148,163,184,0.08)';
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.background = 'transparent';
                                            }, children: [_jsxs("td", { style: tdStyles, children: [_jsx("div", { style: { whiteSpace: 'nowrap' }, children: formatRelativeTime(event.createdAt) }), _jsx("div", { style: { fontSize: 11, opacity: 0.6 }, children: formatDate(event.createdAt).split(',')[1] })] }), _jsx("td", { style: tdStyles, children: _jsx(Badge, { variant: "default", children: event.method || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                            fontFamily: 'JetBrains Mono, monospace',
                                                            fontSize: 12,
                                                            maxWidth: 300,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            display: 'block',
                                                        }, title: event.path || '', children: event.path || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                            fontFamily: 'JetBrains Mono, monospace',
                                                            fontSize: 12,
                                                            opacity: event.actorName ? 1 : 0.5,
                                                        }, children: event.actorName || event.actorId || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                            fontFamily: 'JetBrains Mono, monospace',
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            color: getSeverityColor(severity),
                                                        }, children: formatDuration(event.details?.durationMs) }) }), _jsx("td", { style: tdStyles, children: _jsx(Badge, { variant: getSeverityBadgeVariant(severity), children: severity }) })] }, event.id));
                                    }) })] }) })) }) }), pagination.totalPages > 1 && (_jsxs("div", { style: { padding: '0 16px 16px', display: 'flex', justifyContent: 'center', gap: 8 }, children: [_jsx(Button, { variant: "secondary", disabled: pagination.page <= 1, onClick: () => setPagination((p) => ({ ...p, page: p.page - 1 })), children: "\u2190 Previous" }), _jsxs("span", { style: { padding: '8px 16px', fontSize: 13 }, children: ["Page ", pagination.page, " of ", pagination.totalPages] }), _jsx(Button, { variant: "secondary", disabled: pagination.page >= pagination.totalPages, onClick: () => setPagination((p) => ({ ...p, page: p.page + 1 })), children: "Next \u2192" })] })), _jsx(Modal, { open: !!selectedEvent, onClose: () => setSelectedEvent(null), title: "Request Details", children: selectedEvent && (_jsx("div", { style: { padding: 16 }, children: _jsx(Tabs, { tabs: [
                            {
                                id: 'overview',
                                label: 'Overview',
                                content: (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }, children: [_jsx(DetailRow, { label: "Timestamp", value: formatDate(selectedEvent.createdAt) }), _jsx(DetailRow, { label: "Duration", value: formatDuration(selectedEvent.details?.durationMs) }), _jsx(DetailRow, { label: "Method", value: selectedEvent.method || '—' }), _jsx(DetailRow, { label: "Path", value: selectedEvent.path || '—', mono: true }), _jsx(DetailRow, { label: "User", value: selectedEvent.actorName || selectedEvent.actorId || 'Anonymous' }), _jsx(DetailRow, { label: "Status", value: String(selectedEvent.details?.responseStatus || '—') }), _jsx(DetailRow, { label: "Entity", value: `${selectedEvent.entityKind}${selectedEvent.entityId ? ` #${selectedEvent.entityId}` : ''}` }), _jsx(DetailRow, { label: "Pack", value: selectedEvent.packName || '—' })] })),
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
                        ] }) })) }), _jsx(Modal, { open: showThresholdModal, onClose: () => setShowThresholdModal(false), title: "Slow Threshold Settings", children: _jsxs("div", { style: { padding: 16 }, children: [_jsx("p", { style: { marginBottom: 16, opacity: 0.8 }, children: "Requests slower than this threshold will be marked as \"slow\"." }), _jsx("div", { style: { marginBottom: 16 }, children: _jsx(Input, { type: "number", placeholder: "Threshold in milliseconds", value: newThreshold, onChange: (v) => setNewThreshold(typeof v === 'string' ? v : v.target?.value ?? '') }) }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx(Button, { variant: "secondary", onClick: () => setShowThresholdModal(false), children: "Cancel" }), _jsx(Button, { onClick: handleSetThreshold, children: "Save" })] })] }) })] }));
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
export default AppLatency;
