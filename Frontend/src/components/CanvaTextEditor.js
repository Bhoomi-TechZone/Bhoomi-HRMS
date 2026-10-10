import React, { useState, useRef, useEffect, useCallback } from 'react';
import './CanvaTextEditor.css';

// Curated Canva-style color palette
const CANVA_COLORS = [
    { name: 'Dark Slate', hex: '#0f172a' },
    { name: 'Charcoal', hex: '#334155' },
    { name: 'Bhoomi Dark Green', hex: '#1b5e20' },
    { name: 'Bhoomi Mid Green', hex: '#2e7d32' },
    { name: 'Emerald', hex: '#059669' },
    { name: 'Teal', hex: '#0d9488' },
    { name: 'Navy Blue', hex: '#1e3a8a' },
    { name: 'Royal Blue', hex: '#2563eb' },
    { name: 'Sky Blue', hex: '#0284c7' },
    { name: 'Indigo', hex: '#4f46e5' },
    { name: 'Purple', hex: '#7c3aed' },
    { name: 'Pink', hex: '#db2777' },
    { name: 'Rose', hex: '#e11d48' },
    { name: 'Crimson Red', hex: '#dc2626' },
    { name: 'Orange', hex: '#ea580c' },
    { name: 'Amber Gold', hex: '#d97706' },
    { name: 'Deep Bronze', hex: '#78350f' },
    { name: 'Pure Black', hex: '#000000' },
];

const CANVA_HIGHLIGHTS = [
    { name: 'None', hex: 'transparent' },
    { name: 'Canary Yellow', hex: '#fef08a' },
    { name: 'Mint Green', hex: '#bbf7d0' },
    { name: 'Soft Sky', hex: '#bae6fd' },
    { name: 'Blush Pink', hex: '#fbcfe8' },
    { name: 'Peach', hex: '#fed7aa' },
    { name: 'Lavender', hex: '#e9d5ff' },
    { name: 'Slate Light', hex: '#e2e8f0' },
];

const FONT_SIZE_PRESETS = [
    { label: 'Small (11px)', size: 11 },
    { label: 'Body (13px)', size: 13 },
    { label: 'Medium (15px)', size: 15 },
    { label: 'Subhead (18px)', size: 18 },
    { label: 'Section Head (22px)', size: 22 },
    { label: 'Large Title (26px)', size: 26 },
];

// Convert input string (\n-delimited, may have inline HTML) to proper <div>-per-line
// contentEditable HTML. Always wraps each line in <div> so the editor's block structure
// is preserved correctly on every load — avoids phantom blank lines from browser re-structuring.
function formatInitialHtml(rawText) {
    if (!rawText) return '';

    // Split by newline — each \n is a "line" in the serialized format
    const lines = rawText.split('\n');
    const htmlLines = lines.map(line => {
        const t = line.trim();

        // Empty line → standard contentEditable empty-line representation
        if (!t || t === '<br>' || t === '<div><br></div>') {
            return '<div><br></div>';
        }

        // Already wrapped in a block element → don't double-wrap
        if (/^<(div|p|ul|ol|li|h[1-6]|table|blockquote|pre)\b/i.test(t)) {
            return line;
        }

        // Rich HTML content (inline tags from editor) → wrap in <div> as-is
        if (/<[a-z][\s\S]*>/i.test(line)) {
            return `<div>${line}</div>`;
        }

        // Plain text → escape entities, convert **bold** / *italic* markdown
        let formatted = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        return `<div>${formatted}</div>`;
    });

    return htmlLines.join('');
}

// Convert HTML content from contentEditable back to formatted string for state
function serializeEditorHtml(editorEl) {
    if (!editorEl) return '';
    
    // Clean up empty containers
    const clone = editorEl.cloneNode(true);
    
    // Extract lines & tables cleanly
    const lines = [];
    const children = Array.from(clone.childNodes);
    
    if (children.length === 0) {
        return clone.innerHTML || '';
    }

    children.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent;
            if (text) lines.push(text);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toLowerCase();
            if (tagName === 'table') {
                lines.push(child.outerHTML);
            } else if (tagName === 'div' || tagName === 'p' || tagName === 'li') {
                if (child.querySelector('table')) {
                    lines.push(child.innerHTML);
                } else if (child.innerHTML === '<br>' || child.textContent === '') {
                    lines.push('');
                } else {
                    lines.push(child.innerHTML);
                }
            } else if (tagName === 'br') {
                lines.push('');
            } else {
                lines.push(child.outerHTML);
            }
        }
    });

    // Strip trailing empty lines (browsers always add a trailing <div><br></div>)
    while (lines.length > 0) {
        const last = lines[lines.length - 1];
        if (last === '' || last === '<br>' || last === '<div><br></div>') {
            lines.pop();
        } else {
            break;
        }
    }

    return lines.join('\n');
}

export function CanvaTextEditor({
    value = '',
    onChange,
    placeholder = 'Start typing or select text to format...',
    minHeight = '360px',
    height = '420px',
    maxHeight = '650px',
    pageNumber = 1,
    isPageFull = false,
    pageCapacity = null,
    onAddPage = null
}) {
    const editorRef = useRef(null);
    const isTypingRef = useRef(false);
    const savedSelectionRef = useRef(null);

    // Page capacity alert state
    const [showCapacityAlert, setShowCapacityAlert] = useState(false);
    const percent = pageCapacity?.percent !== undefined ? pageCapacity.percent : 0;

    // Active format states
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const [isStrike, setIsStrike] = useState(false);
    const [currentColor, setCurrentColor] = useState('#0f172a');
    const [currentHighlight, setCurrentHighlight] = useState('transparent');
    const [currentFontSize, setCurrentFontSize] = useState(14);
    
    // UI popovers
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
    const [showSymbolMenu, setShowSymbolMenu] = useState(false);
    const [customHex, setCustomHex] = useState('#2e7d32');

    // Sync external value changes into contentEditable (e.g. page change or import)
    useEffect(() => {
        if (editorRef.current && !isTypingRef.current) {
            const expectedHtml = formatInitialHtml(value);
            if (editorRef.current.innerHTML !== expectedHtml) {
                editorRef.current.innerHTML = expectedHtml;
            }
        }
    }, [value, pageNumber]);

    // Save selection so toolbar clicks don't lose the user's cursor / highlighted range
    const saveSelection = useCallback(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
            savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
        }
    }, []);

    // Restore selection before applying commands
    const restoreSelection = useCallback(() => {
        if (savedSelectionRef.current && editorRef.current) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSelectionRef.current);
        }
    }, []);

    // Update active toolbar button states based on current selection
    const updateActiveStates = useCallback(() => {
        saveSelection();
        try {
            setIsBold(document.queryCommandState('bold'));
            setIsItalic(document.queryCommandState('italic'));
            setIsUnderline(document.queryCommandState('underline'));
            setIsStrike(document.queryCommandState('strikeThrough'));

            // Check color of selected node
            const sel = window.getSelection();
            if (sel && sel.anchorNode) {
                const node = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
                if (node) {
                    const compStyle = window.getComputedStyle(node);
                    if (compStyle.color) setCurrentColor(compStyle.color);
                    if (compStyle.backgroundColor && compStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                        setCurrentHighlight(compStyle.backgroundColor);
                    } else {
                        setCurrentHighlight('transparent');
                    }
                    const px = parseInt(compStyle.fontSize, 10);
                    if (px && !isNaN(px)) setCurrentFontSize(px);
                }
            }
        } catch (e) {
            // Ignore command state errors on non-focusable nodes
        }
    }, [saveSelection]);

    // Trigger state change up to parent
    const triggerChange = useCallback(() => {
        if (!editorRef.current || !onChange) return;
        isTypingRef.current = true;
        const serialized = serializeEditorHtml(editorRef.current);
        onChange(serialized);
        setTimeout(() => {
            isTypingRef.current = false;
        }, 50);
    }, [onChange]);

    // Format Commands
    const applyFormat = (command, val = null) => {
        restoreSelection();
        editorRef.current?.focus();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand(command, false, val);
        updateActiveStates();
        triggerChange();
    };

    const handleBold = () => applyFormat('bold');
    const handleItalic = () => applyFormat('italic');
    const handleUnderline = () => applyFormat('underline');
    const handleStrike = () => applyFormat('strikeThrough');

    const handleApplyColor = (hex) => {
        restoreSelection();
        editorRef.current?.focus();
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('foreColor', false, hex);
        setCurrentColor(hex);
        setShowColorPicker(false);
        updateActiveStates();
        triggerChange();
    };

    const handleApplyHighlight = (hex) => {
        restoreSelection();
        editorRef.current?.focus();
        document.execCommand('styleWithCSS', false, true);
        if (hex === 'transparent') {
            document.execCommand('removeFormat', false, null);
        } else {
            document.execCommand('hiliteColor', false, hex);
        }
        setCurrentHighlight(hex);
        setShowHighlightPicker(false);
        updateActiveStates();
        triggerChange();
    };

    const handleSetFontSize = (sizePx) => {
        restoreSelection();
        editorRef.current?.focus();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            const selectedContent = range.extractContents();
            const span = document.createElement('span');
            span.style.fontSize = `${sizePx}px`;
            span.style.lineHeight = '1.45';
            span.appendChild(selectedContent);
            range.insertNode(span);
            
            // Re-select inserted span
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            sel.removeAllRanges();
            sel.addRange(newRange);
            saveSelection();
        }
        setCurrentFontSize(sizePx);
        setShowFontSizeMenu(false);
        triggerChange();
    };

    const handleStepFontSize = (delta) => {
        const nextSize = Math.max(10, Math.min(36, currentFontSize + delta));
        handleSetFontSize(nextSize);
    };

    const handleBulletList = () => {
        restoreSelection();
        editorRef.current?.focus();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            document.execCommand('insertText', false, '• ');
        }
        triggerChange();
    };

    const handleNumberedList = () => {
        restoreSelection();
        editorRef.current?.focus();
        document.execCommand('insertText', false, '1. ');
        triggerChange();
    };

    const handleInsertSymbol = (sym) => {
        restoreSelection();
        editorRef.current?.focus();
        document.execCommand('insertText', false, sym + ' ');
        setShowSymbolMenu(false);
        triggerChange();
    };

    const handleInsertTable = () => {
        restoreSelection();
        editorRef.current?.focus();
        const tableHtml = `
            <table class="pg-custom-table" style="width: 100%; border-collapse: collapse; margin: 8px 0; border: 1.5px solid #cbd5e1;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: bold; text-align: left;">Item / Feature</th>
                        <th style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: bold; text-align: left;">Specification & Scope</th>
                        <th style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: bold; text-align: left;">Timeline</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">Module 1</td>
                        <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">Specification details...</td>
                        <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">1-2 Weeks</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">Module 2</td>
                        <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">Specification details...</td>
                        <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">2-3 Weeks</td>
                    </tr>
                </tbody>
            </table>
            <div><br></div>
        `;
        document.execCommand('insertHTML', false, tableHtml);
        triggerChange();
    };

    const handleClearFormat = () => {
        restoreSelection();
        editorRef.current?.focus();
        document.execCommand('removeFormat', false, null);
        updateActiveStates();
        triggerChange();
    };

    // Close popovers on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.canva-popover-container')) {
                setShowColorPicker(false);
                setShowHighlightPicker(false);
                setShowFontSizeMenu(false);
                setShowSymbolMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle keypresses, shortcuts, and block further typing when page is full
    const handleKeyDown = (e) => {
        // Standard shortcuts
        if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleBold();
        } else if (e.key === 'i' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleItalic();
        } else if (e.key === 'u' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleUnderline();
        }
    };

    return (
        <div className="canva-editor-container">
            {/* ================= CANVA FLOATING TOOLBAR ================= */}
            <div className="canva-toolbar" onMouseDown={(e) => {
                // Prevent toolbar button clicks from stealing focus / deselecting text in contentEditable
                if (e.target.tagName !== 'INPUT') {
                    e.preventDefault();
                }
            }}>
                {/* 1. Font Size Control */}
                <div className="canva-tool-group canva-popover-container">
                    <button
                        type="button"
                        className="canva-tool-btn canva-step-btn"
                        onClick={() => handleStepFontSize(-2)}
                        title="Decrease font size"
                    >
                        −
                    </button>
                    <button
                        type="button"
                        className="canva-tool-btn canva-fontsize-display"
                        onClick={() => setShowFontSizeMenu(!showFontSizeMenu)}
                        title="Change Font Size"
                    >
                        <span>{currentFontSize}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <button
                        type="button"
                        className="canva-tool-btn canva-step-btn"
                        onClick={() => handleStepFontSize(2)}
                        title="Increase font size"
                    >
                        +
                    </button>

                    {/* Font Size Dropdown */}
                    {showFontSizeMenu && (
                        <div className="canva-dropdown-menu">
                            <div className="canva-dropdown-header">Font Size</div>
                            {FONT_SIZE_PRESETS.map(preset => (
                                <button
                                    key={preset.size}
                                    type="button"
                                    className={`canva-dropdown-item ${currentFontSize === preset.size ? 'active' : ''}`}
                                    onClick={() => handleSetFontSize(preset.size)}
                                >
                                    <span style={{ fontSize: `${Math.min(16, preset.size)}px` }}>{preset.label}</span>
                                    {currentFontSize === preset.size && <span className="canva-check-mark">✓</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="canva-divider" />

                {/* 2. Formatting: Bold, Italic, Underline, Strike */}
                <div className="canva-tool-group">
                    <button
                        type="button"
                        className={`canva-tool-btn ${isBold ? 'active' : ''}`}
                        onClick={handleBold}
                        title="Bold (Ctrl+B)"
                    >
                        <strong>B</strong>
                    </button>
                    <button
                        type="button"
                        className={`canva-tool-btn ${isItalic ? 'active' : ''}`}
                        onClick={handleItalic}
                        title="Italic (Ctrl+I)"
                    >
                        <em>I</em>
                    </button>
                    <button
                        type="button"
                        className={`canva-tool-btn ${isUnderline ? 'active' : ''}`}
                        onClick={handleUnderline}
                        title="Underline (Ctrl+U)"
                    >
                        <span style={{ textDecoration: 'underline' }}>U</span>
                    </button>
                    <button
                        type="button"
                        className={`canva-tool-btn ${isStrike ? 'active' : ''}`}
                        onClick={handleStrike}
                        title="Strikethrough"
                    >
                        <span style={{ textDecoration: 'line-through' }}>S</span>
                    </button>
                </div>

                <div className="canva-divider" />

                {/* 3. Text Color & Highlight Color (Canva Style) */}
                <div className="canva-tool-group canva-popover-container">
                    {/* Text Color Picker */}
                    <button
                        type="button"
                        className={`canva-tool-btn canva-color-btn ${showColorPicker ? 'active' : ''}`}
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        title="Text Color"
                    >
                        <span className="canva-letter-a">A</span>
                        <span
                            className="canva-color-bar"
                            style={{ backgroundColor: currentColor || '#0f172a' }}
                        />
                    </button>

                    {/* Color Picker Dropdown Popover */}
                    {showColorPicker && (
                        <div className="canva-popover-panel canva-color-popover">
                            <div className="canva-popover-title">Text Color</div>
                            <div className="canva-palette-grid">
                                {CANVA_COLORS.map(c => (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        className={`canva-swatch ${currentColor === c.hex ? 'selected' : ''}`}
                                        style={{ backgroundColor: c.hex }}
                                        onClick={() => handleApplyColor(c.hex)}
                                        title={`${c.name} (${c.hex})`}
                                    />
                                ))}
                            </div>

                            {/* Custom Color Input */}
                            <div className="canva-custom-color-row">
                                <label className="canva-custom-label">
                                    <div className="canva-rainbow-icon">
                                        <input
                                            type="color"
                                            value={customHex}
                                            onChange={(e) => {
                                                setCustomHex(e.target.value);
                                                handleApplyColor(e.target.value);
                                            }}
                                            className="canva-native-color-input"
                                        />
                                    </div>
                                    <span>Custom Color</span>
                                </label>
                                <span className="canva-hex-tag">{customHex.toUpperCase()}</span>
                            </div>

                            <button
                                type="button"
                                className="canva-btn-reset-color"
                                onClick={() => handleApplyColor('#0f172a')}
                            >
                                Reset to Default Color
                            </button>
                        </div>
                    )}

                    {/* Text Highlight / Background Color */}
                    <button
                        type="button"
                        className={`canva-tool-btn canva-color-btn ${showHighlightPicker ? 'active' : ''}`}
                        onClick={() => setShowHighlightPicker(!showHighlightPicker)}
                        title="Text Highlight Background Color"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 2-2.5 2.5a2.12 2.12 0 0 1-3 0l-.5-.5L8 12l4 4 8-8-.5-.5a2.12 2.12 0 0 1 0-3L22 2z"/></svg>
                        <span
                            className="canva-color-bar"
                            style={{ backgroundColor: currentHighlight !== 'transparent' ? currentHighlight : '#fef08a' }}
                        />
                    </button>

                    {/* Highlight Picker Popover */}
                    {showHighlightPicker && (
                        <div className="canva-popover-panel canva-color-popover">
                            <div className="canva-popover-title">Highlight Color</div>
                            <div className="canva-palette-grid">
                                {CANVA_HIGHLIGHTS.map(c => (
                                    <button
                                        key={c.name}
                                        type="button"
                                        className={`canva-swatch ${c.hex === 'transparent' ? 'is-transparent' : ''} ${currentHighlight === c.hex ? 'selected' : ''}`}
                                        style={{ backgroundColor: c.hex !== 'transparent' ? c.hex : '#ffffff' }}
                                        onClick={() => handleApplyHighlight(c.hex)}
                                        title={c.name}
                                    >
                                        {c.hex === 'transparent' && <span style={{ fontSize: '14px', color: '#dc2626' }}>⊘</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="canva-divider" />

                {/* 4. Lists & Inserts */}
                <div className="canva-tool-group">
                    <button
                        type="button"
                        className="canva-tool-btn"
                        onClick={handleBulletList}
                        title="Add Bullet Point (•)"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor"/><circle cx="3" cy="12" r="1.5" fill="currentColor"/><circle cx="3" cy="18" r="1.5" fill="currentColor"/></svg>
                    </button>
                    <button
                        type="button"
                        className="canva-tool-btn"
                        onClick={handleNumberedList}
                        title="Add Numbered Item (1.)"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
                    </button>
                    <button
                        type="button"
                        className="canva-tool-btn"
                        onClick={handleInsertTable}
                        title="Insert Proposal Table"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>
                    </button>
                </div>

                <div className="canva-divider" />

                {/* 5. Special Symbols Dropdown */}
                <div className="canva-tool-group canva-popover-container">
                    <button
                        type="button"
                        className="canva-tool-btn"
                        onClick={() => setShowSymbolMenu(!showSymbolMenu)}
                        title="Insert Special Symbols (✓, ★, ➔)"
                    >
                        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>✓★</span>
                    </button>

                    {showSymbolMenu && (
                        <div className="canva-dropdown-menu canva-symbols-menu">
                            <div className="canva-dropdown-header">Insert Symbol</div>
                            <div className="canva-symbols-grid">
                                {['✓', '★', '➔', '◆', '❖', '✔', '➤', '●', '■', '✦'].map(sym => (
                                    <button
                                        key={sym}
                                        type="button"
                                        className="canva-symbol-btn"
                                        onClick={() => handleInsertSymbol(sym)}
                                    >
                                        {sym}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="canva-divider" />

                {/* 6. Clear Formatting */}
                <div className="canva-tool-group">
                    <button
                        type="button"
                        className="canva-tool-btn"
                        onClick={handleClearFormat}
                        title="Clear Formatting (Remove styles)"
                    >
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>T<sub style={{ fontSize: '9px' }}>x</sub></span>
                    </button>
                </div>
            </div>

            {/* ================= PAGE CAPACITY BAR ================= */}
            <div className={`canva-capacity-bar ${isPageFull ? 'is-full' : (percent >= 85 ? 'is-warning' : 'is-normal')}`}>
                <div className="canva-capacity-info">
                    <span className="canva-capacity-label">
                        Page {pageNumber} Space:
                    </span>
                    <div className="canva-capacity-track">
                        <div
                            className="canva-capacity-fill"
                            style={{
                                width: `${Math.min(100, Math.max(0, percent))}%`,
                                backgroundColor: isPageFull ? '#ef4444' : (percent >= 85 ? '#f59e0b' : '#10b981')
                            }}
                        />
                    </div>
                    <span className="canva-capacity-value">
                        {percent}% {isPageFull ? '(Full)' : ''}
                    </span>
                </div>

                {isPageFull ? (
                    <div className="canva-capacity-full-notice">
                        <span>🚫 Page space acquired. Further typing blocked.</span>
                        {onAddPage && (
                            <button
                                type="button"
                                className="canva-btn-quick-add-page"
                                onClick={onAddPage}
                                title="Add a new page"
                            >
                                + Add Page {pageNumber + 1}
                            </button>
                        )}
                    </div>
                ) : percent >= 85 ? (
                    <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>
                        ⚠️ Page space nearly full ({percent}%)
                    </span>
                ) : null}
            </div>

            {/* ================= EDITABLE CANVAS AREA ================= */}
            <div
                ref={editorRef}
                className="canva-editable-content"
                contentEditable={true}
                suppressContentEditableWarning={true}
                onInput={() => {
                    updateActiveStates();
                    triggerChange();
                }}
                onKeyUp={updateActiveStates}
                onMouseUp={updateActiveStates}
                onSelect={updateActiveStates}
                onKeyDown={handleKeyDown}
                style={{ minHeight, height, maxHeight, overflowY: 'auto', resize: 'vertical' }}
                data-placeholder={placeholder}
            />
        </div>
    );
}

export default CanvaTextEditor;
