import React, { useRef } from 'react';
import { Download, Printer, Eye, Layers } from 'lucide-react';
import NEHA_MAM_SIGNATURE from '../constants_nehaSign';

// Smart signature display that crops transparent or white margins and displays at a prominent, clear size
const SignatureDisplay = ({ src, alt, maxHeight = 62, maxWidth = 220, onError }) => {
  const [displaySrc, setDisplaySrc] = React.useState(src);

  React.useEffect(() => {
    if (!src) {
      setDisplaySrc(null);
      return;
    }

    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            const alpha = data[idx + 3];
            const r = data[idx], g = data[idx + 1], b = data[idx + 2];
            // Treat as content if not transparent and not near pure white (#eee+)
            const isWhite = r > 235 && g > 235 && b > 235;
            if (alpha > 20 && !isWhite) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              found = true;
            }
          }
        }

        if (found && maxX > minX && maxY > minY) {
          const pad = 6;
          const cropX = Math.max(0, minX - pad);
          const cropY = Math.max(0, minY - pad);
          const cropW = Math.min(canvas.width - cropX, (maxX - minX) + pad * 2);
          const cropH = Math.min(canvas.height - cropY, (maxY - minY) + pad * 2);

          const trimmedCanvas = document.createElement('canvas');
          trimmedCanvas.width = cropW;
          trimmedCanvas.height = cropH;
          const trimmedCtx = trimmedCanvas.getContext('2d');
          trimmedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          const result = trimmedCanvas.toDataURL('image/png');
          if (!isCancelled) {
            setDisplaySrc(result);
          }
          return;
        }
      } catch (err) {
        // Fallback to original
      }
      if (!isCancelled) setDisplaySrc(src);
    };
    img.onerror = () => {
      if (!isCancelled) setDisplaySrc(src);
    };
    img.src = src;

    return () => { isCancelled = true; };
  }, [src]);

  if (!src) return null;

  return (
    <img
      src={displaySrc || src}
      alt={alt}
      onError={onError}
      style={{
        maxHeight: `${maxHeight}px`,
        maxWidth: `${maxWidth}px`,
        width: 'auto',
        height: 'auto',
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
    />
  );
};

export const AssetAcknowledgmentForm = ({
  asset,
  assignedAssets = [],
  allAssets = [],
  employee,
  issuer,
  issuerSignature,
  receiverSignature,
  signedAt,
  assignedDate,
  isDraft = false,
  showActions = true,
  currentUser = null,
  containerStyle = {}
}) => {
  const formPrintRef = useRef(null);

  // Normalise assigned assets list
  const assetsList = React.useMemo(() => {
    if (Array.isArray(assignedAssets) && assignedAssets.length > 0) {
      return assignedAssets;
    }
    if (asset) return [asset];
    return [];
  }, [assignedAssets, asset]);

  const primaryAsset = asset || assetsList[0] || {};

  // Check if current user is the assigned receiver of this form
  const isAssignedReceiver = React.useMemo(() => {
    if (!currentUser) return false;
    const currentUserId = (currentUser._id || currentUser.id || '').toString();
    const currentUserEmpId = (currentUser.employeeId || '').toString().trim().toLowerCase();
    const currentUsername = (currentUser.username || '').toString().trim().toLowerCase();

    const targetEmp = employee || primaryAsset?.assignedTo;
    const targetId = (targetEmp?._id || targetEmp || '').toString();
    const targetEmpId = (targetEmp?.employeeId || '').toString().trim().toLowerCase();
    const targetUsername = (targetEmp?.username || '').toString().trim().toLowerCase();

    return (
      (targetId && currentUserId && targetId === currentUserId) ||
      (targetEmpId && currentUserEmpId && targetEmpId === currentUserEmpId) ||
      (targetUsername && currentUsername && targetUsername === currentUsername)
    );
  }, [currentUser, employee, primaryAsset]);

  // Check if current user is privileged (Admin, HR) or the assigned receiver to view download/print buttons
  const canDownloadAndPrint = React.useMemo(() => {
    if (isAssignedReceiver) return true;
    if (showActions === false) return false;
    if (currentUser) {
      const roleName = (currentUser.role?.name || (typeof currentUser.role === 'string' ? currentUser.role : '') || '').toString().trim().toLowerCase();
      const hasPerm = Array.isArray(currentUser.role?.permissions) && currentUser.role.permissions.some(
        p => p.module === 'assets' && (p.actions?.includes('create') || p.actions?.includes('update') || p.actions?.includes('delete'))
      );
      return ['admin', 'hr', 'hr manager', 'director', 'super admin'].some(r => roleName === r || roleName.includes(r)) || hasPerm;
    }
    return showActions;
  }, [showActions, currentUser, isAssignedReceiver]);

  const formatAssetCode = (item) => {
    if (!item) return '—';
    if (item.assetId && /^AST\d{3,}$/i.test(item.assetId)) {
      return item.assetId.toUpperCase();
    }
    if (Array.isArray(allAssets) && allAssets.length > 0) {
      const idx = allAssets.findIndex(a => a._id === item._id);
      if (idx !== -1) {
        return `AST${String(idx + 1).padStart(3, '0')}`;
      }
    }
    return item.assetId || '—';
  };

  const formatDisplayDate = (d) => {
    if (!d) return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const empName = employee
    ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.username || '—'
    : '—';
  const empId = employee?.employeeId || (employee?.username ? `@${employee.username}` : '—');
  const empDesignation = employee?.designation || (typeof employee?.role === 'object' ? employee?.role?.name : employee?.role) || '—';
  const empJoiningDate = employee?.joiningDate ? formatDisplayDate(employee.joiningDate) : '—';

  const issuerName = issuer
    ? `${issuer.firstName || ''} ${issuer.lastName || ''}`.trim() || issuer.username || 'Authorized Official'
    : 'Authorized Official';
  const issuerDesignation = issuer?.designation || (typeof issuer?.role === 'object' ? issuer?.role?.name : issuer?.role) || issuer?.department || 'System Administrator';

  const effectiveIssuerSignature = (issuerSignature && issuerSignature.trim() && !issuerSignature.includes('nehamam sign') && !issuerSignature.includes('404'))
    ? (issuerSignature.includes('nehamam') ? '/nehamam_sign.png' : issuerSignature)
    : '/nehamam_sign.png';

  const handoverDate = formatDisplayDate(assignedDate || (isDraft ? new Date() : primaryAsset?.assignedDate));
  const receivedDate = signedAt ? formatDisplayDate(signedAt) : handoverDate;

  // Helper to build dynamic key-value fields per asset based on its type
  const getDynamicAssetFields = (item) => {
    if (!item) return [];
    const type = (item.assetType || 'Laptop').trim();
    const fields = [];

    // Code and Type
    fields.push({ label: 'Asset Code:', value: formatAssetCode(item), isHighlight: true });
    fields.push({ label: 'Asset Type:', value: type });

    if (type === 'SIM') {
      fields.push({ label: 'Telecom Provider:', value: item.telecomProvider || item.brandName || '—', isBold: true });
      fields.push({ label: 'SIM / Phone No:', value: item.simNumber || '—', isBold: true });
      if (item.model) fields.push({ label: 'Plan / Type:', value: item.model });
      fields.push({ label: 'Condition:', value: item.condition || 'Active' });
    } else if (type === 'Mobile' || type === 'Tablet') {
      fields.push({ label: 'Make / Brand:', value: item.brandName || item.assetName || '—', isBold: true });
      fields.push({ label: 'Model:', value: item.model || '—' });
      if (item.colour) fields.push({ label: 'Colour:', value: item.colour });
      if (item.imei1) fields.push({ label: 'IMEI 1:', value: item.imei1 });
      if (item.imei2) fields.push({ label: 'IMEI 2:', value: item.imei2 });
      if (item.deviceId) fields.push({ label: 'Device ID:', value: item.deviceId });
      if (item.serialNumber && !item.imei1) fields.push({ label: 'Serial Number:', value: item.serialNumber });
      fields.push({ label: 'Condition:', value: item.condition || 'Good' });
    } else if (type === 'Desktop' || type === 'Laptop') {
      fields.push({ label: 'Make / Brand:', value: item.brandName || item.assetName || '—', isBold: true });
      fields.push({ label: 'Model:', value: item.model || 'Standard Model' });
      if (item.deviceId) fields.push({ label: 'Device ID:', value: item.deviceId });
      if (item.productId) fields.push({ label: 'Product ID:', value: item.productId });
      if (item.serialNumber) fields.push({ label: 'Serial Number:', value: item.serialNumber });
      if (item.colour) fields.push({ label: 'Colour:', value: item.colour });
      fields.push({ label: 'Condition:', value: item.condition || 'Good' });
    } else {
      // Monitor, Keyboard, Mouse, Laptop charger, Other
      fields.push({ label: 'Make / Brand:', value: item.brandName || item.assetName || '—', isBold: true });
      if (item.model) fields.push({ label: 'Model:', value: item.model });
      if (item.serialNumber) fields.push({ label: 'Serial Number:', value: item.serialNumber });
      if (item.deviceId) fields.push({ label: 'Device ID:', value: item.deviceId });
      if (item.productId) fields.push({ label: 'Product ID:', value: item.productId });
      if (item.colour) fields.push({ label: 'Colour:', value: item.colour });
      fields.push({ label: 'Condition:', value: item.condition || 'Good' });
    }

    if (item.description) {
      fields.push({ label: 'Remarks / Notes:', value: item.description, isFullWidth: true });
    }

    return fields;
  };

  // Helper to build a concise dynamic specifications line for the table
  const getAssetSpecsSnippet = (item) => {
    if (!item) return '';
    const type = (item.assetType || 'Laptop').trim();
    const parts = [];

    if (type === 'SIM') {
      if (item.telecomProvider) parts.push(`Provider: ${item.telecomProvider}`);
      if (item.simNumber) parts.push(`SIM No: ${item.simNumber}`);
      if (item.model) parts.push(`Plan: ${item.model}`);
    } else if (type === 'Mobile' || type === 'Tablet') {
      if (item.model) parts.push(`Model: ${item.model}`);
      if (item.colour) parts.push(`Colour: ${item.colour}`);
      if (item.imei1) parts.push(`IMEI 1: ${item.imei1}`);
      if (item.imei2) parts.push(`IMEI 2: ${item.imei2}`);
      if (item.deviceId) parts.push(`Dev ID: ${item.deviceId}`);
      if (item.serialNumber && !item.imei1) parts.push(`S/N: ${item.serialNumber}`);
    } else if (type === 'Desktop' || type === 'Laptop') {
      if (item.model) parts.push(`Model: ${item.model}`);
      if (item.deviceId) parts.push(`Dev ID: ${item.deviceId}`);
      if (item.productId) parts.push(`Prod ID: ${item.productId}`);
      if (item.serialNumber) parts.push(`S/N: ${item.serialNumber}`);
      if (item.colour) parts.push(`Colour: ${item.colour}`);
    } else {
      if (item.model) parts.push(`Model: ${item.model}`);
      if (item.serialNumber) parts.push(`S/N: ${item.serialNumber}`);
      if (item.deviceId) parts.push(`Dev ID: ${item.deviceId}`);
      if (item.productId) parts.push(`Prod ID: ${item.productId}`);
      if (item.colour) parts.push(`Colour: ${item.colour}`);
    }

    if (item.description) {
      parts.push(`Notes: ${item.description}`);
    }

    return parts.join(' · ');
  };

  // Condition summary
  const conditionVal = assetsList.length === 1
    ? (assetsList[0]?.condition || 'Good')
    : assetsList.map(a => `${a.assetId || a.assetName}: ${a.condition || 'Good'}`).join(', ');

  const remarksSummary = assetsList
    .map(a => a.description)
    .filter(Boolean)
    .join('; ') || 'Issued in good operational condition for official business use.';

  const handlePrint = () => {
    const printContent = formPrintRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Asset Handover Acknowledgement Form - ${primaryAsset?.assetId || 'Document'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
              color: #000;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print { display: none !important; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #000; padding: 4px 6px; font-size: 9.5pt; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPdf = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const target = formPrintRef.current;
      if (!target) return;

      const canvas = await html2canvas(target, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Asset_Handover_${primaryAsset?.assetId || 'Form'}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error generating PDF. Please use the Print button to Save as PDF.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', ...containerStyle }}>
      {/* Informational Banner */}
      {isDraft && (
        <div style={{
          width: '100%',
          maxWidth: '780px',
          margin: '0 0 12px 0',
          padding: '10px 16px',
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 1px 4px rgba(245, 158, 11, 0.08)'
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', background: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0
          }}>
            <Eye size={13} />
          </div>
          <div style={{ fontSize: 11.5, color: '#92400e', lineHeight: 1.4 }}>
            <strong>Official Template Preview (Draft):</strong> Live preview of the Asset Handover Acknowledgement Form populated for <strong>{empName}</strong>. Not officially generated or signed yet.
          </div>
        </div>
      )}

      {/* Action Toolbar (Only for HR, Manager, Admin) */}
      {canDownloadAndPrint && (
        <div style={{
          width: '100%',
          maxWidth: '780px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginBottom: 10
        }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Printer size={13} />
            Print Form
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
              color: '#ffffff',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Download size={13} />
            Download PDF
          </button>
        </div>
      )}

      {/* Official A4 Sheet */}
      <div
        ref={formPrintRef}
        style={{
          width: '100%',
          maxWidth: '780px',
          background: '#ffffff',
          color: '#000000',
          padding: '24px 38px',
          borderRadius: 6,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
          border: '1px solid #d1d5db',
          fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
          fontSize: '11.5px',
          lineHeight: '1.38',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* Draft Watermark Overlay */}
        {isDraft && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 0,
            overflow: 'hidden'
          }}>
            <div style={{
              transform: 'rotate(-32deg)',
              fontSize: '48px',
              fontWeight: 900,
              color: 'rgba(203, 213, 225, 0.35)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              userSelect: 'none'
            }}>
              DRAFT PREVIEW
            </div>
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Top Company Logo */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <img
              src="/logo.png"
              alt="Bhoomi Techzone"
              style={{ height: '36px', maxWidth: '170px', objectFit: 'contain' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>

          {/* Main Title with Underline */}
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <h1 style={{
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#000000',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              margin: '0 0 4px 0'
            }}>
              ASSET HANDOVER ACKNOWLEDGEMENT FORM
            </h1>
            <div style={{ width: '360px', height: '1.5px', background: '#000000', margin: '0 auto' }} />
          </div>

          {/* Section: Employee Details */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#2b6cb0', marginBottom: 4 }}>
              Employee Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 30px' }}>
              <div style={{ display: 'flex' }}>
                <span style={{ minWidth: '130px', color: '#000' }}>Employee Name:</span>
                <strong style={{ color: '#000' }}>{empName}</strong>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ minWidth: '120px', color: '#000' }}>Employee ID:</span>
                <strong style={{ color: '#000' }}>{empId}</strong>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ minWidth: '130px', color: '#000' }}>Designation:</span>
                <span>{empDesignation}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ minWidth: '120px', color: '#000' }}>Date of Joining:</span>
                <span>{empJoiningDate}</span>
              </div>
            </div>
          </div>

          {/* Section: Asset Details (Dynamic per Asset Type and Multiple Assets) */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#2b6cb0' }}>
                Asset Details {assetsList.length > 1 ? `(${assetsList.length} Items Assigned)` : ''}
              </div>
            </div>

            {assetsList.length === 0 ? (
              <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 4, color: '#64748b' }}>
                No asset information available.
              </div>
            ) : assetsList.length === 1 ? (
              // Single Asset Clean Grid
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 30px' }}>
                {getDynamicAssetFields(assetsList[0]).map((f, i) => (
                  <div key={i} style={{ display: 'flex', gridColumn: f.isFullWidth ? '1 / -1' : 'auto' }}>
                    <span style={{ minWidth: '130px', color: '#000' }}>{f.label}</span>
                    {f.isHighlight ? (
                      <strong style={{ color: '#166534', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{f.value}</strong>
                    ) : f.isBold ? (
                      <strong style={{ color: '#000' }}>{f.value}</strong>
                    ) : (
                      <span style={{ color: '#000' }}>{f.value}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // Multiple Assets Stack
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {assetsList.map((item, idx) => {
                  const fields = getDynamicAssetFields(item);
                  const typeLabel = item.assetType || 'Asset';
                  const brandOrName = item.brandName || item.assetName || (typeLabel === 'SIM' ? item.telecomProvider : '');
                  return (
                    <div
                      key={item._id || item.assetId || idx}
                      style={{
                        padding: '6px 10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 4
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingBottom: 3, borderBottom: '1px dashed #cbd5e1' }}>
                        <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '11px' }}>
                          #{idx + 1}. {typeLabel}{brandOrName ? ` (${brandOrName})` : ''}
                        </span>
                        <strong style={{ color: '#166534', fontFamily: 'monospace', fontSize: '11px' }}>
                          {formatAssetCode(item)}
                        </strong>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 20px', fontSize: '11px' }}>
                        {fields.filter(f => f.label !== 'Asset Code:' && f.label !== 'Asset Type:').map((f, i) => (
                          <div key={i} style={{ display: 'flex', gridColumn: f.isFullWidth ? '1 / -1' : 'auto' }}>
                            <span style={{ minWidth: '110px', color: '#334155' }}>{f.label}</span>
                            {f.isBold ? (
                              <strong style={{ color: '#000' }}>{f.value}</strong>
                            ) : (
                              <span style={{ color: '#000' }}>{f.value}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Accessories Issued / Issued Items Table (Dynamic for all assigned assets) */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#2b6cb0', marginBottom: 4, textDecoration: 'underline' }}>
              Accessories & Equipment Issued
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ border: '1px solid #000', padding: '4px 6px', width: '40px', textAlign: 'center', fontWeight: 'bold' }}>S.No</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px', width: '120px', fontWeight: 'bold' }}>Asset Code</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px', fontWeight: 'bold' }}>Item Description & Dynamic Specifications</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px', width: '85px', textAlign: 'center', fontWeight: 'bold' }}>Condition</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px', width: '60px', textAlign: 'center', fontWeight: 'bold' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {assetsList.map((item, idx) => {
                  const specsSnippet = getAssetSpecsSnippet(item);
                  const brandOrName = item.brandName || item.assetName || (item.assetType === 'SIM' ? item.telecomProvider : '');
                  return (
                    <tr key={item._id || item.assetId || idx}>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>
                        <strong style={{ color: '#166534', fontFamily: 'monospace' }}>{formatAssetCode(item)}</strong>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>
                        <div>
                          <strong style={{ color: '#0f172a' }}>{item.assetType || 'Asset'}{brandOrName ? ` (${brandOrName})` : ''}</strong>
                        </div>
                        {specsSnippet && (
                          <div style={{ fontSize: '10px', color: '#334155', marginTop: 1 }}>
                            {specsSnippet}
                          </div>
                        )}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                        {item.condition || 'Good'}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>1</td>
                    </tr>
                  );
                })}

                {/* Additional Standard Peripherals when computer is assigned without standalone peripheral asset */}
                {(() => {
                  const hasComputer = assetsList.some(a => ['Laptop', 'Desktop'].includes(a.assetType));
                  const hasChargerAsset = assetsList.some(a => a.assetType === 'Laptop charger');
                  const extraRows = [];

                  if (hasComputer && !hasChargerAsset) {
                    extraRows.push({
                      tag: 'Standard Accessory',
                      title: 'Charger & Power Adapter',
                      desc: 'Original OEM Power Cable & Adapter',
                      cond: 'Good',
                      qty: 1
                    });
                  }

                  return extraRows.map((extra, exIdx) => (
                    <tr key={`extra-${exIdx}`}>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                        {assetsList.length + exIdx + 1}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', color: '#64748b', fontSize: '10px' }}>
                        {extra.tag}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>
                        <strong style={{ color: '#0f172a' }}>{extra.title}</strong>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: 1 }}>{extra.desc}</div>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                        {extra.cond}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>
                        {extra.qty}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {/* Section: Condition of Equipment at the Time of Handover */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#2b6cb0', marginBottom: 3 }}>
              Condition of Equipment at the Time of Handover
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: 2 }}>
              <strong>✓ {conditionVal}</strong>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ minWidth: '70px', color: '#000' }}>Remarks:</span>
              <span>{remarksSummary}</span>
            </div>
          </div>

          {/* Section: Employee Undertaking */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#2b6cb0', marginBottom: 3 }}>
              Employee Undertaking
            </div>
            <p style={{ margin: 0, fontSize: '11px', lineHeight: '1.4', color: '#000', textAlign: 'justify' }}>
              I acknowledge receipt of the above-mentioned company asset(s), equipment, and accessories in good working condition. I undertake to use them responsibly for official business purposes, report any loss or damage immediately, and return all assigned items upon separation from the company or when requested.
            </p>
          </div>

          {/* Section: Handover Details */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#2b6cb0', marginBottom: 3 }}>
              Handover Details
            </div>
            <div style={{ display: 'flex', gap: '40px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span>Date of Handover:</span>
                <strong>{handoverDate}</strong>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span>Place:</span>
                <strong>NOIDA</strong>
              </div>
            </div>
          </div>

          {/* Section: Signatures Table */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#2b6cb0', marginBottom: 4 }}>
              Signatures
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', padding: '4px 8px', width: '50%', textAlign: 'left', fontWeight: 'bold' }}>
                    Issued By
                  </th>
                  <th style={{ border: '1px solid #000', padding: '4px 8px', width: '50%', textAlign: 'left', fontWeight: 'bold' }}>
                    Received By
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
                    <span style={{ display: 'inline-block', width: '85px' }}>Name:</span>
                    <strong>{issuerName}</strong>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
                    <span style={{ display: 'inline-block', width: '90px' }}>Name:</span>
                    <strong>{empName}</strong>
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
                    <span style={{ display: 'inline-block', width: '85px' }}>Designation:</span>
                    <span>{issuerDesignation}</span>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
                    <span style={{ display: 'inline-block', width: '90px' }}>Employee ID:</span>
                    <span>{empId}</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '4px 8px', height: '68px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ minWidth: '80px', fontSize: '11px', fontWeight: '600' }}>Signature:</span>
                      {effectiveIssuerSignature ? (
                        <SignatureDisplay
                          src={effectiveIssuerSignature}
                          alt="Issuer Signature"
                          maxHeight={60}
                          maxWidth={220}
                          onError={(e) => {
                            if (!e.currentTarget.dataset.retried) {
                              e.currentTarget.dataset.retried = 'true';
                              e.currentTarget.src = (process.env.PUBLIC_URL || '') + '/nehamam_sign.png';
                            }
                          }}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '4px 8px', height: '68px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ minWidth: '85px', fontSize: '11px', fontWeight: '600' }}>Signature:</span>
                      {receiverSignature ? (
                        <SignatureDisplay
                          src={receiverSignature}
                          alt="Receiver Signature"
                          maxHeight={60}
                          maxWidth={220}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
                    <span style={{ display: 'inline-block', width: '85px' }}>Date:</span>
                    <span>{handoverDate}</span>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
                    <span style={{ display: 'inline-block', width: '90px' }}>Date:</span>
                    <span>{receivedDate}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section: For Office Use Only */}
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#2b6cb0', marginBottom: 3 }}>
              For Office Use Only
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ minWidth: '190px' }}>Asset Entry Updated in Register:</span>
                <strong>Yes</strong>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ minWidth: '190px' }}>Verified By:</span>
                <strong>Neha Bano</strong>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ minWidth: '190px' }}>Designation:</span>
                <span>Branch Head</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetAcknowledgmentForm;
