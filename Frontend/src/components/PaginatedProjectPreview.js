import React, { useMemo, useEffect } from 'react';

// Proportional font-size scaling for A4 preview (base 13.5px editor -> 9.5px preview, ~0.70 ratio)
function scaleInlineFontSize(html) {
    if (!html) return '';
    return html.replace(/font-size:\s*(\d+(?:\.\d+)?)\s*px/gi, (match, pxStr) => {
        const px = parseFloat(pxStr);
        if (isNaN(px)) return match;
        const scaledPx = Math.max(7, Math.min(24, Math.round((px * 0.70) * 10) / 10));
        return `font-size: ${scaledPx}px; line-height: 1.45`;
    });
}

// Convert markdown (**bold**, *italic*, __underline__, ~~strike~~) and scale HTML font sizes
function formatInlineHtml(rawText) {
    if (!rawText) return '';
    if (typeof rawText !== 'string') return String(rawText);

    let html = rawText;

    // Convert markdown **bold** to <strong> if not already HTML
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert markdown *italic* to <em>
    html = html.replace(/(^|[^\*])\*([^\*\s][^\*]*?)\*/g, '$1<em>$2</em>');
    // Convert markdown __underline__ to <u>
    html = html.replace(/__(.*?)__/g, '<u>$1</u>');
    // Convert markdown ~~strike~~ to <s>
    html = html.replace(/~~(.*?)~~/g, '<s>$1</s>');

    // Scale inline font-size styles for A4 preview
    html = scaleInlineFontSize(html);

    return html;
}

// Helper: detect if a token/line is visually empty
function isEmptyToken(line) {
    if (line === undefined || line === null) return true;
    const t = typeof line === 'string' ? line.trim() : '';
    return !t || t === '<br>' || t === '<br/>' || t === '<br />' || t === '<div><br></div>' || t === '<div><br/></div>' || t === '<p><br></p>' || t === '&nbsp;' || t === '<div></div>' || t === '<p></p>';
}

// Parse a page's content into lines / tables
function parsePageLines(rawContent, pageNum) {
    if (!rawContent || !rawContent.trim()) return [];

    // Separate tables as distinct tokens
    const tables = [];
    let processed = rawContent.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
        tables.push(match);
        return `___TABLE_TOKEN_${tables.length - 1}___`;
    });

    // Normalize all block breaks so every paragraph/div/li/br becomes a distinct line
    processed = processed
        .replace(/<div>\s*<br\s*[\/]?>\s*<\/div>/gi, '\n___EMPTY_LINE___\n')
        .replace(/<p>\s*<br\s*[\/]?>\s*<\/p>/gi, '\n___EMPTY_LINE___\n')
        .replace(/<br\s*[\/]?>/gi, '\n___EMPTY_LINE___\n')
        .replace(/<\/div>/gi, '</div>\n')
        .replace(/<\/p>/gi, '</p>\n')
        .replace(/<\/li>/gi, '</li>\n');

    const rawSplits = processed.split('\n');
    const tokens = [];

    rawSplits.forEach(segment => {
        let s = segment.trim();
        if (s === '___EMPTY_LINE___' || !s) {
            tokens.push('');
            return;
        }

        // Restore table tokens
        if (s.includes('___TABLE_TOKEN_')) {
            s = s.replace(/___TABLE_TOKEN_(\d+)___/g, (_, idx) => tables[parseInt(idx, 10)] || '');
        }

        if (s === '<div></div>' || s === '<p></p>' || s === '<div><br></div>' || s === '<div><br/></div>') {
            tokens.push('');
        } else {
            tokens.push(s);
        }
    });

    // Trim leading and trailing empty tokens
    let start = 0;
    let end = tokens.length - 1;
    while (start <= end && isEmptyToken(tokens[start])) start++;
    while (end >= start && isEmptyToken(tokens[end])) end--;
    const trimmed = tokens.slice(start, end + 1);

    return trimmed.map((line, idx) => ({
        id: `p${pageNum}-l${idx}`,
        isTable: typeof line === 'string' && line.trim().startsWith('<table'),
        isEmpty: isEmptyToken(line),
        content: line
    }));
}

// Available content height in A4 page (920px page - 52px header - 22px footer - 20px margins)
const MAX_PAGE_CONTENT_HEIGHT = 805;
const TIMELINE_BLOCK_HEIGHT = 55;

// Helper: detect if a line is a section heading or title
function isHeadingToken(content) {
    if (!content || typeof content !== 'string') return false;
    const cleanText = content.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) return false;

    // Matches numbered sections e.g. "3. SOCIAL MEDIA MANAGEMENT", "Scope of Work", headings, or bold short titles
    if (/^\d+\.\s+[A-Za-z]/i.test(cleanText) && cleanText.length < 80) return true;
    if (/^(Scope of Work|Campaign Management|Project Overview|Deliverables|Key Features|Platforms\s*[:-])/i.test(cleanText)) return true;
    if (/<span[^>]*font-size:\s*(?:1[5-9]|2\d)px/i.test(content)) return true;
    if (/<(h1|h2|h3|h4)\b/i.test(content)) return true;
    if ((/<b>|<strong>|\*\*/i.test(content)) && cleanText.length < 50 && !cleanText.startsWith('•')) return true;

    return false;
}

// Helper: estimate visual height in px of a preview line/token
function estimateLineHeight(content) {
    if (!content) return 14.5;
    const trimmed = typeof content === 'string' ? content.trim() : '';
    if (!trimmed || trimmed === '<br>' || trimmed === '<br/>' || trimmed === '&nbsp;') {
        return 14.5;
    }
    if (trimmed.startsWith('<table')) {
        const rowCount = (trimmed.match(/<tr/gi) || []).length || 1;
        return rowCount * 20 + 12;
    }

    const isHeading = isHeadingToken(trimmed);

    // Check font size inline styles (e.g. font-size: 22px, font-size: 18px)
    const sizeMatch = trimmed.match(/font-size:\s*(\d+(?:\.\d+)?)\s*px/i);
    let fontSize = 9.5;
    if (sizeMatch) {
        const rawSize = parseFloat(sizeMatch[1]);
        fontSize = Math.max(7, Math.min(24, Math.round((rawSize * 0.70) * 10) / 10));
    } else if (/<h1\b/i.test(trimmed)) {
        fontSize = 18;
    } else if (/<h2\b/i.test(trimmed)) {
        fontSize = 15;
    } else if (/<h3\b/i.test(trimmed)) {
        fontSize = 13;
    }

    const plainText = trimmed.replace(/<[^>]+>/g, '').trim();
    const charCount = plainText.length || 1;

    // At ~9.5px font size inside 602px container, ~110-120 chars per visual line
    const charsPerLine = Math.max(35, Math.floor(1150 / fontSize));
    const visualLineCount = Math.max(1, Math.ceil(charCount / charsPerLine));

    const lineH = fontSize * 1.55;
    return visualLineCount * lineH + (isHeading ? 6 : 0);
}

function PaginatedProjectPreview({
    sections,
    timeline,
    renderHeader,
    renderFooter,
    readOnly = false,
    onPageClick,
    onPageCapacityChange,
}) {
    // Flow all document content continuously across beautifully balanced A4 pages
    const { projectPages, capacities } = useMemo(() => {
        let maxPages = 1;
        (sections || []).forEach(s => {
            const p = Math.max(1, Number(s.page || 1));
            if (p > maxPages) maxPages = p;
        });

        // 1. Gather all lines across all editor pages in sequence
        const allDocLines = [];
        const caps = {};

        for (let p = 1; p <= maxPages; p++) {
            const pageSections = (sections || []).filter(s => Math.max(1, Number(s.page || 1)) === p);
            const contentSecs = pageSections.filter(s => s.type !== 'page-heading');
            const rawContent = contentSecs.map(s => (s.content || '').trimEnd()).join('\n');
            const lines = parsePageLines(rawContent, p);

            let pageH = 0;
            lines.forEach(l => {
                const isHeading = isHeadingToken(l.content);
                const lineObj = { ...l, originPage: p, isHeading };
                allDocLines.push(lineObj);
                pageH += estimateLineHeight(l.content);
            });

            const percent = Math.round((pageH / MAX_PAGE_CONTENT_HEIGHT) * 100);
            caps[p] = {
                percent,
                isFull: pageH > MAX_PAGE_CONTENT_HEIGHT,
                height: Math.round(pageH)
            };
        }

        const hasTimeline = Boolean((timeline || '').trim());

        if (allDocLines.length === 0) {
            return {
                projectPages: [{
                    editorPage: 1,
                    lines: [],
                    timeline: hasTimeline ? timeline.trim() : null
                }],
                capacities: caps
            };
        }

        // 2. Continuous smart pagination with tight page utilization
        const pagesList = [];
        let curPageLines = [];
        let curPageHeight = 0;

        for (let i = 0; i < allDocLines.length; i++) {
            const lineObj = allDocLines[i];
            const lineH = estimateLineHeight(lineObj.content);

            const isLastLineOfDoc = (i === allDocLines.length - 1);
            const timelineNeededH = (isLastLineOfDoc && hasTimeline) ? TIMELINE_BLOCK_HEIGHT : 0;

            // Only move a heading if there is strictly less than 35px remaining (no room for heading + line)
            const isOrphanHeading = lineObj.isHeading && (MAX_PAGE_CONTENT_HEIGHT - curPageHeight < 35);

            const wouldOverflow = (curPageHeight + lineH + timelineNeededH > MAX_PAGE_CONTENT_HEIGHT);

            if (curPageLines.length > 0 && (wouldOverflow || isOrphanHeading)) {
                // Push current page
                const primaryOrigin = curPageLines[0]?.originPage || 1;
                pagesList.push({
                    editorPage: primaryOrigin,
                    lines: curPageLines,
                    timeline: null
                });
                curPageLines = [lineObj];
                curPageHeight = lineH;
            } else {
                curPageLines.push(lineObj);
                curPageHeight += lineH;
            }
        }

        if (curPageLines.length > 0) {
            const primaryOrigin = curPageLines[0]?.originPage || 1;
            pagesList.push({
                editorPage: primaryOrigin,
                lines: curPageLines,
                timeline: hasTimeline ? timeline.trim() : null
            });
        }

        return { projectPages: pagesList, capacities: caps };
    }, [sections, timeline]);

    // Notify parent of updated page capacities for editor progress bar
    const capacitiesJson = JSON.stringify(capacities);
    useEffect(() => {
        if (onPageCapacityChange) {
            onPageCapacityChange(JSON.parse(capacitiesJson));
        }
    }, [capacitiesJson, onPageCapacityChange]);

    return (
        <>
            {projectPages.map((pageData, pageIndex) => (
                <div className="pg-page" key={`project-page-${pageData.editorPage}-${pageIndex}`}>
                    <div className="pg-page-border">
                        {renderHeader(pageIndex)}
                        <div
                            className="pg-prev-sections-box pg-paginated-sections-box"
                            onClick={() => onPageClick && onPageClick(pageData.editorPage)}
                            title={!readOnly ? `Click to select Page ${pageData.editorPage} in editor` : undefined}
                            style={{
                                flex: 1,
                                overflow: 'hidden',
                                margin: '1px 0 0 0',
                                padding: 0,
                                background: 'transparent',
                                border: 'none',
                                cursor: !readOnly ? 'pointer' : 'default',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                {pageData.lines.length > 0 ? (
                                    pageData.lines.map((lineObj) => {
                                        if (lineObj.isTable) {
                                            return (
                                                <div
                                                    key={lineObj.id}
                                                    className="pg-prev-table-block"
                                                    style={{ margin: '4px 0 6px', overflowX: 'auto' }}
                                                    dangerouslySetInnerHTML={{ __html: formatInlineHtml(lineObj.content) }}
                                                />
                                            );
                                        }

                                        if (lineObj.isEmpty) {
                                            return (
                                                <div
                                                    key={lineObj.id}
                                                    className="pg-preview-line pg-preview-empty-line"
                                                    style={{
                                                        fontSize: '9.5px',
                                                        lineHeight: 1.55,
                                                        height: '14.5px',
                                                        minHeight: '14.5px',
                                                        margin: 0,
                                                        padding: 0
                                                    }}
                                                >
                                                    &nbsp;
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={lineObj.id}
                                                className={`pg-preview-line ${lineObj.isHeading ? 'pg-preview-heading-line' : ''}`}
                                                style={{
                                                    fontSize: '9.5px',
                                                    lineHeight: 1.55,
                                                    color: '#1e293b',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                    textAlign: 'left',
                                                    margin: lineObj.isHeading ? '4px 0 2px' : 0,
                                                    padding: 0
                                                }}
                                                dangerouslySetInnerHTML={{ __html: formatInlineHtml(lineObj.content) }}
                                            />
                                        );
                                    })
                                ) : (
                                    <p className="pg-body-text" style={{ color: '#94a3b8', fontStyle: 'italic', margin: '8px 0', fontSize: '9.5px' }}>
                                        Page {pageData.editorPage} is empty. Type in the editor to add content.
                                    </p>
                                )}
                            </div>

                            {pageData.timeline && (
                                <div className="pg-project-block" style={{ marginTop: '10px', flexShrink: 0 }}>
                                    <div className="pg-section-title" style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '3px' }}>
                                        PROJECT TIMELINE
                                    </div>
                                    <p className="pg-body-text" style={{ fontSize: '9.5px', lineHeight: 1.55, margin: 0, color: '#1e293b' }}>
                                        {pageData.timeline}
                                    </p>
                                </div>
                            )}
                        </div>
                        {renderFooter(pageIndex)}
                    </div>
                </div>
            ))}
        </>
    );
}

export default PaginatedProjectPreview;
