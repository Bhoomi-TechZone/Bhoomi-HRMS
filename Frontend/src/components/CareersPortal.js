import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Briefcase, MapPin, Clock, Calendar, Search, ArrowRight, ArrowLeft, ArrowUpRight,
    Sparkles, Check, ChevronDown, Eye, Share2, Filter,
    Layers, Building2, UserCheck, Shield, ExternalLink, X,
    FileText, CheckCircle2, ChevronRight, HelpCircle, HeartHandshake,
    Globe, Award, Zap, Compass, Send, Copy, Mail, Phone, Code2, Laptop,
    TrendingUp, Users, CheckSquare, MessageCircle, CheckCheck, Bookmark,
    Linkedin, Twitter
} from 'lucide-react';
import api from '../api/axios';

// Department color system with vibrant, soft pastel backgrounds & solid text
const getDeptBadgeStyle = (dept = '') => {
    const d = dept.toLowerCase();
    if (d.includes('market') || d.includes('creative') || d.includes('video') || d.includes('graphic') || d.includes('media')) {
        return { bg: '#fdf4ff', color: '#9333ea', border: '#f0abfc', dot: '#c084fc', label: 'Marketing & Creative' };
    }
    if (d.includes('dev') || d.includes('eng') || d.includes('tech') || d.includes('code') || d.includes('software') || d.includes('mern') || d.includes('stack') || d.includes('full')) {
        return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#60a5fa', label: 'Engineering' };
    }
    if (d.includes('sale') || d.includes('biz') || d.includes('growth') || d.includes('client') || d.includes('account')) {
        return { bg: '#fffbeb', color: '#b45309', border: '#fde68a', dot: '#f59e0b', label: 'Sales & Growth' };
    }
    if (d.includes('hr') || d.includes('people') || d.includes('talent') || d.includes('operat') || d.includes('admin')) {
        return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#4ade80', label: 'People & Ops' };
    }
    if (d.includes('design') || d.includes('ui') || d.includes('ux') || d.includes('product')) {
        return { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3', dot: '#fb7185', label: 'Product Design' };
    }
    if (d.includes('finan') || d.includes('account') || d.includes('pay')) {
        return { bg: '#f0f9ff', color: '#0284c7', border: '#bae6fd', dot: '#38bdf8', label: 'Finance' };
    }
    return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', dot: '#94a3b8', label: dept || 'General' };
};

// Employment Type color system
const getTypeBadgeStyle = (type = 'Full-time') => {
    switch (type) {
        case 'Full-time':
            return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
        case 'Part-time':
            return { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' };
        case 'Contract':
            return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
        case 'Internship':
            return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
        default:
            return { bg: '#f1f5f9', color: '#334155', border: '#e2e8f0' };
    }
};

const PORTAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;}
:root{
  --ink:#090d16;--ink2:#1e293b;--muted:#64748b;--subtle:#94a3b8;
  --border:#e2e8f0;--border2:#f1f5f9;--border-hover:#cbd5e1;
  --accent:#16a34a;--accent-light:#f0fdf4;--accent-mid:#22c55e;--accent-dark:#15803d;
  --surface:#ffffff;--bg:#f8fafc;
  --font:'Plus Jakarta Sans','Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  --shadow-xs:0 1px 2px rgba(0,0,0,.03);
  --shadow-sm:0 2px 5px rgba(0,0,0,.04),0 1px 2px rgba(0,0,0,.02);
  --shadow-md:0 10px 25px -3px rgba(15,23,42,.06),0 4px 6px -2px rgba(15,23,42,.03);
  --shadow-hover:0 16px 36px -4px rgba(15,23,42,.09),0 6px 12px -2px rgba(15,23,42,.04);
  --shadow-lg:0 24px 48px -8px rgba(15,23,42,.12);
}
.c-portal-root{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);font-family:var(--font);color:var(--ink);-webkit-font-smoothing:antialiased;}

/* Navigation */
.c-nav{
  height:64px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:0 36px;
  background:#ffffff;
  position:sticky;
  top:0;
  z-index:50;
  border-bottom:1px solid #e8f5e9;
  box-shadow:0 2px 12px rgba(22,163,74,.06), 0 1px 3px rgba(0,0,0,.03);
}
.c-nav::after{
  content:'';
  position:absolute;
  bottom:0;
  left:0;
  right:0;
  height:2.5px;
  background:linear-gradient(90deg,#22c55e 0%,#16a34a 35%,#4ade80 70%,#22c55e 100%);
}
.c-nav-brand{
  display:flex;
  align-items:center;
  gap:10px;
  text-decoration:none;
  cursor:pointer;
  min-width:0;
}
.c-nav-logo{
  width:36px;
  height:36px;
  border-radius:10px;
  background:#f0fdf4;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  flex-shrink:0;
  box-shadow:0 0 0 1px #bbf7d0, 0 2px 6px rgba(22,163,74,.1);
  transition:transform .2s ease, box-shadow .2s ease;
}
.c-nav-brand:hover .c-nav-logo{
  transform:scale(1.04);
}
.c-nav-logo img{width:100%;height:100%;object-fit:contain;}
.c-nav-name{
  font-size:15px;
  font-weight:800;
  color:#14532d;
  letter-spacing:-0.03em;
  line-height:1.15;
  white-space:nowrap;
}
.c-nav-sub{
  font-size:10px;
  color:#6b7280;
  font-weight:600;
  letter-spacing:0.04em;
  text-transform:uppercase;
  margin-top:1px;
  white-space:nowrap;
}
.c-nav-actions{display:flex;align-items:center;gap:10px;flex-shrink:0;}
.c-nav-open-count{
  display:inline-flex;
  align-items:center;
  gap:5px;
  font-size:11px;
  font-weight:700;
  color:#15803d;
  background:#f0fdf4;
  border:1px solid #bbf7d0;
  padding:3px 10px;
  border-radius:9999px;
  white-space:nowrap;
}
.c-nav-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#16a34a;
  animation:cPulseGreen 2s ease-in-out infinite;
}
.c-nav-count-text-short{display:none;}
.c-nav-btn-text-short{display:none;}
.c-nav-open-count {
  box-shadow: none !important;
}
.c-nav-visit-btn{
  display:inline-flex;
  align-items:center;
  gap:5px;
  padding:6.5px 14px;
  border-radius:9999px;
  background:#16a34a;
  color:#ffffff;
  border:none;
  font-size:12px;
  font-weight:700;
  text-decoration:none;
  transition:background .18s ease;
  white-space:nowrap;
  cursor:pointer;
  font-family:inherit;
  box-shadow:none !important;
}
.c-nav-visit-btn:hover{
  background:#15803d;
  color:#ffffff;
  box-shadow:none !important;
}
@keyframes cPulseGreen{
  0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0);}
  50%{box-shadow:0 0 0 4px rgba(74,222,128,0.22);}
}
.c-btn-outline{
  padding:7px 15px;
  border-radius:9999px;
  border:1.5px solid #16a34a;
  background:#ffffff;
  color:#16a34a;
  font-size:12px;
  font-weight:700;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  gap:5px;
  transition:all .18s;
  text-decoration:none;
  font-family:inherit;
  white-space:nowrap;
  box-shadow:none !important;
}
.c-btn-outline:hover{
  background:#f0fdf4;
  border-color:#15803d;
  color:#15803d;
  box-shadow:none !important;
}
.c-btn-primary{
  background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);
  color:#ffffff;
  border:none;
  padding:9px 20px;
  border-radius:9999px;
  font-size:12.5px;
  font-weight:700;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  gap:6px;
  transition:all .2s ease;
  text-decoration:none;
  box-shadow:none !important;
  font-family:inherit;
  letter-spacing:-0.01em;
  white-space:nowrap;
}
.c-btn-primary:hover{
  background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);
  transform:none;
  box-shadow:none !important;
}
.c-nav-mobile-apply-btn {
  display: none;
  box-shadow: none !important;
}

/* Hero */
.c-hero{padding:44px 24px 34px;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);border-bottom:1px solid var(--border);text-align:center;position:relative;}
.c-hero-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:9999px;background:#f0fdf4;color:#15803d;font-size:11px;font-weight:700;border:1px solid #bbf7d0;margin-bottom:12px;}
.c-hero-title{font-size:36px;font-weight:800;color:var(--ink);letter-spacing:-0.035em;line-height:1.22;max-width:880px;margin:0 auto 12px;}
.c-hero-typewriter{
  background:linear-gradient(135deg, #16a34a 0%, #2563eb 50%, #9333ea 100%);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  display:inline-block;
  min-height:1.2em;
}
.c-typewriter-cursor{
  display:inline-block;
  font-weight:300;
  -webkit-text-fill-color:#16a34a;
  color:#16a34a;
  margin-left:2px;
  animation:cCursorBlink 0.9s infinite;
}
@keyframes cCursorBlink{0%,100%{opacity:1;}50%{opacity:0;}}
.c-hero-sub{font-size:14.5px;color:var(--muted);max-width:620px;margin:0 auto 22px;line-height:1.55;}

/* Search & Filter Bar */
.c-filter-box{max-width:960px;margin:0 auto;background:#ffffff;border:1px solid var(--border);border-radius:16px;padding:8px;box-shadow:var(--shadow-md);display:flex;gap:8px;align-items:center;}
.c-search-wrap{flex:1;min-width:200px;display:flex;align-items:center;background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:8px 12px;gap:8px;transition:border-color .15s, background .15s;}
.c-search-wrap:focus-within{border-color:#86efac;background:#fff;}
.c-search-input{border:none;background:transparent;outline:none;font-size:13px;color:var(--ink);width:100%;font-family:inherit;}
.c-search-input::placeholder{color:#94a3b8;}
.c-filter-dropdowns-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.c-filter-dd-btn{padding:7.5px 13px;border-radius:10px;border:1px solid var(--border);background:#ffffff;font-size:12px;font-weight:600;color:var(--ink2);cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:all .15s;font-family:inherit;}
.c-filter-dd-btn:hover{border-color:var(--border-hover);background:#f8fafc;}
.c-filter-dd-btn.active{border-color:#86efac;background:#f0fdf4;color:#15803d;font-weight:700;}
.c-filter-reset-btn{border:none;background:transparent;color:#dc2626;font-size:12px;font-weight:700;cursor:pointer;padding:6px 10px;border-radius:8px;transition:background .15s;}
.c-filter-reset-btn:hover{background:#fef2f2;}

/* Content Area */
.c-main{flex:1;max-width:1360px;width:100%;margin:0 auto;padding:32px 36px 64px;}
.c-section-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;}
.c-section-title{font-size:17px;font-weight:800;color:var(--ink);letter-spacing:-0.02em;display:flex;align-items:center;gap:8px;}
.c-section-count{font-size:11px;font-weight:700;padding:3px 10px;border-radius:9999px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;}

/* Job Grid */
.c-job-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:24px;}

/* ── Minimal Professional Job Card ── */
.c-job-card{
  background:#ffffff;
  border:1px solid #e2e8f0;
  border-radius:18px;
  padding:22px 24px;
  transition:all .22s cubic-bezier(0.16, 1, 0.3, 1);
  display:flex;
  flex-direction:column;
  justify-content:space-between;
  box-shadow:0 2px 8px rgba(15, 23, 42, 0.04);
  position:relative;
  cursor:pointer;
}
.c-job-card:hover{
  border-color:#86efac;
  box-shadow:0 12px 28px -4px rgba(15, 23, 42, 0.08);
  transform:translateY(-2px);
}

.c-card-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:12px;
}
.c-card-dept-pill{
  font-size:11.5px;
  font-weight:700;
  padding:4px 12px;
  border-radius:9999px;
  display:inline-flex;
  align-items:center;
  gap:5px;
  letter-spacing:.01em;
}
.c-card-type-pill{
  font-size:11.5px;
  font-weight:700;
  padding:4px 12px;
  border-radius:9999px;
  letter-spacing:.01em;
}

.c-card-title-row{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
  margin-bottom:10px;
}
.c-card-title{
  font-size:18px;
  font-weight:800;
  color:var(--ink);
  line-height:1.35;
  letter-spacing:-0.025em;
  display:flex;
  align-items:center;
  transition:color .15s ease;
}
.c-job-card:hover .c-card-title{
  color:#15803d;
}
.c-card-arrow-icon{
  color:#94a3b8;
  opacity:0;
  transform:translate(-3px, 3px);
  transition:all .2s ease;
  flex-shrink:0;
  margin-top:4px;
}
.c-job-card:hover .c-card-arrow-icon{
  opacity:1;
  color:#15803d;
  transform:translate(0, 0);
}

.c-card-meta-list{
  display:flex;
  align-items:center;
  gap:7px;
  flex-wrap:wrap;
  margin-bottom:14px;
}
.c-card-pill{
  font-size:11.5px;
  padding:4px 11px;
  border-radius:9999px;
  display:inline-flex;
  align-items:center;
  gap:5px;
  font-weight:600;
  letter-spacing:0.01em;
}

.c-card-desc{
  font-size:13px;
  color:#475569;
  line-height:1.6;
  margin-bottom:18px;
  display:-webkit-box;
  -webkit-line-clamp:3;
  -webkit-box-orient:vertical;
  overflow:hidden;
  text-overflow:ellipsis;
  word-break:break-word;
}

.c-card-footer{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding-top:16px;
  border-top:1px solid #f1f5f9;
  gap:10px;
  margin-top:auto;
}
.c-card-details-btn{
  font-size:12.5px;
  font-weight:600;
  color:#475569;
  background:#f8fafc;
  border:1px solid #e2e8f0;
  padding:8px 16px;
  border-radius:9999px;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  gap:5px;
  transition:all .15s ease;
  font-family:inherit;
}
.c-card-details-btn:hover{
  background:#f1f5f9;
  color:var(--ink);
  border-color:#cbd5e1;
}
.c-card-apply-btn{
  padding:8.5px 20px;
  border-radius:9999px;
  background:#16a34a;
  border:none;
  font-size:13px;
  font-weight:700;
  color:#ffffff;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  gap:6px;
  transition:all .18s ease;
  font-family:inherit;
  box-shadow:none;
}
.c-card-apply-btn:hover{
  background:#15803d;
  box-shadow:none;
}

/* ── Skeleton Shimmer Effect ── */
@keyframes cShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.c-skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%);
  background-size: 400% 100%;
  animation: cShimmer 1.4s ease infinite;
  border-radius: 6px;
}
.c-skeleton-pill {
  border-radius: 9999px;
}
.c-skeleton-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

/* ── Amazon & Meta Styled 2-Column Separately Scrollable Layout ── */
.c-detail-page-wrapper {
  max-width: 1520px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 36px 36px;
  box-sizing: border-box;
}

@media(min-width: 961px) {
  .c-detail-split-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 390px;
    gap: 36px;
    height: calc(100vh - 120px);
    overflow: hidden;
    margin-top: 14px;
  }
  .c-scrollable-left {
    overflow-y: auto;
    height: 100%;
    padding-right: 22px;
    padding-bottom: 60px;
  }
  .c-scrollable-right {
    overflow-y: auto;
    height: 100%;
    padding-right: 8px;
    padding-bottom: 60px;
  }
}

@media(max-width: 960px) {
  .c-detail-page-wrapper {
    padding: 16px 20px 48px;
  }
  .c-detail-split-layout {
    display: flex;
    flex-direction: column;
    gap: 32px;
    height: auto;
    overflow: visible;
  }
  .c-scrollable-left, .c-scrollable-right {
    overflow-y: visible;
    height: auto;
    padding-right: 0;
  }
}

/* Custom Sleek Scrollbars (Amazon / Meta Career Page Style) */
.c-scrollable-left::-webkit-scrollbar,
.c-scrollable-right::-webkit-scrollbar {
  width: 6px;
}
.c-scrollable-left::-webkit-scrollbar-track,
.c-scrollable-right::-webkit-scrollbar-track {
  background: transparent;
}
.c-scrollable-left::-webkit-scrollbar-thumb,
.c-scrollable-right::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 9999px;
}
.c-scrollable-left::-webkit-scrollbar-thumb:hover,
.c-scrollable-right::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Breadcrumb Header */
.c-breadcrumb-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f5f9;
}
.c-breadcrumb-links {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}
.c-back-short {
  display: none;
}
.c-back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #16a34a;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  padding: 6px 14px;
  border-radius: 9999px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  transition: all 0.15s ease;
}
.c-back-link:hover {
  background: #dcfce7;
  color: #15803d;
  transform: translateX(-2px);
}

/* Amazon / Meta Styled Hero Header */
.c-meta-hero {
  margin-bottom: 24px;
  padding-bottom: 22px;
  border-bottom: 1px solid #e2e8f0;
}
.c-meta-hero-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.c-meta-hero-title {
  font-size: 32px;
  font-weight: 700;
  color: #090d16;
  letter-spacing: -0.025em;
  line-height: 1.25;
  margin-bottom: 14px;
}
.c-meta-hero-chips {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13.5px;
  color: #475569;
}
.c-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

/* Left Content Flow & Bold Field Labels */
.c-content-flow {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.c-section-block {
  position: relative;
}
.c-section-heading {
  font-size: 18px;
  font-weight: 800;
  color: #090d16;
  letter-spacing: -0.02em;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding-bottom: 8px;
  border-bottom: 2px solid #f1f5f9;
}
.c-sub-heading {
  font-size: 15.5px;
  font-weight: 800;
  color: #090d16;
  margin-top: 24px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Amazon-style Role Specifications Grid (Bold Labels with Values) */
.c-specs-highlight-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 18px 22px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px 22px;
  margin-bottom: 24px;
}
.c-kv-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
  line-height: 1.6;
}
.c-kv-bold-label {
  font-weight: 700;
  color: #090d16;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
.c-kv-value {
  color: #334155;
  font-weight: 500;
}

/* Paragraphs & Bullet styling */
.c-detail-paragraph {
  font-size: 14.5px;
  color: #334155;
  line-height: 1.8;
  margin-bottom: 14px;
}
.c-detail-paragraph strong, .c-detail-paragraph b {
  font-weight: 800;
  color: #090d16;
}
.c-bullet-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
  margin-bottom: 16px;
}
.c-bullet-item {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  font-size: 14px;
  color: #334155;
  line-height: 1.65;
}
.c-bullet-icon {
  color: #16a34a;
  flex-shrink: 0;
  margin-top: 3.5px;
}

/* Tech Stack Tags */
.c-tech-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.c-tech-pill {
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 5px 12px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all .15s ease;
}
.c-tech-pill:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  transform: translateY(-1px);
}



/* Culture & Benefits Grid */
.c-perk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.c-perk-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow-xs);
  transition: all .18s ease;
}
.c-perk-card:hover {
  border-color: #86efac;
  box-shadow: var(--shadow-sm);
  transform: translateY(-1.5px);
}
.c-perk-card-title {
  font-weight: 800;
  font-size: 13.5px;
  color: #090d16;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.c-perk-card-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

/* Bottom Apply CTA Card */
.c-apply-bottom-banner {
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border: 1px solid #bbf7d0;
  border-radius: 16px;
  padding: 24px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 10px;
}
.c-apply-bottom-title {
  font-size: 17px;
  font-weight: 900;
  color: #166534;
  margin-bottom: 3px;
  letter-spacing: -0.02em;
}
.c-apply-bottom-sub {
  font-size: 13px;
  color: #15803d;
  line-height: 1.45;
}

/* Right Sidebar Flow (Amazon/Meta Style Specs & Action Rail) */
.c-sidebar-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.c-side-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 22px;
  box-shadow: var(--shadow-xs);
}
.c-side-hd {
  font-size: 14px;
  font-weight: 800;
  color: #090d16;
  margin-bottom: 14px;
  letter-spacing: -0.015em;
  display: flex;
  align-items: center;
  gap: 7px;
}
.c-side-spec-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid #f8fafc;
  font-size: 12.5px;
}
.c-side-spec-item:last-child { border-bottom: none; }
.c-side-spec-lbl { color: #64748b; font-weight: 500; }
.c-side-spec-val { color: #334155; font-weight: 500; text-align: right; }

/* Empty State */
.c-empty { text-align: center; padding: 64px 20px; background: #ffffff; border: 1px dashed var(--border); border-radius: 18px; }
.c-empty-icon { width: 52px; height: 52px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; color: var(--muted); }
.c-empty-title { font-size: 16px; font-weight: 800; color: var(--ink); margin-bottom: 6px; }
.c-empty-sub { font-size: 13px; color: var(--muted); margin-bottom: 18px; }

/* ── Ultra-Professional Talent Community Showcase Section ── */
.c-talent-showcase {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 38px 44px;
  margin-top: 52px;
  box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.05), 0 4px 6px -2px rgba(15, 23, 42, 0.02);
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 40px;
  align-items: center;
  position: relative;
  overflow: hidden;
}
.c-talent-showcase::before {
  content: '';
  position: absolute;
  top: -50px;
  right: -50px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(22, 163, 74, 0.08) 0%, rgba(22, 163, 74, 0) 70%);
  pointer-events: none;
}
.c-talent-left {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.c-talent-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 4px 12px;
  border-radius: 9999px;
  width: fit-content;
}
.c-talent-title {
  font-size: 24px;
  font-weight: 800;
  color: #090d16;
  letter-spacing: -0.03em;
  line-height: 1.25;
}
.c-talent-desc {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
}
.c-talent-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.c-talent-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.c-talent-perk-card {
  background: #f8fafc;
  border: 1px solid #edf2f7;
  border-radius: 14px;
  padding: 14px 18px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  transition: all 0.2s ease;
}
.c-talent-perk-card:hover {
  background: #ffffff;
  border-color: #86efac;
  transform: translateX(3px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}
.c-talent-perk-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #16a34a;
}
.c-talent-perk-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #090d16;
  margin-bottom: 2px;
}
.c-talent-perk-sub {
  font-size: 12px;
  color: #64748b;
  line-height: 1.45;
}

.c-location-showcase {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 36px 40px;
  margin-top: 52px;
  box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.04);
  display: grid;
  grid-template-columns: 0.9fr 1.35fr;
  gap: 40px;
  align-items: center;
  position: relative;
  overflow: hidden;
}
.c-location-left {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.c-location-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 4px 12px;
  border-radius: 9999px;
  width: fit-content;
}
.c-location-title {
  font-size: 24px;
  font-weight: 800;
  color: #090d16;
  letter-spacing: -0.03em;
  line-height: 1.25;
}
.c-location-desc {
  font-size: 13.5px;
  color: #64748b;
  line-height: 1.6;
}
.c-location-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 4px 0 8px;
}
.c-location-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: #334155;
  line-height: 1.45;
}
.c-location-item-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #16a34a;
  flex-shrink: 0;
  margin-top: 1px;
}
.c-map-frame-wrap {
  width: 100%;
  height: 420px;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
}
.c-map-frame-wrap iframe {
  width: 100%;
  height: 100%;
  border: none;
}

@media(max-width: 900px) {
  .c-location-showcase {
    grid-template-columns: 1fr;
    padding: 26px 20px;
    gap: 22px;
    margin-top: 36px;
  }
  .c-map-frame-wrap {
    height: 340px;
    border-radius: 16px;
  }
  .c-talent-showcase {
    grid-template-columns: 1fr;
    padding: 28px 22px;
    gap: 26px;
  }
}

@media(max-width: 768px) {
  .c-nav { padding: 0 16px; height: 58px; }
  .c-nav-brand { gap: 8px; }
  .c-nav-logo { width: 32px; height: 32px; border-radius: 8px; }
  .c-nav-name { font-size: 13.5px; }
  .c-nav-sub { font-size: 9.5px; }
  .c-btn-outline { padding: 6px 12px; font-size: 11.5px; }
  .c-main { padding: 24px 18px 48px; }
  .c-job-grid { grid-template-columns: 1fr; }
}

@media(max-width: 640px) {
  .c-nav { padding: 0 12px; height: 54px; }
  .c-nav-name-pvt { display: none; }
  .c-nav-sub { display: none; }
  .c-nav-count-text { display: none; }
  .c-nav-count-text-short { display: inline; }
  .c-nav-btn-text { display: none; }
  .c-nav-btn-text-short { display: inline; }
  .c-nav-open-count { padding: 3px 8px; font-size: 10.5px; }
  .c-nav-visit-btn { padding: 4px 10px; font-size: 11px; gap: 4px; }
  .c-nav-browse-btn { display: none !important; }
  .c-nav-visit-detail { display: none !important; }
  .c-nav-mobile-apply-btn {
    display: inline-flex !important;
    padding: 6px 14px !important;
    font-size: 11.5px !important;
    font-weight: 700 !important;
    gap: 4px !important;
    border-radius: 9999px !important;
    background: #16a34a !important;
    color: #ffffff !important;
    box-shadow: none !important;
    border: none !important;
    white-space: nowrap !important;
  }
  .c-nav-mobile-apply-btn:hover {
    background: #15803d !important;
  }
  .c-btn-outline { padding: 5px 10px; font-size: 11px; }
  .c-btn-primary { padding: 5.5px 11px; font-size: 11px; gap: 4px; }

  .c-hero { padding: 26px 14px 20px; }
  .c-hero-badge { font-size: 10.5px; padding: 3.5px 10px; margin-bottom: 10px; }
  .c-hero-title { font-size: clamp(20px, 5.5vw, 25px); line-height: 1.28; margin-bottom: 8px; }
  .c-hero-sub { font-size: 12.5px; margin-bottom: 16px; line-height: 1.5; }

  .c-filter-box { flex-direction: column; padding: 8px; gap: 8px; border-radius: 14px; }
  .c-search-wrap { width: 100%; min-width: 100%; padding: 8px 10px; border-radius: 9px; }
  .c-filter-dropdowns-row { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
  .c-filter-dd-btn { width: 100%; justify-content: space-between; padding: 6.5px 7px; font-size: 11px; border-radius: 8px; }
  .c-filter-reset-btn { grid-column: span 3; text-align: center; padding: 4px; font-size: 11.5px; }

  .c-main { padding: 16px 12px 40px; }
  .c-section-bar { margin-bottom: 14px; gap: 8px; }
  .c-section-title { font-size: 15.5px; }
  .c-section-count { font-size: 10.5px; padding: 2px 8px; }

  .c-job-card { padding: 16px 14px; border-radius: 14px; }
  .c-card-header { margin-bottom: 10px; }
  .c-card-dept-pill, .c-card-type-pill { font-size: 10.5px; padding: 3px 9px; }
  .c-card-title { font-size: 15.5px; }
  .c-card-meta-list { gap: 5px; margin-bottom: 10px; }
  .c-card-pill { font-size: 10.5px; padding: 3px 8px; }
  .c-card-desc { font-size: 12.5px; line-height: 1.55; margin-bottom: 14px; -webkit-line-clamp: 3; }
  .c-card-footer { padding-top: 12px; gap: 6px; }
  .c-card-details-btn { font-size: 11px; padding: 6px 11px; }
  .c-card-apply-btn { font-size: 11.5px; padding: 6.5px 13px; }

  .c-detail-page-wrapper { padding: 14px 14px 40px; }
  .c-breadcrumb-bar { flex-wrap: nowrap; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 14px; padding-bottom: 10px; }
  .c-crumb-trail { display: none !important; }
  .c-back-full { display: none !important; }
  .c-back-short { display: inline !important; }
  .c-back-link { padding: 5px 11px; font-size: 11.5px; white-space: nowrap; }
  .c-share-role-btn { padding: 5px 11px !important; font-size: 11.5px !important; white-space: nowrap; flex-shrink: 0; }
  .c-meta-hero { margin-bottom: 18px; padding-bottom: 16px; }
  .c-meta-hero-title { font-size: 22px; line-height: 1.25; margin-bottom: 10px; }
  .c-meta-hero-chips { gap: 8px 12px; font-size: 12px; }
  .c-content-flow { gap: 20px; }
  .c-sub-heading { font-size: 14.5px; margin-top: 18px; margin-bottom: 8px; }
  .c-specs-highlight-box { padding: 14px 16px; grid-template-columns: 1fr; gap: 9px; margin-bottom: 18px; }
  .c-kv-row { font-size: 13.5px; gap: 4px 8px; }
  .c-kv-bold-label { min-width: 80px; }
  .c-detail-paragraph { font-size: 13.5px; line-height: 1.65; margin-bottom: 12px; }
  .c-bullet-list { gap: 10px; margin-top: 8px; margin-bottom: 14px; }
  .c-bullet-item { font-size: 13px; line-height: 1.55; gap: 9px; }
  .c-perk-grid { grid-template-columns: 1fr; gap: 10px; }
  .c-apply-bottom-banner { flex-direction: column; align-items: flex-start; gap: 12px; padding: 16px 14px; }
  .c-side-card { padding: 16px 14px; border-radius: 12px; }
  .c-location-showcase { padding: 20px 16px; margin-top: 28px; border-radius: 16px; }
  .c-location-title { font-size: 18px; }
  .c-location-desc { font-size: 12.5px; }
  .c-location-item { font-size: 12px; }
  .c-map-frame-wrap { height: 300px; border-radius: 14px; }
  .c-talent-showcase { padding: 22px 16px; margin-top: 24px; border-radius: 16px; }
  .c-talent-title { font-size: 18px; }
  .c-talent-desc { font-size: 12.5px; }
}

@media(max-width: 380px) {
  .c-filter-dropdowns-row { grid-template-columns: 1fr 1fr; }
  .c-filter-reset-btn { grid-column: span 2; }
}
`;

// Dropdown Card Filter
const DropdownFilter = ({ label, value, options, onChange, allLabel = 'All' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const isFiltered = value !== 'All' && value !== '';

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`c-filter-dd-btn ${isFiltered ? 'active' : ''}`}
            >
                <span>{isFiltered ? value : label}</span>
                <ChevronDown size={13} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        backgroundColor: '#ffffff',
                        borderRadius: '14px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                        border: '1px solid #e2e8f0',
                        zIndex: 1000,
                        minWidth: '170px',
                        padding: '6px',
                        animation: 'cpDdFadeIn 0.15s ease'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }} className="c-dd-scroll">
                        <div
                            onClick={() => { onChange('All'); setIsOpen(false); }}
                            onMouseEnter={e => { if (value !== 'All') e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                            onMouseLeave={e => { if (value !== 'All') e.currentTarget.style.backgroundColor = 'transparent'; }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                padding: '7px 10px',
                                borderRadius: '8px',
                                fontSize: '12.5px',
                                fontWeight: value === 'All' ? '600' : '500',
                                color: value === 'All' ? '#0f172a' : '#475569',
                                backgroundColor: value === 'All' ? '#f1f5f9' : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <span>{allLabel}</span>
                            {value === 'All' && <Check size={13} color="#16a34a" strokeWidth={2.5} />}
                        </div>
                        {options.map((opt) => {
                            const isSel = value === opt;
                            return (
                                <div
                                    key={opt}
                                    onClick={() => { onChange(opt); setIsOpen(false); }}
                                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '8px',
                                        padding: '7px 10px',
                                        borderRadius: '8px',
                                        fontSize: '12.5px',
                                        fontWeight: isSel ? '600' : '500',
                                        color: isSel ? '#0f172a' : '#475569',
                                        backgroundColor: isSel ? '#f1f5f9' : 'transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span>{opt}</span>
                                    {isSel && <Check size={13} color="#16a34a" strokeWidth={2.5} />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const TYPEWRITER_PHRASES = [
    'Tech & Software Engineering',
    'Sales & Business Growth',
    'Digital Marketing & Media',
    'Graphic Design & Creativity',
    'Real Estate & Ventures',
    'Enterprise Cloud Solutions'
];

const CareersPortal = () => {
    const navigate = useNavigate();
    const routeParams = useParams();
    const [searchParams, setSearchParams] = useSearchParams();

    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedDept, setSelectedDept] = useState('All');
    const [selectedType, setSelectedType] = useState('All');
    const [selectedLoc, setSelectedLoc] = useState('All');
    const [selectedJob, setSelectedJob] = useState(null);
    const [copiedId, setCopiedId] = useState(null);

    // Typewriter State
    const [typewriterIndex, setTypewriterIndex] = useState(0);
    const [typewriterText, setTypewriterText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const currentPhrase = TYPEWRITER_PHRASES[typewriterIndex];
        let timeout;

        if (!isDeleting && typewriterText === currentPhrase) {
            timeout = setTimeout(() => setIsDeleting(true), 2200);
        } else if (isDeleting && typewriterText === '') {
            setIsDeleting(false);
            setTypewriterIndex(prev => (prev + 1) % TYPEWRITER_PHRASES.length);
        } else {
            const speed = isDeleting ? 32 : 60;
            timeout = setTimeout(() => {
                setTypewriterText(prev =>
                    isDeleting
                        ? currentPhrase.substring(0, prev.length - 1)
                        : currentPhrase.substring(0, prev.length + 1)
                );
            }, speed);
        }

        return () => clearTimeout(timeout);
    }, [typewriterText, isDeleting, typewriterIndex]);

    // Fetch jobs from backend
    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const res = await api.get('/recruitment/jobs');
                const openJobs = (res.data || []).filter(j => j.status === 'Open' || !j.status);
                setJobs(openJobs);
            } catch (err) {
                console.error('Error fetching jobs:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchJobs();
    }, []);

    // Sync selected job with route params / query params
    useEffect(() => {
        if (!jobs.length) return;
        const targetId = routeParams.id || searchParams.get('jobId') || searchParams.get('view');
        if (targetId) {
            const matched = jobs.find(j => j._id === targetId);
            if (matched) {
                setSelectedJob(matched);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            setSelectedJob(null);
        }
    }, [routeParams.id, searchParams, jobs]);

    const departments = useMemo(() => {
        const set = new Set();
        jobs.forEach(j => { if (j.department) set.add(j.department); });
        return Array.from(set).sort();
    }, [jobs]);

    const locations = useMemo(() => {
        const set = new Set();
        jobs.forEach(j => { if (j.location) set.add(j.location); });
        return Array.from(set).sort();
    }, [jobs]);

    const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];

    const filteredJobs = useMemo(() => {
        return jobs.filter(j => {
            const matchesSearch = !search ||
                j.title?.toLowerCase().includes(search.toLowerCase()) ||
                j.department?.toLowerCase().includes(search.toLowerCase()) ||
                j.description?.toLowerCase().includes(search.toLowerCase()) ||
                j.requirements?.toLowerCase().includes(search.toLowerCase());

            const matchesDept = selectedDept === 'All' || j.department === selectedDept;
            const matchesType = selectedType === 'All' || j.type === selectedType;
            const matchesLoc = selectedLoc === 'All' || j.location === selectedLoc;

            return matchesSearch && matchesDept && matchesType && matchesLoc;
        });
    }, [jobs, search, selectedDept, selectedType, selectedLoc]);

    const handleViewJob = (job) => {
        setSelectedJob(job);
        const slug = job.title ? job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
        setSearchParams({ jobId: job._id, job: slug });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBackToList = () => {
        setSelectedJob(null);
        setSearchParams({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleApply = (jobId, jobTitle) => {
        const slug = jobTitle ? jobTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
        navigate(`/careers/apply?jobId=${jobId}&job=${slug}&ref=careers_portal&mode=apply`);
    };

    const handleCopyShareLink = (job) => {
        const baseUrl = window.location.origin;
        const slug = job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const url = `${baseUrl}/careers?jobId=${job._id}&job=${slug}`;
        navigator.clipboard.writeText(url);
        setCopiedId(job._id);
        setTimeout(() => setCopiedId(null), 2200);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatSalaryRange = (min, max, period = 'per month') => {
        const hasMin = min !== undefined && min !== null && String(min).trim() !== '';
        const hasMax = max !== undefined && max !== null && String(max).trim() !== '';
        if (!hasMin && !hasMax) return null;

        const isAnnual = period === 'per annum' || period === 'per year' || period === 'annum' || period === 'ctc' || period === 'annual';

        if (isAnnual) {
            const formatLpa = (val) => {
                const num = Number(val);
                if (isNaN(num)) return val;
                // If entered as full INR amount (e.g. 350000 -> 3.5, 1200000 -> 12)
                if (num >= 10000) {
                    const lpa = Math.round((num / 100000) * 100) / 100;
                    return `₹${lpa}`;
                }
                // If entered directly as LPA number (e.g. 3.5, 6)
                const lpa = Math.round(num * 100) / 100;
                return `₹${lpa}`;
            };

            if (hasMin && hasMax) {
                if (Number(min) === Number(max)) {
                    return `${formatLpa(min)} LPA`;
                }
                return `${formatLpa(min)} - ${formatLpa(max)} LPA`;
            }
            if (hasMin) {
                return `From ${formatLpa(min)} LPA`;
            }
            return `Up to ${formatLpa(max)} LPA`;
        }

        const formatAmt = (val) => {
            const num = Number(val);
            if (isNaN(num)) return val;
            return `₹${num.toLocaleString('en-IN')}`;
        };

        if (hasMin && hasMax) {
            if (Number(min) === Number(max)) {
                return `${formatAmt(min)} / month`;
            }
            return `${formatAmt(min)} – ${formatAmt(max)} / month`;
        }
        if (hasMin) {
            return `From ${formatAmt(min)} / month`;
        }
        return `Up to ${formatAmt(max)} / month`;
    };

    const formatExperienceRange = (min, minUnit = 'years', max, maxUnit = 'years') => {
        const hasMin = min !== undefined && min !== null && String(min).trim() !== '';
        const hasMax = max !== undefined && max !== null && String(max).trim() !== '';
        if (!hasMin && !hasMax) return null;

        const formatVal = (v, u) => {
            const num = Number(v);
            if (isNaN(num)) return v;
            if (num === 0) return 'Fresher';
            const unitName = u === 'months' ? (num === 1 ? 'Month' : 'Months') : (num === 1 ? 'Year' : 'Years');
            return `${num} ${unitName}`;
        };

        if (hasMin && hasMax) {
            if (Number(min) === Number(max) && minUnit === maxUnit) {
                return formatVal(min, minUnit);
            }
            if (minUnit === maxUnit) {
                const unitName = minUnit === 'months' ? 'Months' : 'Years';
                return `${min} - ${max} ${unitName}`;
            }
            return `${formatVal(min, minUnit)} - ${formatVal(max, maxUnit)}`;
        }
        if (hasMin) return `Min ${formatVal(min, minUnit)}`;
        return `Up to ${formatVal(max, maxUnit)}`;
    };

    const extractJobMeta = (job) => {
        let exp = formatExperienceRange(job.minExperience, job.minExpUnit, job.maxExperience, job.maxExpUnit) || '';
        let loc = job.location || 'On-site · Sector 63, Noida';
        const desc = job.description || '';
        const reqs = job.requirements || '';
        const combined = `${desc}\n${reqs}`;

        if (!exp) {
            const expMatch = combined.match(/(?:Experience|Exp|Required Experience)\s*:\s*([^\n\r,;.]+)/i);
            if (expMatch && expMatch[1]) {
                let val = expMatch[1].trim().replace(/^[-:,\s]+/, '');
                if (val.length < 25) {
                    exp = val.toLowerCase().includes('yr') || val.toLowerCase().includes('year') || val.toLowerCase().includes('month') || val.toLowerCase().includes('exp')
                        ? val
                        : `${val} Exp`;
                }
            }
        }

        if (!job.location || job.location === 'On-site' || job.location === 'Off-site') {
            const locMatch = combined.match(/(?:Location|Work Location|Job Location)\s*:\s*([^\n\r,;]+)/i);
            if (locMatch && locMatch[1]) {
                const locVal = locMatch[1].trim();
                if (locVal.length < 35) {
                    loc = locVal;
                }
            }
        }

        return { exp, loc };
    };

    const cleanExcerpt = (text, title = '', maxChars = 220) => {
        if (!text) return `Join our high-impact team as a ${title || 'specialist'} to build and scale innovative enterprise technology.`;

        let clean = text
            .replace(/<[^>]*>/g, ' ')
            .replace(/[#*_`~]/g, ' ')
            .replace(/Job Description\s*(?:Bhoomi Tech\s*Zone\s*Pvt\.?\s*Ltd\.?)?(?:\s*is looking for)?/gi, ' ')
            .replace(/(?:Job Title|Title)\s*:[^\n\r]*(\n|\r|$)/gi, ' ')
            .replace(/Company\s*:[^\n\r]*(\n|\r|$)/gi, ' ')
            .replace(/(?:Job Type|Employment Type)\s*:[^\n\r]*(\n|\r|$)/gi, ' ')
            .replace(/(?:Location|Work Location)\s*:[^\n\r]*(\n|\r|$)/gi, ' ')
            .replace(/(?:Required Experience|Experience Required|Experience|Exp)\s*:[^\n\r]*(\n|\r|$)/gi, ' ')
            .replace(/(?:Salary|CTC|Compensation|Package)\s*:[^\n\r]*(\n|\r|$)/gi, ' ')
            .replace(/(?:Shift|Working Hours|Timing)\s*:[^\n\r]*(\n|\r|$)/gi, ' ')
            .replace(/(?:Qualification|Education)\s*:[^\n\r]*(\n|\r|$)/gi, ' ')
            .replace(/(?:Job Overview|Role Overview|Overview|Description|Job Summary|Summary|Key Responsibilities|Responsibilities|Requirements)\s*:\s*/gi, ' ')
            .replace(/\b(?:Job Overview|Role Overview|Job Summary)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!clean || clean.length < 8 || clean.toLowerCase() === 'test' || /^[-:.\s]+$/.test(clean)) {
            return `Join our high-impact team as a ${title || 'specialist'} to build and scale innovative enterprise technology.`;
        }

        if (clean.length > maxChars) {
            const cut = clean.slice(0, maxChars);
            const lastSpace = cut.lastIndexOf(' ');
            const finalStr = (lastSpace > 50 ? cut.slice(0, lastSpace) : cut).trim();
            return `${finalStr.replace(/[.,;:\-\s]+$/, '')}...`;
        }

        return clean;
    };

    const KNOWN_HEADERS = [
        'job description', 'description', 'about the role', 'about the position', 'overview',
        'key responsibilities', 'responsibilities', 'what you\'ll do', 'what you will do', 'roles and responsibilities', 'roles & responsibilities',
        'requirements', 'qualifications', 'basic qualifications', 'preferred qualifications', 'required skills',
        'skills required', 'technical skills', 'skills', 'key skills', 'tools & technologies', 'tools',
        'perks', 'benefits', 'perks & benefits', 'what we offer', 'what you get', 'about company', 'compensation'
    ];

    const LIST_SECTION_HEADERS = [
        'required skills', 'skills required', 'skills', 'technical skills', 'key skills', 'tools & technologies', 'tools',
        'qualifications', 'basic qualifications', 'preferred qualifications', 'key qualifications', 'education',
        'what we offer', 'perks', 'benefits', 'perks & benefits', 'what you get', 'compensation & benefits',
        'responsibilities', 'key responsibilities', 'roles and responsibilities', 'roles & responsibilities', 'what you\'ll do', 'what you will do',
        'requirements', 'eligibility', 'eligibility criteria', 'why join us', 'what we look for', 'what we\'re looking for', 'duties', 'job duties'
    ];

    const renderFormattedText = (rawText, jobContext = selectedJob, defaultInList = false) => {
        if (!rawText || !rawText.trim()) return null;

        const isPlaceholder = rawText.trim().toLowerCase() === 'test' ||
            rawText.trim().length < 5 ||
            /^[-:.\s]+$/.test(rawText.trim());

        if (isPlaceholder) {
            return null;
        }

        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const elements = [];
        let currentBulletList = [];
        let currentKvGroup = [];
        let inListSection = defaultInList;

        // Exact form values from job creation / edit form
        const formExp = jobContext ? formatExperienceRange(jobContext.minExperience, jobContext.minExpUnit, jobContext.maxExperience, jobContext.maxExpUnit) : null;
        const formSalary = jobContext && (jobContext.minSalary || jobContext.maxSalary) ? formatSalaryRange(jobContext.minSalary, jobContext.maxSalary, jobContext.salaryPeriod) : null;
        const formLocation = jobContext?.location || null;
        const formType = jobContext?.type || null;

        const getCanonicalSpec = (rawKey, rawValue) => {
            let displayKey = rawKey.trim();
            let displayVal = rawValue.trim();
            const keyLower = displayKey.toLowerCase();

            if (keyLower.includes('exp') || keyLower.includes('experience')) {
                displayKey = 'Experience';
                if (formExp) {
                    displayVal = formExp;
                }
            } else if (keyLower.includes('salary') || keyLower.includes('ctc') || keyLower.includes('compensation') || keyLower.includes('package') || keyLower.includes('pay') || keyLower.includes('stipend')) {
                displayKey = 'Salary';
                if (formSalary) {
                    displayVal = formSalary;
                }
            } else if (keyLower === 'job type' || keyLower === 'employment type' || keyLower === 'type') {
                displayKey = 'Job Type';
                if (formType) {
                    displayVal = formType;
                }
            } else if (keyLower === 'location' || keyLower === 'work location' || keyLower === 'job location') {
                displayKey = 'Location';
                if (formLocation && formLocation !== 'On-site' && formLocation !== 'Off-site') {
                    displayVal = formLocation;
                }
            } else if (keyLower.includes('shift') || keyLower.includes('working hours') || keyLower.includes('timing')) {
                displayKey = 'Shift';
            }

            return { key: displayKey, value: displayVal };
        };

        const flushBullets = () => {
            if (currentBulletList.length > 0) {
                const list = [...currentBulletList];
                elements.push(
                    <ul key={`b-list-${elements.length}`} className="c-bullet-list">
                        {list.map((b, idx) => (
                            <li key={idx} className="c-bullet-item">
                                <CheckCircle2 size={16} className="c-bullet-icon" />
                                <span>{b}</span>
                            </li>
                        ))}
                    </ul>
                );
                currentBulletList = [];
            }
        };

        const flushKvGroup = () => {
            if (currentKvGroup.length > 0) {
                const group = [...currentKvGroup];
                elements.push(
                    <div key={`kv-box-${elements.length}`} className="c-specs-highlight-box">
                        {group.map((item, idx) => {
                            const spec = getCanonicalSpec(item.key, item.value);
                            return (
                                <div key={idx} className="c-kv-row">
                                    <span className="c-kv-bold-label">{spec.key}:</span>
                                    <span className="c-kv-value">{spec.value}</span>
                                </div>
                            );
                        })}
                    </div>
                );
                currentKvGroup = [];
            }
        };

        lines.forEach((line, lineIdx) => {
            const cleanLower = line.toLowerCase().replace(/[:\-_#*]+$/g, '').trim();

            // Ignore company name / company lines
            if (/^(company|company\s*name|organization|employer)\s*:/i.test(line)) {
                return;
            }

            // 1. Header Line (e.g., "Job Description", "Key Responsibilities:", "Required Skills:", "Qualifications:")
            const isKnownHd = KNOWN_HEADERS.includes(cleanLower);
            const isCustomHd = /^[A-Za-z\s&/]{3,35}:?$/.test(line) && line.length < 35 && !line.includes('.');
            if (isKnownHd || isCustomHd) {
                flushBullets();
                flushKvGroup();
                const isListHd = LIST_SECTION_HEADERS.some(h => cleanLower.includes(h));
                inListSection = isListHd;
                const headerTitle = line.replace(/[:]+$/, '');
                elements.push(
                    <h3 key={`hd-${lineIdx}`} className="c-sub-heading">
                        <CheckSquare size={16} color="#16a34a" />
                        <span>{headerTitle}</span>
                    </h3>
                );
                return;
            }

            // 2. Key-Value Pattern (e.g. "Job Title: Graphic & Video Editor", "Salary: ₹15,000 – ₹30,000 per month")
            const kvMatch = line.match(/^([A-Za-z\s/&()_-]{2,30})\s*:\s*(.+)$/);
            if (kvMatch) {
                const rawKey = kvMatch[1].trim();
                const rawValue = kvMatch[2].trim();
                const keyLower = rawKey.toLowerCase();
                if (keyLower === 'company' || keyLower === 'company name' || keyLower === 'organization' || keyLower === 'employer') {
                    return;
                }
                const spec = getCanonicalSpec(rawKey, rawValue);
                if (spec.value.length > 95) {
                    flushBullets();
                    flushKvGroup();
                    elements.push(
                        <p key={`p-kv-${lineIdx}`} className="c-detail-paragraph">
                            <strong className="c-kv-bold-label">{spec.key}: </strong>
                            <span>{spec.value}</span>
                        </p>
                    );
                } else {
                    flushBullets();
                    currentKvGroup.push({ key: spec.key, value: spec.value });
                }
                return;
            }

            // 3. Bullet Point Line (e.g. "- Edit high quality videos", "* Good communication")
            if (/^[-*•·+►✓✔▪▫]\s*/.test(line) || /^\d+[.)]\s*/.test(line)) {
                flushKvGroup();
                const bulletContent = line.replace(/^[-*•·+►✓✔▪▫\d.)\s]+/, '');
                currentBulletList.push(bulletContent);
                return;
            }

            // 4. Lines inside a recognized List Section (e.g. Required Skills, Qualifications, What We Offer)
            if (inListSection) {
                flushKvGroup();
                currentBulletList.push(line);
                return;
            }

            // 5. Standard Paragraph text
            flushBullets();
            flushKvGroup();
            elements.push(
                <p key={`p-${lineIdx}`} className="c-detail-paragraph">
                    {line}
                </p>
            );
        });

        flushBullets();
        flushKvGroup();

        return <div>{elements}</div>;
    };

    return (
        <div className="c-portal-root">
            <style>{PORTAL_CSS}</style>

            {/* ── Top Navigation Bar ── */}
            <nav className="c-nav">
                <div className="c-nav-brand" onClick={() => { if (selectedJob) handleBackToList(); }}>
                    <div className="c-nav-logo">
                        <img src="/favicon.webp" alt="Bhoomi TechZone" />
                    </div>
                    <div>
                        <div className="c-nav-name">
                            Bhoomi Techzone <span className="c-nav-name-pvt">Pvt Ltd</span>
                        </div>
                        <div className="c-nav-sub">Careers &amp; Talent Portal</div>
                    </div>
                </div>

                <div className="c-nav-actions">
                    {selectedJob && (
                        <button
                            type="button"
                            onClick={handleBackToList}
                            className="c-btn-primary c-nav-browse-btn"
                        >
                            <span className="c-nav-btn-text">Browse Openings</span>
                            <span className="c-nav-btn-text-short">Openings</span>
                            <ArrowRight size={13} />
                        </button>
                    )}
                    <a
                        href="https://www.bhoomitechzone.in"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`c-nav-visit-btn ${selectedJob ? 'c-nav-visit-detail' : ''}`}
                        title="Visit Bhoomi Techzone Official Website"
                    >
                        <span>Visit</span>
                        <ArrowUpRight size={12} color="#ffffff" />
                    </a>
                    {!selectedJob && (
                        <span className="c-nav-open-count">
                            <span className="c-nav-dot" />
                            <span className="c-nav-count-text">{jobs.length} Positions Open</span>
                            <span className="c-nav-count-text-short">{jobs.length} Open</span>
                        </span>
                    )}
                    {selectedJob && (
                        <button
                            type="button"
                            onClick={() => handleApply(selectedJob._id, selectedJob.title)}
                            className="c-btn-primary c-nav-mobile-apply-btn"
                        >
                            <span>Apply</span>
                            <ArrowRight size={12} />
                        </button>
                    )}
                </div>
            </nav>

            {/* If a Job is Selected, show AMAZON & META STYLED 2-COLUMN SEPARATELY SCROLLABLE VIEW */}
            {selectedJob ? (
                (() => {
                    const deptStyle = getDeptBadgeStyle(selectedJob.department);
                    const typeStyle = getTypeBadgeStyle(selectedJob.type);
                    const meta = extractJobMeta(selectedJob);

                    return (
                        <div className="c-detail-page-wrapper">
                            {/* Breadcrumb Navigation Bar */}
                            <div className="c-breadcrumb-bar">
                                <div className="c-breadcrumb-links">
                                    <span onClick={handleBackToList} className="c-back-link">
                                        <ArrowLeft size={13} />
                                        <span className="c-back-full">Back to all open roles</span>
                                        <span className="c-back-short">Back to roles</span>
                                    </span>
                                    <span className="c-crumb-trail" style={{ color: '#cbd5e1' }}>/</span>
                                    <span className="c-crumb-trail">{selectedJob.department || 'Engineering'}</span>
                                    <span className="c-crumb-trail" style={{ color: '#cbd5e1' }}>/</span>
                                    <span className="c-crumb-trail" style={{ color: '#090d16', fontWeight: 700 }}>{selectedJob.title}</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleCopyShareLink(selectedJob)}
                                    className="c-btn-outline c-share-role-btn"
                                    style={{ padding: '6px 14px', fontSize: '12px' }}
                                >
                                    {copiedId === selectedJob._id ? (
                                        <><Check size={13} color="#16a34a" /> Link Copied</>
                                    ) : (
                                        <><Share2 size={13} /> Share Role</>
                                    )}
                                </button>
                            </div>

                            {/* 2-Column Amazon / Meta Styled Separately Scrollable Split Layout */}
                            <div className="c-detail-split-layout">
                                {/* ── LEFT COLUMN (Deep-Dive Job Description with Bold Field Labels, Independently Scrollable) ── */}
                                <div className="c-scrollable-left">
                                    {/* Amazon/Meta Styled Role Header */}
                                    <header className="c-meta-hero">
                                        <div className="c-meta-hero-badges">
                                            {/* Department Pill */}
                                            <span
                                                className="c-card-dept-pill"
                                                style={{
                                                    backgroundColor: deptStyle.bg,
                                                    color: deptStyle.color,
                                                    border: `1px solid ${deptStyle.border}`
                                                }}
                                            >
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: deptStyle.dot, display: 'inline-block' }} />
                                                <span>{selectedJob.department || 'Engineering'}</span>
                                            </span>

                                            {/* Employment Type Pill */}
                                            <span
                                                className="c-card-type-pill"
                                                style={{
                                                    backgroundColor: typeStyle.bg,
                                                    color: typeStyle.color,
                                                    border: `1px solid ${typeStyle.border}`
                                                }}
                                            >
                                                {selectedJob.type}
                                            </span>

                                            {/* Actively Hiring Pill */}
                                            <span
                                                className="c-card-pill"
                                                style={{
                                                    backgroundColor: '#dcfce7',
                                                    color: '#166534',
                                                    border: '1px solid #86efac'
                                                }}
                                            >
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} />
                                                <span>Actively Hiring</span>
                                            </span>
                                        </div>

                                        <h1 className="c-meta-hero-title">{selectedJob.title}</h1>

                                        <div className="c-meta-hero-chips">
                                            <span className="c-meta-chip">
                                                <MapPin size={15} color="#16a34a" />
                                                <span>{meta.loc}</span>
                                            </span>
                                            <span className="c-meta-chip">
                                                <Clock size={15} color="#2563eb" />
                                                <span>{selectedJob.type}</span>
                                            </span>
                                            {meta.exp && (
                                                <span className="c-meta-chip">
                                                    <Briefcase size={15} color="#d97706" />
                                                    <span>{meta.exp}</span>
                                                </span>
                                            )}
                                            {selectedJob.deadline && (
                                                <span className="c-meta-chip">
                                                    <Calendar size={15} color="#64748b" />
                                                    <span>Closes {formatDate(selectedJob.deadline)}</span>
                                                </span>
                                            )}
                                        </div>
                                    </header>

                                    {/* Main Content Flow */}
                                    <div className="c-content-flow">
                                        {/* Description & Role Details */}
                                        {selectedJob.description && (
                                            <div className="c-section-block">
                                                <h2 className="c-section-heading">
                                                    <Sparkles size={18} color="#16a34a" />
                                                    <span>About the Position</span>
                                                </h2>
                                                <div>
                                                    {renderFormattedText(selectedJob.description)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Key Qualifications / Requirements (Only if entered for the job) */}
                                        {selectedJob.requirements && selectedJob.requirements.trim().length > 0 && renderFormattedText(selectedJob.requirements, selectedJob, true) && (
                                            <div className="c-section-block">
                                                <h2 className="c-section-heading">
                                                    <Award size={18} color="#d97706" />
                                                    <span>What We're Looking For (Qualifications)</span>
                                                </h2>
                                                <div>
                                                    {renderFormattedText(selectedJob.requirements, selectedJob, true)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Eligibility Criteria (Only if entered for the job) */}
                                        {selectedJob.eligibilityCriteria && selectedJob.eligibilityCriteria.trim().length > 0 && renderFormattedText(selectedJob.eligibilityCriteria, selectedJob, true) && (
                                            <div className="c-section-block">
                                                <h2 className="c-section-heading">
                                                    <UserCheck size={18} color="#2563eb" />
                                                    <span>Eligibility Criteria</span>
                                                </h2>
                                                <div>
                                                    {renderFormattedText(selectedJob.eligibilityCriteria, selectedJob, true)}
                                                </div>
                                            </div>
                                        )}



                                        {/* Benefits & Culture Cards */}
                                        <div className="c-section-block">
                                            <h2 className="c-section-heading">
                                                <Zap size={18} color="#f59e0b" />
                                                <span>Why Build Your Career at Bhoomi Techzone Pvt Ltd?</span>
                                            </h2>
                                            <div className="c-perk-grid">
                                                <div className="c-perk-card">
                                                    <div className="c-perk-card-title">🚀 High-Impact &amp; Growth</div>
                                                    <div className="c-perk-card-desc">Work on production enterprise systems touching thousands of users with rapid career advancement.</div>
                                                </div>
                                                <div className="c-perk-card">
                                                    <div className="c-perk-card-title">💡 Modern Engineering</div>
                                                    <div className="c-perk-card-desc">Build with modern stacks, scalable microservices, clean code, and automated CI/CD workflows.</div>
                                                </div>
                                                <div className="c-perk-card">
                                                    <div className="c-perk-card-title">🎓 Mentorship &amp; Leadership</div>
                                                    <div className="c-perk-card-desc">Direct access to experienced technical leadership, regular code reviews, and dedicated learning budgets.</div>
                                                </div>
                                                <div className="c-perk-card">
                                                    <div className="c-perk-card-title">🌟 Inclusive Team Culture</div>
                                                    <div className="c-perk-card-desc">Transparent communication, meritocratic growth, collaborative problem solving, and team celebrations.</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Ready to Apply Banner */}
                                        <div className="c-apply-bottom-banner">
                                            <div>
                                                <div className="c-apply-bottom-title">Ready to take the next step in your career?</div>
                                                <div className="c-apply-bottom-sub">Join us to build high-performance software and shape the future of enterprise tech.</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleApply(selectedJob._id, selectedJob.title)}
                                                className="c-btn-primary"
                                                style={{ padding: '10px 22px', fontSize: '13px' }}
                                            >
                                                Apply for this Position <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* ── RIGHT COLUMN (Amazon / Meta Style Sticky/Scrollable Role Specs & Quick Action Rail) ── */}
                                <div className="c-scrollable-right">
                                    <div className="c-sidebar-stack">
                                        {/* Role Summary Card */}
                                        <div className="c-side-card">
                                            <h3 className="c-side-hd">
                                                <FileText size={16} color="#16a34a" /> Role Summary
                                            </h3>

                                            <div className="c-side-spec-item">
                                                <span className="c-side-spec-lbl">Job ID</span>
                                                <span className="c-side-spec-val" style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#64748b' }}>
                                                    #{selectedJob._id.slice(-6).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="c-side-spec-item">
                                                <span className="c-side-spec-lbl">Department</span>
                                                <span className="c-side-spec-val">{selectedJob.department || 'Engineering'}</span>
                                            </div>
                                            <div className="c-side-spec-item">
                                                <span className="c-side-spec-lbl">Employment Type</span>
                                                <span className="c-side-spec-val">{selectedJob.type}</span>
                                            </div>
                                            <div className="c-side-spec-item">
                                                <span className="c-side-spec-lbl">Location</span>
                                                <span className="c-side-spec-val">{meta.loc}</span>
                                            </div>
                                            {(selectedJob.minSalary || selectedJob.maxSalary) && (
                                                <div className="c-side-spec-item">
                                                    <span className="c-side-spec-lbl">Salary (INR)</span>
                                                    <span className="c-side-spec-val" style={{ color: '#166534', fontWeight: 700 }}>
                                                        {formatSalaryRange(selectedJob.minSalary, selectedJob.maxSalary, selectedJob.salaryPeriod)}
                                                    </span>
                                                </div>
                                            )}
                                            {meta.exp && (
                                                <div className="c-side-spec-item">
                                                    <span className="c-side-spec-lbl">Experience</span>
                                                    <span className="c-side-spec-val">{meta.exp}</span>
                                                </div>
                                            )}
                                            <div className="c-side-spec-item">
                                                <span className="c-side-spec-lbl">Status</span>
                                                <span className="c-side-spec-val" style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} />
                                                    Open &amp; Hiring
                                                </span>
                                            </div>
                                        </div>

                                        {/* Company Snapshot Card */}
                                        <div className="c-side-card">
                                            <h3 className="c-side-hd">
                                                <Building2 size={16} color="#2563eb" /> About Bhoomi Techzone Pvt Ltd
                                            </h3>
                                            <p style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.5, marginBottom: '12px' }}>
                                                Bhoomi Techzone Pvt Ltd is a technology provider building robust enterprise SaaS, digital workflows, and modern cloud solutions.
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#475569' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><MapPin size={13} color="#16a34a" /> Noida Sector 63, India</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><Users size={13} color="#2563eb" /> 50+ Team Members</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                                    <Globe size={13} color="#0284c7" />
                                                    <a
                                                        href="https://www.bhoomitechzone.in"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        www.bhoomitechzone.in <ArrowUpRight size={11} />
                                                    </a>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Share this Role Card */}
                                        <div className="c-side-card">
                                            <h3 className="c-side-hd">
                                                <Share2 size={16} color="#9333ea" /> Share this Opening
                                            </h3>
                                            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px', lineHeight: 1.45 }}>
                                                Know someone who would be an exceptional match? Share this role link.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyShareLink(selectedJob)}
                                                className="c-btn-outline"
                                                style={{ width: '100%', justifyContent: 'center', fontSize: '12px', padding: '8.5px 14px' }}
                                            >
                                                {copiedId === selectedJob._id ? (
                                                    <><Check size={13} color="#16a34a" /> Link Copied to Clipboard</>
                                                ) : (
                                                    <><Copy size={13} /> Copy Shareable Link</>
                                                )}
                                            </button>
                                        </div>

                                        {/* Direct Contact Questions Card */}
                                        <div className="c-side-card" style={{ background: '#f8fafc' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#090d16', marginBottom: '3px' }}>Have questions?</div>
                                            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.45, marginBottom: '10px' }}>
                                                Reach out directly to our talent acquisition team.
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <a
                                                    href="mailto:hr@bhoomitechzone.in"
                                                    style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <Mail size={13} /> hr@bhoomitechzone.in
                                                </a>
                                                <a
                                                    href="tel:+919821724181"
                                                    style={{ fontSize: '12px', fontWeight: 600, color: '#334155', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <Phone size={13} color="#16a34a" /> +91 98217 24181
                                                </a>
                                                <a
                                                    href="tel:+919211947852"
                                                    style={{ fontSize: '12px', fontWeight: 600, color: '#334155', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <Phone size={13} color="#16a34a" /> +91 92119 47852
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()
            ) : (
                /* Standard Jobs Grid / Search View */
                <>
                    {/* Hero Section */}
                    <header className="c-hero">
                        <div className="c-hero-badge">
                            <Sparkles size={13} /> We're Hiring Ambitious Minds
                        </div>
                        <h1 className="c-hero-title">
                            Shape the Next Generation of<br />
                            <span className="c-hero-typewriter">
                                {typewriterText}
                                <span className="c-typewriter-cursor">|</span>
                            </span>
                        </h1>
                        <p className="c-hero-sub">
                            Join a high-growth team driving innovation across technology, sales, digital marketing, creative design, and real estate.
                        </p>

                        {/* Search & Filter Floating Card */}
                        <div className="c-filter-box">
                            <div className="c-search-wrap">
                                <Search size={15} color="#94a3b8" />
                                <input
                                    type="text"
                                    placeholder="Search by job title, skill, or keyword..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="c-search-input"
                                />
                                {search && (
                                    <X size={14} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />
                                )}
                            </div>

                            <div className="c-filter-dropdowns-row">
                                <DropdownFilter
                                    label="Department"
                                    value={selectedDept}
                                    options={departments}
                                    onChange={setSelectedDept}
                                    allLabel="All Departments"
                                />

                                <DropdownFilter
                                    label="Job Type"
                                    value={selectedType}
                                    options={jobTypes}
                                    onChange={setSelectedType}
                                    allLabel="All Job Types"
                                />

                                {locations.length > 0 && (
                                    <DropdownFilter
                                        label="Location"
                                        value={selectedLoc}
                                        options={locations}
                                        onChange={setSelectedLoc}
                                        allLabel="All Locations"
                                    />
                                )}

                                {(selectedDept !== 'All' || selectedType !== 'All' || selectedLoc !== 'All' || search) && (
                                    <button
                                        type="button"
                                        onClick={() => { setSearch(''); setSelectedDept('All'); setSelectedType('All'); setSelectedLoc('All'); }}
                                        className="c-filter-reset-btn"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Main Listings */}
                    <main className="c-main" id="openings">
                        <div className="c-section-bar">
                            <div className="c-section-title">
                                <Briefcase size={18} color="#15803d" />
                                <span>Open Positions</span>
                                <span className="c-section-count">{filteredJobs.length} {filteredJobs.length === 1 ? 'Role' : 'Roles'} Available</span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="c-job-grid">
                                {Array.from({ length: 6 }).map((_, idx) => (
                                    <div key={idx} className="c-skeleton-card">
                                        <div>
                                            {/* Header Pills */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <div className="c-skeleton c-skeleton-pill" style={{ width: 110, height: 24 }} />
                                                <div className="c-skeleton c-skeleton-pill" style={{ width: 75, height: 24 }} />
                                            </div>

                                            {/* Title */}
                                            <div className="c-skeleton" style={{ width: '80%', height: 22, borderRadius: 8, marginBottom: 14 }} />

                                            {/* Meta Chips */}
                                            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
                                                <div className="c-skeleton c-skeleton-pill" style={{ width: 115, height: 24 }} />
                                                <div className="c-skeleton c-skeleton-pill" style={{ width: 105, height: 24 }} />
                                                <div className="c-skeleton c-skeleton-pill" style={{ width: 95, height: 24 }} />
                                            </div>

                                            {/* 3-line Description */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                                                <div className="c-skeleton" style={{ width: '100%', height: 13 }} />
                                                <div className="c-skeleton" style={{ width: '92%', height: 13 }} />
                                                <div className="c-skeleton" style={{ width: '65%', height: 13 }} />
                                            </div>
                                        </div>

                                        {/* Footer buttons */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                                            <div className="c-skeleton c-skeleton-pill" style={{ width: 105, height: 32 }} />
                                            <div className="c-skeleton c-skeleton-pill" style={{ width: 95, height: 32 }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredJobs.length === 0 ? (
                            <div className="c-empty">
                                <div className="c-empty-icon">
                                    <Search size={24} />
                                </div>
                                <h3 className="c-empty-title">No matching job openings found</h3>
                                <p className="c-empty-sub">Try changing your search terms or filter criteria to see available positions.</p>
                                <button
                                    type="button"
                                    onClick={() => { setSearch(''); setSelectedDept('All'); setSelectedType('All'); setSelectedLoc('All'); }}
                                    className="c-btn-primary"
                                >
                                    Reset Filters &amp; View All <ArrowRight size={13} />
                                </button>
                            </div>
                        ) : (
                            <div className="c-job-grid">
                                {filteredJobs.map(job => {
                                    const deptStyle = getDeptBadgeStyle(job.department);
                                    const typeStyle = getTypeBadgeStyle(job.type);
                                    const meta = extractJobMeta(job);

                                    return (
                                        <div key={job._id} className="c-job-card" onClick={() => handleViewJob(job)}>
                                            <div>
                                                {/* Card Top Pill Badges */}
                                                <div className="c-card-header">
                                                    {/* Department Pill */}
                                                    <span
                                                        className="c-card-dept-pill"
                                                        style={{
                                                            backgroundColor: deptStyle.bg,
                                                            color: deptStyle.color,
                                                            border: `1px solid ${deptStyle.border}`
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                width: 6,
                                                                height: 6,
                                                                borderRadius: '50%',
                                                                backgroundColor: deptStyle.dot,
                                                                display: 'inline-block'
                                                            }}
                                                        />
                                                        <span>{job.department || 'General'}</span>
                                                    </span>

                                                    {/* Employment Type Pill */}
                                                    <span
                                                        className="c-card-type-pill"
                                                        style={{
                                                            backgroundColor: typeStyle.bg,
                                                            color: typeStyle.color,
                                                            border: `1px solid ${typeStyle.border}`
                                                        }}
                                                    >
                                                        {job.type}
                                                    </span>
                                                </div>

                                                {/* Title Row with Hover Arrow */}
                                                <div className="c-card-title-row">
                                                    <h3 className="c-card-title">{job.title}</h3>
                                                    <ArrowUpRight size={17} className="c-card-arrow-icon" />
                                                </div>

                                                {/* Pill Shape Colorful Badges / Meta Chips */}
                                                <div className="c-card-meta-list">
                                                    {/* Location Pill */}
                                                    <span
                                                        className="c-card-pill"
                                                        style={{
                                                            backgroundColor: '#f1f5f9',
                                                            color: '#334155',
                                                            border: '1px solid #e2e8f0'
                                                        }}
                                                    >
                                                        <MapPin size={11.5} color="#64748b" />
                                                        <span>{meta.loc}</span>
                                                    </span>

                                                    {/* Salary Range Pill */}
                                                    {(job.minSalary || job.maxSalary) && (
                                                        <span
                                                            className="c-card-pill"
                                                            style={{
                                                                backgroundColor: '#f0fdf4',
                                                                color: '#166534',
                                                                border: '1px solid #bbf7d0',
                                                                fontWeight: 600
                                                            }}
                                                        >
                                                            <span>{formatSalaryRange(job.minSalary, job.maxSalary, job.salaryPeriod)}</span>
                                                        </span>
                                                    )}

                                                    {/* Experience Pill */}
                                                    {meta.exp && (
                                                        <span
                                                            className="c-card-pill"
                                                            style={{
                                                                backgroundColor: '#fef3c7',
                                                                color: '#92400e',
                                                                border: '1px solid #fde68a'
                                                            }}
                                                        >
                                                            <Briefcase size={11.5} color="#b45309" />
                                                            <span>{meta.exp}</span>
                                                        </span>
                                                    )}

                                                    {/* Actively Hiring Pill */}
                                                    <span
                                                        className="c-card-pill"
                                                        style={{
                                                            backgroundColor: '#dcfce7',
                                                            color: '#166534',
                                                            border: '1px solid #86efac'
                                                        }}
                                                    >
                                                        <Clock size={11.5} color="#166534" />
                                                        <span>Actively Hiring</span>
                                                    </span>
                                                </div>

                                                {/* Description Excerpt */}
                                                <p className="c-card-desc">
                                                    {cleanExcerpt(job.description, job.title)}
                                                </p>
                                            </div>

                                            {/* Card Footer Actions */}
                                            <div className="c-card-footer" onClick={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    className="c-card-details-btn"
                                                    onClick={() => handleViewJob(job)}
                                                >
                                                    <Eye size={12.5} /> View Details
                                                </button>
                                                <button
                                                    type="button"
                                                    className="c-card-apply-btn"
                                                    onClick={() => handleApply(job._id, job.title)}
                                                >
                                                    Apply Now <ArrowRight size={12.5} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── Corporate Headquarters & Location Map Showcase ── */}
                        <div className="c-location-showcase">
                            <div className="c-location-left">
                                <div className="c-location-badge">
                                    <MapPin size={13} color="#16a34a" />
                                    <span>Headquarters &amp; Innovation Hub</span>
                                </div>
                                <h3 className="c-location-title">
                                    Visit Our Development Center
                                </h3>
                                <p className="c-location-desc">
                                    Located in the tech &amp; corporate corridor of Noida Sector 63, our workspace is designed for innovation, rapid prototyping, and high-energy team collaboration.
                                </p>
                                <div className="c-location-details">
                                    <div className="c-location-item">
                                        <div className="c-location-item-icon">
                                            <Building2 size={15} />
                                        </div>
                                        <div>
                                            <strong style={{ color: '#090d16', display: 'block', fontSize: '13px' }}>Bhoomi Techzone Pvt Ltd</strong>
                                            <span>Sector 63, Noida, Uttar Pradesh 201301, India</span>
                                        </div>
                                    </div>
                                    <div className="c-location-item">
                                        <div className="c-location-item-icon" style={{ color: '#2563eb', background: '#eff6ff', borderColor: '#bfdbfe' }}>
                                            <Compass size={15} />
                                        </div>
                                        <div>
                                            <strong style={{ color: '#090d16', display: 'block', fontSize: '13px' }}>Transit &amp; Accessibility</strong>
                                            <span>Walking distance from Noida Electronic City Metro Station (Blue Line)</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                                    <a
                                        href="https://maps.google.com/?q=Bhoomi+Techzone+Pvt+Ltd+Sector+63+Noida+Uttar+Pradesh"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="c-btn-outline"
                                        style={{ padding: '8px 18px', fontSize: '12.5px' }}
                                    >
                                        <MapPin size={13} /> Get Directions on Google Maps <ArrowUpRight size={12} />
                                    </a>
                                </div>
                            </div>

                            <div className="c-map-frame-wrap">
                                <iframe
                                    title="Bhoomi Techzone Headquarters Location"
                                    src="https://maps.google.com/maps?q=Bhoomi%20Techzone%20Pvt%20Ltd%20Sector%2063%20Noida%20Uttar%20Pradesh&t=&z=15&ie=UTF8&iwloc=&output=embed"
                                    loading="lazy"
                                    allowFullScreen
                                    referrerPolicy="no-referrer-when-downgrade"
                                />
                            </div>
                        </div>

                        {/* Ultra-Professional Talent Community Showcase Section */}
                        <div className="c-talent-showcase">
                            <div className="c-talent-left">
                                <div className="c-talent-badge">
                                    <Sparkles size={13} color="#16a34a" />
                                    <span>Talent Community · Direct Connect</span>
                                </div>
                                <h3 className="c-talent-title">
                                    Don't see the right opening right now?
                                </h3>
                                <p className="c-talent-desc">
                                    We are always looking for driven software engineers, product designers, sales champions, and creative specialists. Get in touch directly with our recruitment team to discuss upcoming roles.
                                </p>
                                <div className="c-talent-actions">
                                    <a
                                        href="mailto:hr@bhoomitechzone.in"
                                        className="c-btn-primary"
                                        style={{ padding: '10px 22px', fontSize: '13.5px', textDecoration: 'none' }}
                                    >
                                        <Mail size={14} /> Email Talent Team
                                    </a>
                                </div>
                            </div>

                            <div className="c-talent-right">
                                <div className="c-talent-perk-card">
                                    <div className="c-talent-perk-icon">
                                        <Zap size={17} />
                                    </div>
                                    <div>
                                        <div className="c-talent-perk-title">Direct Recruiter Review</div>
                                        <div className="c-talent-perk-sub">Every submitted profile is reviewed by our talent leads within 48 business hours.</div>
                                    </div>
                                </div>

                                <div className="c-talent-perk-card">
                                    <div className="c-talent-perk-icon" style={{ color: '#2563eb' }}>
                                        <Users size={17} />
                                    </div>
                                    <div>
                                        <div className="c-talent-perk-title">Priority for Future Openings</div>
                                        <div className="c-talent-perk-sub">Get first consideration and invitations before new openings are publicly announced.</div>
                                    </div>
                                </div>

                                <div className="c-talent-perk-card">
                                    <div className="c-talent-perk-icon" style={{ color: '#9333ea' }}>
                                        <Shield size={17} />
                                    </div>
                                    <div>
                                        <div className="c-talent-perk-title">Confidential &amp; Transparent</div>
                                        <div className="c-talent-perk-sub">Your candidacy and information are kept strictly confidential throughout the evaluation.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </>
            )}

            {/* Footer */}
            <footer style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff', padding: '24px 32px', textAlign: 'center', fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
                <div>© {new Date().getFullYear()} Bhoomi Techzone Pvt Ltd · Careers &amp; Talent Board</div>
                <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <a href="mailto:hr@bhoomitechzone.in" style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Mail size={13} /> hr@bhoomitechzone.in
                    </a>
                    <span style={{ color: '#cbd5e1' }}>·</span>
                    <a href="tel:+919821724181" style={{ color: '#334155', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Phone size={13} color="#16a34a" /> +91 98217 24181
                    </a>
                    <span style={{ color: '#cbd5e1' }}>·</span>
                    <a href="tel:+919211947852" style={{ color: '#334155', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Phone size={13} color="#16a34a" /> +91 92119 47852
                    </a>
                </div>
            </footer>
        </div>
    );
};

export default CareersPortal;
