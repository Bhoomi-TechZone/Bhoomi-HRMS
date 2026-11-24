import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import {
    RefreshCw,
    ExternalLink,
    X,
    Send,
    Plus,
    AlertCircle
} from 'lucide-react';
import './DealWhatsAppChat.css';

// Professional Crisp WhatsApp SVG Icon
const WhatsAppIcon = ({ size = 18, color = "#25D366" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ color, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.53 1.77.781 2.8.781 3.182 0 5.768-2.587 5.768-5.766.001-3.181-2.585-5.767-5.772-5.772zm3.364 8.163c-.14.394-.715.728-1.026.77-.312.042-.716.082-2.146-.508-1.721-.71-2.83-2.476-2.916-2.59-.086-.114-.689-.918-.689-1.752 0-.834.437-1.246.592-1.417.156-.171.341-.214.455-.214.114 0 .228.001.328.006.105.005.245-.039.384.294.142.341.485 1.18.528 1.266.043.086.071.186.014.3-.057.114-.085.186-.17.286-.086.1-.18.223-.257.3-.086.086-.176.179-.076.35.1.171.444.733.953 1.186.655.584 1.207.765 1.378.851.171.086.271.071.371-.043.1-.114.428-.499.542-.67.114-.171.228-.143.385-.086.157.057.998.471 1.169.557.171.086.285.128.328.2.043.072.043.414-.097.808zM12.012 2c-5.506 0-9.985 4.479-9.985 9.985 0 1.761.458 3.483 1.332 5.006L2 22l5.163-1.319a9.925 9.925 0 004.849 1.304c5.506 0 9.988-4.479 9.988-9.985 0-5.506-4.482-10-9.988-10z" />
    </svg>
);

// Crisp Delivery Status Checkmarks
const StatusTicks = ({ status }) => {
    const isRead = status === 'read';
    const isDelivered = status === 'delivered';
    const isSent = status === 'sent';

    if (isRead || isDelivered) {
        return (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={isRead ? "#34b7f1" : "#94a3b8"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <path d="M18 6L7 17l-5-5" />
                <path d="M22 10l-7.5 7.5L13 16" />
            </svg>
        );
    }
    if (isSent) {
        return (
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                <path d="M20 6L9 17l-5-5" />
            </svg>
        );
    }
    return null;
};

export default function DealWhatsAppChat({
    deal,
    contact,
    currentUser,
    isAdmin = true
}) {
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [data, setData] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');

    // Modal state for connecting/mapping
    const [showModal, setShowModal] = useState(false);
    const [modalPhoneNumber, setModalPhoneNumber] = useState('');
    const [availableNumbers, setAvailableNumbers] = useState([]);
    const [selectedOption, setSelectedOption] = useState('custom');
    const [loadingNumbers, setLoadingNumbers] = useState(false);
    const [savingConnection, setSavingConnection] = useState(false);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Fetch available company WhatsApp numbers from backend/Meta
    const fetchCompanyNumbers = useCallback(async () => {
        try {
            setLoadingNumbers(true);
            const res = await api.get('/whatsapp/company-numbers');
            if (res.data?.success && Array.isArray(res.data.numbers)) {
                setAvailableNumbers(res.data.numbers);
            }
        } catch (err) {
            console.warn('Could not fetch company numbers:', err.message);
        } finally {
            setLoadingNumbers(false);
        }
    }, []);

    // 1. Fetch Real Deal Conversation & Mapped Number
    const fetchConversation = useCallback(async () => {
        if (!deal?._id && !deal?.id) return;
        const dealId = deal._id || deal.id;

        try {
            setLoading(true);
            const res = await api.get(`/whatsapp/conversations/${dealId}`);
            if (res.data?.success && res.data?.data) {
                setData(res.data.data);
                setMessages(res.data.data.messages || []);
                if (res.data.data.connection?.displayPhoneNumber) {
                    setModalPhoneNumber(res.data.data.connection.displayPhoneNumber);
                    setSelectedOption(res.data.data.connection.displayPhoneNumber);
                }
            }
        } catch (err) {
            console.warn('Could not fetch WhatsApp conversation:', err.message);
            const dealOwnerName = deal.salesOwner || (deal.assignedTo?.firstName ? `${deal.assignedTo.firstName} ${deal.assignedTo.lastName || ''}`.trim() : 'Salesperson');
            const customerPhone = deal.phone || contact?.phone || '';
            const clientName = deal.clientName || deal.dealName || 'Customer';

            setData({
                deal: { id: dealId, clientName, dealName: deal.dealName },
                dealOwner: { name: dealOwnerName, email: deal.assignedTo?.email || '' },
                customer: { name: clientName, phone: customerPhone },
                connection: null,
                messages: []
            });
            setMessages([]);
        } finally {
            setLoading(false);
            setTimeout(scrollToBottom, 100);
        }
    }, [deal, contact]);

    useEffect(() => {
        if (!isAdmin) return;
        fetchConversation();
        fetchCompanyNumbers();
    }, [isAdmin, fetchConversation, fetchCompanyNumbers]);

    // Socket.IO real-time listener
    useEffect(() => {
        if (!isAdmin) return;
        const handleNewMessage = (msg) => {
            const currentDealId = String(deal?._id || deal?.id || '');
            if (msg.associatedDeal && String(msg.associatedDeal) === currentDealId) {
                setMessages(prev => {
                    if (prev.some(m => m.wamid === msg.wamid)) return prev;
                    return [...prev, msg];
                });
                setTimeout(scrollToBottom, 100);
            }
        };

        if (window.socket) {
            window.socket.on('whatsapp:new_message', handleNewMessage);
            return () => {
                window.socket.off('whatsapp:new_message', handleNewMessage);
            };
        }
    }, [deal]);

    // 2. Send Real WhatsApp message
    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        const textToSend = inputText.trim();
        if (!textToSend || sending) return;

        const dealId = deal?._id || deal?.id;
        const convId = data?.conversation?.id || data?.conversation?._id;
        const recipientPhone = data?.customer?.phone || deal?.phone || contact?.phone;

        try {
            setSending(true);
            const res = await api.post('/whatsapp/messages/send', {
                dealId,
                conversationId: convId,
                text: textToSend,
                recipientPhone
            });

            if (res.data?.success && res.data?.data) {
                setMessages(prev => [...prev, res.data.data]);
                setInputText('');
                setTimeout(scrollToBottom, 100);
            }
        } catch (err) {
            alert('Failed to send message: ' + (err.response?.data?.message || err.message));
        } finally {
            setSending(false);
        }
    };

    // 3. Save connection mapping for this Deal Owner
    const handleSaveConnection = async () => {
        if (!modalPhoneNumber.trim()) {
            alert('Please select or enter the company-assigned WhatsApp Business number.');
            return;
        }

        try {
            setSavingConnection(true);
            const ownerName = data?.dealOwner?.name || deal?.salesOwner || 'Salesperson';
            const dealId = deal?._id || deal?.id;

            const res = await api.post('/whatsapp/verify-and-connect', {
                displayPhoneNumber: modalPhoneNumber.trim(),
                employeeId: data?.dealOwner?.id || currentUser?._id,
                employeeName: ownerName,
                dealId
            });

            if (res.data?.success) {
                setShowModal(false);
                fetchConversation();
            } else {
                alert(res.data?.message || 'Failed to verify WhatsApp number');
            }
        } catch (err) {
            alert('Could not connect number: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingConnection(false);
        }
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const clientName = deal?.clientName || deal?.dealName || data?.customer?.name || 'Customer';
    const dealOwnerName = data?.dealOwner?.name || deal?.salesOwner || 'Salesperson';
    const customerPhone = data?.customer?.phone || deal?.phone || contact?.phone || '';
    const isConnected = Boolean(data?.connection && data.connection.status === 'connected');
    const salespersonPhone = isConnected ? data.connection.displayPhoneNumber : '';

    if (!isAdmin) {
        return (
            <div style={{
                padding: '60px 20px',
                textAlign: 'center',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }}>
                <h4 style={{
                    margin: '0 0 6px',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#475569',
                    letterSpacing: '-0.01em'
                }}>
                    This feature is temporarily unavailable
                </h4>
                <p style={{
                    margin: 0,
                    fontSize: '12.5px',
                    color: '#94a3b8',
                    lineHeight: 1.5
                }}>
                    Please contact your system administrator for assistance.
                </p>
            </div>
        );
    }

    return (
        <div className="wa-minimal-card">
            {/* 1. Sleek, Minimal Single Header */}
            <div className="wa-minimal-header">
                <div className="wa-header-left">
                    <div className="wa-avatar-wrap">
                        <WhatsAppIcon size={20} color={isConnected ? "#25D366" : "#64748b"} />
                    </div>
                    <div className="wa-header-meta">
                        <div className="wa-header-title-row">
                            <span className="wa-client-name">{clientName}</span>
                            {isConnected ? (
                                <span className="wa-pill connected">
                                    <span className="wa-dot" /> Connected
                                </span>
                            ) : (
                                <span className="wa-pill disconnected">Not Connected</span>
                            )}
                        </div>
                        <div className="wa-header-sub">
                            <span>Owner: <strong>{dealOwnerName}</strong></span>
                            <span className="wa-dot-sep">•</span>
                            <span>Customer: <strong>{customerPhone || 'N/A'}</strong></span>
                            {isConnected && (
                                <>
                                    <span className="wa-dot-sep">•</span>
                                    <span className="wa-number-badge">{salespersonPhone}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="wa-header-actions">
                    {isConnected ? (
                        <>
                            <button className="wa-icon-btn" onClick={fetchConversation} title="Refresh messages">
                                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                            </button>
                            <button className="wa-btn-subtle" onClick={() => setShowModal(true)}>
                                Settings
                            </button>
                            {customerPhone && (
                                <a
                                    href={`https://wa.me/${String(customerPhone).replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="wa-btn-subtle"
                                    title="Open WhatsApp Web"
                                >
                                    <ExternalLink size={12} />
                                    <span>Web</span>
                                </a>
                            )}
                        </>
                    ) : (
                        <button className="wa-btn-connect-sm" onClick={() => setShowModal(true)}>
                            <Plus size={13} />
                            <span>Connect WhatsApp</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Main Body: Professional Minimalist View */}
            {!isConnected ? (
                /* Elegant "Not Connected" Hero */
                <div className="wa-not-connected-hero">
                    <div className="wa-nc-visual">
                        <div className="wa-nc-icon-badge">
                            <WhatsAppIcon size={34} color="#25D366" />
                        </div>
                    </div>

                    <h3 className="wa-nc-heading">Connect WhatsApp for {dealOwnerName}</h3>
                    <p className="wa-nc-subtext">
                        Connect <strong>{dealOwnerName}</strong>'s assigned company WhatsApp Business number to chat directly with <strong>{clientName}</strong> ({customerPhone || 'Customer'}).
                    </p>

                    <button className="wa-primary-cta" onClick={() => setShowModal(true)}>
                        <WhatsAppIcon size={16} color="#ffffff" />
                        <span>Connect to WhatsApp</span>
                    </button>

                    <div className="wa-nc-features">
                        <span>✓ Meta Cloud API</span>
                        <span>•</span>
                        <span>✓ CRM Deal Tracking</span>
                        <span>•</span>
                        <span>✓ Direct Chat</span>
                    </div>
                </div>
            ) : (
                /* Connected Message Feed & Composer */
                <>
                    <div className="wa-chat-feed">
                        {loading ? (
                            <div className="wa-empty-chat">
                                <RefreshCw size={18} className="animate-spin" />
                                <span>Loading conversation...</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="wa-empty-chat">
                                <WhatsAppIcon size={30} color="#cbd5e1" />
                                <strong style={{ color: '#475569' }}>No messages yet</strong>
                                <p style={{ margin: 0, fontSize: 12 }}>
                                    Type below to start chatting with {clientName} via {dealOwnerName}'s WhatsApp ({salespersonPhone}).
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="wa-date-pill">Today</div>
                                {messages.map((m, idx) => {
                                    const isOutbound = m.direction === 'outbound';
                                    return (
                                        <div key={m.wamid || m._id || idx} className={`wa-row ${isOutbound ? 'outbound' : 'inbound'}`}>
                                            <div className={`wa-bubble ${isOutbound ? 'outbound' : 'inbound'}`}>
                                                <div className="wa-msg-text">{m.text}</div>
                                                <div className="wa-msg-meta">
                                                    <span>{formatTime(m.timestamp)}</span>
                                                    {isOutbound && <StatusTicks status={m.status} />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="wa-composer-wrap" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            className="wa-composer-input"
                            placeholder={`Message ${clientName}...`}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            className="wa-send-btn"
                            disabled={!inputText.trim() || sending}
                            title="Send WhatsApp message"
                        >
                            {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                        </button>
                    </form>
                </>
            )}

            {/* 3. Minimal Clean Connect Modal */}
            {showModal && (
                <div className="wa-modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="wa-modal-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="wa-modal-header">
                            <div>
                                <h4 className="wa-modal-title">Connect WhatsApp Business Account</h4>
                                <div className="wa-modal-sub">Link your company-assigned WhatsApp number to chat with clients</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="wa-modal-body">
                            <div className="wa-form-field">
                                <label className="wa-field-label">Salesperson / Deal Owner</label>
                                <input
                                    type="text"
                                    className="wa-field-input"
                                    value={dealOwnerName}
                                    disabled
                                    style={{ background: '#f8fafc', color: '#64748b' }}
                                />
                            </div>

                            {/* Number Input Field - ALWAYS visible and directly editable */}
                            <div className="wa-form-field">
                                <label className="wa-field-label">Company WhatsApp Number</label>
                                <input
                                    type="text"
                                    className="wa-field-input"
                                    placeholder="+91 98765 43210"
                                    value={modalPhoneNumber}
                                    onChange={(e) => setModalPhoneNumber(e.target.value)}
                                    autoFocus
                                />
                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                    Type your company-provided WhatsApp number with country code (e.g. +91 98765 43210)
                                </span>
                            </div>

                            {/* Optional quick-select if company numbers exist */}
                            {availableNumbers.length > 0 && (
                                <div className="wa-form-field">
                                    <label className="wa-field-label" style={{ color: '#64748b', fontSize: 11.5 }}>
                                        Or pick from registered company numbers:
                                    </label>
                                    <select
                                        className="wa-field-select"
                                        value={modalPhoneNumber}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setModalPhoneNumber(e.target.value);
                                            }
                                        }}
                                    >
                                        <option value="">-- Choose from registered numbers --</option>
                                        {availableNumbers.map((num) => (
                                            <option key={num.id || num.phoneNumberId} value={num.displayPhoneNumber}>
                                                {num.displayPhoneNumber} {num.verifiedName ? `(${num.verifiedName})` : ''} {num.assignedTo ? `— Assigned: ${num.assignedTo}` : '— [Available]'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Automatic Verification Note */}
                            <div className="wa-auto-verify-box">
                                <span className="wa-auto-verify-icon">✓</span>
                                <div>
                                    <strong>Automatic Meta Verification:</strong> Simply enter your company WhatsApp number. The system verifies and connects it with Meta Cloud API automatically — no Phone Number ID or WABA ID needed.
                                </div>
                            </div>
                        </div>

                        <div className="wa-modal-footer">
                            <button
                                type="button"
                                className="wa-btn-subtle"
                                onClick={() => setShowModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="wa-btn-connect-sm"
                                onClick={handleSaveConnection}
                                disabled={savingConnection || !modalPhoneNumber.trim()}
                            >
                                {savingConnection ? (
                                    <>
                                        <RefreshCw size={12} className="animate-spin" />
                                        <span>Verifying & Connecting...</span>
                                    </>
                                ) : (
                                    <span>Verify & Connect Number</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
