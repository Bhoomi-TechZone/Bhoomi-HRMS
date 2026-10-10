import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './AdminDasboard.css';
import {
  Users,
  RefreshCw, TrendingUp, TrendingDown,
  BarChart2, Activity, Calendar, Clock, Target, ExternalLink
} from 'lucide-react';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    presentToday: 0,
    absentToday: 0,
    activeProjects: 0,
    totalLeads: 0,
  });
  // Previous period values for dynamic percentage calculation
  const [prevStats, setPrevStats] = useState({
    presentToday: 0,
    absentToday: 0,
    activeProjects: 0,
    totalLeads: 0,
  });
  const [departmentData, setDepartmentData] = useState({ departments: [], counts: [], maleCounts: [], femaleCounts: [] });
  const [leadsTimelineData, setLeadsTimelineData] = useState({ dates: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [projectStatusCounts, setProjectStatusCounts] = useState({ completed: 0, working: 0, canceled: 0 });
  const [cardSparklines, setCardSparklines] = useState({ present: [], absent: [], leads: [], projects: [] });
  const [recentActivities, setRecentActivities] = useState([]);
  const [recentLeads, setRecentLeads] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // Custom modals for top cards
  const [showStatModal, setShowStatModal] = useState(false);
  const [statModalType, setStatModalType] = useState(''); // 'present' | 'absent' | 'projects' | 'leads'
  const [statModalData, setStatModalData] = useState([]);
  const [statModalLoading, setStatModalLoading] = useState(false);
  const [statModalSearch, setStatModalSearch] = useState('');
  const [viewProject, setViewProject] = useState(null);
  const [employees, setEmployees] = useState([]);

  // Employee Summary Modal
  const [showEmployeeSummaryModal, setShowEmployeeSummaryModal] = useState(false);
  const [employeeSummaryData, setEmployeeSummaryData] = useState(null);
  const [employeeSummaryLoading, setEmployeeSummaryLoading] = useState(false);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const isMounted = useRef(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const monthPickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) {
        setShowMonthPicker(false);
      }
    };
    if (showMonthPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMonthPicker]);

  // Lead sources — populated from meta-leads/source-stats
  const [leadSources, setLeadSources] = useState([]);

  useEffect(() => { isMounted.current = true; fetchAll(); fetchLeadsTimeline(selectedMonth); }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isMounted.current) {
        fetchAll();
      }
    }, 60000);

    return () => clearInterval(intervalId);
  }, [selectedMonth]);

  useEffect(() => {
    if (isMounted.current && selectedMonth) {
      fetchLeadsTimeline(selectedMonth);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (!loading && !chartLoading && leadsTimelineData.dates && leadsTimelineData.dates.length > 0) {
      renderLeadsChart();
    }
    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [leadsTimelineData, loading, chartLoading]);

  const generateProjectId = (projectName, projectId) => {
    if (!projectName) return projectId ? projectId.substring(0, 6).toUpperCase() : "PROJ";
    const letters = String(projectName).replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase();
    return `${letters}-${projectId.substring(projectId.length - 4).toUpperCase()}`;
  };

  const isOverdue = (p) => p.deadline && p.status === "active" && new Date(p.deadline) < new Date();

  const formatDate = (v) => {
    if (!v) return "Not set";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "Not set";
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const statusStyle = (status) => {
    switch (status) {
      case 'active': return { color: '#3b82f6', background: '#eff6ff' };
      case 'completed': return { color: '#10b981', background: '#ecfdf5' };
      case 'on-hold': return { color: '#f59e0b', background: '#fffbeb' };
      case 'canceled': return { color: '#ef4444', background: '#fef2f2' };
      case 'overdue': return { color: '#ef4444', background: '#fef2f2' };
      default: return { color: '#64748b', background: '#f8fafc' };
    }
  };

  const priorityStyle = (priority) => {
    switch (priority) {
      case 'high': return { color: '#ef4444', background: '#fef2f2' };
      case 'medium': return { color: '#f59e0b', background: '#fffbeb' };
      case 'low': return { color: '#10b981', background: '#ecfdf5' };
      default: return { color: '#64748b', background: '#f8fafc' };
    }
  };

  const handleUpdateLead = async (leadId, type, updateData) => {
    try {
      if (type === 'meta') {
        await api.put(`/meta-leads/${leadId}`, updateData);
      } else {
        await api.put(`/leads/${leadId}`, updateData);
      }
      
      // Optimistically update the UI
      setRecentLeads(prev => prev.map(l => {
        if (l._id !== leadId) return l;
        // If assignedTo is updated, populate it with employee data so the UI doesn't break
        let newLead = { ...l, ...updateData };
        if (updateData.assignedTo !== undefined) {
          if (!updateData.assignedTo) {
            newLead.assignedTo = null;
          } else {
            const emp = employees.find(e => e._id === updateData.assignedTo);
            if (emp) newLead.assignedTo = emp;
          }
        }
        return newLead;
      }));
      
      // Update statModalData if it's open
      setStatModalData(prev => prev.map(l => {
        if (l._id !== leadId) return l;
        let newLead = { ...l, ...updateData };
        if (updateData.assignedTo !== undefined) {
          if (!updateData.assignedTo) {
            newLead.assignedTo = null;
          } else {
            const emp = employees.find(e => e._id === updateData.assignedTo);
            if (emp) newLead.assignedTo = emp;
          }
        }
        return newLead;
      }));
    } catch (err) {
      console.error('Error updating lead:', err);
      alert('Failed to update lead');
    }
  };

  const fetchAndShowEmployeeSummary = async (empId) => {
    if (!empId) return;
    setEmployeeSummaryLoading(true);
    setEmployeeSummaryData(null);
    setShowEmployeeSummaryModal(true);
    try {
      const res = await api.get(`/employees/${empId}/summary`);
      setEmployeeSummaryData(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to fetch employee details');
      setShowEmployeeSummaryModal(false);
    } finally {
      setEmployeeSummaryLoading(false);
    }
  };

  const fetchDepartmentData = async (month) => {
    setChartLoading(true);
    try {
      const genderStats = await api.get(`/employees/gender-stats?month=${month}`)
        .catch(() => ({ data: { departments: [], overall: { total: 0, male: 0, female: 0 } } }));
      const depts = genderStats.data?.departments || [];
      const newData = {
        departments: depts.map(d => d.name),
        counts: depts.map(d => d.total),
        maleCounts: depts.map(d => d.male),
        femaleCounts: depts.map(d => d.female),
      };
      setDepartmentData(newData);
      setChartLoading(false);
      // Call renderChart directly with fresh data to avoid stale closure
      setTimeout(() => renderChart(newData), 0);
    } catch {
      setChartLoading(false);
    }
  };

  const fetchLeadsTimeline = async (month) => {
    setChartLoading(true);
    try {
      // Fetch leads timeline data for the selected month
      const timelineResp = await api.get(`/meta-leads/timeline?month=${month}`)
        .catch((err) => {
          console.error('Error fetching timeline:', err);
          return { data: { dates: [], sources: [] } };
        });
      
      const timelineData = timelineResp.data;
      console.log('Timeline data from backend:', timelineData);
      
      setLeadsTimelineData(timelineData);
      setChartLoading(false);
      
      // Only render chart if we have data
      if (timelineData.dates && timelineData.dates.length > 0) {
        setTimeout(() => renderLeadsChart(timelineData), 0);
      }
    } catch (err) {
      console.error('Timeline fetch error:', err);
      setChartLoading(false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch current and previous stats in parallel (adjust endpoint as needed)
      const responses = await Promise.all([
        api.get('/attendance/today-stats').catch(() => ({ data: { presentToday: 0, absentToday: 0 } })),
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/meta-leads?page=1&limit=50&sortBy=createdTime&sortOrder=desc').catch(() => ({ data: { leads: [], total: 0 } })),
        api.get('/leads').catch(() => ({ data: [] })),
        api.get(`/employees/gender-stats?month=${selectedMonth}`).catch(() => ({ data: { departments: [], overall: { total: 0, male: 0, female: 0 } } })),
        api.get('/dashboard/previous-stats').catch(() => ({ data: { presentToday: 0, absentToday: 0, activeProjects: 0, totalLeads: 0 } })),
        api.get('/activities').catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] }))
      ]);

      const [
        attendanceStats, projects, metaLeadsResp, manualLeadsResp,
        genderStats, prevStatsResp, activitiesResp, employeesResp
      ] = responses;

      setEmployees(employeesResp.data || []);

      // Combine meta leads and manual leads
      const metaLeadsArr = metaLeadsResp.data?.leads || (Array.isArray(metaLeadsResp.data) ? metaLeadsResp.data : []);
      const manualLeadsArr = Array.isArray(manualLeadsResp.data) ? manualLeadsResp.data : [];
      const combinedLeads = [...metaLeadsArr, ...manualLeadsArr];

      // Use combined count for Total Leads (optional, depending on if you want it to reflect both)
      const totalMetaLeads = (metaLeadsResp.data?.pagination?.total ?? metaLeadsResp.data?.total ?? metaLeadsArr.length) + manualLeadsArr.length;
      
      // Set recent leads for table display - always keep newest first for admin visibility
      const sortedLeads = combinedLeads
        .filter((lead) => lead && (lead.createdTime || lead.createdAt || lead.syncedAt))
        .sort((a, b) => {
          const aTime = new Date(a.createdTime || a.createdAt || a.syncedAt || 0).getTime();
          const bTime = new Date(b.createdTime || b.createdAt || b.syncedAt || 0).getTime();
          return bTime - aTime;
        });
      setRecentLeads(sortedLeads.slice(0, 50)); // Only keep the top 50 so UI doesn't lag

      // Recent activity feed for admin card
      const latestActivities = Array.isArray(activitiesResp.data) ? activitiesResp.data : [];
      setRecentActivities(latestActivities.slice(0, 6));

      // Fetch lead source stats
      const GAUGE_COLORS = ['#162a16', '#3b775e', '#a8e63d', '#0891b2', '#8b5cf6', '#f59e0b'];
      const sourceStatsResp = await api.get('/meta-leads/source-stats').catch(() => ({ data: { sources: [] } }));
      const rawSources = sourceStatsResp.data?.sources || [];
      setLeadSources(rawSources.map((s, i) => ({
        label: s.label,
        color: GAUGE_COLORS[i % GAUGE_COLORS.length],
        value: s.percent,
        count: s.count,
      })));

      // Count project statuses for pie chart
      let completed = 0, working = 0, canceled = 0;
      (projects.data || []).forEach(p => {
        if (['completed', 'done', 'finished'].includes((p.status || '').toLowerCase())) completed++;
        else if (['active', 'in-progress', 'working', 'progress'].includes((p.status || '').toLowerCase())) working++;
        else if (['canceled', 'cancelled', 'aborted'].includes((p.status || '').toLowerCase())) canceled++;
      });
      setProjectStatusCounts({ completed, working, canceled });

      const activeProjects = (projects.data || []).filter(
        p => p.status === 'active'
      ).length;

      setStats({
        presentToday: attendanceStats.data?.presentToday || 0,
        absentToday: attendanceStats.data?.absentToday ?? ((attendanceStats.data?.totalActive - attendanceStats.data?.presentToday) || 0),
        activeProjects,
        totalLeads: totalMetaLeads,
      });

      // Set previous stats for percentage calculation
      setPrevStats({
        presentToday: prevStatsResp.data?.presentToday || 0,
        absentToday: prevStatsResp.data?.absentToday || 0,
        activeProjects: prevStatsResp.data?.activeProjects || 0,
        totalLeads: prevStatsResp.data?.totalLeads || 0,
      });

      // Fetch weekly sparkline data for cards
      const sparkResp = await api.get('/dashboard/weekly-sparklines').catch(() => ({ data: null }));
      if (sparkResp.data) {
        setCardSparklines({
          present: sparkResp.data.present || [],
          absent:  sparkResp.data.absent  || [],
          leads:   sparkResp.data.leads   || [],
          projects:sparkResp.data.projects|| [],
        });
      } else {
        // Fallback: derive sparklines from already-fetched stats
        setCardSparklines({
          present:  Array.from({ length: 7 }, (_, i) => Math.max(0, (attendanceStats.data?.presentToday || 0) - (6 - i) * 2 + Math.floor(Math.random() * 3))),
          absent:   Array.from({ length: 7 }, (_, i) => Math.max(0, (attendanceStats.data?.absentToday  || 0) - (6 - i) * 1 + Math.floor(Math.random() * 2))),
          leads:    Array.from({ length: 7 }, (_, i) => Math.round((totalMetaLeads / 30) * (i + 1))),
          projects: Array.from({ length: 7 }, (_, i) => Math.max(0, activeProjects - (6 - i))),
        });
      }

      const depts = genderStats.data?.departments || [];
      setDepartmentData({
        departments: depts.map(d => d.name),
        counts: depts.map(d => d.total),
        maleCounts: depts.map(d => d.male),
        femaleCounts: depts.map(d => d.female),
      });
      // Prevent the selectedMonth useEffect from double-fetching on initial load
      // by setting departmentData here directly with the initial month
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const renderChart = (data) => {
    const chartData = data || departmentData;
    if (!chartRef.current || !window.Chart) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const ctx = chartRef.current.getContext('2d');
    const canvasHeight = chartRef.current.offsetHeight || 320;

    // Dynamic y-axis: spread the data to fill the chart height naturally
    const allVals = [...(chartData.counts || []), ...(chartData.maleCounts || []), ...(chartData.femaleCounts || [])];
    const dataMax = Math.max(...allVals, 1);
    const rawStep = dataMax <= 5 ? 1 : dataMax <= 20 ? 5 : dataMax <= 50 ? 10 : dataMax <= 100 ? 20 : 50;
    const suggestedMax = Math.ceil((dataMax * 1.6) / rawStep) * rawStep;

    // Strong gradient fills — bold wave style like the reference
    const makeGrad = (r, g, b, topAlpha, botAlpha) => {
      const g1 = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      g1.addColorStop(0,    `rgba(${r},${g},${b},${topAlpha})`);
      g1.addColorStop(0.45, `rgba(${r},${g},${b},${topAlpha * 0.5})`);
      g1.addColorStop(1,    `rgba(${r},${g},${b},${botAlpha})`);
      return g1;
    };

    const crosshairPlugin = {
      id: 'crosshair',
      afterDraw(chart) {
        if (!chart.tooltip._active || !chart.tooltip._active.length) return;
        const c = chart.ctx;
        const x = chart.tooltip._active[0].element.x;
        c.save();
        c.beginPath();
        c.moveTo(x, chart.scales.y.top);
        c.lineTo(x, chart.scales.y.bottom);
        c.lineWidth = 1;
        c.strokeStyle = 'rgba(107,114,128,0.3)';
        c.setLineDash([5, 4]);
        c.stroke();
        c.restore();
      },
    };

    chartInstance.current = new window.Chart(ctx, {
      type: 'line',
      plugins: [crosshairPlugin],
      data: {
        labels: chartData.departments,
        datasets: [
          {
            label: 'Total',
            data: chartData.counts,
            borderColor: '#b2ff1e',
            backgroundColor: makeGrad(178, 255, 0, 0.55, 0.02),
            borderWidth: 2.5,
            tension: 0.5,
            cubicInterpolationMode: 'monotone',
            fill: 'origin',
            order: 3,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#b2ff1e',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
          {
            label: 'Male',
            data: chartData.maleCounts,
            borderColor: '#3b775e',
            backgroundColor: makeGrad(59, 119, 94, 0.50, 0.02),
            borderWidth: 2.5,
            tension: 0.5,
            cubicInterpolationMode: 'monotone',
            fill: 'origin',
            order: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#3b775e',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
          {
            label: 'Female',
            data: chartData.femaleCounts,
            borderColor: '#ff9900',
            backgroundColor: makeGrad(255, 153, 0, 0.45, 0.02),
            borderWidth: 2.5,
            tension: 0.5,
            cubicInterpolationMode: 'monotone',
            fill: 'origin',
            order: 1,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#ff9900',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 4, bottom: 0, left: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            padding: { top: 10, bottom: 10, left: 14, right: 16 },
            titleColor: '#111827',
            bodyColor: '#4b5563',
            titleFont: { size: 13, weight: '700', family: 'Inter, Segoe UI, Arial, sans-serif' },
            bodyFont: { size: 12, weight: '400', family: 'Inter, Segoe UI, Arial, sans-serif' },
            cornerRadius: 10,
            borderColor: '#e5e7eb',
            borderWidth: 1,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 5,
            caretSize: 5,
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => `  ${item.dataset.label}: ${item.parsed.y}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax,
            ticks: {
              font: { size: 11, family: 'Inter, Segoe UI, Arial, sans-serif' },
              color: '#c4c9d4',
              stepSize: rawStep,
              padding: 12,
              maxTicksLimit: 5,
            },
            grid: {
              display: true,
              color: 'rgba(229,231,235,0.55)',
              lineWidth: 1,
            },
            border: { display: false },
          },
          x: {
            ticks: {
              font: { size: 11, family: 'Inter, Segoe UI, Arial, sans-serif' },
              color: '#c4c9d4',
              maxRotation: 0,
              minRotation: 0,
              padding: 8,
            },
            grid: { display: false },
            border: { display: false },
          },
        },
        interaction: { intersect: false, mode: 'index' },
        animation: { duration: 800, easing: 'easeInOutCubic' },
      },
    });
  };

  const renderLeadsChart = (data) => {
    const chartData = data || leadsTimelineData;
    if (!chartRef.current || !window.Chart) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const ctx = chartRef.current.getContext('2d');
    const canvasHeight = chartRef.current.offsetHeight || 320;

    // Calculate max value across all sources for dynamic y-axis
    let allVals = [];
    (chartData.sources || []).forEach(source => {
      allVals = allVals.concat(source.data || []);
    });
    const dataMax = Math.max(...allVals, 1);
    const rawStep = dataMax <= 5 ? 1 : dataMax <= 20 ? 5 : dataMax <= 50 ? 10 : dataMax <= 100 ? 20 : 50;
    const suggestedMax = Math.ceil((dataMax * 1.6) / rawStep) * rawStep;

    // Strong gradient fills — bold wave style like the reference
    const makeGrad = (r, g, b, topAlpha, botAlpha) => {
      const g1 = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      g1.addColorStop(0,    `rgba(${r},${g},${b},${topAlpha})`);
      g1.addColorStop(0.45, `rgba(${r},${g},${b},${topAlpha * 0.5})`);
      g1.addColorStop(1,    `rgba(${r},${g},${b},${botAlpha})`);
      return g1;
    };

    const crosshairPlugin = {
      id: 'crosshair',
      afterDraw(chart) {
        if (!chart.tooltip._active || !chart.tooltip._active.length) return;
        const c = chart.ctx;
        const x = chart.tooltip._active[0].element.x;
        c.save();
        c.beginPath();
        c.moveTo(x, chart.scales.y.top);
        c.lineTo(x, chart.scales.y.bottom);
        c.lineWidth = 1;
        c.strokeStyle = 'rgba(107,114,128,0.3)';
        c.setLineDash([5, 4]);
        c.stroke();
        c.restore();
      },
    };

    // Define colors for different lead sources - comprehensive palette
    const sourceColors = [
      { name: 'IndiaMART', border: '#3b82f6', rgb: [59, 130, 246] },
      { name: 'Meta', border: '#8b5cf6', rgb: [139, 92, 246] },
      { name: 'Facebook', border: '#8b5cf6', rgb: [139, 92, 246] },
      { name: 'Instagram', border: '#ec4899', rgb: [236, 72, 153] },
      { name: 'Website', border: '#10b981', rgb: [16, 185, 129] },
      { name: 'LinkedIn', border: '#f59e0b', rgb: [245, 158, 11] },
      { name: 'Email Marketing', border: '#0ea5e9', rgb: [14, 165, 233] },
      { name: 'Excel Import', border: '#f43f5e', rgb: [244, 63, 94] },
      { name: 'Manual', border: '#f59e0b', rgb: [245, 158, 11] },
      { name: 'Other', border: '#a8e63d', rgb: [168, 230, 61] },
      // Additional dynamic colors for any other sources
      { name: 'default_0', border: '#06b6d4', rgb: [6, 182, 212] },
      { name: 'default_1', border: '#84cc16', rgb: [132, 204, 22] },
      { name: 'default_2', border: '#f43f5e', rgb: [244, 63, 94] },
      { name: 'default_3', border: '#a855f7', rgb: [168, 85, 247] },
      { name: 'default_4', border: '#14b8a6', rgb: [20, 184, 166] },
      { name: 'default_5', border: '#eab308', rgb: [234, 179, 8] },
      { name: 'default_6', border: '#22c55e', rgb: [34, 197, 94] },
    ];

    // Build datasets from sources with dynamic color assignment
    const datasets = (chartData.sources || []).map((source, idx) => {
      let colorConfig = sourceColors.find(c => c.name === source.name);
      if (!colorConfig) {
        // Assign from default colors if no match found
        const defaultIdx = idx % 7;
        colorConfig = sourceColors[7 + defaultIdx] || sourceColors[6]; // lime green as ultimate fallback
      }
      return {
        label: source.name,
        data: source.data || [],
        borderColor: colorConfig.border,
        backgroundColor: makeGrad(colorConfig.rgb[0], colorConfig.rgb[1], colorConfig.rgb[2], 0.45, 0.02),
        borderWidth: 2.5,
        tension: 0.4,
        cubicInterpolationMode: 'monotone',
        fill: 'origin',
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: colorConfig.border,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      };
    });

    chartInstance.current = new window.Chart(ctx, {
      type: 'line',
      plugins: [crosshairPlugin],
      data: {
        labels: chartData.dates || [],
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 4, bottom: 0, left: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            padding: { top: 10, bottom: 10, left: 14, right: 16 },
            titleColor: '#111827',
            bodyColor: '#4b5563',
            titleFont: { size: 13, weight: '700', family: 'Inter, Segoe UI, Arial, sans-serif' },
            bodyFont: { size: 12, weight: '400', family: 'Inter, Segoe UI, Arial, sans-serif' },
            cornerRadius: 10,
            borderColor: '#e5e7eb',
            borderWidth: 1,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 5,
            caretSize: 5,
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => `  ${item.dataset.label}: ${item.parsed.y}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax,
            ticks: {
              font: { size: 11, family: 'Inter, Segoe UI, Arial, sans-serif' },
              color: '#c4c9d4',
              stepSize: rawStep,
              padding: 12,
              maxTicksLimit: 5,
            },
            grid: {
              display: true,
              color: 'rgba(229,231,235,0.55)',
              lineWidth: 1,
            },
            border: { display: false },
          },
          x: {
            ticks: {
              font: { size: 11, family: 'Inter, Segoe UI, Arial, sans-serif' },
              color: '#c4c9d4',
              maxRotation: 0,
              minRotation: 0,
              padding: 8,
              autoSkip: true,
              maxTicksLimit: 10,
            },
            grid: { display: false },
            border: { display: false },
          },
        },
        interaction: { intersect: false, mode: 'index' },
        animation: { duration: 800, easing: 'easeInOutCubic' },
      },
    });
  };

  // Dynamic gauge arc helpers
  const gaugeArcPoint = (frac) => {
    const angle = Math.PI * (1 - frac);
    return [+(50 + 40 * Math.cos(angle)).toFixed(3), +(50 - 40 * Math.sin(angle)).toFixed(3)];
  };
  const gaugeArcPath = (fromFrac, toFrac) => {
    if (toFrac - fromFrac < 0.001) return '';
    const [x1, y1] = gaugeArcPoint(fromFrac);
    const [x2, y2] = gaugeArcPoint(toFrac);
    // The full gauge is only 180° (a semicircle), so any segment within it
    // is always ≤180° — large-arc-flag must always be 0.
    return `M${x1},${y1} A40,40 0 0,1 ${x2},${y2}`;
  };

  const formatTimeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const activityIconMap = {
    leave: { color: '#f59e0b', bg: '#fffbeb' },
    attendance: { color: '#16a34a', bg: '#f0fdf4' },
    project: { color: '#3b82f6', bg: '#eff6ff' },
    lead: { color: '#8b5cf6', bg: '#f5f3ff' },
    payroll: { color: '#0891b2', bg: '#ecfeff' },
    employee: { color: '#3b775e', bg: '#f0faf5' },
    default: { color: '#6b7280', bg: '#f3f4f6' },
  };

  const getActivityStyle = (type = '') => {
    const t = type.toLowerCase();
    const key = Object.keys(activityIconMap).find(k => t.includes(k)) || 'default';
    return activityIconMap[key];
  };

  const getActivityIcon = (type = '', color) => {
    const t = type.toLowerCase();
    if (t.includes('leave'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="3" fill="#fbbf24" opacity="0.18"/>
          <rect x="3" y="4" width="18" height="18" rx="3" stroke="#f59e0b" strokeWidth="1.5" fill="none"/>
          <line x1="16" y1="2" x2="16" y2="6" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="8" y1="2" x2="8" y2="6" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="3" y1="10" x2="21" y2="10" stroke="#f59e0b" strokeWidth="1.3"/>
          <rect x="7" y="13" width="3" height="3" rx="0.8" fill="#f59e0b"/>
          <rect x="11" y="13" width="3" height="3" rx="0.8" fill="#fcd34d"/>
          <rect x="7" y="17" width="3" height="2" rx="0.8" fill="#fcd34d"/>
        </svg>
      );
    if (t.includes('attendance'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" fill="#16a34a" opacity="0.14"/>
          <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="1.5" fill="none"/>
          <circle cx="12" cy="12" r="2" fill="#16a34a"/>
          <line x1="12" y1="7" x2="12" y2="12" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="12" y1="12" x2="15.5" y2="14.5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      );
    if (t.includes('project'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M3 7c0-1.1.9-2 2-2h4l2 2.5h8a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="#3b82f6" opacity="0.18"/>
          <path d="M3 7c0-1.1.9-2 2-2h4l2 2.5h8a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="#3b82f6" strokeWidth="1.5" fill="none"/>
          <line x1="8" y1="13" x2="16" y2="13" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="8" y1="16" x2="13" y2="16" stroke="#93c5fd" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      );
    if (t.includes('lead'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="9" width="20" height="6" rx="3" fill="#8b5cf6" opacity="0.12"/>
          <polyline points="2 12 5.5 12 8 5 12 19 15 9 17.5 12 22 12" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <circle cx="8" cy="5" r="1.2" fill="#a78bfa"/>
          <circle cx="15" cy="9" r="1.2" fill="#a78bfa"/>
        </svg>
      );
    if (t.includes('payroll'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" fill="#0891b2" opacity="0.13"/>
          <circle cx="12" cy="12" r="9" stroke="#0891b2" strokeWidth="1.5" fill="none"/>
          <line x1="12" y1="6" x2="12" y2="18" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M15 9H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
      );
    if (t.includes('employee') || t.includes('joined') || t.includes('team') || t.includes('user'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3.5" fill="#3b775e" opacity="0.2"/>
          <circle cx="12" cy="8" r="3.5" stroke="#3b775e" strokeWidth="1.5" fill="none"/>
          <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#3b775e" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#3b775e" strokeWidth="1.5" strokeLinecap="round" fill="#3b775e" opacity="0.1"/>
        </svg>
      );
    if (t.includes('goal'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.5" fill="#fed7aa" opacity="0.9" fillOpacity="0.2"/>
          <circle cx="12" cy="12" r="6" stroke="#f97316" strokeWidth="1.3" fill="none"/>
          <circle cx="12" cy="12" r="3" stroke="#f97316" strokeWidth="1.2" fill="#fed7aa" fillOpacity="0.4"/>
          <circle cx="12" cy="12" r="1.5" fill="#f97316"/>
        </svg>
      );
    // default: info
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill="#6b7280" opacity="0.12"/>
        <circle cx="12" cy="12" r="9" stroke="#6b7280" strokeWidth="1.5" fill="none"/>
        <circle cx="12" cy="8" r="1" fill="#6b7280"/>
        <line x1="12" y1="11" x2="12" y2="17" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleCardClick = async (key) => {
    setShowStatModal(true);
    setStatModalType(key);
    setStatModalData([]);
    setStatModalSearch('');
    setStatModalLoading(true);

    try {
      if (key === 'present' || key === 'absent') {
        const res = await api.get(`/attendance/today-list?type=${key}`);
        setStatModalData(res.data || []);
      } else if (key === 'projects') {
        const res = await api.get('/projects');
        setStatModalData((res.data || []).filter(p => p.status === 'active'));
      } else if (key === 'leads') {
        const metaResp = await api.get('/meta-leads?page=1&limit=50&sortBy=createdTime&sortOrder=desc');
        const manualResp = await api.get('/leads');
        const m1 = Array.isArray(metaResp.data?.leads) ? metaResp.data.leads : [];
        const m2 = Array.isArray(manualResp.data) ? manualResp.data : [];
        const combined = [...m1, ...m2].filter(l => l).sort((a, b) => {
          const tA = new Date(a.createdTime || a.createdAt || a.syncedAt || 0).getTime();
          const tB = new Date(b.createdTime || b.createdAt || b.syncedAt || 0).getTime();
          return tB - tA;
        });
        setStatModalData(combined.slice(0, 100));
      }
    } catch (err) {
      console.error('Error fetching modal data:', err);
    } finally {
      setStatModalLoading(false);
    }
  };

  // Helper to calculate percent change and arrow
  // Accepts a themeColor for positive values
  function getPercentChange(current, prev, themeColor = '#16a34a', themeBg = 'rgba(22,163,74,0.08)') {
    if (prev === 0 && current === 0) return { percent: '0%', color: '#6b7280', bg: '#f3f4f6', arrow: 'up' };
    if (prev === 0) return { percent: '+100%', color: themeColor, bg: themeBg, arrow: 'up' };
    const diff = current - prev;
    const pct = Math.round((diff / Math.abs(prev)) * 100);
    if (pct > 0) return { percent: `+${pct}%`, color: themeColor, bg: themeBg, arrow: 'up' };
    if (pct < 0) return { percent: `${pct}%`, color: '#ef4444', bg: 'rgba(239,68,68,0.08)', arrow: 'down' };
    return { percent: '0%', color: '#6b7280', bg: '#f3f4f6', arrow: 'up' };
  }

  // Sparkline SVG renderer — rounded pill bars like the reference image
  const SparkBars = ({ data = [], color = '#a8e63d', height = 36, featured = false, labels = [] }) => {
    if (!data.length) return null;
    const max = Math.max(...data, 1);
    const barW = 7;
    const gap  = 4;
    const totalW = data.length * (barW + gap) - gap;
    const labelH = labels.length ? 12 : 0;
    const svgH = height + labelH;
    return (
      <svg width={totalW} height={svgH} viewBox={`0 0 ${totalW} ${svgH}`} style={{ display: 'block' }}>
        {data.map((v, i) => {
          const barH = Math.max(4, Math.round((v / max) * (height - 4)));
          const x = i * (barW + gap);
          const y = height - barH;
          const r = barW / 2;
          return (
            <rect
              key={i}
              x={x} y={y}
              width={barW} height={barH}
              rx={r} ry={r}
              fill={color}
              opacity={featured ? 0.85 : 0.7}
              className="spark-bar"
              style={{
                transformOrigin: `${x + barW/2}px ${height}px`,
                '--spark-delay': `${i * 0.08}s`,
                cursor: 'pointer'
              }}
            />
          );
        })}
        {labels.length > 0 && labels.map((lbl, i) => (
          <text
            key={`lbl-${i}`}
            x={i * (barW + gap) + barW / 2}
            y={svgH - 1}
            textAnchor="middle"
            fontSize="6"
            fontFamily="Inter, Segoe UI, Arial, sans-serif"
            fill="#9ca3af"
          >
            {lbl}
          </text>
        ))}
      </svg>
    );
  };

  const totalProjectStatusCount = projectStatusCounts.completed + projectStatusCounts.working + projectStatusCounts.canceled;
  const completedProjectPercent = totalProjectStatusCount
    ? Math.round((projectStatusCounts.completed / totalProjectStatusCount) * 100)
    : 0;

  const cards = [
    {
      key: 'present',
      label: 'Present',
      value: stats.presentToday,
      icon: (
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'50%', background:'#a8e63d', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7.5" r="3.5" fill="#162a16"/>
            <path d="M2.5 19.5c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" fill="#162a16"/>
            <path d="M15 12.5l2.5 2.5 5-5" stroke="#162a16" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      ),
      featured: true,
      valueColor: '#111827',
      sparkColor: '#a8e63d',
      sparkData: cardSparklines.present,
      ...getPercentChange(stats.presentToday, prevStats.presentToday, '#16a34a', 'rgba(22,163,74,0.08)'),
      percentText: 'from last month',
      trendIcon: <Users size={10} color="#3b775e" />,
      trendText: 'employees in office',
      trendColor: '#3b775e',
      trendSuffix: null,
    },
    {
      key: 'absent',
      label: 'Absent',
      value: stats.absentToday,
      icon: (
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'50%', background:'#3b775e', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7.5" r="3.5" fill="#fff"/>
            <path d="M2.5 19.5c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" fill="#fff"/>
            <line x1="16.5" y1="10" x2="21.5" y2="15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="21.5" y1="10" x2="16.5" y2="15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </span>
      ),
      featured: false,
      valueColor: '#111827',
      sparkColor: '#ef4444',
      sparkData: cardSparklines.absent,
      ...getPercentChange(stats.absentToday, prevStats.absentToday, '#ef4444', 'rgba(239,68,68,0.08)'),
      percentText: 'from last month',
      trendIcon: <TrendingDown size={10} color="#ef4444" />,
      trendText: "absent today",
      trendColor: '#ef4444',
      trendSuffix: 'from office',
    },
    {
      key: 'leads',
      label: 'Total Leads',
      value: stats.totalLeads,
      icon: (
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'50%', background:'#3b775e', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="13" width="4" height="7" rx="1" fill="#fff"/>
            <rect x="10" y="8" width="4" height="12" rx="1" fill="#fff"/>
            <rect x="17" y="4" width="4" height="16" rx="1" fill="#fff"/>
          </svg>
        </span>
      ),
      featured: false,
      valueColor: '#111827',
      sparkColor: '#0891b2',
      sparkData: cardSparklines.leads,
      ...getPercentChange(stats.totalLeads, prevStats.totalLeads, '#0891b2', 'rgba(8,145,178,0.08)'),
      percentText: 'from last month',
      trendIcon: <TrendingUp size={10} color="#0891b2" />,
      trendText: 'assigned',
      trendColor: '#0891b2',
      trendSuffix: 'leads total',
    },
    {
      key: 'projects',
      label: 'Active Projects',
      value: stats.activeProjects,
      icon: (
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'50%', background:'#3b775e', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="8" width="18" height="12" rx="2" fill="#fff"/>
            <path d="M15 8V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            <line x1="8" y1="13" x2="16" y2="13" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7"/>
            <line x1="8" y1="17" x2="13" y2="17" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5"/>
          </svg>
        </span>
      ),
      featured: false,
      valueColor: '#111827',
      sparkColor: '#16a34a',
      sparkData: cardSparklines.projects,
      ...getPercentChange(stats.activeProjects, prevStats.activeProjects, '#16a34a', 'rgba(22,163,74,0.08)'),
      percentText: 'from last month',
      trendIcon: <Activity size={10} color="#16a34a" />,
      trendText: 'in progress',
      trendColor: '#16a34a',
      trendSuffix: 'this month',
    },

  ];

  return (
    <div className="page-container" style={{ padding: '0 24px 20px 24px', background: '#f4f7f0', height: '100vh', overflowY: 'auto' }}>
      <div className="admin-dashboard">

        {/* Header */}
        <div className="admin-dashboard-header" style={{ position: 'sticky', top: 0, zIndex: 30, backgroundColor: '#f4f7f0', margin: '0 -24px 24px -24px', padding: '20px 24px 14px 24px', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
          <div className="admin-dashboard-title">
            <BarChart2 size={18} color="#14532d" />
            <h2>{user?.role?.name === 'Admin' ? 'Admin Overview' : 'HR Overview'}</h2>
          </div>
          <button className="admin-refresh-btn" onClick={handleRefresh} disabled={refreshing || loading} style={{ boxShadow: 'none' }}>
            {refreshing
              ? <span className="admin-skeleton" style={{ width: 62, height: 16, borderRadius: 5, display: 'inline-block' }} />
              : <><RefreshCw size={13} /> Refresh</>}
          </button>
        </div>

        {error && <div className="admin-error"><strong>Error:</strong> {error}</div>}

        {/* Outer 2-col grid: left (cards + chart) | right panel */}
        <div className="admin-outer-layout">

          {/* ── LEFT COLUMN ── */}
          <div className="admin-left-col">

            {/* Stat Cards — horizontal layout */}
            <div className="admin-stats-grid" style={{ position: 'sticky', top: '63px', zIndex: 20, backgroundColor: '#f4f7f0', opacity: 1, paddingBottom: '12px' }}>
              {cards.map((card) => (
                <div 
                  key={card.key} 
                  className={`admin-stat-card ist-stats-grid-item`}
                  onClick={() => handleCardClick(card.key)}
                  style={{ background: 'white', padding: '14px 16px 10px', borderRadius: '12px', border: '1px solid #e2e8f0', transition: 'all 0.3s', overflow: 'hidden', position: 'relative', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  {/* Floating Bubbles */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', width: '90px', height: '90px', borderRadius: '50%', background: card.sparkColor, opacity: 0.06, right: '-26px', bottom: '-26px' }} />
                    <div style={{ position: 'absolute', width: '54px', height: '54px', borderRadius: '50%', background: card.sparkColor, opacity: 0.04, right: '36px', bottom: '-20px' }} />
                  </div>

                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Label row + trend badge */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>{card.label}</div>
                      {loading ? (
                        <div className="admin-skeleton" style={{ height: 16, width: 40, borderRadius: 20 }} />
                      ) : card.percent ? (
                        <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: card.arrow === 'up' ? 'rgba(168,230,61,0.15)' : 'rgba(239,68,68,0.1)', color: card.arrow === 'up' ? '#3d7c00' : '#dc2626', whiteSpace: 'nowrap' }}>
                          {card.arrow === 'up' ? '▲' : '▼'} {card.percent.replace(/^[+-]/, '')}
                        </span>
                      ) : (
                        <div style={{ color: card.sparkColor }}>{card.icon}</div>
                      )}
                    </div>
                    
                    {/* Value */}
                    {loading ? (
                      <div className="admin-skeleton" style={{ height: 26, width: '55%', borderRadius: 6, margin: '4px 0 8px 0' }} />
                    ) : (
                      <div style={{ fontSize: '26px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '8px' }}>{card.value}</div>
                    )}
                    
                    {/* Bottom: vs last month + sparkline */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', flex: 1 }}>
                      {loading ? (
                        <div className="admin-skeleton" style={{ height: 11, width: '70%', borderRadius: 5 }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {card.percent ? (
                            <>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: card.arrow === 'up' ? '#16a34a' : '#ef4444', lineHeight: 1.2 }}>{card.arrow === 'up' ? '+' : '-'}{card.percent.replace(/^[+-]/, '')}</span>
                              <span style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.4 }}>{card.percentText || 'vs last month'}</span>
                            </>
                          ) : (
                            <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>{card.trendText} {card.trendSuffix}</span>
                          )}
                        </div>
                      )}
                      
                      {!loading && card.sparkData && card.sparkData.length > 0 && (
                        <div style={{ width: '60px', height: '24px', flexShrink: 0 }}>
                          <svg viewBox="0 0 100 40" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                            <path
                              d={`M ${card.sparkData.map((val, i) => {
                                const max = Math.max(...card.sparkData, 1);
                                const min = Math.min(...card.sparkData, 0);
                                const range = max - min || 1;
                                const x = (i / (card.sparkData.length - 1)) * 100;
                                const y = 38 - ((val - min) / range) * 36;
                                return `${x},${y}`;
                              }).join(' L ')}`}
                              fill="none"
                              stroke={card.sparkColor}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Leads Timeline Chart */}
            <div className="admin-chart-card">
              <div className="admin-chart-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TrendingUp size={19} color="#16a34a" style={{ flexShrink: 0 }} />
                  <div>
                    <h3 className="admin-chart-title">Leads Timeline</h3>
                    <p className="admin-chart-subtitle">Total leads per source over time</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400, whiteSpace: 'nowrap' }}>Current Month</span>

                  {/* Custom Month Picker */}
                  <div ref={monthPickerRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => { setPickerYear(parseInt(selectedMonth.split('-')[0])); setShowMonthPicker(v => !v); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px',
                        border: `1.5px solid ${showMonthPicker ? '#3b775e' : '#d1d5db'}`,
                        borderRadius: '20px',
                        fontSize: '12px', fontWeight: 600,
                        color: '#3b775e',
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        userSelect: 'none',
                        boxShadow: showMonthPicker ? '0 0 0 3px rgba(59,119,94,0.12)' : 'none',
                        transition: 'box-shadow 0.15s, border-color 0.15s',
                        outline: 'none',
                      }}
                    >
                      {selectedMonth
                        ? new Date(selectedMonth + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        : 'Select month'}
                      <Calendar size={13} color="#3b775e" style={{ flexShrink: 0 }} />
                    </button>

                    {showMonthPicker && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
                        padding: '18px 16px 14px',
                        minWidth: '244px',
                        zIndex: 1000,
                      }}>
                        {/* Year navigation */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                          <button
                            onClick={() => setPickerYear(y => y - 1)}
                            style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', color: '#374151', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                          >‹</button>
                          <span style={{ fontWeight: 700, fontSize: 15, color: '#111827', letterSpacing: 0.3 }}>{pickerYear}</span>
                          <button
                            onClick={() => setPickerYear(y => y + 1)}
                            style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', color: '#374151', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                          >›</button>
                        </div>

                        {/* Month grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => {
                            const val = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
                            const isSelected = val === selectedMonth;
                            const isNow = val === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                            return (
                              <button
                                key={m}
                                onClick={() => { setSelectedMonth(val); setShowMonthPicker(false); }}
                                style={{
                                  padding: '9px 4px',
                                  borderRadius: '10px',
                                  border: isNow && !isSelected ? '1.5px solid #3b775e' : '1.5px solid transparent',
                                  background: isSelected ? 'linear-gradient(135deg,#3b775e,#16a34a)' : 'transparent',
                                  color: isSelected ? '#fff' : isNow ? '#3b775e' : '#374151',
                                  fontWeight: isSelected || isNow ? 700 : 400,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  boxShadow: isSelected ? '0 2px 8px rgba(59,119,94,0.25)' : 'none',
                                  transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f0faf5'; }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                              >{m}</button>
                            );
                          })}
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                          <button
                            onClick={() => { setSelectedMonth(''); setShowMonthPicker(false); }}
                            style={{ background: 'none', border: 'none', fontSize: 12, color: '#9ca3af', cursor: 'pointer', fontWeight: 500 }}
                          >Clear</button>
                          <button
                            onClick={() => {
                              const n = new Date();
                              setSelectedMonth(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`);
                              setShowMonthPicker(false);
                            }}
                            style={{ background: 'none', border: 'none', fontSize: 12, color: '#3b775e', cursor: 'pointer', fontWeight: 700 }}
                          >This month</button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#9ca3af', fontSize: 18, fontWeight: 'bold', letterSpacing: 1, lineHeight: 1, display: 'flex', alignItems: 'center' }}>···</button>
                </div>
              </div>
              {loading || chartLoading ? (
                <div style={{ padding: '10px 4px 4px' }}>
                  {/* Legend skeleton */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>
                    {[44, 36, 48].map((w, i) => (
                      <div className="admin-skeleton" key={i} style={{ height: 20, width: w, borderRadius: 20 }} />
                    ))}
                  </div>
                  {/* Chart area skeleton — bars rising from bottom */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 180, padding: '0 8px' }}>
                    {[60, 90, 45, 110, 70, 130, 55, 95].map((h, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
                        <div className="admin-skeleton" style={{ height: h, borderRadius: '6px 6px 2px 2px' }} />
                        <div className="admin-skeleton" style={{ height: 10, borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : !leadsTimelineData.dates || leadsTimelineData.dates.length === 0 ? (
                <div className="admin-chart-empty">No leads timeline data available</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* Custom Legend */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, paddingRight: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                    {(leadsTimelineData.sources || []).map((source, idx) => {
                      const legendColors = {
                        'IndiaMART': { color: '#dbeafe', textColor: '#1e40af', border: '#93c5fd' },
                        'Meta': { color: '#ede9fe', textColor: '#6d28d9', border: '#c4b5fd' },
                        'Facebook': { color: '#ede9fe', textColor: '#6d28d9', border: '#c4b5fd' },
                        'Instagram': { color: '#fce7f3', textColor: '#be185d', border: '#f9a8d4' },
                        'Website': { color: '#d1fae5', textColor: '#047857', border: '#6ee7b7' },
                        'LinkedIn': { color: '#fef3c7', textColor: '#b45309', border: '#fcd34d' },
                        'Other': { color: '#f0fce4', textColor: '#3f6212', border: '#bef264' },
                        'default_0': { color: '#cffafe', textColor: '#0e7490', border: '#67e8f9' },
                        'default_1': { color: '#ecfccb', textColor: '#4d7c0f', border: '#bef264' },
                        'default_2': { color: '#ffe4e6', textColor: '#be123c', border: '#fda4af' },
                        'default_3': { color: '#f3e8ff', textColor: '#7e22ce', border: '#d8b4fe' },
                        'default_4': { color: '#ccfbf1', textColor: '#0f766e', border: '#5eead4' },
                        'default_5': { color: '#fef9c3', textColor: '#a16207', border: '#fde047' },
                        'default_6': { color: '#dcfce7', textColor: '#15803d', border: '#86efac' },
                      };
                      let colorConfig = legendColors[source.name];
                      if (!colorConfig) {
                        const defaultIdx = idx % 7;
                        colorConfig = legendColors[`default_${defaultIdx}`] || legendColors['Other'];
                      }
                      return (
                        <div key={source.name} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 7px', borderRadius: 20, background: colorConfig.color, border: `1px solid ${colorConfig.border}` }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: colorConfig.textColor, letterSpacing: 0.2 }}>{source.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Chart */}
                  <div className="admin-chart-wrapper admin-chart-wrapper--expanded">
                    <canvas ref={chartRef} />
                  </div>
                </div>
              )}
            </div>

            {/* Recent Leads Table */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
              <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Target size={16} style={{ color: '#3b775e' }} /> Recent Leads
                </h2>
                <div 
                  onClick={() => navigate('/leads')}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', color: '#64748b', transition: 'all 0.2s', border: '1px solid #e2e8f0' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#3b775e'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                  title="View All Leads"
                >
                  <ExternalLink size={16} />
                </div>
              </div>
              {(() => {
                const filteredRecentLeads = recentLeads;
                return loading ? (
                  <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    <div className="admin-skeleton" style={{ height: 300, width: '100%', borderRadius: 8 }} />
                  </div>
                ) : filteredRecentLeads.length > 0 ? (
                <div style={{ maxHeight: '460px', overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '1200px' }}>
                    <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>#</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Lead</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Contact</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Requirement</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Country</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Industry</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Source</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Lead Type</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Assigned To</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Added On</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '10px', textTransform: 'uppercase' }}>Added By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecentLeads.map((lead, idx) => {
                        const statusColors = {
                          'New': { bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
                          'Contacted': { bg: '#ffedd5', color: '#d97706', dot: '#f59e0b' },
                          'Qualified': { bg: '#dcfce7', color: '#16a34a', dot: '#22c55e' },
                          'Interested': { bg: '#ede9fe', color: '#7c3aed', dot: '#8b5cf6' },
                          'Follow-up': { bg: '#fce7f3', color: '#be185d', dot: '#ec4899' },
                          'Converted': { bg: '#d1fae5', color: '#047857', dot: '#059669' },
                          'Not Interested': { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444' },
                          'Closed': { bg: '#f1f5f9', color: '#475569', dot: '#64748b' },
                        };
                        const status = lead.status || 'New';
                        const st = statusColors[status] || statusColors['New'];
                        
                        // Assigned To
                        let assignedEmpName = 'Unassigned';
                        let assignedInitials = '?';
                        if (lead.assignedTo) {
                          if (typeof lead.assignedTo === 'object' && lead.assignedTo.firstName) {
                            assignedEmpName = `${lead.assignedTo.firstName} ${lead.assignedTo.lastName || ''}`.trim();
                            assignedInitials = `${lead.assignedTo.firstName[0] || ''}${lead.assignedTo.lastName?.[0] || ''}`.toUpperCase();
                          } else {
                            // If it's just an ID, without full employee list, show ID or fallback
                            assignedEmpName = 'Assigned';
                            assignedInitials = 'A';
                          }
                        }

                        // Lead Type
                        const lt = lead.leadType;
                        const ltCfg = lt === 'Hot' ? { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', dot: '#ef4444' }
                                  : lt === 'Warm' ? { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa', dot: '#f97316' }
                                  : lt === 'Cold' ? { bg: '#e0f2fe', color: '#0284c7', border: '#bae6fd', dot: '#38bdf8' }
                                  : { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', dot: '#cbd5e1' };

                        const displayDate = lead.createdTime || lead.createdAt || lead.syncedAt;

                        let sourceBg = '#f8fafc';
                        let sourceColor = '#64748b';
                        if (lead._type === 'meta') { sourceBg = '#ede9fe'; sourceColor = '#7c3aed'; }
                        else if (lead.source === 'Excel Import') { sourceBg = '#f0fdf4'; sourceColor = '#15803d'; }
                        else if (lead.source === 'Email Marketing') { sourceBg = '#e0f2fe'; sourceColor = '#0369a1'; }

                        const sourceName = lead._type === 'meta' ? (lead.pageName || 'Meta') : (lead.source || 'Manual').replace(' - Buyer Lead','').replace(' - Enquiry','');

                        return (
                          <tr key={lead._id || idx} style={{ borderBottom: idx < recentLeads.length - 1 ? '1px solid #f3f4f6' : 'none', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#94a3b8', fontSize: '10px' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a', marginBottom: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{lead.leadName || lead.name || lead.company || '—'}</div>
                              {lead.company && (lead.leadName || lead.name) && <div style={{ fontSize: '9.5px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{lead.company}</div>}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 500, color: '#475569', marginBottom: '1px' }}>{(lead.contactNumber && lead.contactNumber !== 'N/A') ? lead.contactNumber : (lead.phone && lead.phone !== 'N/A') ? lead.phone : '—'}</div>
                              {lead.email && <div style={{ fontSize: '9.5px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{lead.email}</div>}
                            </td>
                            <td style={{ padding: '10px 12px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: '#475569' }}>{lead.requirements || lead.requirement || lead.product || lead.description?.slice(0,50) || '—'}</td>
                            <td style={{ padding: '10px 12px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: '#475569' }}>{lead.country || '—'}</td>
                            <td style={{ padding: '10px 12px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: '#475569' }}>{lead.industry || '—'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, background: sourceBg, color: sourceColor }}>
                                {sourceName}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {lead._type === 'meta' ? (
                                <span style={{ color: '#cbd5e1', fontSize: '10px' }}>—</span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 7px', border: `1px solid ${ltCfg.border}`, borderRadius: '999px', fontSize: '10px', color: ltCfg.color, background: ltCfg.bg, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ltCfg.dot, flexShrink: 0, opacity: lt ? 1 : 0 }} />
                                  <select
                                    value={lt || ""}
                                    onChange={(e) => handleUpdateLead(lead._id, lead._type, { leadType: e.target.value })}
                                    style={{ fontSize: '10px', fontWeight: 700, background: 'transparent', color: ltCfg.color, border: 'none', cursor: 'pointer', outline: 'none', appearance: 'none', paddingRight: '0px' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <option value="" disabled>Type</option>
                                    <option value="Hot">Hot</option>
                                    <option value="Warm">Warm</option>
                                    <option value="Cold">Cold</option>
                                  </select>
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 7px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#f8fafc', fontSize: '10px', fontWeight: 600, color: lead.assignedTo ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap', maxWidth: '140px', overflow: 'hidden' }}>
                                {lead.assignedTo ? (
                                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#3b82f6', color: '#fff', fontSize: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{assignedInitials}</span>
                                ) : (
                                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} />
                                )}
                                <select
                                  value={lead.assignedTo ? (typeof lead.assignedTo === 'object' ? lead.assignedTo._id : lead.assignedTo) : ""}
                                  onChange={(e) => handleUpdateLead(lead._id, lead._type, { assignedTo: e.target.value || null })}
                                  style={{ fontSize: '10px', fontWeight: 600, background: 'transparent', color: lead.assignedTo ? '#0f172a' : '#94a3b8', border: 'none', cursor: 'pointer', outline: 'none', textOverflow: 'ellipsis', width: '120px' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="">Unassigned</option>
                                  {employees.filter(emp => emp.role?.name?.toLowerCase().includes('sales') && emp.isActive !== false).map(emp => (
                                    <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '1px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.dot }} />
                                <select
                                  value={status}
                                  onChange={(e) => handleUpdateLead(lead._id, lead._type, { status: e.target.value })}
                                  style={{ fontSize: '10.5px', fontWeight: 600, background: 'transparent', color: st.color, border: 'none', cursor: 'pointer', outline: 'none', appearance: 'none', paddingRight: '0px' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {Object.keys(statusColors).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: '11px', whiteSpace: 'nowrap' }}>
                              {displayDate ? new Date(displayDate).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: '11px', whiteSpace: 'nowrap' }}>
                              {lead.addedOn ? new Date(lead.addedOn).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '10px', whiteSpace: 'nowrap' }}>
                              {lead.createdBy ? (() => {
                                const nameColors = [
                                  { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
                                  { bg: '#f5f3ff', color: '#5b21b6', border: '#e9d5ff' },
                                  { bg: '#fdf2f8', color: '#9d174d', border: '#fbcfe8' },
                                  { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
                                  { bg: '#f0fdf4', color: '#065f46', border: '#bbf7d0' },
                                  { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
                                  { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4' }
                                ];
                                const nameStr = typeof lead.createdBy === 'object' ? (`${lead.createdBy.firstName || ''} ${lead.createdBy.lastName || ''}`.trim() || lead.createdBy.email || '') : lead.createdBy;
                                if (!nameStr) return '—';
                                const colorIdx = nameStr.length > 0 ? nameStr.charCodeAt(0) % nameColors.length : 0;
                                const c = nameColors[colorIdx];
                                return (
                                  <span 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const creatorId = typeof lead.createdBy === 'object' ? lead.createdBy._id : lead.createdBy;
                                      if (creatorId) fetchAndShowEmployeeSummary(creatorId);
                                    }}
                                    title="Click to view details"
                                    style={{ display: 'inline-flex', alignItems: 'center', padding: '2.5px 9px', borderRadius: '999px', background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 600, fontFamily: "'Inter', sans-serif", cursor: 'pointer' }}
                                  >
                                    {nameStr}
                                  </span>
                                );
                              })() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No leads available</div>
              );
              })()}
            </div>

          </div>{/* end left col */}

          {/* ── RIGHT PANEL ── starts at the same level as cards */}
          <div className="admin-right-panel">

            {/* Project Status Donut */}
            <div className="admin-right-card" style={{ minHeight: 340, position: 'sticky', top: '63px', zIndex: 20 }}>
              <div className="admin-right-card-header">
                <h4 className="admin-right-card-title">Project Status</h4>
                <div className="admin-right-card-dots"><span /><span /><span /></div>
              </div>
              {loading ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
                    <div className="admin-skeleton" style={{ width: 100, height: 100, borderRadius: '50%' }} />
                  </div>
                  <div className="admin-donut-legend">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="admin-donut-legend-row">
                        <div className="admin-skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                        <div className="admin-skeleton" style={{ height: 10, flex: 1, borderRadius: 5, margin: '0 8px' }} />
                        <div className="admin-skeleton" style={{ width: 28, height: 10, borderRadius: 5 }} />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-pie-chart-wrap">
                    <div style={{ width: 140, height: 140, position: 'relative', margin: '0 auto' }}>
                    <Pie
                      data={{
                        labels: ['Completed', 'Working', 'Canceled'],
                        datasets: [{
                          data: [projectStatusCounts.completed, projectStatusCounts.working, projectStatusCounts.canceled],
                          backgroundColor: ['#10b981', '#3b775e', '#a8e63d'],
                          borderColor: '#fff',
                          borderWidth: 3,
                          hoverOffset: 6,
                        }],
                      }}
                      options={{
                        cutout: '72%',
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (ctx) => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                              },
                            },
                          },
                        },
                      }}
                      width={90}
                      height={90}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '62px',
                        height: '62px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                      }}
                    >
                      <span style={{ fontSize: '20px', fontWeight: '700', color: '#162a16', lineHeight: 1 }}>
                        {completedProjectPercent}%
                      </span>
                      <span style={{ fontSize: '9px', fontWeight: '600', color: '#6b7280', marginTop: '2px' }}>
                        Done
                      </span>
                    </div>
                    </div>
                  </div>
                  <div className="admin-donut-legend">
                    {(() => {
                      const total = projectStatusCounts.completed + projectStatusCounts.working + projectStatusCounts.canceled;
                      return [
                        { label: 'Completed', color: '#10b981', value: projectStatusCounts.completed },
                        { label: 'Working',   color: '#3b775e', value: projectStatusCounts.working },
                        { label: 'Canceled',  color: '#a8e63d', value: projectStatusCounts.canceled },
                      ].map((item) => (
                        <div key={item.label} className="admin-donut-legend-row">
                          <span className="admin-donut-legend-dot" style={{ background: item.color }} />
                          <span className="admin-donut-legend-label">{item.label}</span>
                          <span className="admin-donut-legend-value">{total ? Math.round((item.value / total) * 100) : 0}%</span>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              )}
            </div>

            {/* Attendance Today */}
                        {/* Leads Source Card (semi-circular gauge style) */}
                        <div className="admin-right-card" style={{ minHeight: 240, flex: 1 }}>
                          <div className="admin-right-card-header">
                            <h4 className="admin-right-card-title">Leads Source</h4>
                            <div className="admin-right-card-dots"><span /><span /><span /></div>
                          </div>
                          {loading ? (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '10px 0 6px' }}>
                                <div className="admin-skeleton" style={{ width: 84, height: 42, borderRadius: 8 }} />
                                <div className="admin-skeleton" style={{ width: 80, height: 10, borderRadius: 5, marginTop: 8 }} />
                              </div>
                              <div style={{ marginTop: 8 }}>
                                {[...Array(3)].map((_, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                                    <div className="admin-skeleton" style={{ width: 7, height: 7, borderRadius: '50%', marginRight: 7, flexShrink: 0 }} />
                                    <div className="admin-skeleton" style={{ height: 10, flex: 1, borderRadius: 5, marginRight: 4 }} />
                                    <div className="admin-skeleton" style={{ width: 28, height: 10, borderRadius: 5 }} />
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Semi-circular gauge */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '14px 0 8px' }}>
                                <div style={{ position: 'relative', width: 104, height: 52, marginBottom: 8 }}>
                                  <svg width="104" height="52" viewBox="0 0 100 50">
                                    {/* Background track */}
                                    <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                                    {/* Dynamic colored arcs */}
                                    {(() => {
                                      const total = leadSources.reduce((s, x) => s + x.value, 0);
                                      if (!total) return null;
                                      let cum = 0;
                                      return leadSources.map((src) => {
                                        const frac = src.value / 100;
                                        const path = gaugeArcPath(cum, cum + frac);
                                        cum += frac;
                                        return path ? (
                                          <path key={src.label} d={path} fill="none" stroke={src.color} strokeWidth="10" />
                                        ) : null;
                                      });
                                    })()}
                                  </svg>
                                  {/* Center total */}
                                  <span style={{
                                    position: 'absolute', left: 0, right: 0, top: 32,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, fontSize: 19, color: '#162a16',
                                    letterSpacing: '-1px', lineHeight: 1.1, fontFamily: 'inherit', width: '100%'
                                  }}>
                                    {leadSources.reduce((a, b) => a + b.value, 0)}<span style={{ fontSize: 12, fontWeight: 600, marginLeft: 1 }}>%</span>
                                  </span>
                                </div>
                                <span style={{ fontSize: 12, color: '#6b7280', marginTop: 0 }}>of leads tracked</span>
                              </div>
                              {/* Legend */}
                              <div style={{ marginTop: 12 }}>
                                {leadSources.length === 0 ? (
                                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '8px 0' }}>No data</div>
                                ) : leadSources.map((src) => (
                                  <div key={src.label} style={{ display: 'flex', alignItems: 'center', marginBottom: 9, fontSize: 12 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: src.color, display: 'inline-block', marginRight: 8, flexShrink: 0 }} />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={src.label}>{src.label}</span>
                                    <span style={{ fontWeight: 600, color: '#162a16', marginLeft: 4 }}>{src.value}%</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
            <div className="admin-right-card admin-right-card--grow">
              <div className="admin-right-card-header">
                <h4 className="admin-right-card-title">Recent Activity</h4>
                <div className="admin-right-card-dots"><span /><span /><span /></div>
              </div>
              {loading ? (
                <div style={{ marginTop: 6 }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none' }}>
                      <div className="admin-skeleton" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="admin-skeleton" style={{ height: 11, width: '75%', borderRadius: 5, marginBottom: 4 }} />
                        <div className="admin-skeleton" style={{ height: 9, width: '45%', borderRadius: 5 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivities.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '24px 0' }}>No recent activity</div>
              ) : (
                <div className="no-scrollbar admin-activity-scroll" style={{ marginTop: 6 }}>
                  {recentActivities.map((activity, i) => {
                    const activityText = activity.description || activity.action || activity.type || '';
                    const style = getActivityStyle(activityText);
                    const userName = activity.user?.firstName
                      ? `${activity.user.firstName} ${activity.user.lastName || ''}`.trim()
                      : activity.performedBy || '';
                    const activityTime = activity.timestamp || activity.createdAt || activity.updatedAt;
                    return (
                      <div key={activity._id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: i < recentActivities.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <span style={{ width: 28, height: 28, borderRadius: '50%', background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {getActivityIcon(activityText, style.color)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {activity.title || activity.type || 'Activity'}
                          </div>
                          <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.4, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {activity.description || activity.action || '—'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            {userName && <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>{userName}</span>}
                            {userName && activityTime && <span style={{ fontSize: 10, color: '#d1d5db' }}>·</span>}
                            {activityTime && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: '#9ca3af' }}>
                                <Clock size={9} color="#9ca3af" />{formatTimeAgo(activityTime)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>{/* end right panel */}
        </div>{/* end outer layout */}

        {/* Dashboard Stat Click Modal */}
        {showStatModal && (() => {
          let title = '';
          let countText = '';
          let items = [];
          if (statModalType === 'present') {
            title = 'Present Today'; countText = 'employees';
            items = statModalData.filter(e => (`${e.firstName || ''} ${e.lastName || ''} ${e.employeeId || ''}`).toLowerCase().includes(statModalSearch.toLowerCase()));
          } else if (statModalType === 'absent') {
            title = 'Absent Today'; countText = 'employees';
            items = statModalData.filter(e => (`${e.firstName || ''} ${e.lastName || ''} ${e.employeeId || ''}`).toLowerCase().includes(statModalSearch.toLowerCase()));
          } else if (statModalType === 'projects') {
            title = 'Active Projects'; countText = 'projects';
            items = statModalData.filter(p => (p.name || '').toLowerCase().includes(statModalSearch.toLowerCase()));
          } else if (statModalType === 'leads') {
            title = 'Recent Leads'; countText = 'leads';
            items = statModalData.filter(l => (`${l.name || ''} ${l.company || l.formName || ''}`).toLowerCase().includes(statModalSearch.toLowerCase()));
          }
          
          const thStyle = { padding: '8px 10px', fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', whiteSpace: 'nowrap', textAlign: 'left', position: 'sticky', top: 0, zIndex: 1 };
          const tdStyle = { padding: '9px 10px', fontSize: '12px', color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };

          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(3px)' }} onClick={e => { if (e.target === e.currentTarget) { setShowStatModal(false); setStatModalSearch(''); } }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '12px', width: '580px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 2px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{title}</div>
                  <button onClick={() => { setShowStatModal(false); setStatModalSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                {/* Search */}
                <input autoFocus placeholder={`Search ${countText}...`} value={statModalSearch} onChange={e => setStatModalSearch(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', marginBottom: '10px', color: '#334155' }} />
                
                {/* Table container */}
                <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>#</th>
                        {(statModalType === 'present' || statModalType === 'absent') && (
                          <>
                            <th style={thStyle}>Emp ID</th>
                            <th style={thStyle}>Name</th>
                            <th style={thStyle}>Designation</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Status</th>
                          </>
                        )}
                        {statModalType === 'projects' && (
                          <>
                            <th style={thStyle}>Project Name</th>
                            <th style={thStyle}>Client</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Status</th>
                          </>
                        )}
                        {statModalType === 'leads' && (
                          <>
                            <th style={thStyle}>Lead Name</th>
                            <th style={thStyle}>Source/Form</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Status</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {statModalLoading ? (
                        <tr><td colSpan="5" style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Loading {countText}...</td></tr>
                      ) : items.length === 0 ? (
                        <tr><td colSpan="5" style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>No {countText} found</td></tr>
                      ) : items.map((item, idx) => (
                        <tr 
                          key={item._id || idx} 
                          onClick={() => {
                            if (statModalType === 'projects') {
                              setViewProject(item);
                            } else if (statModalType === 'leads') {
                              setShowStatModal(false);
                              navigate('/leads');
                            } else if (statModalType === 'present' || statModalType === 'absent') {
                              setShowStatModal(false);
                              navigate('/attendance');
                            }
                          }}
                          style={{ transition: 'background 0.15s', cursor: 'pointer' }} 
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} 
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', fontSize: '10.5px' }}>{idx + 1}</td>
                          {(statModalType === 'present' || statModalType === 'absent') && (
                            <>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{item.employeeId || '—'}</td>
                              <td style={{ ...tdStyle, fontWeight: 600, color: '#0f172a' }}>{item.firstName} {item.lastName}</td>
                              <td style={{ ...tdStyle, color: '#64748b' }}>{item.designation || '—'}</td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <span style={{ padding: '3px 8px', background: statModalType === 'present' ? '#dcfce7' : '#fee2e2', color: statModalType === 'present' ? '#16a34a' : '#dc2626', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                                  {statModalType === 'present' ? 'Present' : 'Absent'}
                                </span>
                              </td>
                            </>
                          )}
                          {statModalType === 'projects' && (
                            <>
                              <td style={{ ...tdStyle, fontWeight: 600, color: '#0f172a' }}>{item.name || '—'}</td>
                              <td style={{ ...tdStyle, color: '#64748b' }}>{item.clientName || '—'}</td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <span style={{ padding: '3px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                  {item.status || 'Active'}
                                </span>
                              </td>
                            </>
                          )}
                          {statModalType === 'leads' && (
                            <>
                              <td style={{ ...tdStyle, fontWeight: 600, color: '#0f172a' }}>{item.name || '—'}</td>
                              <td style={{ ...tdStyle, color: '#64748b' }}>{item.source || item.formName || '—'}</td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <span style={{ padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                                  {item.status || 'New'}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer details */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px 0', marginTop: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                    {statModalLoading ? '-' : items.length} {countText.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>{statModalData.length} total</span>
                </div>
              </div>
            </div>
          );
        })()}

        {viewProject && (
          <div onClick={() => setViewProject(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 999999 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "600px", background: "#fff", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 20px 40px rgba(15,23,42,0.18)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>Project Details</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{generateProjectId(viewProject.name, viewProject._id)}</div>
                </div>
                <button onClick={() => setViewProject(null)} style={{ background: "transparent", border: "none", fontSize: "24px", color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}>x</button>
              </div>
              
              <div style={{ padding: "20px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#0f172a", fontWeight: 700 }}>{viewProject.name}</h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>{viewProject.description || "No description provided."}</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", background: "#f8fafc", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Client</div>
                    <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600 }}>{viewProject.clientName || "-"}</div>
                    {viewProject.clientCompany && <div style={{ fontSize: "12px", color: "#64748b" }}>{viewProject.clientCompany}</div>}
                    {viewProject.clientEmail && <div style={{ fontSize: "12px", color: "#64748b" }}>{viewProject.clientEmail}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Status & Value</div>
                    <div style={{ marginBottom: "6px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, ...statusStyle(isOverdue(viewProject) ? 'overdue' : viewProject.status) }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor" }} />
                        {isOverdue(viewProject) ? 'Overdue' : (viewProject.status === 'active' ? 'Progress' : viewProject.status?.replace("-", " "))}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600 }}>{viewProject.projectValue ? `₹${Number(viewProject.projectValue).toLocaleString()}` : "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Timeline</div>
                    <div style={{ fontSize: "13px", color: "#475569" }}>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>Start:</span> {formatDate(viewProject.startDate)}
                    </div>
                    <div style={{ fontSize: "13px", color: "#475569" }}>
                      <span style={{ fontWeight: 600, color: isOverdue(viewProject) ? "#dc2626" : "#0f172a" }}>Deadline:</span> {formatDate(viewProject.deadline)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Priority</div>
                    <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", ...priorityStyle(viewProject.priority) }}>
                      {viewProject.priority}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "#0f172a", fontWeight: 700, marginBottom: "10px" }}>Assigned Team</div>
                  {viewProject.assignedEmployees && viewProject.assignedEmployees.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {viewProject.assignedEmployees.map((member) => {
                        const memberId = typeof member === 'object' ? member._id : member;
                        const empObj = typeof member === 'object' && (member.name || member.firstName) ? member : null;
                        const emp = empObj;
                        const empName = emp ? (emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || "Employee") : "Employee";
                        const finalEmail = (emp && emp.email) ? emp.email : "";
                        const assignmentDate = viewProject.employeeAssignmentDates && viewProject.employeeAssignmentDates[memberId]
                          ? viewProject.employeeAssignmentDates[memberId]
                          : (viewProject.startDate || viewProject.createdAt);
                        
                        return (
                          <div key={memberId} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", border: "1px solid #f1f5f9", borderRadius: "8px" }}>
                            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#475569", flexShrink: 0 }}>
                              {empName !== "Employee" ? empName.charAt(0).toUpperCase() : "?"}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{empName}</div>
                              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                                {emp && emp.employeeId && (
                                  <span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontWeight: 600, color: "#475569" }}>
                                    {emp.employeeId}
                                  </span>
                                )}
                                {emp && emp.designation && <span>• {emp.designation}</span>}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                              {finalEmail && (
                                <div style={{ fontSize: "11px", color: "#64748b", textAlign: "right" }}>{finalEmail}</div>
                              )}
                              <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px", fontWeight: 500 }}>
                                Assigned on {formatDate(assignmentDate)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: "16px", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1", color: "#64748b", fontSize: "13px" }}>
                      No employees assigned to this project yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showEmployeeSummaryModal && (
          <div className="is-modal-overlay" onClick={() => setShowEmployeeSummaryModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(3px)' }}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                fontFamily: "'Poppins', 'Inter', 'Segoe UI', sans-serif",
                width: "350px",
                maxWidth: "90vw",
                minHeight: "auto",
                background: "#ffffff",
                borderRadius: "14px",
                border: "1px solid #e5e7eb",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "9px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
                animation: "is-modal-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
                position: "relative",
                boxSizing: "border-box"
              }}
            >
              {/* Close Button 'X' at top right */}
              <button
                type="button"
                onClick={() => setShowEmployeeSummaryModal(false)}
                style={{
                  position: "absolute",
                  top: "22px",
                  right: "22px",
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  color: "#6b7280",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 20,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.color = "#111827";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.color = "#6b7280";
                }}
              >
                ×
              </button>

              <div
                style={{
                  position: "relative",
                  height: "135px",
                  borderRadius: "11px",
                  overflow: "hidden",
                  background: "linear-gradient(135deg, #d1d5db, #e5e7eb)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {employeeSummaryLoading ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="3" strokeLinecap="round" style={{ animation: 'spin 1.8s linear infinite' }}>
                    <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                  </svg>
                ) : employeeSummaryData?.profileImage || employeeSummaryData?.avatar || employeeSummaryData?.photo ? (
                  <img
                    src={employeeSummaryData.profileImage || employeeSummaryData.avatar || employeeSummaryData.photo}
                    alt={employeeSummaryData ? `${employeeSummaryData.firstName} ${employeeSummaryData.lastName}` : "Member"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: "#a8e63d",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", lineHeight: 1.15 }}>
                  {employeeSummaryData ? `${employeeSummaryData.firstName} ${employeeSummaryData.lastName}` : "Loading..."}
                </div>
                {employeeSummaryData && (
                  <div style={{
                    width: "14px",
                    height: "14px",
                    marginLeft: "-2px",
                    borderRadius: "50%",
                    background: "#4caf50",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 7L10 17l-6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>

              <div style={{ fontSize: "11px", color: "#6b7280", lineHeight: 1.35 }}>
                {employeeSummaryData?.designation || employeeSummaryData?.role?.name || "CRM User"}
              </div>

              <div style={{ height: "1px", background: "#f1f5f9", margin: "4px 0" }} />

              {employeeSummaryData && (
                <div style={{ display: "grid", gap: "6px", marginTop: "2px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", color: "#6b7280" }}>Employee ID</span>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937" }}>{employeeSummaryData.employeeId || "-"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", color: "#6b7280" }}>Department</span>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937", textAlign: "right" }}>{employeeSummaryData.department || "-"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", color: "#6b7280" }}>Role</span>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937", textAlign: "right" }}>{employeeSummaryData.role?.name || "-"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", color: "#6b7280" }}>Contact</span>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937", textAlign: "right" }}>{employeeSummaryData.phone || "-"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", color: "#6b7280" }}>Joining Date</span>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937", textAlign: "right" }}>
                      {employeeSummaryData.joiningDate ? new Date(employeeSummaryData.joiningDate).toLocaleDateString('en-IN') : "-"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", color: "#6b7280" }}>Email</span>
                    <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937", textAlign: "right", wordBreak: "break-all", maxWidth: "220px" }}>{employeeSummaryData.email}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", color: "#6b7280" }}>Leads Added</span>
                    <span style={{ fontSize: "10px", fontWeight: 750, color: "#166534" }}>{employeeSummaryData.totalLeadsAdded || 0}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowEmployeeSummaryModal(false)}
                style={{
                  marginTop: "12px",
                  border: "none",
                  borderRadius: "999px",
                  background: "linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%)",
                  color: "#1f2937",
                  padding: "8px 10px",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 3px 8px rgba(168, 230, 61, 0.2)",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                onMouseLeave={e => e.currentTarget.style.opacity = 1}
              >
                Close Profile
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default AdminDashboard;


