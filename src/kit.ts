'use client';

import React from 'react';
import { X, Loader2, AlertCircle, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { UiKit, AlertProps, ModalProps, EmptyStateProps, TabsProps, DropdownProps, SelectProps, SelectOption, CheckboxProps, TableProps, TableColumn, BadgeProps, InputProps, TextAreaProps, ButtonProps, PageProps, CardProps } from '@hit/ui-kit';
import { Autocomplete, DataTable, AlertDialog, Breadcrumb, Help } from '@hit/ui-kit';

// =============================================================================
// ERP DESIGN SYSTEM
// =============================================================================
// This is an opinionated design system for admin/ERP interfaces.
// Every component follows these rules strictly for visual consistency.

// SPACING SCALE (in pixels) - use rem equivalents
// 0: 0, 1: 4px, 2: 8px, 3: 12px, 4: 16px, 5: 20px, 6: 24px, 8: 32px, 10: 40px, 12: 48px

// COLORS - Uses CSS variables for theme support
// These will automatically switch between light and dark based on data-theme attribute
// Using CSS variable references that React will resolve at render time
const colors = {
  // Backgrounds - use CSS variables that respond to theme
  bg: {
    page: 'var(--hit-background, #ffffff)',
    surface: 'var(--hit-surface, #ffffff)',
    elevated: 'var(--hit-surface-hover, #f8fafc)',
    input: 'var(--hit-input-bg, #ffffff)',
    muted: 'var(--hit-muted, #f1f5f9)',
  },
  // Borders
  border: {
    subtle: 'var(--hit-border, #e2e8f0)',
    default: 'var(--hit-border-strong, #cbd5e1)',
    focus: 'var(--hit-primary, #3b82f6)',
  },
  // Text
  text: {
    primary: 'var(--hit-foreground, #0f172a)',
    secondary: 'var(--hit-muted-foreground, #64748b)',
    muted: 'var(--hit-input-placeholder, #9ca3af)',
    inverse: '#ffffff', // Always white for inverse text
  },
  // Semantic colors - use CSS variables
  primary: {
    default: 'var(--hit-primary, #3b82f6)',
    hover: 'var(--hit-primary-hover, #2563eb)',
    muted: 'rgba(59, 130, 246, 0.15)',
  },
  success: {
    default: 'var(--hit-success, #22c55e)',
    muted: 'rgba(34, 197, 94, 0.15)',
    border: 'rgba(34, 197, 94, 0.3)',
  },
  warning: {
    default: 'var(--hit-warning, #f59e0b)',
    muted: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  error: {
    default: 'var(--hit-error, #ef4444)',
    muted: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.3)',
  },
  info: {
    default: 'var(--hit-info, #06b6d4)',
    muted: 'rgba(6, 182, 212, 0.15)',
    border: 'rgba(6, 182, 212, 0.3)',
  },
  accent: {
    default: 'var(--hit-accent, #8b5cf6)',
  },
};

// SIZING
const sizing = {
  inputHeight: '40px',      // All inputs, selects, buttons
  inputHeightSm: '32px',    // Small variant
  inputHeightLg: '48px',    // Large variant
  borderRadius: '8px',      // Standard radius
  borderRadiusSm: '6px',    // Small elements
  borderRadiusLg: '12px',   // Cards, modals
};

// =============================================================================
// COMPONENTS
// =============================================================================

// -----------------------------------------------------------------------------
// Global Styles - Injected once to ensure proper rendering
// -----------------------------------------------------------------------------
const globalStylesId = 'hit-ui-kit-styles';

function injectGlobalStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(globalStylesId)) return;
  
  const style = document.createElement('style');
  style.id = globalStylesId;
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* Form element resets for UI Kit */
    .hit-ui-kit input,
    .hit-ui-kit textarea,
    .hit-ui-kit select,
    .hit-ui-kit button {
      font-family: inherit;
    }
    
    .hit-ui-kit input::placeholder,
    .hit-ui-kit textarea::placeholder {
      color: var(--hit-input-placeholder, #9ca3af);
      opacity: 1;
    }
    
    .hit-ui-kit input:focus,
    .hit-ui-kit textarea:focus,
    .hit-ui-kit select:focus {
      border-color: var(--hit-primary, #3b82f6) !important;
      box-shadow: 0 0 0 3px var(--hit-primary-light, rgba(59, 130, 246, 0.15));
    }
  `;
  document.head.appendChild(style);
}

// -----------------------------------------------------------------------------
// Page - The master layout component
// Controls: background, max-width, header alignment, spacing
// -----------------------------------------------------------------------------
const Page: UiKit['Page'] = ({ title, description, actions, children }: PageProps) => {
  // Inject global styles on first render
  React.useEffect(() => {
    injectGlobalStyles();
  }, []);

  return React.createElement('div', {
    className: 'hit-ui-kit',
    style: {
      minHeight: '100%',
      backgroundColor: colors.bg.page,
    },
  },
    // Header section
    (title || description || actions) && React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '24px',
        marginBottom: '24px',
        flexWrap: 'wrap',
      },
    },
      React.createElement('div', { style: { flex: '1 1 auto', minWidth: '200px' } },
        title && React.createElement('h1', {
          style: {
            fontSize: '24px',
            fontWeight: '600',
            color: colors.text.primary,
            margin: '0 0 4px 0',
            lineHeight: '1.3',
          },
        }, title),
        description && React.createElement('p', {
          style: {
            fontSize: '14px',
            color: colors.text.secondary,
            margin: 0,
            lineHeight: '1.5',
          },
        }, description)
      ),
      actions && React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
        },
      }, actions)
    ),
    // Content
    React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      },
    }, children)
  );
};

// -----------------------------------------------------------------------------
// Card - Container for content sections
// Fixed padding, consistent styling
// -----------------------------------------------------------------------------
const Card: UiKit['Card'] = ({ title, description, footer, children }: CardProps) => {
  return React.createElement('div', {
    style: {
      backgroundColor: colors.bg.surface,
      border: `1px solid ${colors.border.subtle}`,
      borderRadius: sizing.borderRadiusLg,
      overflow: 'hidden',
    },
  },
    // Header
    (title || description) && React.createElement('div', {
      style: {
        padding: '16px 20px',
        borderBottom: `1px solid ${colors.border.subtle}`,
      },
    },
      title && React.createElement('h2', {
        style: {
          fontSize: '16px',
          fontWeight: '600',
          color: colors.text.primary,
          margin: 0,
          lineHeight: '1.4',
        },
      }, title),
      description && React.createElement('p', {
        style: {
          fontSize: '13px',
          color: colors.text.secondary,
          margin: '4px 0 0 0',
          lineHeight: '1.4',
        },
      }, description)
    ),
    // Body
    React.createElement('div', {
      style: {
        padding: '20px',
      },
    }, children),
    // Footer
    footer && React.createElement('div', {
      style: {
        padding: '16px 20px',
        borderTop: `1px solid ${colors.border.subtle}`,
        backgroundColor: colors.bg.elevated,
      },
    }, footer)
  );
};

// -----------------------------------------------------------------------------
// Button - Consistent sizing across all variants
// -----------------------------------------------------------------------------
const Button: UiKit['Button'] = ({ variant = 'primary', size = 'md', loading, disabled, type = 'button', onClick, children }: ButtonProps) => {
  const heights: Record<'sm' | 'md' | 'lg', string> = { sm: sizing.inputHeightSm, md: sizing.inputHeight, lg: sizing.inputHeightLg };
  const paddings: Record<'sm' | 'md' | 'lg', string> = { sm: '0 12px', md: '0 16px', lg: '0 24px' };
  const fontSizes: Record<'sm' | 'md' | 'lg', string> = { sm: '13px', md: '14px', lg: '15px' };
  const sizeKey = size ?? 'md';

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: colors.primary.default,
      color: '#ffffff',
      border: 'none',
    },
    secondary: {
      backgroundColor: colors.bg.elevated,
      color: colors.text.primary,
      border: `1px solid ${colors.border.default}`,
    },
    danger: {
      backgroundColor: colors.error.default,
      color: '#ffffff',
      border: 'none',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.text.secondary,
      border: 'none',
    },
    link: {
      backgroundColor: 'transparent',
      color: colors.primary.default,
      border: 'none',
      padding: '0',
      height: 'auto',
    },
  };

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    height: variant === 'link' ? 'auto' : heights[sizeKey],
    padding: variant === 'link' ? '0' : paddings[sizeKey],
    fontSize: fontSizes[sizeKey],
    fontWeight: '500',
    borderRadius: sizing.borderRadius,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.5 : 1,
    transition: 'all 150ms ease',
    whiteSpace: 'nowrap',
    ...variantStyles[variant ?? 'primary'],
  };

  return React.createElement('button', {
    type,
    onClick: disabled || loading ? undefined : onClick,
    disabled: disabled || loading,
    style: baseStyle,
  },
    loading && React.createElement(Loader2, { size: sizeKey === 'sm' ? 14 : 16, style: { animation: 'spin 1s linear infinite' } }),
    children
  );
};

// -----------------------------------------------------------------------------
// Input - Fixed height, consistent styling
// -----------------------------------------------------------------------------
const Input: UiKit['Input'] = ({ label, type = 'text', placeholder, value, onChange, error, disabled, required, className }: InputProps) => {
  // Check if className contains flex-1 or similar flex grow classes
  const shouldFlex = className?.includes('flex-1') || className?.includes('flex-grow');
  return React.createElement('div', {
    className,
    style: { 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '6px',
      ...(shouldFlex ? { flex: '1 1 0%', minWidth: 0 } : {}),
    },
  },
    label && React.createElement('label', {
      style: {
        fontSize: '13px',
        fontWeight: '500',
        color: colors.text.secondary,
      },
    },
      label,
      required && React.createElement('span', { style: { color: colors.error.default, marginLeft: '4px' } }, '*')
    ),
    React.createElement('input', {
      type,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
      placeholder,
      disabled,
      style: {
        // Reset browser defaults
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        appearance: 'none',
        boxSizing: 'border-box',
        margin: 0,
        fontFamily: 'inherit',
        // Our styles
        width: '100%',
        height: sizing.inputHeight,
        padding: '0 12px',
        fontSize: '14px',
        lineHeight: '1.5',
        color: colors.text.primary,
        backgroundColor: colors.bg.input,
        border: `1px solid ${error ? colors.error.default : colors.border.default}`,
        borderRadius: sizing.borderRadius,
        outline: 'none',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        opacity: disabled ? 0.5 : 1,
      },
    }),
    error && React.createElement('p', {
      style: { fontSize: '12px', color: colors.error.default, margin: 0 },
    }, error)
  );
};

// -----------------------------------------------------------------------------
// TextArea - Consistent with Input styling
// -----------------------------------------------------------------------------
const TextArea: UiKit['TextArea'] = ({ label, placeholder, value, onChange, rows = 4, error, disabled, required }: TextAreaProps) => {
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '6px' },
  },
    label && React.createElement('label', {
      style: {
        fontSize: '13px',
        fontWeight: '500',
        color: colors.text.secondary,
      },
    },
      label,
      required && React.createElement('span', { style: { color: colors.error.default, marginLeft: '4px' } }, '*')
    ),
    React.createElement('textarea', {
      value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
      placeholder,
      rows,
      disabled,
      style: {
        // Reset browser defaults
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        appearance: 'none',
        boxSizing: 'border-box',
        margin: 0,
        fontFamily: 'inherit',
        // Our styles
        width: '100%',
        padding: '10px 12px',
        fontSize: '14px',
        color: colors.text.primary,
        backgroundColor: colors.bg.input,
        border: `1px solid ${error ? colors.error.default : colors.border.default}`,
        borderRadius: sizing.borderRadius,
        outline: 'none',
        resize: 'vertical',
        minHeight: '100px',
        lineHeight: '1.5',
        opacity: disabled ? 0.5 : 1,
      },
    }),
    error && React.createElement('p', {
      style: { fontSize: '12px', color: colors.error.default, margin: 0 },
    }, error)
  );
};

// -----------------------------------------------------------------------------
// Select - Same height as Input and Button
// -----------------------------------------------------------------------------
const Select: UiKit['Select'] = ({ label, options, value, onChange, placeholder, error, disabled, required }: SelectProps) => {
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '6px' },
  },
    label && React.createElement('label', {
      style: {
        fontSize: '13px',
        fontWeight: '500',
        color: colors.text.secondary,
      },
    },
      label,
      required && React.createElement('span', { style: { color: colors.error.default, marginLeft: '4px' } }, '*')
    ),
    React.createElement('div', { style: { position: 'relative' } },
      React.createElement('select', {
        value,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value),
        disabled,
        style: {
          width: '100%',
          height: sizing.inputHeight,
          padding: '0 36px 0 12px',
          fontSize: '14px',
          color: colors.text.primary,
          backgroundColor: colors.bg.input,
          border: `1px solid ${error ? colors.error.default : colors.border.default}`,
          borderRadius: sizing.borderRadius,
          outline: 'none',
          appearance: 'none',
          cursor: 'pointer',
          opacity: disabled ? 0.5 : 1,
        },
      },
        placeholder && React.createElement('option', { value: '', disabled: true }, placeholder),
        options.map((opt: SelectOption) =>
          React.createElement('option', { key: opt.value, value: opt.value, disabled: opt.disabled }, opt.label)
        )
      ),
      React.createElement('div', {
        style: {
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: colors.text.muted,
        },
      }, React.createElement(ChevronDown, { size: 16 }))
    ),
    error && React.createElement('p', {
      style: { fontSize: '12px', color: colors.error.default, margin: 0 },
    }, error)
  );
};

// -----------------------------------------------------------------------------
// Checkbox
// -----------------------------------------------------------------------------
const Checkbox: UiKit['Checkbox'] = ({ label, checked, onChange, disabled }: CheckboxProps) => {
  return React.createElement('label', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    },
  },
    React.createElement('input', {
      type: 'checkbox',
      checked,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked),
      disabled,
      style: {
        width: '18px',
        height: '18px',
        accentColor: colors.primary.default,
        cursor: 'inherit',
      },
    }),
    label && React.createElement('span', {
      style: { fontSize: '14px', color: colors.text.primary },
    }, label)
  );
};

// -----------------------------------------------------------------------------
// Table - Clean, scannable data display
// -----------------------------------------------------------------------------
const Table: UiKit['Table'] = ({ columns, data, onRowClick, emptyMessage = 'No data found', loading }: TableProps) => {
  if (loading) {
    return React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px',
      },
    }, React.createElement(Loader2, {
      size: 24,
      style: { animation: 'spin 1s linear infinite', color: colors.text.muted },
    }));
  }

  if (!data.length) {
    return React.createElement('div', {
      style: {
        textAlign: 'center',
        padding: '48px 24px',
        color: colors.text.muted,
        fontSize: '14px',
      },
    }, emptyMessage);
  }

  return React.createElement('div', { style: { overflowX: 'auto' } },
    React.createElement('table', {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
      },
    },
      React.createElement('thead', null,
        React.createElement('tr', {
          style: { borderBottom: `1px solid ${colors.border.subtle}` },
        },
          columns.map((col: TableColumn) =>
            React.createElement('th', {
              key: col.key,
              style: {
                padding: '12px 16px',
                fontSize: '12px',
                fontWeight: '600',
                color: colors.text.muted,
                textAlign: col.align || 'left',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              },
            }, col.label)
          )
        )
      ),
      React.createElement('tbody', null,
        data.map((row: Record<string, unknown>, rowIndex: number) =>
          React.createElement('tr', {
            key: rowIndex,
            onClick: onRowClick ? () => onRowClick(row, rowIndex) : undefined,
            style: {
              borderBottom: `1px solid ${colors.border.subtle}`,
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'background-color 150ms ease',
            },
            onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => {
              if (onRowClick) e.currentTarget.style.backgroundColor = colors.bg.elevated;
            },
            onMouseLeave: (e: React.MouseEvent<HTMLTableRowElement>) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            },
          },
            columns.map((col: TableColumn) =>
              React.createElement('td', {
                key: col.key,
                style: {
                  padding: '14px 16px',
                  fontSize: '14px',
                  color: colors.text.primary,
                  textAlign: col.align || 'left',
                  verticalAlign: 'middle',
                },
              },
                col.render ? col.render(row[col.key], row, rowIndex) : String(row[col.key] ?? '')
              )
            )
          )
        )
      )
    )
  );
};

// -----------------------------------------------------------------------------
// Badge - Small status indicators
// -----------------------------------------------------------------------------
const Badge: UiKit['Badge'] = ({ variant = 'default', children }: BadgeProps) => {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      backgroundColor: colors.bg.elevated,
      color: colors.text.secondary,
      border: `1px solid ${colors.border.default}`,
    },
    success: {
      backgroundColor: colors.success.muted,
      color: colors.success.default,
      border: `1px solid ${colors.success.border}`,
    },
    warning: {
      backgroundColor: colors.warning.muted,
      color: colors.warning.default,
      border: `1px solid ${colors.warning.border}`,
    },
    error: {
      backgroundColor: colors.error.muted,
      color: colors.error.default,
      border: `1px solid ${colors.error.border}`,
    },
    info: {
      backgroundColor: colors.info.muted,
      color: colors.info.default,
      border: `1px solid ${colors.info.border}`,
    },
  };

  return React.createElement('span', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      fontSize: '12px',
      fontWeight: '500',
      borderRadius: '4px',
      whiteSpace: 'nowrap',
      ...styles[variant],
    },
  }, children);
};

// -----------------------------------------------------------------------------
// Avatar
// -----------------------------------------------------------------------------
function AvatarComponent({ src, name, size = 'md' }: { src?: string; name?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 28, md: 36, lg: 44 };
  const fontSize = { sm: '11px', md: '13px', lg: '15px' };
  const dim = sizes[size];

  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return React.createElement('img', {
      src,
      alt: name || 'Avatar',
      style: {
        width: dim,
        height: dim,
        borderRadius: '50%',
        objectFit: 'cover' as const,
      },
    });
  }

  return React.createElement('div', {
    style: {
      width: dim,
      height: dim,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${colors.primary.default}, #8b5cf6)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontSize: fontSize[size],
      fontWeight: '600',
    },
  }, initials || '?');
}
const Avatar = AvatarComponent as UiKit['Avatar'];

// -----------------------------------------------------------------------------
// Alert - Prominent notifications
// -----------------------------------------------------------------------------
const Alert: UiKit['Alert'] = ({ variant, title, onClose, children }: AlertProps) => {
  const config = {
    success: { Icon: CheckCircle, bg: colors.success.muted, border: colors.success.border, color: colors.success.default },
    warning: { Icon: AlertTriangle, bg: colors.warning.muted, border: colors.warning.border, color: colors.warning.default },
    error: { Icon: AlertCircle, bg: colors.error.muted, border: colors.error.border, color: colors.error.default },
    info: { Icon: Info, bg: colors.info.muted, border: colors.info.border, color: colors.info.default },
  } as const;

  const { Icon, bg, border, color } = config[variant];

  return React.createElement('div', {
    style: {
      display: 'flex',
      gap: '12px',
      padding: '16px',
      backgroundColor: bg,
      border: `1px solid ${border}`,
      borderRadius: sizing.borderRadius,
    },
  },
    React.createElement(Icon, { size: 20, style: { color, flexShrink: 0, marginTop: '1px' } }),
    React.createElement('div', { style: { flex: 1, minWidth: 0 } },
      title && React.createElement('h4', {
        style: {
          fontSize: '14px',
          fontWeight: '600',
          color,
          margin: '0 0 4px 0',
        },
      }, title),
      React.createElement('div', {
        style: {
          fontSize: '14px',
          color: colors.text.primary,
          lineHeight: '1.5',
        },
      }, children)
    ),
    onClose && React.createElement('button', {
      onClick: onClose,
      style: {
        background: 'none',
        border: 'none',
        padding: '4px',
        cursor: 'pointer',
        color: colors.text.muted,
        flexShrink: 0,
      },
    }, React.createElement(X, { size: 16 }))
  );
};

// -----------------------------------------------------------------------------
// Modal
// -----------------------------------------------------------------------------
const Modal: UiKit['Modal'] = ({ open, onClose, title, description, size = 'md', children }: ModalProps) => {
  if (!open) return null;

  // Keep in sync with ui-kit Modal size type (sm|md|lg|xl|2xl|full)
  const widths: Record<string, string> = {
    sm: '400px',
    md: '500px',
    lg: '640px',
    xl: '800px',
    '2xl': '980px',
    full: '90vw',
  };

  return React.createElement('div', {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    },
  },
    // Backdrop
    React.createElement('div', {
      onClick: onClose,
      style: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
      },
    }),
    // Content
    React.createElement('div', {
      style: {
        position: 'relative',
        width: '100%',
        maxWidth: widths[size],
        maxHeight: 'calc(100vh - 48px)',
        backgroundColor: colors.bg.surface,
        border: `1px solid ${colors.border.subtle}`,
        borderRadius: sizing.borderRadiusLg,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      },
    },
      // Header
      (title || description) && React.createElement('div', {
        style: {
          padding: '20px 24px',
          borderBottom: `1px solid ${colors.border.subtle}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
        },
      },
        React.createElement('div', null,
          title && React.createElement('h2', {
            style: {
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text.primary,
              margin: 0,
            },
          }, title),
          description && React.createElement('p', {
            style: {
              fontSize: '14px',
              color: colors.text.secondary,
              margin: '4px 0 0 0',
            },
          }, description)
        ),
        React.createElement('button', {
          onClick: onClose,
          style: {
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: colors.text.muted,
            borderRadius: '4px',
          },
        }, React.createElement(X, { size: 20 }))
      ),
      // Body
      React.createElement('div', {
        style: {
          padding: '24px',
          overflowY: 'auto',
        },
      }, children)
    )
  );
};

// -----------------------------------------------------------------------------
// Spinner
// -----------------------------------------------------------------------------
function SpinnerComponent({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 16, md: 24, lg: 32 };
  return React.createElement(Loader2, {
    size: sizes[size],
    style: {
      animation: 'spin 1s linear infinite',
      color: colors.primary.default,
    },
  });
}
const Spinner = SpinnerComponent as UiKit['Spinner'];

// -----------------------------------------------------------------------------
// EmptyState
// -----------------------------------------------------------------------------
const EmptyState: UiKit['EmptyState'] = ({ icon, title, description, action }: EmptyStateProps) => {
  return React.createElement('div', {
    style: {
      textAlign: 'center',
      padding: '48px 24px',
    },
  },
    icon && React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '16px',
        color: colors.text.muted,
      },
    }, icon),
    React.createElement('h3', {
      style: {
        fontSize: '16px',
        fontWeight: '600',
        color: colors.text.primary,
        margin: '0 0 8px 0',
      },
    }, title),
    description && React.createElement('p', {
      style: {
        fontSize: '14px',
        color: colors.text.secondary,
        margin: '0 0 24px 0',
        maxWidth: '400px',
        marginLeft: 'auto',
        marginRight: 'auto',
      },
    }, description),
    action
  );
};

// -----------------------------------------------------------------------------
// Tabs
// -----------------------------------------------------------------------------
const Tabs: UiKit['Tabs'] = ({ tabs, activeTab, onChange }: TabsProps) => {
  const getTabId = (tab: { id?: string; value?: string }) => tab.id ?? tab.value ?? '';
  const currentTab = activeTab || getTabId(tabs[0] || {});

  return React.createElement('div', null,
    React.createElement('div', {
      style: {
        display: 'flex',
        gap: '4px',
        borderBottom: `1px solid ${colors.border.subtle}`,
        marginBottom: '20px',
      },
    },
      tabs.map((tab: { id?: string; value?: string; label: string; content?: React.ReactNode }) => {
        const tabId = getTabId(tab);
        return React.createElement('button', {
          key: tabId,
          onClick: () => {
            if (tabId) {
              onChange?.(tabId);
            }
          },
          style: {
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: currentTab === tabId ? colors.primary.default : colors.text.secondary,
            background: 'none',
            border: 'none',
            borderBottom: currentTab === tabId ? `2px solid ${colors.primary.default}` : '2px solid transparent',
            marginBottom: '-1px',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          },
        }, tab.label);
      })
    ),
    tabs.find((tab: { id?: string; value?: string; label: string; content?: React.ReactNode }) => getTabId(tab) === currentTab)?.content
  );
};

// -----------------------------------------------------------------------------
// Dropdown
// -----------------------------------------------------------------------------
const Dropdown: UiKit['Dropdown'] = ({ trigger, items, align = 'left' }: DropdownProps) => {
  const [open, setOpen] = React.useState(false);

  return React.createElement('div', { style: { position: 'relative', display: 'inline-block' } },
    React.createElement('div', {
      onClick: () => setOpen(!open),
      style: { cursor: 'pointer' },
    }, trigger),
    open && React.createElement(React.Fragment, null,
      React.createElement('div', {
        onClick: () => setOpen(false),
        style: {
          position: 'fixed',
          inset: 0,
          zIndex: 40,
        },
      }),
      React.createElement('div', {
        style: {
          position: 'absolute',
          top: '100%',
          [align === 'right' ? 'right' : 'left']: 0,
          marginTop: '4px',
          minWidth: '180px',
          backgroundColor: colors.bg.surface,
          border: `1px solid ${colors.border.default}`,
          borderRadius: sizing.borderRadius,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          zIndex: 50,
          overflow: 'hidden',
        },
      },
        items.map((item: { label: string; onClick: () => void; icon?: React.ReactNode; danger?: boolean; disabled?: boolean }, idx: number) =>
          React.createElement('button', {
            key: idx,
            onClick: () => {
              if (!item.disabled) {
                item.onClick();
                setOpen(false);
              }
            },
            disabled: item.disabled,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 14px',
              fontSize: '14px',
              color: item.danger ? colors.error.default : colors.text.primary,
              background: 'none',
              border: 'none',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              opacity: item.disabled ? 0.5 : 1,
              textAlign: 'left',
              transition: 'background-color 150ms ease',
            },
            onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
              if (!item.disabled) {
                e.currentTarget.style.backgroundColor = item.danger ? colors.error.muted : colors.bg.elevated;
              }
            },
            onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            },
          },
            item.icon,
            item.label
          )
        )
      )
    )
  );
};

// =============================================================================
// EXPORT ERP KIT
// =============================================================================

export const erpKit: UiKit = {
  Page,
  Card,
  Button,
  Input,
  TextArea,
  Select,
  Checkbox,
  Autocomplete,
  Table,
  DataTable,
  Badge,
  Avatar,
  Alert,
  Modal,
  AlertDialog,
  Spinner,
  EmptyState,
  Tabs,
  Dropdown,
  Breadcrumb,
  Help,
};
