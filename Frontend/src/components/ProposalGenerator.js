import React, { useState, useRef, useEffect } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import mammoth from 'mammoth';
import axios from '../api/axios';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Load Google Fonts
const loadGoogleFonts = () => {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto:wght@400;500;700&family=Montserrat:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Lato:wght@400;700&family=Poppins:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Merriweather:wght@400;700&display=swap';
  link.rel = 'stylesheet';
  if (!document.querySelector(`link[href="${link.href}"]`)) {
    document.head.appendChild(link);
  }
};
loadGoogleFonts();

const PAGE_WIDTH = 1050;

// Parse Mammoth HTML into granular semantic elements (Headings, Paragraphs, Lists, Tables, Images)
function parseDocxIntoSemanticElements(html) {
  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rawNodes = Array.from(doc.body.childNodes);
  const elements = [];

  const addElement = (elem) => {
    if (!elem.html || !elem.html.trim()) return;
    elements.push(elem);
  };

  for (let i = 0; i < rawNodes.length; i++) {
    const node = rawNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) {
        addElement({
          type: 'paragraph',
          html: `<p>${node.textContent}</p>`,
          fontSize: 14,
          estimatedHeight: Math.max(26, Math.ceil(text.length / 65) * 22 + 8)
        });
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const tagName = node.tagName.toLowerCase();
    const textContent = node.textContent.trim();
    const imgs = Array.from(node.querySelectorAll('img'));
    const isDirectImg = tagName === 'img';

    // Standalone image or image container
    if (isDirectImg || (imgs.length > 0 && !textContent)) {
      const imgSrc = isDirectImg ? node.getAttribute('src') : imgs[0].getAttribute('src');
      if (imgSrc) {
        addElement({
          type: 'image',
          html: `<p><img src="${imgSrc}" style="max-width: 100%; border-radius: 6px;" /></p>`,
          fontSize: 14,
          estimatedHeight: 220
        });
      }
      continue;
    }

    if (tagName === 'table') {
      const rows = Array.from(node.querySelectorAll('tr'));
      const rowCount = rows.length || 1;
      
      // If table is exceptionally large, break it into manageable sub-tables
      if (rowCount > 8) {
        const headerRow = rows[0] ? rows[0].outerHTML : '';
        for (let r = 0; r < rowCount; r += 6) {
          const chunkRows = rows.slice(r, r + 6);
          const hasHeader = r === 0;
          const tableHtml = `<table>${!hasHeader && headerRow ? headerRow : ''}${chunkRows.map(tr => tr.outerHTML).join('')}</table>`;
          addElement({
            type: 'table',
            html: tableHtml,
            fontSize: 13,
            estimatedHeight: Math.max(80, chunkRows.length * 36 + 24)
          });
        }
      } else {
        addElement({
          type: 'table',
          html: node.outerHTML,
          fontSize: 13,
          estimatedHeight: Math.max(70, rowCount * 36 + 24)
        });
      }
      continue;
    }

    if (tagName === 'ul' || tagName === 'ol') {
      const items = Array.from(node.querySelectorAll('li'));
      if (items.length > 7) {
        // Split long list into smaller chunks so user can move chunks and span pages smoothly
        for (let j = 0; j < items.length; j += 6) {
          const chunkItems = items.slice(j, j + 6);
          const listHtml = `<${tagName}>${chunkItems.map(li => li.outerHTML).join('')}</${tagName}>`;
          addElement({
            type: 'list',
            html: listHtml,
            fontSize: 14,
            estimatedHeight: Math.max(30, chunkItems.length * 24 + 10)
          });
        }
      } else {
        addElement({
          type: 'list',
          html: node.outerHTML,
          fontSize: 14,
          estimatedHeight: Math.max(30, items.length * 24 + 10)
        });
      }
      continue;
    }

    if (/^h[1-6]$/i.test(tagName)) {
      if (!textContent) continue;
      const level = parseInt(tagName.charAt(1)) || 1;
      const fontSize = level === 1 ? 22 : level === 2 ? 18 : level === 3 ? 16 : 14;
      const hHeight = level === 1 ? 44 : level === 2 ? 38 : level === 3 ? 32 : 28;
      addElement({
        type: 'heading',
        level: level,
        html: node.outerHTML,
        fontSize: fontSize,
        estimatedHeight: hHeight
      });
      continue;
    }

    // Regular paragraph or blockquote / div
    if (!textContent && imgs.length === 0) continue;

    if (textContent.length > 400) {
      // Split very long paragraphs into ~200-300 character chunks (by sentence)
      const sentences = textContent.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [textContent];
      let currentParaText = '';
      for (const sent of sentences) {
        if ((currentParaText + sent).length > 300 && currentParaText.trim()) {
          const lines = Math.max(1, Math.ceil(currentParaText.length / 65));
          addElement({
            type: 'paragraph',
            html: `<p>${currentParaText.trim()}</p>`,
            fontSize: 14,
            estimatedHeight: Math.max(26, lines * 22 + 8)
          });
          currentParaText = sent;
        } else {
          currentParaText += (currentParaText ? ' ' : '') + sent;
        }
      }
      if (currentParaText.trim()) {
        const lines = Math.max(1, Math.ceil(currentParaText.length / 65));
        addElement({
          type: 'paragraph',
          html: `<p>${currentParaText.trim()}</p>`,
          fontSize: 14,
          estimatedHeight: Math.max(26, lines * 22 + 8)
        });
      }
    } else {
      const lines = Math.max(1, Math.ceil(textContent.length / 65));
      addElement({
        type: 'paragraph',
        html: node.outerHTML,
        fontSize: 14,
        estimatedHeight: Math.max(26, lines * 22 + 8)
      });
    }
  }

  return elements;
}

const customStyle = `
  .ql-container {
    height: 100% !important;
    min-height: 40px;
    font-size: inherit;
    border: none !important;
    box-sizing: border-box !important;
  }
  .text-box-wrapper .ql-container.ql-snow {
    border: none !important;
  }
  .ql-editor {
    overflow-y: visible !important;
    height: 100% !important;
    padding: 0px !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
    line-height: 1.5 !important;
  }
  
  /* Make sure quill inherits the wrapper font family */
  .text-box-wrapper .ql-editor {
    font-family: inherit !important;
  }

  .text-box-wrapper .ql-editor p {
    margin: 0 0 6px 0 !important;
    line-height: 1.5 !important;
  }

  .text-box-wrapper .ql-editor ul, 
  .text-box-wrapper .ql-editor ol {
    margin: 4px 0 6px 0 !important;
    padding-left: 20px !important;
  }

  .text-box-wrapper .ql-editor li {
    margin-bottom: 3px !important;
    line-height: 1.45 !important;
  }

  .text-box-wrapper .ql-editor h1,
  .text-box-wrapper .ql-editor h2,
  .text-box-wrapper .ql-editor h3,
  .text-box-wrapper .ql-editor h4 {
    margin: 8px 0 4px 0 !important;
    font-weight: 700 !important;
    color: #0f172a !important;
    line-height: 1.3 !important;
  }
  .text-box-wrapper .ql-editor h1 { font-size: 1.45em !important; }
  .text-box-wrapper .ql-editor h2 { font-size: 1.25em !important; }
  .text-box-wrapper .ql-editor h3 { font-size: 1.1em !important; }

  .text-box-wrapper .ql-editor table {
    width: 100% !important;
    border-collapse: collapse !important;
    margin: 8px 0 !important;
    font-size: 0.95em !important;
  }
  .text-box-wrapper .ql-editor table th,
  .text-box-wrapper .ql-editor table td {
    border: 1px solid #cbd5e1 !important;
    padding: 6px 10px !important;
    text-align: left !important;
  }
  .text-box-wrapper .ql-editor table th {
    background: #f1f5f9 !important;
    font-weight: 700 !important;
  }
  
  /* Make sure the active box editor doesn't get pushed down */
  .text-box-wrapper .ql-container {
    margin-top: 0;
  }
  
  /* Make images fill the text box so they can be resized using the box's resize handle */
  .text-box-wrapper img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
  }
  
  /* Prevent page scrolling when resizing elements */
  body.is-resizing {
    overflow: hidden !important;
    touch-action: none !important;
    -webkit-overflow-scrolling: none !important;
  }
  
  /* Hide the global Quill toolbar - we use per-textbox toolbars instead */
  .ql-toolbar {
    display: none !important;
  }
`;

export function ProposalGenerator({ isOpen, onClose, onSuccess, proposalId, readOnly = false, initialTab = 'form' }) {
  const [numPages, setNumPages] = useState(null);
  const [isLoadingProposal, setIsLoadingProposal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState('Custom Generated Proposal');
  const [savedBase64Pdf, setSavedBase64Pdf] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Text boxes state: { id, pageId, type, text, x, y, width, height, fontSize, data? }
  const [textBoxes, setTextBoxes] = useState([]);
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [editingBoxId, setEditingBoxId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPageToAdd, setSelectedPageToAdd] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false); // synchronous ref to prevent scroll flicker
  const dragStartPos = useRef({ x: 0, y: 0 });
  const quillRef = useRef(null);
  const [rotationTooltip, setRotationTooltip] = useState({ visible: false, angle: 0 });
  const [activeHandle, setActiveHandle] = useState(null); // 'rotate' | 'move' | null
  
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isHistoryUpdate = useRef(false);

  useEffect(() => {
    if (isHistoryUpdate.current) {
      isHistoryUpdate.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (isDragging) return;
      setHistory(prev => {
        const currentHistory = prev.slice(0, historyIndex + 1);
        if (currentHistory.length > 0 && JSON.stringify(currentHistory[currentHistory.length - 1]) === JSON.stringify(textBoxes)) {
          return prev;
        }
        const newHistory = [...currentHistory, textBoxes];
        if (newHistory.length > 50) newHistory.shift();
        setHistoryIndex(newHistory.length - 1);
        return newHistory;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [textBoxes, isDragging, historyIndex]);

  const [pageSequence, setPageSequence] = useState([]);
  const [draggedPageIndex, setDraggedPageIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleUndo = () => {
    if (historyIndex > 0) {
      isHistoryUpdate.current = true;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setTextBoxes(history[newIndex]);
      setActiveBoxId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isHistoryUpdate.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setTextBoxes(history[newIndex]);
      setActiveBoxId(null);
    }
  };

  useEffect(() => {
    let timer = null;
    if (isOpen) {
      // Clear defaults or previous session
      setTextBoxes([]);
      setPageSequence([]);
      setSelectedPageToAdd(0);
      setActiveBoxId(null);
      setEditingBoxId(null);
      setSavedBase64Pdf(null);
      setIsDownloading(false);
      setProposalTitle('Custom Generated Proposal');
      setIsLoadingProposal(true);
      
      if (proposalId) {
        axios.get(`/proposals/${proposalId}?t=${Date.now()}`).then(res => {
          if (res.data) {
            if (res.data.title) setProposalTitle(res.data.title);
            if (res.data.pdfEditorState) {
              const { savedTextBoxes, savedPageSequence, base64Pdf } = res.data.pdfEditorState;
              if (savedTextBoxes) setTextBoxes(savedTextBoxes);
              if (savedPageSequence) setPageSequence(savedPageSequence);
              if (base64Pdf) setSavedBase64Pdf(base64Pdf);
            }
          }
        }).catch(err => {
          console.error("Error fetching proposal state:", err);
        });
      }

      // Show 5.5-second loading spinner so the template background, fonts, and layers load properly
      timer = setTimeout(() => {
        setIsLoadingProposal(false);
      }, 5500);
    } else {
      setIsLoadingProposal(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, proposalId]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    if (pageSequence.length === 0) {
      setPageSequence(Array.from(new Array(numPages), (_, i) => ({
        id: `page-${i + 1}-${Date.now()}`,
        originalPageNumber: i + 1
      })));
    }
  };

  const activeModules = React.useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['image'],
      ['clean']
    ],
    history: {
      delay: 500,
      maxStack: 100,
      userOnly: true
    }
  }), []);

  const getSpawnY = () => {
    const container = document.getElementById('pdf-scroll-container');
    const pageObj = pageSequence[selectedPageToAdd];
    if (!pageObj) return 100;
    const pageEl = document.getElementById(`pdf-page-container-${pageObj.id}`);
    if (container && pageEl) {
      const pageRect = pageEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (pageRect.top < containerRect.top) {
        return (containerRect.top - pageRect.top) + 100;
      }
    }
    return 100;
  };

  const addTextBox = (e) => {
    if (e) e.stopPropagation();
    if (!pageSequence[selectedPageToAdd]) return;

    // Get page dimensions to center the text box
    const pageObj = pageSequence[selectedPageToAdd];
    const pageEl = document.getElementById(`pdf-page-container-${pageObj.id}`);
    let centerX = 100; // fallback
    
    if (pageEl) {
      const pageWidth = pageEl.offsetWidth || PAGE_WIDTH;
      const textBoxWidth = 250;
      centerX = (pageWidth - textBoxWidth) / 2; // Center horizontally
    }

    const newBox = {
      id: Date.now().toString(),
      type: 'text',
      pageId: pageSequence[selectedPageToAdd].id,
      text: '<p>New Text Box</p>',
      x: centerX,
      y: getSpawnY(),
      width: 250,
      height: 'auto',
      fontSize: 16
    };
    setTextBoxes(prev => [...prev, newBox]);
    setActiveBoxId(newBox.id);
  };

  const imageFileInputRef = useRef(null);
  const docxFileInputRef = useRef(null);
  const [isParsingDocx, setIsParsingDocx] = useState(false);

  const addImageBox = (e) => {
    if (e) e.stopPropagation();
    if (imageFileInputRef.current) {
      imageFileInputRef.current.click();
    }
  };

  const handleImportDocxClick = (e) => {
    if (e) e.stopPropagation();
    if (docxFileInputRef.current) {
      docxFileInputRef.current.click();
    }
  };

  const handleDocxFile = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(docx)$/i)) {
      alert('Please select a valid Word document (.docx file).');
      return;
    }

    setIsParsingDocx(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const options = {
        convertImage: mammoth.images.imgElement(function(image) {
          return image.read("base64").then(function(imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            };
          });
        })
      };

      const result = await mammoth.convertToHtml({ arrayBuffer }, options);
      const rawHtml = result.value || '';

      if (!rawHtml.trim()) {
        alert('Could not extract readable content from this Word document.');
        setIsParsingDocx(false);
        return;
      }

      // Parse DOCX HTML into granular semantic elements (Headings, Paragraphs, Lists, Tables, Images)
      const elements = parseDocxIntoSemanticElements(rawHtml);

      if (elements.length === 0) {
        alert('Could not extract readable content from this Word document.');
        setIsParsingDocx(false);
        return;
      }

      // Identify the blank content page in the template (Page 3 in BtplSoft_Proposal.pdf)
      const BLANK_PAGE_ORIGINAL_NUM = Math.min(3, numPages || 3);

      let updatedSequence = [...pageSequence];
      if (updatedSequence.length === 0) {
        updatedSequence = Array.from(new Array(numPages || 3), (_, i) => ({
          id: `page-${i + 1}-${Date.now()}`,
          originalPageNumber: i + 1
        }));
      }

      // Auto-detect proposal title from DOCX filename or heading
      const cleanDocxName = file.name.replace(/\.[^/.]+$/, '').trim();
      const firstHeading = elements.find(e => e.type === 'heading');
      const headingText = firstHeading ? firstHeading.html.replace(/<[^>]*>/g, '').trim() : '';

      if (cleanDocxName && (!proposalTitle || proposalTitle === 'Custom Generated Proposal')) {
        setProposalTitle(cleanDocxName);
      } else if (headingText && headingText.length <= 80 && (!proposalTitle || proposalTitle === 'Custom Generated Proposal')) {
        setProposalTitle(headingText);
      }

      // Find the first blank template page (Page 3) in the sequence
      let blankPageIndex = updatedSequence.findIndex(p => p.originalPageNumber === BLANK_PAGE_ORIGINAL_NUM);
      if (blankPageIndex === -1) {
        // If not found, insert page 3 right after cover/profile or at current selection
        const insertAt = Math.min(updatedSequence.length, Math.max(1, selectedPageToAdd + 1));
        const newBlankPage = {
          id: `page-${BLANK_PAGE_ORIGINAL_NUM}-${Date.now()}`,
          originalPageNumber: BLANK_PAGE_ORIGINAL_NUM
        };
        updatedSequence.splice(insertAt, 0, newBlankPage);
        blankPageIndex = insertAt;
      }

      const START_X = 135;
      const CONTENT_WIDTH = 630;
      const START_Y = 45;
      const MAX_PAGE_Y = 535; // Usable vertical height on the blank template page
      const GAP_Y = 12; // Gap between elements

      const targetPages = [updatedSequence[blankPageIndex]];
      let currentTargetPageIndex = 0;
      let currentY = START_Y;

      const newDocxBoxes = [];

      for (let i = 0; i < elements.length; i++) {
        const elem = elements[i];
        const elemHeight = elem.estimatedHeight || 30;

        // If adding this element exceeds page height and we already placed elements on current page
        if (currentY > START_Y && (currentY + elemHeight > MAX_PAGE_Y)) {
          // Advance to next blank page
          currentTargetPageIndex++;
          const nextSeqIdx = blankPageIndex + currentTargetPageIndex;

          if (nextSeqIdx < updatedSequence.length && updatedSequence[nextSeqIdx].originalPageNumber === BLANK_PAGE_ORIGINAL_NUM) {
            targetPages.push(updatedSequence[nextSeqIdx]);
          } else {
            // Insert a new duplicate of the blank template page (Page 3)
            const newBlankPage = {
              id: `page-${BLANK_PAGE_ORIGINAL_NUM}-${Date.now()}-${currentTargetPageIndex}`,
              originalPageNumber: BLANK_PAGE_ORIGINAL_NUM
            };
            updatedSequence.splice(nextSeqIdx, 0, newBlankPage);
            targetPages.push(newBlankPage);
          }

          currentY = START_Y;
        }

        const currentPage = targetPages[currentTargetPageIndex];
        const boxId = `docx-box-${Date.now()}-${i}`;

        newDocxBoxes.push({
          id: boxId,
          type: 'text',
          pageId: currentPage.id,
          text: elem.html,
          x: START_X,
          y: currentY,
          width: CONTENT_WIDTH,
          height: 'auto',
          fontSize: elem.fontSize || 14,
          fontFamily: "'Inter', sans-serif"
        });

        currentY += elemHeight + GAP_Y;
      }

      // Clean prior docx boxes from target pages
      const targetPageIds = new Set(targetPages.map(p => p.id));
      const filteredTextBoxes = textBoxes.filter(b => !targetPageIds.has(b.pageId) || !b.id.startsWith('docx-box-'));

      setPageSequence(updatedSequence);
      setTextBoxes([...filteredTextBoxes, ...newDocxBoxes]);
      setSelectedPageToAdd(blankPageIndex);

      // Brief delay for smooth UI transition
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.error('Error importing DOCX:', err);
      alert('Failed to import DOCX: ' + (err.message || 'Unknown error'));
    } finally {
      setIsParsingDocx(false);
      if (docxFileInputRef.current) docxFileInputRef.current.value = '';
    }
  };

  const handleDocxUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleDocxFile(file);
  };

  const handleImageUpload = (e) => {
    if (!pageSequence[selectedPageToAdd]) return;
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      
      // Get page dimensions to center the image box
      const pageObj = pageSequence[selectedPageToAdd];
      const pageEl = document.getElementById(`pdf-page-container-${pageObj.id}`);
      let centerX = 100; // fallback
      
      if (pageEl) {
        const pageWidth = pageEl.offsetWidth || PAGE_WIDTH;
        const imageBoxWidth = 400;
        centerX = (pageWidth - imageBoxWidth) / 2; // Center horizontally
      }
      
      const newBox = {
        id: Date.now().toString(),
        type: 'text',
        pageId: pageSequence[selectedPageToAdd].id,
        text: `<img src="${base64}" />`,
        x: centerX, 
        y: getSpawnY(), 
        width: 400, 
        height: 300, 
        fontSize: 16
      };
      setTextBoxes(prev => [...prev, newBox]);
      setActiveBoxId(newBox.id);
      e.target.value = null;
    };
    reader.readAsDataURL(file);
  };

  const addTableBox = (e) => {
    if (e) e.stopPropagation();
    if (!pageSequence[selectedPageToAdd]) return;
    const newBox = {
      id: Date.now().toString(),
      type: 'table',
      pageId: pageSequence[selectedPageToAdd].id,
      data: Array.from({ length: 3 }, () => Array(3).fill('')),
      x: 100, y: getSpawnY(), width: 500, height: 200, fontSize: 16
    };
    setTextBoxes(prev => [...prev, newBox]);
    setActiveBoxId(newBox.id);
  };

  const duplicatePage = () => {
    const pageToDuplicate = pageSequence[selectedPageToAdd];
    if (!pageToDuplicate) return;

    const newPageId = `page-${pageToDuplicate.originalPageNumber}-${Date.now()}`;
    const newPage = {
      id: newPageId,
      originalPageNumber: pageToDuplicate.originalPageNumber
    };

    // Clone text boxes belonging to this page
    const boxesToClone = textBoxes.filter(b => b.pageId === pageToDuplicate.id);
    const clonedBoxes = boxesToClone.map(b => ({
      ...b,
      id: Date.now().toString() + Math.random().toString(),
      pageId: newPageId
    }));

    const newSequence = [...pageSequence];
    newSequence.splice(selectedPageToAdd + 1, 0, newPage);
    setPageSequence(newSequence);
    setTextBoxes(prev => [...prev, ...clonedBoxes]);
    setSelectedPageToAdd(selectedPageToAdd + 1);
  };

  const deletePage = () => {
    if (pageSequence.length <= 1) {
      alert("Cannot delete the last remaining page.");
      return;
    }
    const pageToDelete = pageSequence[selectedPageToAdd];
    if (!pageToDelete) return;

    // Remove text boxes belonging to this page
    setTextBoxes(prev => prev.filter(b => b.pageId !== pageToDelete.id));

    const newSequence = [...pageSequence];
    newSequence.splice(selectedPageToAdd, 1);
    setPageSequence(newSequence);
    setSelectedPageToAdd(Math.max(0, selectedPageToAdd - 1));
  };

  const updateTextBox = (id, field, value) => {
    setTextBoxes(prev => prev.map(box => box.id === id ? { ...box, [field]: value } : box));
  };

  const handlePointerMove = (e) => {
    return;
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    if (e && e.target && e.target.releasePointerCapture && e.pointerId !== undefined) {
      try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}
    }
  };

  const generateFinalPDF = async () => {
    if (!pageSequence.length) return;
    setIsGenerating(true);
    try {
      const oldActiveBoxId = activeBoxId;
      const oldEditingBoxId = editingBoxId;
      setActiveBoxId(null);
      setEditingBoxId(null);

      await new Promise(r => setTimeout(r, 60));

      let pdf = null;

      for (let i = 0; i < pageSequence.length; i++) {
        const pageObj = pageSequence[i];
        const pageElement = document.getElementById(`pdf-page-container-${pageObj.id}`);
        if (!pageElement) continue;

        const canvas = await html2canvas(pageElement, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 0
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.88);
        const isLandscape = canvas.width > canvas.height;
        const orientation = isLandscape ? 'l' : 'p';

        // Precise dimensions in points (pt)
        const ptWidth = canvas.width / 1.5;
        const ptHeight = canvas.height / 1.5;

        if (i === 0) {
          pdf = new jsPDF({
            orientation: orientation,
            unit: 'pt',
            format: [ptWidth, ptHeight]
          });
        } else {
          pdf.addPage([ptWidth, ptHeight], orientation);
        }

        const actualPdfWidth = pdf.internal.pageSize.getWidth();
        const actualPdfHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'JPEG', 0, 0, actualPdfWidth, actualPdfHeight, undefined, 'FAST');
      }

      if (!pdf) throw new Error("Could not render proposal pages.");

      const base64Pdf = pdf.output('datauristring');
      setSavedBase64Pdf(base64Pdf);

      const pdfEditorState = {
        savedTextBoxes: textBoxes,
        savedPageSequence: pageSequence,
        base64Pdf: base64Pdf
      };

      if (proposalId) {
        try {
          const res = await axios.put(`/proposals/${proposalId}`, { 
            title: proposalTitle || 'Custom Generated Proposal',
            proposalType: 'international',
            pdfEditorState 
          });
          if (onSuccess) onSuccess(res.data);
        } catch (e) {
          console.error('Error saving state:', e);
          alert('Error saving the proposal.');
        }
      } else {
        const proposalData = {
          title: proposalTitle || 'Custom Generated Proposal',
          proposalType: 'international',
          clientName: 'TBD (Add Client Details)',
          total: 0,
          status: 'draft',
          pdfEditorState
        };
        
        try {
          const res = await axios.post('/proposals', proposalData);
          if (onSuccess) onSuccess(res.data);
        } catch (apiError) {
          console.error('Error creating proposal record:', apiError);
          alert('Failed to create record in database.');
        }
      }
      setActiveBoxId(oldActiveBoxId);
      setEditingBoxId(oldEditingBoxId);
    } catch (err) {
      console.error(err);
      alert("Error generating PDF: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDirectDownload = async () => {
    if (!pageSequence.length) return;

    const safeTitle = (proposalTitle || 'Proposal')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();

    // If PDF has already been generated and saved, download it instantly in 0ms!
    if (savedBase64Pdf) {
      const link = document.createElement('a');
      link.href = savedBase64Pdf;
      link.setAttribute('download', `${safeTitle}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    // Otherwise render on the fly with download indicator
    setIsDownloading(true);
    try {
      const oldActiveBoxId = activeBoxId;
      const oldEditingBoxId = editingBoxId;
      setActiveBoxId(null);
      setEditingBoxId(null);

      await new Promise(r => setTimeout(r, 60));

      let pdf = null;

      for (let i = 0; i < pageSequence.length; i++) {
        const pageObj = pageSequence[i];
        const pageElement = document.getElementById(`pdf-page-container-${pageObj.id}`);
        if (!pageElement) continue;

        const canvas = await html2canvas(pageElement, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 0
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.88);
        const isLandscape = canvas.width > canvas.height;
        const orientation = isLandscape ? 'l' : 'p';

        const ptWidth = canvas.width / 1.5;
        const ptHeight = canvas.height / 1.5;

        if (i === 0) {
          pdf = new jsPDF({
            orientation: orientation,
            unit: 'pt',
            format: [ptWidth, ptHeight]
          });
        } else {
          pdf.addPage([ptWidth, ptHeight], orientation);
        }

        const actualPdfWidth = pdf.internal.pageSize.getWidth();
        const actualPdfHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'JPEG', 0, 0, actualPdfWidth, actualPdfHeight, undefined, 'FAST');
      }

      if (pdf) {
        const base64Pdf = pdf.output('datauristring');
        setSavedBase64Pdf(base64Pdf);
        pdf.save(`${safeTitle}.pdf`);
      }
      setActiveBoxId(oldActiveBoxId);
      setEditingBoxId(oldEditingBoxId);
    } catch (err) {
      console.error(err);
      alert("Error downloading PDF: " + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleScroll = (e) => {
    if (!pageSequence.length) return;
    let closestPage = 0;
    let minDistance = Infinity;

    for (let i = 0; i < pageSequence.length; i++) {
      const pageObj = pageSequence[i];
      const pageEl = document.getElementById(`pdf-page-container-${pageObj.id}`);
      if (pageEl) {
        const rect = pageEl.getBoundingClientRect();
        const pageCenter = rect.top + rect.height / 2;
        const distance = Math.abs(window.innerHeight / 2 - pageCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestPage = i;
        }
      }
    }

    if (closestPage !== selectedPageToAdd) {
      setSelectedPageToAdd(closestPage);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={(e) => {
        // Deselect if clicking outside any box, but don't deselect if clicking the toolbar
        if (!e.target.closest('.text-box-wrapper') && !e.target.closest('.ql-toolbar') && !e.target.closest('.editor-header')) {
          setActiveBoxId(null);
          setEditingBoxId(null);
        }
      }}
    >
      <style>{customStyle}</style>

      {/* Loading Spinner Overlay for Open, Save/Generate, or Download */}
      {(isLoadingProposal || isGenerating || isDownloading) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTop: '4px solid #ffffff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <div style={{
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 600,
            marginTop: '20px',
            fontFamily: "'Inter', -apple-system, sans-serif"
          }}>
            {isGenerating
              ? 'Generating & Saving Proposal...'
              : (isDownloading
                ? 'Downloading PDF...'
                : (readOnly ? 'Loading Proposal...' : 'Loading Template & Assets...'))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header Bar */}
      <div className="editor-header" style={{ position: 'relative', zIndex: 10000, background: '#1f2937', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'white', letterSpacing: '0.5px' }}>
            {readOnly ? 'View Proposal' : 'Proposal Editor'}
          </h2>
          {!readOnly && (
            <input
              type="text"
              value={proposalTitle}
              onChange={(e) => setProposalTitle(e.target.value)}
              placeholder="Enter Proposal Title..."
              title="Proposal Title (used as PDF download filename)"
              style={{
                background: '#374151',
                border: '1px solid #4b5563',
                color: 'white',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                width: '260px',
                outline: 'none'
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {!readOnly && (
            <>
              <select
                value={selectedPageToAdd}
                onChange={(e) => setSelectedPageToAdd(Number(e.target.value))}
                style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', background: 'white', color: 'black', fontSize: '13px', fontWeight: 600 }}
              >
                {Array.from(new Array(numPages || 0), (_, i) => (
                  <option key={i} value={i}>Page {i + 1}</option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '6px', background: '#374151', padding: '4px', borderRadius: '6px' }}>
                <button
                  onClick={handleImportDocxClick}
                  style={{
                    padding: '6px 12px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title="Import Word document (.docx)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Import DOCX
                </button>
                <button onClick={addTextBox} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: textBoxes.find(b=>b.id===activeBoxId)?.type==='text' ? '2px solid #ffffff' : '2px solid transparent', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, boxShadow: textBoxes.find(b=>b.id===activeBoxId)?.type==='text' ? '0 0 8px rgba(16,185,129,0.8)' : 'none' }}>+ Text</button>
                <button onClick={addImageBox} style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', border: textBoxes.find(b=>b.id===activeBoxId)?.type==='image' ? '2px solid #ffffff' : '2px solid transparent', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, boxShadow: textBoxes.find(b=>b.id===activeBoxId)?.type==='image' ? '0 0 8px rgba(139,92,246,0.8)' : 'none' }}>+ Image</button>
                <button onClick={addTableBox} style={{ padding: '6px 12px', background: '#f59e0b', color: 'white', border: textBoxes.find(b=>b.id===activeBoxId)?.type==='table' ? '2px solid #ffffff' : '2px solid transparent', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, boxShadow: textBoxes.find(b=>b.id===activeBoxId)?.type==='table' ? '0 0 8px rgba(245,158,11,0.8)' : 'none' }}>+ Table</button>
                <button onClick={duplicatePage} style={{ padding: '6px 12px', background: '#14b8a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }} title="Duplicate Current Page">Copy Page</button>
                <button onClick={deletePage} style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }} title="Delete Current Page">Delete Page</button>
              </div>

              <div style={{ display: 'flex', gap: '6px', background: '#374151', padding: '4px', borderRadius: '6px', marginLeft: '6px' }}>
                <button
                  onClick={() => {
                    if (!activeBoxId) return;
                    const box = textBoxes.find(b => b.id === activeBoxId);
                    if (!box) return;

                    let nextAlign = 'center';
                    if (box.pageAlign === 'center') nextAlign = 'right';
                    else if (box.pageAlign === 'right') nextAlign = 'left';

                    let newX = box.x;
                    if (nextAlign === 'left') newX = 20;
                    else if (nextAlign === 'center') newX = (PAGE_WIDTH - box.width) / 2;
                    else if (nextAlign === 'right') newX = PAGE_WIDTH - box.width - 20;

                    setTextBoxes(prev => prev.map(b => b.id === box.id ? { ...b, pageAlign: nextAlign, x: newX } : b));
                  }}
                  disabled={!activeBoxId}
                  style={{ padding: '6px 12px', background: activeBoxId ? '#f59e0b' : '#4b5563', color: 'white', border: 'none', borderRadius: '4px', cursor: activeBoxId ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}
                  title="Align Selected Box on Page"
                >
                  Alignment
                </button>
                <button onClick={handleUndo} style={{ padding: '6px 10px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>⟲ Undo</button>
                <button onClick={handleRedo} style={{ padding: '6px 10px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>⟳ Redo</button>
              </div>

              <button onClick={generateFinalPDF} disabled={isGenerating} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: isGenerating ? 0.7 : 1, fontSize: '12.5px', fontWeight: 700, marginLeft: '10px' }}>
                {isGenerating ? 'Saving…' : 'Save & Generate'}
              </button>
            </>
          )}

          {/* Direct Download button always available in preview & edit */}
          <button onClick={handleDirectDownload} disabled={isGenerating} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: isGenerating ? 0.7 : 1, fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Download PDF
          </button>

          <button onClick={onClose} disabled={isGenerating} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700 }}>Close</button>
        </div>
      </div>

      {/* Main PDF Viewer Area - Scrolling vertically */}
      <div
        id="pdf-scroll-container"
        onScroll={handleScroll}
        style={{ flex: 1, overflow: draggingRef.current ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#374151', padding: '20px', paddingLeft: '50px', touchAction: draggingRef.current ? 'none' : 'auto' }}
      >
        <Document
          file={process.env.PUBLIC_URL + '/BtplSoft_Proposal.pdf'}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div style={{ padding: '50px', color: 'white' }}>Loading PDF...</div>}
        >
          {pageSequence.map((pageObj, index) => {
            return (
              <div
                key={pageObj.id}
                id={`pdf-page-container-${pageObj.id}`}
                draggable
                onDragStart={(e) => {
                  setDraggedPageIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverIndex(index);
                }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverIndex(null);
                  if (draggedPageIndex === null) return;
                  const dropIndex = index;
                  if (draggedPageIndex === dropIndex) return;

                  const newSequence = [...pageSequence];
                  const [draggedPage] = newSequence.splice(draggedPageIndex, 1);
                  newSequence.splice(dropIndex, 0, draggedPage);
                  setPageSequence(newSequence);
                  setDraggedPageIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedPageIndex(null);
                  setDragOverIndex(null);
                }}
                style={{
                  position: 'relative',
                  marginBottom: '30px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  background: 'white',
                  width: PAGE_WIDTH,
                  maxWidth: '100%',
                  height: 'max-content',
                  border: draggedPageIndex === index ? '2px dashed #3b82f6' : '1px solid #d1d5db',
                  opacity: draggedPageIndex === index ? 0.5 : 1
                }}
              >
                {/* Visual Drop Indicator */}
                {dragOverIndex === index && draggedPageIndex !== index && (
                  <div style={{
                    position: 'absolute',
                    top: -15,
                    left: 0,
                    right: 0,
                    height: 8,
                    background: '#3b82f6',
                    borderRadius: 4,
                    zIndex: 100,
                    boxShadow: '0 4px 6px rgba(59, 130, 246, 0.5)'
                  }} />
                )}

                {/* Drag Handle */}
                <div style={{ position: 'absolute', top: 20, left: -40, width: 30, height: 30, background: '#4b5563', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', cursor: 'grab', zIndex: 50, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} title="Drag to reorder page">
                  ☰
                </div>

                {/* PDF Page Background */}
                <Page
                  pageNumber={pageObj.originalPageNumber}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={PAGE_WIDTH}
                />

                {/* Render Draggable Text Boxes for this page */}
                {textBoxes.filter(box => box.pageId === pageObj.id).map(box => (
                  <div
                    key={box.id}
                    className={`text-box-wrapper ${activeBoxId === box.id ? 'active' : 'inactive'}`}
                    style={{
                      position: 'absolute',
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.type === 'text' ? 'auto' : (box.height || 'auto'),
                      transform: `rotate(${editingBoxId === box.id ? 0 : (box.rotation || 0)}deg)`,
                      transformOrigin: 'center center',
                      boxSizing: 'border-box',
                      fontSize: `${box.fontSize || 16}px`,
                      fontFamily: box.fontFamily || 'Arial, sans-serif',
                      border: (activeBoxId === box.id && !readOnly) ? '2px solid #8b3dff' : '2px solid transparent',
                      background: (activeBoxId === box.id && !readOnly) ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
                      zIndex: activeBoxId === box.id ? 20 : 10,
                      cursor: (activeBoxId === box.id && !readOnly) ? 'move' : 'default',
                      touchAction: 'none',
                    }}
                    onClick={(e) => { if (!readOnly) { e.stopPropagation(); setActiveBoxId(box.id); } }}
                    onPointerDown={(e) => {
                      if (readOnly) return;
                      if (['TEXTAREA', 'INPUT', 'SELECT', 'BUTTON', 'OPTION', 'TR', 'TD'].includes(e.target.tagName)) {
                        setActiveBoxId(box.id);
                        return;
                      }
                      if (editingBoxId === box.id) {
                        // If they are actively typing, let them click the text
                        return;
                      }
                      e.stopPropagation();
                      e.preventDefault();
                      
                      // Don't prevent scrolling during move - we want auto-scroll
                      // document.body.classList.add('is-resizing'); // REMOVED
                      
                      if (e.target.setPointerCapture && e.pointerId !== undefined) {
                        try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
                      }
                      setActiveBoxId(box.id);
                      setIsDragging(true);
                      draggingRef.current = true;
                      
                      let lastX = e.clientX;
                      let lastY = e.clientY;
                      let autoScrollAnimationId = null;
                      
                      // Auto-scroll function using requestAnimationFrame
                      const performAutoScroll = () => {
                        const mouseY = lastY;
                        const viewportHeight = window.innerHeight;
                        const scrollThreshold = 200; // Increased for easier triggering
                        const toolbarHeight = 0; // No toolbar blocking now
                        
                        let shouldScroll = false;
                        
                        // Calculate distance-based speed (faster when closer to edge)
                        const calculateSpeed = (distance, threshold) => {
                          // Speed ranges from 8 (far) to 25 (close to edge)
                          const normalizedDistance = Math.max(0, Math.min(1, distance / threshold));
                          return Math.round(8 + (1 - normalizedDistance) * 17);
                        };
                        
                        // Scroll down when near bottom
                        if (mouseY > viewportHeight - scrollThreshold) {
                          const distanceFromBottom = viewportHeight - mouseY;
                          const scrollSpeed = calculateSpeed(distanceFromBottom, scrollThreshold);
                          window.scrollBy(0, scrollSpeed);
                          shouldScroll = true;
                        }
                        // Scroll up when near top (account for toolbar)
                        else if (mouseY < scrollThreshold + toolbarHeight) {
                          const currentScroll = document.documentElement.scrollTop || document.body.scrollTop || window.pageYOffset || 0;
                          if (currentScroll > 0) {
                            const distanceFromTop = mouseY - toolbarHeight;
                            const scrollSpeed = calculateSpeed(distanceFromTop, scrollThreshold);
                            window.scrollBy(0, -scrollSpeed);
                            // Force scroll using direct manipulation as fallback
                            document.documentElement.scrollTop = Math.max(0, currentScroll - scrollSpeed);
                            shouldScroll = true;
                          }
                        }
                        
                        // Continue animation if we're still in scroll zone
                        if (shouldScroll && draggingRef.current) {
                          autoScrollAnimationId = requestAnimationFrame(performAutoScroll);
                        } else {
                          autoScrollAnimationId = null;
                        }
                      };
                      
                      const onMove = (moveEvent) => {
                        moveEvent.preventDefault();
                        moveEvent.stopPropagation();
                        
                        const dx = moveEvent.clientX - lastX;
                        const dy = moveEvent.clientY - lastY;
                        console.log('Moving:', { dx, dy, newX: box.x + dx, newY: box.y + dy }); // DEBUG
                        setTextBoxes(prev => prev.map(b => b.id === box.id ? { ...b, x: b.x + dx, y: b.y + dy } : b));
                        lastX = moveEvent.clientX;
                        lastY = moveEvent.clientY;
                        
                        // Start or restart auto-scroll
                        const mouseY = moveEvent.clientY;
                        const viewportHeight = window.innerHeight;
                        const scrollThreshold = 200;
                        const toolbarHeight = 0; // No toolbar blocking now
                        
                        // Check if we're in a scroll zone (account for toolbar at top)
                        const inScrollZone = (mouseY < scrollThreshold + toolbarHeight) || (mouseY > viewportHeight - scrollThreshold);
                        
                        if (inScrollZone && !autoScrollAnimationId) {
                          // Start auto-scroll animation
                          autoScrollAnimationId = requestAnimationFrame(performAutoScroll);
                        } else if (!inScrollZone && autoScrollAnimationId) {
                          // Stop auto-scroll when leaving scroll zone
                          cancelAnimationFrame(autoScrollAnimationId);
                          autoScrollAnimationId = null;
                        }
                      };
                      
                      const onUp = (upEvent) => {
                        // Clear auto-scroll animation
                        if (autoScrollAnimationId) {
                          cancelAnimationFrame(autoScrollAnimationId);
                          autoScrollAnimationId = null;
                        }
                        
                        // Remove the class to re-enable scrolling
                        // document.body.classList.remove('is-resizing'); // REMOVED
                        
                        if (e.target.releasePointerCapture && upEvent.pointerId !== undefined) {
                          try { e.target.releasePointerCapture(upEvent.pointerId); } catch(err) {}
                        }
                        setIsDragging(false);
                        draggingRef.current = false;
                        document.removeEventListener('pointermove', onMove);
                        document.removeEventListener('pointerup', onUp);
                      };
                      
                      document.addEventListener('pointermove', onMove, { passive: false });
                      document.addEventListener('pointerup', onUp);
                    }}
                    onDoubleClick={(e) => {
                      if (box.type === 'text') {
                        e.stopPropagation();
                        setEditingBoxId(box.id);
                      }
                    }}
                  >
                    {activeBoxId === box.id && !isGenerating && !readOnly && (
                      <>
                        {/* Canva-Style Controls under the box */}
                        <div style={{ position: 'absolute', bottom: '-40px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 101 }}>
                          {/* Rotate Handle */}
                          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                            <div
                              style={{
                                width: '28px', height: '28px',
                                background: activeHandle === 'rotate' ? '#3b82f6' : '#ffffff',
                                border: activeHandle === 'rotate' ? '2px solid #1d4ed8' : '1px solid #d1d5db',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: activeHandle === 'rotate' ? '0 0 10px rgba(59,130,246,0.7)' : '0 2px 4px rgba(0,0,0,0.1)',
                                cursor: 'grab', touchAction: 'none',
                                transition: 'all 0.15s ease',
                                // Visual snap indicator
                                transform: rotationTooltip.isSnapped ? 'scale(1.2)' : 'scale(1)',
                                background: rotationTooltip.isSnapped ? '#10b981' : (activeHandle === 'rotate' ? '#3b82f6' : '#ffffff'),
                                border: rotationTooltip.isSnapped ? '2px solid #059669' : (activeHandle === 'rotate' ? '2px solid #1d4ed8' : '1px solid #d1d5db'),
                                boxShadow: rotationTooltip.isSnapped ? '0 0 20px rgba(16,185,129,0.8)' : (activeHandle === 'rotate' ? '0 0 10px rgba(59,130,246,0.7)' : '0 2px 4px rgba(0,0,0,0.1)')
                              }}
                              title="Rotate (Snap to 0° when close)"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                
                                // Add class to body to prevent scrolling during rotation
                                document.body.classList.add('is-resizing');
                                
                                if (e.target.setPointerCapture && e.pointerId !== undefined) {
                                  try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
                                }
                                setIsDragging(true);
                                draggingRef.current = true;
                                setActiveHandle('rotate');
                                
                                // Lock the element's center in PAGE coordinates at drag-start
                                const wrapperEl = e.target.closest('.text-box-wrapper');
                                const wrapperRect = wrapperEl.getBoundingClientRect();
                                const centerXClient = wrapperRect.left + wrapperRect.width / 2;
                                const centerYClient = wrapperRect.top + wrapperRect.height / 2;
                                
                                // Store the locked center relative to the page container
                                const pageContainer = wrapperEl.parentElement;
                                const pageRect = pageContainer.getBoundingClientRect();
                                const lockedCenterPageX = centerXClient - pageRect.left;
                                const lockedCenterPageY = centerYClient - pageRect.top;
                                
                                const startAngle = Math.atan2(e.clientY - centerYClient, e.clientX - centerXClient) * (180 / Math.PI);
                                const startRotation = box.rotation || 0;
                                
                                setRotationTooltip({ visible: true, angle: Math.round(startRotation) });

                                const onMove = (moveEvent) => {
                                  moveEvent.preventDefault();
                                  moveEvent.stopPropagation();
                                  const currentAngle = Math.atan2(moveEvent.clientY - centerYClient, moveEvent.clientX - centerXClient) * (180 / Math.PI);
                                  let delta = currentAngle - startAngle;
                                  let newRotation = (startRotation + delta) % 360;
                                  
                                  // Normalize rotation to -180 to 180 range
                                  if (newRotation > 180) newRotation -= 360;
                                  if (newRotation < -180) newRotation += 360;
                                  
                                  // Snap to straight (0°) when within 5 degrees
                                  const snapThreshold = 5;
                                  let isSnapped = false;
                                  
                                  if (Math.abs(newRotation) <= snapThreshold) {
                                    newRotation = 0;
                                    isSnapped = true;
                                    
                                    // Haptic feedback on mobile devices
                                    if (navigator.vibrate) {
                                      navigator.vibrate(50); // 50ms vibration
                                    }
                                  }
                                  
                                  if (moveEvent.shiftKey) {
                                    newRotation = Math.round(newRotation / 45) * 45;
                                  }
                                  
                                  setRotationTooltip({ 
                                    visible: true, 
                                    angle: Math.round(newRotation),
                                    isSnapped: isSnapped // Pass snap status to tooltip
                                  });
                                  
                                  // Recalculate x/y so the center stays at lockedCenter
                                  setTextBoxes(prev => prev.map(b => {
                                    if (b.id !== box.id) return b;
                                    const newX = lockedCenterPageX - b.width / 2;
                                    const newY = lockedCenterPageY - (b.height || 40) / 2;
                                    return { ...b, rotation: newRotation, x: newX, y: newY };
                                  }));
                                };

                                const onUp = (upEvent) => {
                                  // Remove the class to re-enable scrolling
                                  document.body.classList.remove('is-resizing');
                                  
                                  if (e.target.releasePointerCapture && upEvent.pointerId !== undefined) {
                                    try { e.target.releasePointerCapture(upEvent.pointerId); } catch(err) {}
                                  }
                                  setIsDragging(false);
                                  draggingRef.current = false;
                                  setActiveHandle(null);
                                  setRotationTooltip({ visible: false, angle: 0 });
                                  document.removeEventListener('pointermove', onMove);
                                  document.removeEventListener('pointerup', onUp);
                                };

                                document.addEventListener('pointermove', onMove, { passive: false });
                                document.addEventListener('pointerup', onUp);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeHandle === 'rotate' ? '#ffffff' : '#4b5563'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 2v6h6"></path></svg>
                            </div>
                            {rotationTooltip.visible && activeBoxId === box.id && (
                              <div style={{ position: 'absolute', top: '-34px', background: '#1f2937', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                {rotationTooltip.angle}°
                              </div>
                            )}
                          </div>
                          
                          {/* Move Handle */}
                          <div
                            style={{
                              width: '28px', height: '28px',
                              background: activeHandle === 'move' ? '#10b981' : '#ffffff',
                              border: activeHandle === 'move' ? '2px solid #059669' : '1px solid #d1d5db',
                              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: activeHandle === 'move' ? '0 0 10px rgba(16,185,129,0.7)' : '0 2px 4px rgba(0,0,0,0.1)',
                              cursor: 'move', touchAction: 'none',
                              transition: 'all 0.15s ease'
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (e.target.setPointerCapture && e.pointerId !== undefined) {
                                try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
                              }
                              setActiveBoxId(box.id);
                              setIsDragging(true);
                              draggingRef.current = true;
                              setActiveHandle('move');
                              
                              let lastX = e.clientX;
                              let lastY = e.clientY;
                              
                              const onMove = (moveEvent) => {
                                moveEvent.preventDefault();
                                const dx = moveEvent.clientX - lastX;
                                const dy = moveEvent.clientY - lastY;
                                setTextBoxes(prev => prev.map(b => b.id === box.id ? { ...b, x: b.x + dx, y: b.y + dy } : b));
                                lastX = moveEvent.clientX;
                                lastY = moveEvent.clientY;
                              };
                              
                              const onUp = (upEvent) => {
                                if (e.target.releasePointerCapture && upEvent.pointerId !== undefined) {
                                  try { e.target.releasePointerCapture(upEvent.pointerId); } catch(err) {}
                                }
                                setIsDragging(false);
                                draggingRef.current = false;
                                setActiveHandle(null);
                                document.removeEventListener('pointermove', onMove);
                                document.removeEventListener('pointerup', onUp);
                              };
                              
                              document.addEventListener('pointermove', onMove, { passive: false });
                              document.addEventListener('pointerup', onUp);
                            }}
                            title="Drag to move"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeHandle === 'move' ? '#ffffff' : '#4b5563'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l-3 3 3 3"></path><path d="M9 5l3-3 3 3"></path><path d="M19 9l3 3-3 3"></path><path d="M9 19l3 3 3-3"></path><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                          </div>
                        </div>

                        {/* Render Resize Handles */}
                        {[
                          { dir: 'nw', style: { top: '-7px', left: '-7px', cursor: 'nw-resize' }, type: 'corner' },
                          { dir: 'ne', style: { top: '-7px', right: '-7px', cursor: 'ne-resize' }, type: 'corner' },
                          { dir: 'sw', style: { bottom: '-7px', left: '-7px', cursor: 'sw-resize' }, type: 'corner' },
                          { dir: 'se', style: { bottom: '-7px', right: '-7px', cursor: 'se-resize' }, type: 'corner' },
                          { dir: 'w', style: { top: '50%', left: '-5px', transform: 'translateY(-50%)', cursor: 'ew-resize', height: '20px', width: '8px', borderRadius: '4px' }, type: 'side' },
                          { dir: 'e', style: { top: '50%', right: '-5px', transform: 'translateY(-50%)', cursor: 'ew-resize', height: '20px', width: '8px', borderRadius: '4px' }, type: 'side' },
                        ].map(handle => (
                          <div
                            key={handle.dir}
                            style={{
                              position: 'absolute',
                              width: handle.type === 'corner' ? '14px' : handle.style.width,
                              height: handle.type === 'corner' ? '14px' : handle.style.height,
                              background: '#ffffff',
                              borderRadius: handle.type === 'corner' ? '50%' : handle.style.borderRadius,
                              zIndex: 100,
                              border: '1px solid #9ca3af',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                              touchAction: 'none',
                              ...handle.style
                            }}
                            onPointerDown={(e) => {
                              e.preventDefault(); // Prevent page scroll/movement
                              e.stopPropagation();
                              
                              // Add class to body to prevent scrolling during resize
                              document.body.classList.add('is-resizing');
                              
                              // Capture the pointer to ensure smooth dragging
                              if (e.target.setPointerCapture && e.pointerId !== undefined) {
                                try { e.target.setPointerCapture(e.pointerId); } catch(err) {}
                              }
                              
                              setIsDragging(true);
                              draggingRef.current = true;
                              const startX = e.clientX;
                              const startY = e.clientY;
                              const startWidth = box.width;
                              const startHeight = box.height || (box.type === 'image' ? 200 : 30);
                              const startBoxX = box.x;
                              const startBoxY = box.y;

                              const onMove = (moveEvent) => {
                                moveEvent.preventDefault(); // Always prevent default to stop page scrolling
                                moveEvent.stopPropagation();
                                
                                let dx = moveEvent.clientX - startX;
                                let dy = moveEvent.clientY - startY;

                                const rot = box.rotation || 0;
                                if (rot !== 0) {
                                  const rad = -rot * (Math.PI / 180);
                                  const rotatedDx = dx * Math.cos(rad) - dy * Math.sin(rad);
                                  const rotatedDy = dx * Math.sin(rad) + dy * Math.cos(rad);
                                  dx = rotatedDx;
                                  dy = rotatedDy;
                                }

                                let newWidth = startWidth;
                                let newHeight = startHeight;
                                let newX = startBoxX;
                                let newY = startBoxY;
                                let newFontSize = box.fontSize || 16;

                                if (handle.dir.includes('e')) newWidth = Math.max(50, startWidth + dx);
                                if (handle.dir.includes('w')) {
                                  newWidth = Math.max(50, startWidth - dx);
                                  newX = startBoxX + (startWidth - newWidth);
                                }

                                if (handle.type === 'corner') {
                                  const scale = newWidth / startWidth;
                                  newHeight = Math.max(30, startHeight * scale);
                                  if (handle.dir.includes('n')) {
                                    newY = startBoxY + (startHeight - newHeight);
                                  }
                                  if (box.type === 'text' || box.type === 'table') {
                                    newFontSize = Math.max(8, Math.round((box.fontSize || 16) * scale));
                                  }
                                } else {
                                  if (handle.dir.includes('s')) newHeight = Math.max(30, startHeight + dy);
                                  if (handle.dir.includes('n')) {
                                    newHeight = Math.max(30, startHeight - dy);
                                    newY = startBoxY + (startHeight - newHeight);
                                  }
                                }

                                setTextBoxes(prev => prev.map(b => b.id === box.id ? { ...b, width: newWidth, height: newHeight, x: newX, y: newY, fontSize: newFontSize } : b));
                              };
                              const onUp = (upEvent) => {
                                // Remove the class to re-enable scrolling
                                document.body.classList.remove('is-resizing');
                                
                                if (e.target.releasePointerCapture && upEvent.pointerId !== undefined) {
                                  try { e.target.releasePointerCapture(upEvent.pointerId); } catch(err) {}
                                }
                                setIsDragging(false);
                                draggingRef.current = false;
                                document.removeEventListener('pointermove', onMove);
                                document.removeEventListener('pointerup', onUp);
                              };
                              document.addEventListener('pointermove', onMove, { passive: false });
                              document.addEventListener('pointerup', onUp);
                            }}
                          />
                        ))}
                      </>
                    )}
                    {/* Toolbar for the active box */}
                    {!isGenerating && activeBoxId === box.id && !readOnly && (
                      <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 100 }}>
                        {/* Row 1: Text Formatting Toolbar — only visible when editing text */}
                        {editingBoxId === box.id && box.type === 'text' && (
                          <div style={{ display: 'flex', gap: '4px', background: '#ffffff', padding: '6px 10px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', alignItems: 'center', width: 'max-content', alignSelf: 'flex-end', fontSize: '13px', fontFamily: "'Inter', -apple-system, sans-serif" }}>
                            {[
                              { label: 'B', title: 'Bold', style: { fontWeight: 'bold' }, format: 'bold' },
                              { label: 'I', title: 'Italic', style: { fontStyle: 'italic' }, format: 'italic' },
                              { label: 'U', title: 'Underline', style: { textDecoration: 'underline' }, format: 'underline' },
                              { label: 'S', title: 'Strikethrough', style: { textDecoration: 'line-through' }, format: 'strike' },
                            ].map(btn => (
                              <button
                                key={btn.format}
                                title={btn.title}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const editor = quillRef.current?.getEditor();
                                  if (!editor) return;
                                  const current = editor.getFormat();
                                  editor.format(btn.format, !current[btn.format]);
                                }}
                                style={{ ...btn.style, background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '13px', minWidth: '28px' }}
                              >{btn.label}</button>
                            ))}
                            <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 4px' }} />
                            {/* Ordered list */}
                            <button title="Ordered List" onMouseDown={(e) => { e.preventDefault(); const ed = quillRef.current?.getEditor(); if (!ed) return; const cur = ed.getFormat(); ed.format('list', cur.list === 'ordered' ? false : 'ordered'); }} style={{ background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '13px' }}>1.</button>
                            {/* Bullet list */}
                            <button title="Bullet List" onMouseDown={(e) => { e.preventDefault(); const ed = quillRef.current?.getEditor(); if (!ed) return; const cur = ed.getFormat(); ed.format('list', cur.list === 'bullet' ? false : 'bullet'); }} style={{ background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '13px' }}>•</button>
                            <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 4px' }} />
                            {/* Text color */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 6px' }}>
                              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>A</span>
                              <input type="color" defaultValue="#000000" title="Text Color" onInput={(e) => { const ed = quillRef.current?.getEditor(); if (ed) ed.format('color', e.target.value); }} style={{ width: '18px', height: '18px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                            </div>
                            {/* Background color */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 6px' }}>
                              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>BG</span>
                              <input type="color" defaultValue="#ffffff" title="Highlight Color" onInput={(e) => { const ed = quillRef.current?.getEditor(); if (ed) ed.format('background', e.target.value); }} style={{ width: '18px', height: '18px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                            </div>
                            <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 4px' }} />
                            {/* Clear formatting */}
                            <button title="Clear Formatting" onMouseDown={(e) => { e.preventDefault(); const ed = quillRef.current?.getEditor(); if (ed) { const range = ed.getSelection(); if (range) ed.removeFormat(range.index, range.length); } }} style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 500 }}>Tx</button>
                            {/* Done button */}
                            <button title="Done Editing" onClick={() => setEditingBoxId(null)} style={{ background: '#8b3dff', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginLeft: '4px' }}>Done</button>
                          </div>
                        )}

                        {/* Row 2: Size, Font, Delete */}
                        <div style={{ display: 'flex', gap: '8px', background: '#ffffff', padding: '6px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', fontSize: '13px', fontFamily: "'Inter', -apple-system, sans-serif", whiteSpace: 'nowrap', alignItems: 'center' }}>
                          {/* Size */}
                          <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', padding: '2px 8px', borderRadius: '6px' }}>
                            <span style={{ fontSize: '12px', marginRight: '4px', color: '#6b7280', fontWeight: 500 }}>Size</span>
                            <input 
                              type="number" 
                              value={box.fontSize || 16} 
                              onChange={(e) => updateTextBox(box.id, 'fontSize', parseInt(e.target.value) || 16)}
                              style={{ width: '36px', border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#111827' }}
                            />
                          </div>

                          {/* Font */}
                          <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', padding: '2px 8px', borderRadius: '6px' }}>
                            <span style={{ fontSize: '12px', marginRight: '4px', color: '#6b7280', fontWeight: 500 }}>Font</span>
                            <select 
                              value={box.fontFamily || 'Arial, sans-serif'} 
                              onChange={(e) => updateTextBox(box.id, 'fontFamily', e.target.value)}
                              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#111827', cursor: 'pointer', maxWidth: '120px' }}
                            >
                              <option value="Arial, sans-serif" style={{ fontFamily: 'Arial, sans-serif' }}>Arial</option>
                              <option value="'Times New Roman', Times, serif" style={{ fontFamily: "'Times New Roman', Times, serif" }}>Times New Roman</option>
                              <option value="Georgia, serif" style={{ fontFamily: "Georgia, serif" }}>Georgia</option>
                              <option value="'Courier New', monospace" style={{ fontFamily: "'Courier New', monospace" }}>Courier New</option>
                              <option value="Verdana, sans-serif" style={{ fontFamily: "Verdana, sans-serif" }}>Verdana</option>
                              <option value="'Inter', sans-serif" style={{ fontFamily: "'Inter', sans-serif" }}>Inter</option>
                              <option value="'Roboto', sans-serif" style={{ fontFamily: "'Roboto', sans-serif" }}>Roboto</option>
                              <option value="'Montserrat', sans-serif" style={{ fontFamily: "'Montserrat', sans-serif" }}>Montserrat</option>
                              <option value="'Open Sans', sans-serif" style={{ fontFamily: "'Open Sans', sans-serif" }}>Open Sans</option>
                              <option value="'Lato', sans-serif" style={{ fontFamily: "'Lato', sans-serif" }}>Lato</option>
                              <option value="'Poppins', sans-serif" style={{ fontFamily: "'Poppins', sans-serif" }}>Poppins</option>
                              <option value="'Playfair Display', serif" style={{ fontFamily: "'Playfair Display', serif" }}>Playfair Display</option>
                              <option value="'Merriweather', serif" style={{ fontFamily: "'Merriweather', serif" }}>Merriweather</option>
                            </select>
                          </div>

                          {/* Table Specific Controls */}
                          {box.type === 'table' && (
                            <div style={{ display: 'flex', gap: '8px', paddingLeft: '8px', borderLeft: '1px solid #e5e7eb' }}>
                              {/* Alignment */}
                              <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
                                <button onClick={(e) => { e.stopPropagation(); updateTextBox(box.id, 'textAlign', 'left'); }} style={{ background: box.textAlign === 'left' ? '#d1d5db' : 'transparent', color: '#374151', border: 'none', padding: '4px 8px', cursor: 'pointer' }} title="Align Left">⫷</button>
                                <button onClick={(e) => { e.stopPropagation(); updateTextBox(box.id, 'textAlign', 'center'); }} style={{ background: (!box.textAlign || box.textAlign === 'center') ? '#d1d5db' : 'transparent', color: '#374151', border: 'none', padding: '4px 8px', cursor: 'pointer' }} title="Align Center">≡</button>
                                <button onClick={(e) => { e.stopPropagation(); updateTextBox(box.id, 'textAlign', 'right'); }} style={{ background: box.textAlign === 'right' ? '#d1d5db' : 'transparent', color: '#374151', border: 'none', padding: '4px 8px', cursor: 'pointer' }} title="Align Right">⫸</button>
                              </div>

                              {/* Rows & Cols */}
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: '#ecfdf5', borderRadius: '6px', overflow: 'hidden', border: '1px solid #d1fae5' }}>
                                  <span style={{ fontSize: '12px', padding: '0 6px', color: '#059669', fontWeight: 600 }}>Row</span>
                                  <button onClick={(e) => { e.stopPropagation(); updateTextBox(box.id, 'data', [...box.data, Array(box.data[0].length).fill('')]); }} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: 'none', borderLeft: '1px solid #d1fae5', padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}>+</button>
                                  <button onClick={(e) => { e.stopPropagation(); if (box.data.length > 1) updateTextBox(box.id, 'data', box.data.slice(0, -1)); }} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: 'none', borderLeft: '1px solid #d1fae5', padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}>-</button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', background: '#f5f3ff', borderRadius: '6px', overflow: 'hidden', border: '1px solid #ede9fe' }}>
                                  <span style={{ fontSize: '12px', padding: '0 6px', color: '#7c3aed', fontWeight: 600 }}>Col</span>
                                  <button onClick={(e) => { e.stopPropagation(); updateTextBox(box.id, 'data', box.data.map(row => [...row, ''])); }} style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: 'none', borderLeft: '1px solid #ede9fe', padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}>+</button>
                                  <button onClick={(e) => { e.stopPropagation(); if (box.data[0].length > 1) updateTextBox(box.id, 'data', box.data.map(row => row.slice(0, -1))); }} style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: 'none', borderLeft: '1px solid #ede9fe', padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}>-</button>
                                </div>
                              </div>

                              {/* BG Color */}
                              <div style={{ display: 'flex', alignItems: 'center', background: '#fffbeb', borderRadius: '6px', overflow: 'hidden', border: '1px solid #fef3c7', padding: '2px 4px' }}>
                                <span style={{ fontSize: '12px', padding: '0 4px', color: '#d97706', fontWeight: 600 }}>BG</span>
                                <input type="color" value={box.backgroundColor || '#ffffff'} onChange={(e) => updateTextBox(box.id, 'backgroundColor', e.target.value)} style={{ border: 'none', width: '20px', height: '20px', padding: 0, cursor: 'pointer', background: 'transparent' }} title="Table Background Color" />
                              </div>
                            </div>
                          )}

                          {/* Delete Button */}
                          <div style={{ paddingLeft: '8px', borderLeft: '1px solid #e5e7eb' }}>
                            <button onClick={() => setTextBoxes(prev => prev.filter(b => b.id !== box.id))} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', borderRadius: '6px', cursor: 'pointer', padding: '4px 8px', fontWeight: 500 }}>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* The Content Editor */}
                    <div style={{ opacity: activeBoxId === box.id || !isGenerating ? 1 : 0.9, height: '100%' }}>
                      {box.type === 'table' ? (
                        <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', background: box.backgroundColor || 'transparent' }}>
                          <tbody>
                            {box.data.map((row, r) => (
                              <tr key={r}>
                                {row.map((cell, c) => (
                                  <td key={c} style={{ border: '1px solid #4b5563', padding: '0' }}>
                                    {activeBoxId === box.id && !isGenerating ? (
                                      <input
                                        type="text"
                                        value={cell}
                                        onChange={(e) => {
                                          const newData = [...box.data];
                                          newData[r][c] = e.target.value;
                                          updateTextBox(box.id, 'data', newData);
                                        }}
                                        style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', padding: '4px 8px', outline: 'none', boxSizing: 'border-box' }}
                                      />
                                    ) : (
                                      <div style={{ width: '100%', height: '100%', padding: '8px', fontSize: 'inherit', boxSizing: 'border-box', textAlign: box.textAlign || 'center', wordBreak: 'break-word', display: 'flex', alignItems: 'center', justifyContent: box.textAlign === 'left' ? 'flex-start' : box.textAlign === 'right' ? 'flex-end' : 'center' }}>
                                        {cell}
                                      </div>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : editingBoxId === box.id ? (
                          <div style={{ position: 'relative' }}>
                            <ReactQuill
                              ref={quillRef}
                              theme="snow"
                              value={box.text}
                              onChange={(content) => updateTextBox(box.id, 'text', content)}
                              modules={{ toolbar: false }}
                              style={{ background: 'white', borderRadius: '4px', minHeight: '80px', border: '1px solid #c4b5fd' }}
                            />
                          </div>
                      ) : (
                        <div
                          className="ql-editor"
                          dangerouslySetInnerHTML={{ __html: box.text || '<p>Double-click to edit</p>' }}
                          style={{ background: 'transparent', pointerEvents: 'none' }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </Document>
      </div>

      {/* Hidden file input for DOCX importing */}
      <input
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ref={docxFileInputRef}
        onChange={handleDocxUpload}
        style={{ display: 'none' }}
      />

      {/* Hidden file input for image uploading */}
      <input
        type="file"
        accept="image/*"
        ref={imageFileInputRef}
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />

      {/* Dummy Quill to keep the toolbar permanently visible even when no text box is active */}
      <div style={{ opacity: activeBoxId ? 0 : 1, pointerEvents: activeBoxId ? 'none' : 'auto', position: 'fixed', top: -9999, left: -9999, zIndex: 9999 }}>
        <ReactQuill theme="snow" value="" modules={activeModules} />
      </div>

      {/* DOCX Parsing Overlay */}
      {isParsingDocx && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <div style={{ width: '60px', height: '60px', border: '6px solid rgba(255,255,255,0.2)', borderTop: '6px solid #0284c7', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <h2 style={{ marginTop: '24px', fontWeight: 'bold', letterSpacing: '1px' }}>Importing & Formatting DOCX...</h2>
          <p style={{ marginTop: '8px', color: '#d1d5db' }}>Extracting text, headings, tables, and images into proposal canvas.</p>
        </div>
      )}

    </div>
  );
}

export default ProposalGenerator;
