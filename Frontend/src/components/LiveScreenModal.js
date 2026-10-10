import React, { useState, useEffect, useRef } from 'react';
import { X, Video, VideoOff, Loader, Maximize2, Minimize2 } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../api/axios';

const LiveScreenModal = ({ employeeId, employeeName, onClose }) => {
  const [streamActive, setStreamActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);

  const [sessionId, setSessionId] = useState(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Error entering fullscreen:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error("Error exiting fullscreen:", err);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleStopAndClose = () => {
    if (socketRef.current && sessionId) {
      console.log("[MONITORING] Emitting monitoring:stop for session:", sessionId);
      socketRef.current.emit('monitoring:stop', { sessionId });
    }
    onClose();
  };

  useEffect(() => {
    let socket;
    let currentSessionId = null;
    const token = localStorage.getItem('token');

    if (token) {
      const apiUrl = process.env.REACT_APP_API_URL;
      const defaultSocketUrl = apiUrl.replace('/api', '');
      socket = io(process.env.REACT_APP_SOCKET_URL || defaultSocketUrl, {
        auth: { token },
        path: '/socket.io',
        transports: ['websocket'],   // Skip polling → avoids "WebSocket closed before connection" error
        upgrade: false,              // Already on WebSocket, no upgrade needed
        reconnectionAttempts: 3,
        timeout: 10000
      });
      socketRef.current = socket;

      // 1. Wait for socket to connect, THEN initiate Request via API
      const initiateRequest = () => {
        console.log('[MONITORING] Socket connected, requesting live stream...');
        api.post('/monitoring/request', { employeeId })
          .then(res => {
            currentSessionId = res.data.sessionId;
            setSessionId(currentSessionId);
            console.log(`[MONITORING] Requested employee ${employeeId}, session ${currentSessionId}`);
          })
          .catch(err => {
            setLoading(false);
            setError(err.response?.data?.message || 'Failed to request monitoring.');
            console.error('[MONITORING] Request failed:', err);
          });
      };

      if (socket.connected) {
        initiateRequest();
      } else {
        socket.on('connect', initiateRequest);
      }

      // 2. Listen to Signaling Events
      socket.on('monitoring:error', (data) => {
        if (data.sessionId !== currentSessionId) return;
        setLoading(false);
        let msg = data.message || 'An error occurred with the monitoring session.';
        if (msg.includes('RTCPeerConnection') || msg.includes('addTrack') || msg.includes('signalingState') || msg.includes('closed')) {
          msg = 'Live stream connection timed out. Please try again.';
        }
        setError(msg);
      });

      socket.on('monitoring:stopped', (data) => {
        if (data.sessionId !== currentSessionId) return;
        setLoading(false);
        setStreamActive(false);
        setError('The monitoring session was stopped.');
      });

      socket.on('webrtc:offer', async (data) => {
        if (data.sessionId !== currentSessionId) return;
        console.log('[WEBRTC] Offer received');

        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443?transport=tcp',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ],
          iceCandidatePoolSize: 10
        });
        peerConnectionRef.current = peerConnection;

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc:ice-candidate', {
              sessionId: currentSessionId,
              candidate: event.candidate
            });
          }
        };

        peerConnection.ontrack = (event) => {
          console.log('[WEBRTC] Remote stream received');
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setStreamActive(true);
            setLoading(false);
          }
        };

        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection.connectionState;
          console.log('[WEBRTC] Connection state:', state);
          if (state === 'connected') {
            // Clear any previous transient error
            setError(null);
            setStreamActive(true);
          } else if (state === 'failed' || state === 'closed') {
            // These are truly fatal — give up
            setStreamActive(false);
            setError('WebRTC disconnected');
          }
          // 'disconnected' is transient — browser will try to recover automatically
          // 'connecting' and 'new' are normal startup states — ignore
        };

        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));

          // Flush queued ICE candidates (skip end-of-candidates markers)
          if (peerConnection.iceQueue) {
            for (const cand of peerConnection.iceQueue) {
              if (cand && cand.candidate && cand.candidate !== '') {
                try {
                  await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.warn('[WEBRTC] Skipping queued ICE candidate:', e.message);
                }
              }
            }
            peerConnection.iceQueue = [];
          }

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          socket.emit('webrtc:answer', {
            sessionId: currentSessionId,
            sdp: answer
          });
          console.log('[WEBRTC] Answer created and sent');
        } catch (err) {
          console.error('[WEBRTC] Error handling offer:', err);
          if (!streamActive) {
            setError('Failed to establish connection.');
            setLoading(false);
          }
        }
      });

      socket.on('webrtc:ice-candidate', async (data) => {
        if (data.sessionId !== currentSessionId || !peerConnectionRef.current) return;
        const pc = peerConnectionRef.current;
        // Skip end-of-candidates markers (candidate is null, undefined, or empty string)
        if (!data.candidate || !data.candidate.candidate || data.candidate.candidate === '') {
          console.log('[WEBRTC] End-of-candidates marker, ignoring.');
          return;
        }
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('[WEBRTC] ICE candidate added');
          } catch (err) {
            console.warn('[WEBRTC] Skipping ICE candidate:', err.message);
          }
        } else {
          console.log('[WEBRTC] Queueing ICE candidate (remote description not set)');
          if (!pc.iceQueue) pc.iceQueue = [];
          pc.iceQueue.push(data.candidate);
        }
      });
    }

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (socket) {
        if (currentSessionId) {
          socket.emit('monitoring:stop', { sessionId: currentSessionId });
        }
        setTimeout(() => {
          try {
            socket.close();
          } catch (e) { }
        }, 100);
      }
    };
  }, [employeeId]);

  const [policyInfo, setPolicyInfo] = useState(null);

  useEffect(() => {
    // Fetch enforcement status for this employee
    api.get(`/employees`)
      .then(res => {
        const emp = res.data.find(e => e.employeeId === employeeId || e._id === employeeId);
        if (emp) {
          api.get('/access-policies')
            .then(pRes => {
              // Find active policy for employee
              api.get(`/access-policies/violations?employeeId=${emp._id}&limit=50`)
                .then(vRes => {
                  const today = new Date().toDateString();
                  const violationsToday = (vRes.data.violations || []).filter(v => new Date(v.timestamp).toDateString() === today).length;
                  setPolicyInfo({
                    violationsToday
                  });
                }).catch(() => { });
            }).catch(() => { });
        }
      }).catch(() => { });
  }, [employeeId]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease-out' }}>
      <div ref={containerRef} style={{ background: '#ffffff', borderRadius: isFullscreen ? '0px' : '12px', border: isFullscreen ? 'none' : '1px solid #e2e8f0', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', width: '100%', maxWidth: isFullscreen ? '100vw' : '960px', height: isFullscreen ? '100vh' : 'auto', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Video size={18} style={{ color: streamActive ? '#10b981' : '#64748b' }} />
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>
              Live Screen: <span style={{ fontWeight: '700' }}>{employeeName}</span> ({employeeId})
            </h2>
            {streamActive && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', background: '#f0fdf4', color: '#16a34a', fontSize: '10px', fontWeight: '600', border: '1px solid #dcfce7', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'actPulse 1.8s ease-in-out infinite' }} />
                LIVE
              </span>
            )}

            {/* Policy & Enforcement HUD */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
              <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: '6px', fontWeight: '600' }}>
                App: ACTIVE
              </span>
              <span style={{ fontSize: '11px', background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: '6px', fontWeight: '600' }}>
                Web: ACTIVE
              </span>
              {policyInfo?.violationsToday !== undefined && (
                <span style={{ fontSize: '11px', background: policyInfo.violationsToday > 0 ? '#fee2e2' : '#f1f5f9', color: policyInfo.violationsToday > 0 ? '#b91c1c' : '#475569', padding: '2px 7px', borderRadius: '6px', fontWeight: '600' }}>
                  Blocked Today: {policyInfo.violationsToday}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {streamActive && (
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                style={{ background: '#e2e8f0', border: 'none', cursor: 'pointer', color: '#475569', width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                onMouseLeave={e => e.currentTarget.style.background = '#e2e8f0'}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
            <button
              onClick={handleStopAndClose}
              title="Close"
              style={{ background: '#e2e8f0', border: 'none', cursor: 'pointer', color: '#475569', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
              onMouseLeave={e => e.currentTarget.style.background = '#e2e8f0'}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div style={{ position: 'relative', width: '100%', flex: isFullscreen ? '1' : 'none', aspectRatio: isFullscreen ? 'auto' : '16/9', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>

          {loading && !error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8' }}>
              <Loader size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
              <span style={{ fontSize: '13px', fontWeight: '500' }}>Requesting live feed from employee...</span>
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#ef4444' }}>
              <VideoOff size={40} style={{ marginBottom: '12px', opacity: 0.8 }} />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>{error}</span>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>The employee might be offline or the agent is not streaming.</span>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            disablePictureInPicture
            controlsList="nopictureinpicture noaudio nodownload noremoteplayback"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              imageRendering: '-webkit-optimize-contrast',
              display: (streamActive && !error) ? 'block' : 'none'
            }}
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button
            onClick={handleStopAndClose}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '8px 24px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
            onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
          >
            <VideoOff size={16} />
            Stop Viewing
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveScreenModal;
