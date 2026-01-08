'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { useUi, useErrorLog } from '@hit/ui-kit';
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
function getStatusBadgeVariant(status) {
    if (status === 0)
        return 'warning'; // Network error
    if (status >= 500)
        return 'error';
    if (status >= 400)
        return 'warning';
    return 'info';
}
function getStatusLabel(status) {
    if (status === 0)
        return 'Network';
    return String(status);
}
// =============================================================================
// MAIN COMPONENT
// =============================================================================
export function ErrorLog() {
    const { Page, Card, Button, Input, Badge, Modal, EmptyState, Spinner, Alert, Tabs } = useUi();
    const errorLogState = useErrorLog();
    const { errors, enabled, maxEntries, clearErrors, clearError, setEnabled, exportErrors, } = errorLogState;
    // Handle backwards compatibility - isProviderAvailable may not exist in older versions
    const isProviderAvailable = 'isProviderAvailable' in errorLogState
        ? errorLogState.isProviderAvailable
        : errors.length > 0 || enabled;
    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [sortField, setSortField] = useState('timestamp');
    const [sortDirection, setSortDirection] = useState('desc');
    const [selectedError, setSelectedError] = useState(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    // Filtered and sorted errors
    const filteredErrors = useMemo(() => {
        let result = [...errors];
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter((e) => e.message.toLowerCase().includes(query) ||
                e.pageUrl.toLowerCase().includes(query) ||
                e.endpoint?.toLowerCase().includes(query) ||
                e.userEmail?.toLowerCase().includes(query));
        }
        // Status filter
        if (statusFilter === '4xx') {
            result = result.filter((e) => e.status >= 400 && e.status < 500);
        }
        else if (statusFilter === '5xx') {
            result = result.filter((e) => e.status >= 500);
        }
        else if (statusFilter === 'network') {
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
        const clientErrors = errors.filter((e) => e.status >= 400 && e.status < 500).length;
        const serverErrors = errors.filter((e) => e.status >= 500).length;
        const networkErrors = errors.filter((e) => e.status === 0).length;
        const last24h = errors.filter((e) => e.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000).length;
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
    return (_jsxs(Page, { title: "Error Log", description: `API errors captured during this session (max ${maxEntries} entries)`, children: [_jsxs("div", { style: {
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
                                    }, children: stats.clientErrors }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "4xx Client" })] }) }), _jsx(Card, { children: _jsxs("div", { style: { padding: '16px 20px', textAlign: 'center' }, children: [_jsx("div", { style: {
                                        fontSize: '28px',
                                        fontWeight: 700,
                                        color: '#6366f1',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }, children: stats.last24h }), _jsx("div", { style: { fontSize: '12px', opacity: 0.7, marginTop: 4 }, children: "Last 24h" })] }) })] }), _jsxs("div", { style: {
                    padding: '0 16px 16px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }, children: [_jsx("div", { style: { flex: '1 1 200px', minWidth: 200 }, children: _jsx(Input, { placeholder: "Search errors...", value: searchQuery, onChange: (v) => setSearchQuery(typeof v === 'string' ? v : v.target?.value ?? '') }) }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 12, opacity: 0.7 }, children: "Status:" }), ['all', '4xx', '5xx', 'network'].map((s) => (_jsx(Button, { variant: statusFilter === s ? 'primary' : 'secondary', onClick: () => setStatusFilter(s), style: { fontSize: 12, padding: '4px 10px' }, children: s === 'all' ? 'All' : s === 'network' ? 'Network' : s }, s)))] }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: 12, opacity: 0.7 }, children: "Source:" }), ['all', 'form', 'fetch'].map((s) => (_jsx(Button, { variant: sourceFilter === s ? 'primary' : 'secondary', onClick: () => setSourceFilter(s), style: { fontSize: 12, padding: '4px 10px' }, children: s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1) }, s)))] }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 8 }, children: [_jsx(Button, { variant: "secondary", onClick: () => setEnabled(!enabled), style: { fontSize: 12 }, children: enabled ? '⏸ Pause' : '▶ Resume' }), _jsx(Button, { variant: "secondary", onClick: handleExport, style: { fontSize: 12 }, children: "Export JSON" }), _jsx(Button, { variant: "secondary", onClick: () => setShowClearConfirm(true), disabled: errors.length === 0, style: { fontSize: 12 }, children: "Clear All" })] })] }), !isProviderAvailable && (_jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Alert, { variant: "error", title: "Provider Not Available", children: "ErrorLogProvider is not wrapping this page. Error logging will not work. This typically happens due to module resolution issues in monorepos. Ensure ErrorLogProvider is in your app's provider hierarchy." }) })), isProviderAvailable && !enabled && (_jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Alert, { variant: "warning", title: "Logging Paused", children: "Error logging is currently paused. New errors will not be captured." }) })), _jsx("div", { style: { padding: '0 16px 16px' }, children: _jsx(Card, { children: filteredErrors.length === 0 ? (_jsx("div", { style: { padding: 40 }, children: _jsx(EmptyState, { title: errors.length === 0 ? 'No Errors Captured' : 'No Matching Errors', description: errors.length === 0
                                ? 'API errors will appear here when they occur.'
                                : 'Try adjusting your search or filters.' }) })) : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { style: tableStyles, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsxs("th", { style: thStyles, onClick: () => handleSort('timestamp'), children: ["Time ", sortIndicator('timestamp')] }), _jsxs("th", { style: thStyles, onClick: () => handleSort('status'), children: ["Status ", sortIndicator('status')] }), _jsx("th", { style: thStyles, children: "Source" }), _jsxs("th", { style: thStyles, onClick: () => handleSort('userEmail'), children: ["User ", sortIndicator('userEmail')] }), _jsxs("th", { style: thStyles, onClick: () => handleSort('pageUrl'), children: ["Page ", sortIndicator('pageUrl')] }), _jsx("th", { style: thStyles, children: "Message" }), _jsx("th", { style: thStyles, children: "Duration" }), _jsx("th", { style: { ...thStyles, width: 60 } })] }) }), _jsx("tbody", { children: filteredErrors.map((err) => (_jsxs("tr", { style: rowStyles, onClick: () => setSelectedError(err), onMouseEnter: (e) => {
                                            e.currentTarget.style.background = 'rgba(148,163,184,0.08)';
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }, children: [_jsxs("td", { style: tdStyles, children: [_jsx("div", { style: { whiteSpace: 'nowrap' }, children: formatRelativeTime(err.timestamp) }), _jsx("div", { style: { fontSize: 11, opacity: 0.6 }, children: formatDate(err.timestamp).split(',')[1] })] }), _jsx("td", { style: tdStyles, children: _jsx(Badge, { variant: getStatusBadgeVariant(err.status), children: getStatusLabel(err.status) }) }), _jsx("td", { style: tdStyles, children: _jsx(Badge, { variant: "default", children: err.source }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        fontFamily: 'JetBrains Mono, monospace',
                                                        fontSize: 12,
                                                        opacity: err.userEmail ? 1 : 0.5,
                                                    }, children: err.userEmail || '—' }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        fontFamily: 'JetBrains Mono, monospace',
                                                        fontSize: 12,
                                                        maxWidth: 180,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        display: 'block',
                                                    }, title: err.pageUrl, children: err.pageUrl }) }), _jsx("td", { style: tdStyles, children: _jsx("span", { style: {
                                                        maxWidth: 300,
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
                                                        clearError(err.id);
                                                    }, style: { fontSize: 11, padding: '4px 8px' }, children: "\u2715" }) })] }, err.id))) })] }) })) }) }), _jsx(Modal, { open: !!selectedError, onClose: () => setSelectedError(null), title: "Error Details", children: selectedError && (_jsx("div", { style: { padding: 16 }, children: _jsx(Tabs, { tabs: [
                            {
                                id: 'overview',
                                label: 'Overview',
                                content: (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }, children: [_jsx(DetailRow, { label: "Timestamp", value: formatDate(selectedError.timestamp) }), _jsx(DetailRow, { label: "Status", value: getStatusLabel(selectedError.status) }), _jsx(DetailRow, { label: "Source", value: selectedError.source }), _jsx(DetailRow, { label: "User", value: selectedError.userEmail || 'Anonymous' }), _jsx(DetailRow, { label: "Page URL", value: selectedError.pageUrl, mono: true }), _jsx(DetailRow, { label: "Endpoint", value: selectedError.endpoint || '—', mono: true }), _jsx(DetailRow, { label: "Method", value: selectedError.method || '—' }), _jsx(DetailRow, { label: "Response Time", value: selectedError.responseTimeMs ? `${selectedError.responseTimeMs}ms` : '—' }), _jsx(DetailRow, { label: "Message", value: selectedError.message })] })),
                            },
                            {
                                id: 'fieldErrors',
                                label: 'Field Errors',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: selectedError.fieldErrors && Object.keys(selectedError.fieldErrors).length > 0 ? (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: Object.entries(selectedError.fieldErrors).map(([field, msg]) => (_jsxs("div", { style: {
                                                background: 'rgba(239,68,68,0.1)',
                                                border: '1px solid rgba(239,68,68,0.2)',
                                                borderRadius: 8,
                                                padding: '8px 12px',
                                            }, children: [_jsxs("strong", { style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }, children: [field, ":"] }), ' ', _jsx("span", { style: { fontSize: 13 }, children: msg })] }, field))) })) : (_jsx("div", { style: { opacity: 0.6, fontSize: 13 }, children: "No field-level errors." })) })),
                            },
                            {
                                id: 'payload',
                                label: 'Payload',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: selectedError.payload ? (_jsx("pre", { style: {
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: 12,
                                            borderRadius: 8,
                                            overflow: 'auto',
                                            fontSize: 12,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            maxHeight: 300,
                                        }, children: JSON.stringify(selectedError.payload, null, 2) })) : (_jsx("div", { style: { opacity: 0.6, fontSize: 13 }, children: "No payload captured." })) })),
                            },
                            {
                                id: 'raw',
                                label: 'Raw Error',
                                content: (_jsx("div", { style: { paddingTop: 16 }, children: selectedError.rawError ? (_jsx("pre", { style: {
                                            background: 'rgba(0,0,0,0.2)',
                                            padding: 12,
                                            borderRadius: 8,
                                            overflow: 'auto',
                                            fontSize: 12,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            maxHeight: 300,
                                        }, children: JSON.stringify(selectedError.rawError, null, 2) })) : (_jsx("div", { style: { opacity: 0.6, fontSize: 13 }, children: "No raw error details." })) })),
                            },
                        ] }) })) }), _jsx(Modal, { open: showClearConfirm, onClose: () => setShowClearConfirm(false), title: "Clear All Errors?", children: _jsxs("div", { style: { padding: 16 }, children: [_jsxs("p", { style: { marginBottom: 16 }, children: ["This will permanently delete all ", errors.length, " logged errors. This action cannot be undone."] }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx(Button, { variant: "secondary", onClick: () => setShowClearConfirm(false), children: "Cancel" }), _jsx(Button, { onClick: handleClearAll, children: "Clear All" })] })] }) })] }));
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
