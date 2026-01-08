'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { useUi, useLatencyLog, formatDuration, getLatencySeverity, } from '@hit/ui-kit';
// =============================================================================
// HELPERS
// =============================================================================
function formatDate(date) {
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}
function formatRelativeTime(date) {
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
function getSourceLabel(source) {
    switch (source) {
        case 'db':
            return 'Database';
        case 'module':
            return 'Module';
        case 'api':
            return 'API';
        default:
            return 'Other';
    }
}
function getSourceIcon(source) {
    switch (source) {
        case 'db':
            return '🗄️';
        case 'module':
            return '📦';
        case 'api':
            return '🌐';
        default:
            return '⚙️';
    }
}
function getSeverityColor(severity) {
    switch (severity) {
        case 'fast':
            return '#22c55e';
        case 'normal':
            return '#3b82f6';
        case 'slow':
            return '#f59e0b';
        case 'critical':
        default:
            return '#ef4444';
    }
}
function getSeverityBadgeVariant(severity) {
    switch (severity) {
        case 'fast':
            return 'success';
        case 'normal':
            return 'info';
        case 'slow':
            return 'warning';
        case 'critical':
        default:
            return 'error';
    }
}
// =============================================================================
// MAIN COMPONENT
// =============================================================================
export function AppLatency() {
    const { Page, Card, Button, Input, Badge, Modal, EmptyState, Tabs, Alert } = useUi();
    const latencyLog = useLatencyLog();
    const { entries, enabled, maxEntries, slowThresholdMs, clearEntries, clearEntry, setEnabled, setSlowThreshold, exportEntries, } = latencyLog;
    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [showSlowOnly, setShowSlowOnly] = useState(false);
    const [sortField, setSortField] = useState('timestamp');
    const [sortDirection, setSortDirection] = useState('desc');
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showThresholdModal, setShowThresholdModal] = useState(false);
    const [newThreshold, setNewThreshold] = useState(String(slowThresholdMs));
    // Filtered and sorted entries
    const filteredEntries = useMemo(() => {
        let result = [...entries];
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter((e) => e.endpoint.toLowerCase().includes(query) ||
                e.moduleName?.toLowerCase().includes(query) ||
                e.tableName?.toLowerCase().includes(query) ||
                e.pageUrl.toLowerCase().includes(query));
        }
        // Source filter
        if (sourceFilter !== 'all') {
            result = result.filter((e) => e.source === sourceFilter);
        }
        // Slow only filter
        if (showSlowOnly) {
            result = result.filter((e) => e.isSlow);
        }
        // Sort
        result.sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'timestamp':
                    cmp = a.timestamp.getTime() - b.timestamp.getTime();
                    break;
                case 'durationMs':
                    cmp = a.durationMs - b.durationMs;
                    break;
                case 'source':
                    cmp = a.source.localeCompare(b.source);
                    break;
                case 'endpoint':
                    cmp = a.endpoint.localeCompare(b.endpoint);
                    break;
            }
            return sortDirection === 'asc' ? cmp : -cmp;
        });
        return result;
    }, [entries, searchQuery, sourceFilter, showSlowOnly, sortField, sortDirection]);
    // Stats
    const stats = useMemo(() => {
        const total = entries.length;
        const slowCount = entries.filter((e) => e.isSlow).length;
        const dbCount = entries.filter((e) => e.source === 'db').length;
        const moduleCount = entries.filter((e) => e.source === 'module').length;
        const apiCount = entries.filter((e) => e.source === 'api').length;
        // Average durations by source
        const avgBySource = {
            db: { total: 0, count: 0 },
            module: { total: 0, count: 0 },
            api: { total: 0, count: 0 },
            other: { total: 0, count: 0 },
        };
        entries.forEach((e) => {
            avgBySource[e.source].total += e.durationMs;
            avgBySource[e.source].count += 1;
        });
        const avgDb = avgBySource.db.count > 0 ? avgBySource.db.total / avgBySource.db.count : 0;
        const avgModule = avgBySource.module.count > 0 ? avgBySource.module.total / avgBySource.module.count : 0;
        const avgApi = avgBySource.api.count > 0 ? avgBySource.api.total / avgBySource.api.count : 0;
        // Overall average
        const overallAvg = total > 0 ? entries.reduce((sum, e) => sum + e.durationMs, 0) / total : 0;
        // P95 latency
        const sortedDurations = [...entries].map((e) => e.durationMs).sort((a, b) => a - b);
        const p95Index = Math.floor(sortedDurations.length * 0.95);
        const p95 = sortedDurations[p95Index] || 0;
        return {
            total,
            slowCount,
            dbCount,
            moduleCount,
            apiCount,
            avgDb,
            avgModule,
            avgApi,
            overallAvg,
            p95,
        };
    }, [entries]);
    const handleExport = () => {
        const json = exportEntries();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `latency-log-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleClearAll = () => {
        clearEntries();
        setShowClearConfirm(false);
    };
    const handleSetThreshold = () => {
        const ms = parseInt(newThreshold, 10);
        if (!isNaN(ms) && ms > 0) {
            setSlowThreshold(ms);
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
    return (_jsxs(Page, { title: "App Latency", description: `Track slow queries and API response times (threshold: ${slowThresholdMs}ms)`, children: [_jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12,
                    padding: 16,
                }, children: [_jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: stats.total }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Total Requests" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: '#ef4444',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: stats.slowCount }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Slow Requests" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: '#6366f1',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: formatDuration(stats.overallAvg) }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Avg Latency" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: '#f59e0b',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: formatDuration(stats.p95) }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "P95 Latency" })] }) })] }), _jsxs("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                    padding: '0 16px 16px',
                }, children: [_jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 20 }, children: "\uD83D\uDDC4\uFE0F" }), _jsx("span", { style: { fontWeight: 600 }, children: "Database" })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 }, children: [_jsx("span", { style: { opacity: 0.7 }, children: "Count:" }), _jsx("span", { style: { fontFamily: 'JetBrains Mono, monospace' }, children: stats.dbCount })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 }, children: [_jsx("span", { style: { opacity: 0.7 }, children: "Avg:" }), _jsx("span", { style: { fontFamily: 'JetBrains Mono, monospace' }, children: formatDuration(stats.avgDb) })] })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 20 }, children: "\uD83D\uDCE6" }), _jsx("span", { style: { fontWeight: 600 }, children: "Modules" })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 }, children: [_jsx("span", { style: { opacity: 0.7 }, children: "Count:" }), _jsx("span", { style: { fontFamily: 'JetBrains Mono, monospace' }, children: stats.moduleCount })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 }, children: [_jsx("span", { style: { opacity: 0.7 }, children: "Avg:" }), _jsx("span", { style: { fontFamily: 'JetBrains Mono, monospace' }, children: formatDuration(stats.avgModule) })] })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }, children: [_jsx("span", { style: { fontSize: 20 }, children: "\uD83C\uDF10" }), _jsx("span", { style: { fontWeight: 600 }, children: "API Calls" })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 }, children: [_jsx("span", { style: { opacity: 0.7 }, children: "Count:" }), _jsx("span", { style: { fontFamily: 'JetBrains Mono, monospace' }, children: stats.apiCount })] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 }, children: [_jsx("span", { style: { opacity: 0.7 }, children: "Avg:" }), _jsx("span", { style: { fontFamily: 'JetBrains Mono, monospace' }, children: formatDuration(stats.avgApi) })] })] }) })] }), _jsxs("div", { style: {
                    padding: '0 16px 16px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }, children: [_jsx("div", { style: { flex: '1 1 200px', minWidth: 200 }, children: _jsx(Input, { placeholder: "Search endpoints, modules, tables...", value: searchQuery, onChange: (v) => setSearchQuery(typeof v === 'string' ? v : v.target?.value ?? '') }) }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 12, opacity: 0.7 }, children: "Source:" }), ['all', 'db', 'module', 'api'].map((s) => (_jsx(Button, { variant: sourceFilter === s ? 'primary' : 'secondary', onClick: () => setSourceFilter(s), style: { fontSize: 12, padding: '4px 10px' }, children: s === 'all' ? 'All' : getSourceLabel(s) }, s)))] }), _jsx("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: _jsx(Button, { variant: showSlowOnly ? 'primary' : 'secondary', onClick: () => setShowSlowOnly(!showSlowOnly), style: { fontSize: 12, padding: '4px 10px' }, children: "\uD83D\uDC0C Slow Only" }) }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 8 }, children: [_jsx(Button, { variant: "secondary", onClick: () => setShowThresholdModal(true), style: { fontSize: 12 }, children: "\u2699\uFE0F Threshold" }), _jsx(Button, { variant: "secondary", onClick: () => setEnabled(!enabled), style: { fontSize: 12 }, children: enabled ? '⏸ Pause' : '▶ Resume' }), _jsx(Button, { variant: "secondary", onClick: handleExport, style: { fontSize: 12 }, children: "Export JSON" }), _jsx(Button, { variant: "secondary", onClick: () => setShowClearConfirm(true), disabled: entries.length === 0, style: { fontSize: 12 }, children: "Clear All" })] })] }), !enabled && (_jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Alert, { variant: "warning", title: "Logging Paused", children: "Latency logging is currently paused. New requests will not be captured." }) })), _jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Card, { children: filteredEntries.length === 0 ? (_jsx("div", { style: { padding: 40 }, children: _jsx(EmptyState, { title: entries.length === 0 ? 'No Requests Captured' : 'No Matching Requests', description: entries.length === 0
                                ? 'Latency data will appear here when requests are tracked.'
                                : 'Try adjusting your search or filters.' }) })) : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: tableStyles, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { style: thStyles, onClick: () => handleSort('timestamp'), children: ["Time ", sortIndicator('timestamp')] }), _jsxs("th", { style: thStyles, onClick: () => handleSort('source'), children: ["Source ", sortIndicator('source')] }), _jsxs("th", { style: thStyles, onClick: () => handleSort('endpoint'), children: ["Endpoint ", sortIndicator('endpoint')] }), _jsx("th", { style: thStyles, children: "Target" }), _jsxs("th", { style: thStyles, onClick: () => handleSort('durationMs'), children: ["Duration ", sortIndicator('durationMs')] }), _jsx("th", { style: thStyles, children: "Status" }), _jsx("th", { style: { ...thStyles, width: 60 } })] }) }), _jsx("tbody", { children: filteredEntries.map((entry) => {
                                        const severity = getLatencySeverity(entry.durationMs, slowThresholdMs);
                                        return (_jsxs("tr", { style: rowStyles, onClick: () => setSelectedEntry(entry), onMouseEnter: (e) => {
                                                e.currentTarget.style.background = 'rgba(148,163,184,0.08)';
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.background = 'transparent';
                                            }, children: [_jsxs("td", { style: tdStyles, children: [_jsx("div", { style: { whiteSpace: 'nowrap' }, children: formatRelativeTime(entry.timestamp) }), _jsx("div", { style: { fontSize: 11, opacity: 0.6 }, children: formatDate(entry.timestamp).split(',')[1] })] }), _jsxs("td", { style: tdStyles, children: [_jsx("span", { style: { marginRight: 6 }, children: getSourceIcon(entry.source) }), _jsx(Badge, { variant: "default", children: getSourceLabel(entry.source) })] }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                            fontFamily: 'JetBrains Mono, monospace',
                                                            fontSize: 12,
                                                            maxWidth: 250,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            display: 'block',
                                                        }, title: entry.endpoint, children: entry.endpoint }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                            fontFamily: 'JetBrains Mono, monospace',
                                                            fontSize: 12,
                                                            opacity: entry.moduleName || entry.tableName ? 1 : 0.5,
                                                        }, children: entry.moduleName || entry.tableName || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                            fontFamily: 'JetBrains Mono, monospace',
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            color: getSeverityColor(severity),
                                                        }, children: formatDuration(entry.durationMs) }) }), _jsx("td", { style: tdStyles, children: _jsx(Badge, { variant: getSeverityBadgeVariant(severity), children: severity }) }), _jsx("td", { style: tdStyles, children: _jsx(Button, { variant: "secondary", onClick: (e) => {
                                                            e.stopPropagation();
                                                            clearEntry(entry.id);
                                                        }, style: { fontSize: 11, padding: '4px 8px' }, children: "\u2715" }) })] }, entry.id));
                                    }) })] }) })) }) }), _jsx(Modal, { open: !!selectedEntry, onClose: () => setSelectedEntry(null), title: "Request Details", children: selectedEntry && (_jsx("div", { style: { padding: 16 }, children: _jsx(Tabs, { tabs: [
                            {
                                id: 'overview',
                                label: 'Overview',
                                content: (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }, children: [_jsx(DetailRow, { label: "Timestamp", value: formatDate(selectedEntry.timestamp) }), _jsx(DetailRow, { label: "Duration", value: formatDuration(selectedEntry.durationMs) }), _jsx(DetailRow, { label: "Source", value: getSourceLabel(selectedEntry.source) }), _jsx(DetailRow, { label: "Endpoint", value: selectedEntry.endpoint, mono: true }), selectedEntry.method && (_jsx(DetailRow, { label: "Method", value: selectedEntry.method })), selectedEntry.moduleName && (_jsx(DetailRow, { label: "Module", value: selectedEntry.moduleName, mono: true })), selectedEntry.tableName && (_jsx(DetailRow, { label: "Table", value: selectedEntry.tableName, mono: true })), selectedEntry.queryType && (_jsx(DetailRow, { label: "Query Type", value: selectedEntry.queryType })), selectedEntry.status !== undefined && (_jsx(DetailRow, { label: "Status", value: String(selectedEntry.status) })), selectedEntry.responseSize !== undefined && (_jsx(DetailRow, { label: "Response Size", value: `${selectedEntry.responseSize} bytes` })), _jsx(DetailRow, { label: "Page URL", value: selectedEntry.pageUrl, mono: true })] })),
                            },
                            {
                                id: 'payload',
                                label: 'Payload',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: selectedEntry.payload ? (_jsx("pre", { style: {
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: 12,
                                            borderRadius: 8,
                                            overflow: 'auto',
                                            fontSize: 12,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            maxHeight: 300,
                                        }, children: JSON.stringify(selectedEntry.payload, null, 2) })) : (_jsx("div", { style: { opacity: 0.6, fontSize: 13 }, children: "No payload captured." })) })),
                            },
                            {
                                id: 'metadata',
                                label: 'Metadata',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 ? (_jsx("pre", { style: {
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: 12,
                                            borderRadius: 8,
                                            overflow: 'auto',
                                            fontSize: 12,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            maxHeight: 300,
                                        }, children: JSON.stringify(selectedEntry.metadata, null, 2) })) : (_jsx("div", { style: { opacity: 0.6, fontSize: 13 }, children: "No additional metadata." })) })),
                            },
                        ] }) })) }), _jsx(Modal, { open: showClearConfirm, onClose: () => setShowClearConfirm(false), title: "Clear All Entries?", children: _jsxs("div", { style: { padding: 16 }, children: [_jsxs("p", { style: { marginBottom: 16 }, children: ["This will permanently delete all ", entries.length, " logged entries. This action cannot be undone."] }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx(Button, { variant: "secondary", onClick: () => setShowClearConfirm(false), children: "Cancel" }), _jsx(Button, { onClick: handleClearAll, children: "Clear All" })] })] }) }), _jsx(Modal, { open: showThresholdModal, onClose: () => setShowThresholdModal(false), title: "Slow Threshold Settings", children: _jsxs("div", { style: { padding: 16 }, children: [_jsx("p", { style: { marginBottom: 16, opacity: 0.8 }, children: "Requests slower than this threshold will be marked as \"slow\"." }), _jsx("div", { style: { marginBottom: 16 }, children: _jsx(Input, { type: "number", placeholder: "Threshold in milliseconds", value: newThreshold, onChange: (v) => setNewThreshold(typeof v === 'string' ? v : v.target?.value ?? '') }) }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx(Button, { variant: "secondary", onClick: () => setShowThresholdModal(false), children: "Cancel" }), _jsx(Button, { onClick: handleSetThreshold, children: "Save" })] })] }) })] }));
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
