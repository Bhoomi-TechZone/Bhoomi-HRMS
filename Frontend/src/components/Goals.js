import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  FolderKanban,
  UserCircle2,
} from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("hrms-goals-fonts")) {
  const link = document.createElement("link");
  link.id = "hrms-goals-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap";
  document.head.appendChild(link);
}

function Goals() {
  const { hasPermission, user, notifications: globalNotifications, setNotifications } = useAuth();
  const location = useLocation();
  const [goals, setGoals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [goalStats, setGoalStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    delayed: 0,
    completedEmployees: 0,
    delayedEmployees: 0,
    inProgressEmployees: 0,
    noCheckInEmployees: 0
  });
  const [showModal, setShowModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [currentGoalForNotes, setCurrentGoalForNotes] = useState(null);
  const [tempNotes, setTempNotes] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentReviewData, setCurrentReviewData] = useState(null);
  const [reviewDescription, setReviewDescription] = useState("");
  const [selectedReviewProject, setSelectedReviewProject] = useState("");
  const [selectedReviewTask, setSelectedReviewTask] = useState("");
  const [selectedTeamLeader, setSelectedTeamLeader] = useState("");
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const viewMode = 'card';
  const [filters, setFilters] = useState({
    employeeName: "",
    projectName: "",
    deadline: "",
    startDate: "",
    endDate: "",
    status: "",
  });
  const [showDateFilterDd, setShowDateFilterDd] = useState(false);

  const [formData, setFormData] = useState({
    employee: "",
    projectGoals: [
      {
        project: "",
        projectName: "",
        goals: [{ name: "" }], // Start with just one goal
      },
    ],
  });
  const [isOwnTask, setIsOwnTask] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);

  // Custom filter dropdown states
  const [showEmpFilterDd, setShowEmpFilterDd] = useState(false);
  const [empFilterSearch, setEmpFilterSearch] = useState("");
  const [showProjFilterDd, setShowProjFilterDd] = useState(false);
  const [projFilterSearch, setProjFilterSearch] = useState("");

  // Modal employee dropdown state
  const [showModalEmpDd, setShowModalEmpDd] = useState(false);
  const [modalEmpSearch, setModalEmpSearch] = useState("");
  const [modalProjSearch, setModalProjSearch] = useState("");

  // Pagination for better performance
  const [currentPage, setCurrentPage] = useState(1);
  const GOALS_PER_PAGE = 10;

  const [pendingUpdates, setPendingUpdates] = useState({});

  // Stats Details Modal State
  const [statDetailsModalOpen, setStatDetailsModalOpen] = useState(false);
  const [statDetailsTitle, setStatDetailsTitle] = useState("");
  const [statDetailsData, setStatDetailsData] = useState([]);
  const [loadingStatDetails, setLoadingStatDetails] = useState(false);

  // Request Task Modal State
  const [showRequestTaskModal, setShowRequestTaskModal] = useState(false);
  const [requestTaskForm, setRequestTaskForm] = useState({
    projectId: "",
    projectName: "",
    requestToId: "",
    requestToName: "",
    taskTitle: "",
    priority: "Low",
    status: "Pending",
    notes: "",
    remarks: "",
    deadlineDate: "",
  });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [showReqProjDd, setShowReqProjDd] = useState(false);
  const [reqProjSearch, setReqProjSearch] = useState("");
  const [showReqTlDd, setShowReqTlDd] = useState(false);
  const [reqTlSearch, setReqTlSearch] = useState("");
  const [showReqPriorityDd, setShowReqPriorityDd] = useState(false);
  const [showReqStatusDd, setShowReqStatusDd] = useState(false);

  // View Requests Modal State
  const [showViewRequestsModal, setShowViewRequestsModal] = useState(false);
  const [taskRequests, setTaskRequests] = useState([]);
  const [isFetchingRequests, setIsFetchingRequests] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [editRequestForm, setEditRequestForm] = useState({ status: '', remarks: '' });
  const [showViewRemarkModal, setShowViewRemarkModal] = useState(false);
  const [viewRemarkText, setViewRemarkText] = useState("");
  const [showAddRemarkModal, setShowAddRemarkModal] = useState(false);
  const [addRemarkText, setAddRemarkText] = useState("");
  const [showViewNoteModal, setShowViewNoteModal] = useState(false);
  const [viewNoteText, setViewNoteText] = useState("");
  const [editNoteId, setEditNoteId] = useState(null);
  const [canEditNote, setCanEditNote] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState("");
  const [showViewTitleModal, setShowViewTitleModal] = useState(false);
  const [viewTitleText, setViewTitleText] = useState("");
  const [openStatusDdId, setOpenStatusDdId] = useState(null);

  const isAdmin = user?.role?.name === 'Admin';
  const canCreateGoals = hasPermission("goals", "create");
  const canUpdateGoals = hasPermission("goals", "update");
  const canDeleteGoals = hasPermission("goals", "delete");

  // Check if user can create tasks without projects (based on create permission)
  const userRoleName = user?.role?.name || '';
  const canAssignTasks = isAdmin || ['HR Manager', 'Manager', 'HR', 'Team Leader'].includes(userRoleName);
  const canCreateWithoutProject = canCreateGoals;
  const canCreateProject = canCreateGoals;

  const showCreateButton = canCreateGoals;

  // Hide project selection for non-admin/non-HR roles, or specifically for HR role
  const hideProjectSelection = (!isAdmin && !hasPermission("goals", "create")) || userRoleName === 'HR';

  // Hide project info display for roles that don't use projects
  const hideProjectInfo = ['HR', 'Sales', 'Marketing'].includes(userRoleName);

  // Removed console.log for performance

  const fetchGoals = useCallback(async () => {
    try {
      const response = await api.get("/goals");
      setGoals(response.data);
    } catch (error) {
      console.error("Error fetching goals:", error);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await api.get("/employees/list");
      setEmployees(response.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await api.get("/projects");
      setProjects(response.data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  }, []);

  const fetchGoalStats = useCallback(async () => {
    try {
      const response = await api.get("/goals/stats");
      setGoalStats(response.data);
    } catch (error) {
      console.error("Error fetching goal stats:", error);
    }
  }, []);

  const fetchTaskRequests = useCallback(async () => {
    setIsFetchingRequests(true);
    try {
      const response = await api.get("/task-requests");
      setTaskRequests(response.data);
    } catch (error) {
      console.error("Error fetching task requests:", error);
    } finally {
      setIsFetchingRequests(false);
    }
  }, []);

  const hasUnreadTaskUpdates = useMemo(() => {
    if (!globalNotifications) return false;
    return globalNotifications.some(n => !n.isRead && n.type === 'Task');
  }, [globalNotifications]);

  const handleOpenViewRequests = () => {
    setShowRequestTaskModal(false);
    setShowViewRequestsModal(true);
    
    if (globalNotifications) {
      const unreadTasks = globalNotifications.filter(n => !n.isRead && n.type === 'Task');
      if (unreadTasks.length > 0) {
        unreadTasks.forEach(n => {
          api.patch(`/notifications/${n._id}/read`).catch(console.error);
        });
        if (setNotifications) {
          setNotifications(prev => prev.map(n => n.type === 'Task' ? { ...n, isRead: true } : n));
        }
      }
    }
  };

  useEffect(() => {
    if (showViewRequestsModal) {
      fetchTaskRequests();
    }
  }, [showViewRequestsModal, fetchTaskRequests]);

  const handleUpdateRequest = async (id) => {
    try {
      await api.put(`/task-requests/${id}`, editRequestForm);
      setEditingRequestId(null);
      fetchTaskRequests();
      alert("Task request updated successfully!");
    } catch (error) {
      console.error("Error updating task request:", error);
      alert(`Failed to update task request: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleInlineUpdate = async (id, field, value) => {
    try {
      await api.put(`/task-requests/${id}`, { [field]: value });
      fetchTaskRequests();
    } catch (error) {
      console.error("Error updating task request:", error);
      alert(`Failed to update task request: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleRequestTaskSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRequest) return;
    if (!requestTaskForm.taskTitle.trim()) {
      alert("Please enter a task title");
      return;
    }
    setIsSubmittingRequest(true);
    try {
      await api.post("/task-requests", {
        requestTo: requestTaskForm.requestToId || undefined,
        projectId: requestTaskForm.projectId || undefined,
        projectName: requestTaskForm.projectName || "",
        taskTitle: requestTaskForm.taskTitle,
        priority: requestTaskForm.priority,
        status: requestTaskForm.status,
        notes: requestTaskForm.notes,
        remarks: requestTaskForm.remarks,
        requestedDate: new Date().toISOString(),
        deadlineDate: requestTaskForm.deadlineDate || undefined,
      });
      alert("Task request submitted successfully!");
      setShowRequestTaskModal(false);
      setRequestTaskForm({
        projectId: "",
        projectName: "",
        requestToId: "",
        requestToName: "",
        taskTitle: "",
        priority: "Low",
        status: "Pending",
        notes: "",
        remarks: "",
        deadlineDate: "",
      });
    } catch (error) {
      console.error("Error submitting task request:", error);
      alert(`Failed to submit task request: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      // Don't modify loading state if user is not available yet,
      // but if user IS available, start loading.
      if (!user?._id) return;

      setLoading(true);
      try {
        // Fetch goals first to show the main list quickly
        await fetchGoals();
        if (isMounted) setLoading(false); // Stop loading skeleton as soon as goals are here

        // Fetch other data in the background (non-blocking for the main view)
        fetchProjects();
        fetchEmployees();
        fetchGoalStats();
      } catch (error) {
        console.error("Error loading data:", error);
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get projects available for task creation - filters by assignment and deadline (memoized)
  const getAvailableProjects = useMemo(() => {
    const currentUserId = user?.id || user?._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return projects.filter(project => {
      // Filter by deadline - exclude projects with passed deadlines
      if (project.deadline) {
        const deadline = new Date(project.deadline);
        deadline.setHours(23, 59, 59, 999);
        if (deadline < today) {
          return false; // Exclude expired projects
        }
      }

      // For Admin, HR Manager, Manager, HR, and Marketing: show all projects with valid deadlines
      if (isAdmin || canUpdateGoals) {
        return true;
      }

      // For Developer, Sales, Employee: show assigned projects with valid deadlines
      const isAssigned = project.assignedEmployees?.some(
        emp => String(emp._id || emp) === String(currentUserId)
      );
      return isAssigned;
    });
  }, [projects, user, isAdmin, userRoleName]);

  // Get count of expired projects for informational message
  const expiredProjectsCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return projects.filter(project => {
      if (project.deadline) {
        const deadline = new Date(project.deadline);
        deadline.setHours(23, 59, 59, 999);
        return deadline < today;
      }
      return false;
    }).length;
  }, [projects]);

  const notifications = useMemo(() => {
    if (!user) return [];
    const notifs = [];
    const currentUserId = user.id || user?._id;

    goals.forEach(goalDoc => {
      const empId = goalDoc.employee?._id || goalDoc.employee;
      const createdById = goalDoc.createdBy?._id || goalDoc.createdBy;

      const isEmployee = String(empId) === String(currentUserId);

      const empName = goalDoc.employee?.firstName ? `${goalDoc.employee.firstName} ${goalDoc.employee.lastName}` : 'Employee';
      const creatorName = goalDoc.createdBy?.firstName ? `${goalDoc.createdBy.firstName} ${goalDoc.createdBy.lastName}` : 'Someone';
      const projName = goalDoc.projects?.length > 0 ? goalDoc.projects[0].projectName : (goalDoc.projectName || 'Project');

      // 1. Task assignment notifications
      if (createdById && String(createdById) !== String(empId)) {
        if (isEmployee) {
          notifs.push({
            id: `${goalDoc._id}_assign`,
            type: 'assigned',
            text: `${creatorName} has assigned you a task for ${projName}`,
            date: goalDoc.createdAt,
            doc: goalDoc
          });
        }
        if (isAdmin) {
          notifs.push({
            id: `${goalDoc._id}_assign_admin`,
            type: 'assigned',
            text: `${creatorName} have assigned task to ${empName} for ${projName}`,
            date: goalDoc.createdAt,
            doc: goalDoc
          });
        }
      }

      // 2. Review Request notifications
      const reviewReq = goalDoc.reviewRequest;
      if (reviewReq && reviewReq.requested) {
        const tlId = reviewReq.teamLeader?._id || reviewReq.teamLeader;
        const isTeamLeader = String(tlId) === String(currentUserId);
        const tlName = reviewReq.teamLeader?.firstName ? `${reviewReq.teamLeader.firstName} ${reviewReq.teamLeader.lastName}` : 'Team Leader';

        const statusStr = reviewReq.status ? `(Status: ${reviewReq.status})` : '';

        if (isTeamLeader || isAdmin) {
          if (reviewReq.status === 'Pending' || reviewReq.status === 'Seen') {
            const notifyText = isAdmin ? `${empName} request review to ${tlName} ${statusStr}` : `${empName} request for a review ${statusStr}`;
            notifs.push({
              id: `${goalDoc._id}_req_${isAdmin ? 'admin' : 'tl'}`,
              type: 'request',
              text: notifyText,
              date: goalDoc.updatedAt || goalDoc.createdAt,
              doc: goalDoc
            });
          }
        }

        if (isEmployee && reviewReq.status === 'Seen') {
          notifs.push({
            id: `${goalDoc._id}_seen`,
            type: 'seen',
            text: `${tlName} has viewed your review request for ${projName}`,
            date: goalDoc.updatedAt || goalDoc.createdAt,
            doc: goalDoc
          });
        } else if (isEmployee && reviewReq.status === 'Approved') {
          notifs.push({
            id: `${goalDoc._id}_app`,
            type: 'approved',
            text: `${tlName} has approved your review request for ${projName}`,
            date: goalDoc.updatedAt || goalDoc.createdAt,
            doc: goalDoc
          });
        } else if (isEmployee && reviewReq.status === 'Rejected') {
          notifs.push({
            id: `${goalDoc._id}_rej`,
            type: 'rejected',
            text: `${tlName} has rejected your review request for ${projName}`,
            date: goalDoc.updatedAt || goalDoc.createdAt,
            doc: goalDoc
          });
        }
      }
    });

    // Sort notifications by date descending
    return notifs.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [goals, user, isAdmin]);

  const fetchStatDetails = async (type, title) => {
    setStatDetailsTitle(title);
    setStatDetailsData([]);
    setLoadingStatDetails(true);
    setStatDetailsModalOpen(true);

    try {
      const response = await api.get(`/goals/stats-details?type=${type}`);
      setStatDetailsData(response.data);
    } catch (error) {
      console.error("Error fetching stat details:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to load details";
      // If 404, it might mean the backend hasn't been restarted
      if (error.response?.status === 404) {
        alert("Endpoint not found. PLease RESTART your backend server to apply the latest changes.");
      } else {
        alert(`Failed to load details: ${errorMessage}`);
      }
    } finally {
      setLoadingStatDetails(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      // Create new project
      const response = await api.post("/projects", {
        name: newProjectName.trim(),
        description: "Created from Goals",
        status: "active"
      });

      const newProject = response.data;

      // Refresh projects list
      await fetchProjects();

      // Auto-select the new project
      console.log("Auto-selecting new project:", newProject);

      const projectData = newProject.project || newProject;

      handleProjectSelection(projectData._id, projectData.name);

      // Reset and close
      setNewProjectName("");
      setShowCreateProjectModal(false);
      setShowProjectSelector(false); // Close the dropdown as requested

      alert("Project created and selected successfully!");
    } catch (error) {
      console.error("Error creating project:", error);
      alert(`Failed to create project: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }

    console.log("Goal submission started", {
      editingGoalId,
      isAdmin,
      canCreateGoals,
      formData: JSON.stringify(formData)
    });

    // Check create permission for new goals - allow HR and Sales even without explicit permission
    const allowedToCreate = canCreateGoals;
    if (!editingGoalId && !allowedToCreate) {
      alert("You don't have permission to create tasks");
      return;
    }



    // Validation for non-editing mode
    if (!editingGoalId) {
      if (canAssignTasks && !isOwnTask && !formData.employee) {
        alert("Please select an employee");
        return;
      }

      // For HR/Manager/Sales, allow tasks without projects
      if (!canCreateWithoutProject) {
        const validProjects = formData.projectGoals.filter(
          (pg) => pg.project && pg.goals.some((g) => g.name && g.name.trim())
        );

        if (validProjects.length === 0) {
          alert("Please select at least one project and fill at least one goal");
          return;
        }
      } else {
        // For roles that can create without project, just check if at least one goal is filled
        const hasAnyGoal = formData.projectGoals.some(
          (pg) => pg.goals.some((g) => g.name && g.name.trim())
        );

        if (!hasAnyGoal) {
          alert("Please fill at least one task");
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      if (editingGoalId) {
        // Update existing goal —  collect tasks from all projectGoals in edit form
        const allGoals = [];
        const allProjects = [];

        for (const projectGoal of formData.projectGoals) {
          const validGoals = projectGoal.goals.filter((g) => g.name && g.name.trim());
          for (const g of validGoals) {
            allGoals.push({
              _id: g._id || undefined,
              name: g.name.trim(),
              notes: g.notes || "",
              isCompleted: g.isCompleted || false,
              completedAt: g.completedAt || null,
              projectId: projectGoal.project || undefined,
              projectName: projectGoal.projectName || "",
            });
          }
          if (projectGoal.project) {
            allProjects.push({ project: projectGoal.project, projectName: projectGoal.projectName });
          }
        }

        if (allGoals.length === 0) {
          alert("Please provide at least one valid goal");
          return;
        }

        const updateData = {
          employee: formData.employee,
          project: formData.projectGoals[0]?.project || undefined,
          projectName: formData.projectGoals[0]?.projectName || "",
          projects: allProjects,
          goals: allGoals,
          isEditing: true,
        };

        console.log("Updating goal with data:", updateData);
        const response = await api.put(`/goals/${editingGoalId}`, updateData);
        console.log("Goal updated successfully:", response.data);
        setEditingGoalId(null);

        alert("Goal updated successfully!");
      } else {
        // Create new goals - ALWAYS create separate entries for each project
        let createdCount = 0;
        const errors = [];

        // Get valid projects with goals
        const validProjectGoals = formData.projectGoals.filter(
          (pg) => pg.project && pg.goals.some((g) => g.name && g.name.trim())
        );

        // For roles that can create without project, skip project validation
        if (!canCreateWithoutProject && selectedProjects.length === 0 && validProjectGoals.length === 0) {
          alert("Please select at least one project and fill at least one goal");
          return;
        }

        // If we have selected projects via multi-select (new UI), use them
        // Otherwise use validProjectGoals from legacy structure

        let projectsToProcess = [];

        if (selectedProjects.length > 0) {
          // Each selected project has its own tasks from formData.projectGoals
          projectsToProcess = formData.projectGoals
            .filter(pg => pg.project && pg.goals.some((g) => g.name && g.name.trim()))
            .map(pg => ({
              project: pg.project,
              projectName: pg.projectName,
              goals: pg.goals.filter((g) => g.name && g.name.trim())
            }));

          if (projectsToProcess.length === 0) {
            alert("Please provide at least one valid goal for the selected project(s)");
            return;
          }
        } else {
          projectsToProcess = validProjectGoals;
        }

        // Deadline check —  filter out expired projects
        const validProjectsToProcess = [];
        const currentUserId = user?.id || user?._id;

        // For HR/Manager/Sales creating without projects, skip validation
        if (canCreateWithoutProject && projectsToProcess.length === 0) {
          // No projects selected, which is allowed for these roles
          // validProjectsToProcess will remain empty
        } else {
          for (const projectGoal of projectsToProcess) {
            const projectObj = projects.find(p => p._id === projectGoal.project);

            if (!projectObj) {
              errors.push(`${projectGoal.projectName}: Project not found`);
              continue;
            }

            // Check if employee is assigned to this project (non-admin and non-special roles only)
            if (!isAdmin && !canCreateWithoutProject) {
              const isAssigned = projectObj.assignedEmployees?.some(
                emp => String(emp._id || emp) === String(currentUserId)
              );

              if (!isAssigned) {
                errors.push(`${projectGoal.projectName}: You are not assigned to this project`);
                continue;
              }
            }

            // Check deadline
            if (projectObj.deadline) {
              const deadline = new Date(projectObj.deadline);
              deadline.setHours(23, 59, 59, 999);
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              if (deadline < today) {
                errors.push(`${projectGoal.projectName}: Deadline (${new Date(projectObj.deadline).toLocaleDateString()}) has passed. Contact HR to extend the deadline first.`);
                continue;
              }
            }

            validProjectsToProcess.push(projectGoal);
          }

          if (!canCreateWithoutProject && validProjectsToProcess.length === 0 && projectsToProcess.length > 0) {
            alert(`Cannot create tasks:\n${errors.join('\n')}`);
            return;
          }
        }

        // Collect all tasks from all projects, tagging each task with its project info
        const allGoals = [];

        if (validProjectsToProcess.length > 0) {
          // Tasks with projects
          for (const projectGoal of validProjectsToProcess) {
            const taskGoals = projectGoal.goals.filter((g) => g.name && g.name.trim());
            for (const g of taskGoals) {
              allGoals.push({
                name: g.name.trim(),
                notes: g.notes || "",
                isCompleted: false,
                projectId: projectGoal.project,
                projectName: projectGoal.projectName,
              });
            }
          }
        } else if (canCreateWithoutProject) {
          // Tasks without projects for HR/Manager/Sales
          for (const projectGoal of formData.projectGoals) {
            const taskGoals = projectGoal.goals.filter((g) => g.name && g.name.trim());
            for (const g of taskGoals) {
              allGoals.push({
                name: g.name.trim(),
                notes: g.notes || "",
                isCompleted: false,
                projectId: null,
                projectName: "",
              });
            }
          }
        }

        if (allGoals.length === 0) {
          alert("Please provide at least one valid task");
          return;
        }

        // Create ONE goal entry with all selected projects combined
        const submitData = {
          employee: (canAssignTasks && !isOwnTask) ? formData.employee : user.id,
          projects: validProjectsToProcess.length > 0 ? validProjectsToProcess.map(pg => ({
            project: pg.project,
            projectName: pg.projectName,
          })) : [],
          goals: allGoals,
        };

        try {
          console.log("Creating single goal entry for all projects:", submitData);
          await api.post("/goals", submitData);
          createdCount = 1;
        } catch (err) {
          console.error("Error creating goal:", err);
          errors.push(err.response?.data?.message || err.message);
        }

        // Show results
        if (errors.length > 0 && createdCount === 0) {
          alert(`Error creating tasks:\n${errors.join('\n')}`);
        } else if (errors.length > 0) {
          alert(`Tasks created with some issues:\n\nCreated successfully\n Skipped projects:\n${errors.join('\n')}`);
        } else {
          alert(`Task created successfully`);
        }
      }

      setShowModal(false);
      setSelectedProjects([]);
      setShowProjectSelector(false);
      setFormData({
        employee: "",
        projectGoals: [
          {
            project: "",
            projectName: "",
            goals: [{ name: "" }],
          },
        ],
      });
      fetchGoals();
      fetchGoalStats();
    } catch (error) {
      console.error("Goal operation error:", error);
      const operation = editingGoalId ? "updating" : "creating";
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        `Error ${operation} goal`;
      alert(`Error ${operation} goal: ${errorMessage}`);

      // Don't close modal on error so user can fix and retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditGoal = (goal) => {
    setEditingGoalId(goal._id);

    // Group tasks by project for the edit form
    const hasProjectInfo = goal.goals.some(g => g.projectName || g.projectId);
    let projectGoals;

    if (hasProjectInfo) {
      const grouped = {};
      goal.goals.forEach(g => {
        const pId = (typeof g.projectId === 'object' ? g.projectId?._id : g.projectId) || '';
        const pName = g.projectName || 'Unknown';
        const key = pId || pName;
        if (!grouped[key]) grouped[key] = { project: pId, projectName: pName, goals: [] };
        grouped[key].goals.push({
          _id: g._id,
          name: g.name,
          notes: g.notes || "",
          isCompleted: g.isCompleted || false,
          completedAt: g.completedAt || null
        });
      });
      projectGoals = Object.values(grouped);
    } else {
      projectGoals = [{
        project: goal.project?._id || "",
        projectName: goal.projectName || goal.project?.name || "",
        goals: goal.goals.map((g) => ({
          _id: g._id,
          name: g.name,
          notes: g.notes || "",
          isCompleted: g.isCompleted || false,
          completedAt: g.completedAt || null
        })),
      }];
    }

    setFormData({
      employee: goal.employee._id,
      projectGoals,
    });
    setShowModal(true);
  };

  const cancelEdit = useCallback(() => {
    setEditingGoalId(null);
    setShowModal(false);
    setSelectedProjects([]);
    setShowProjectSelector(false);
    setShowModalEmpDd(false);
    setModalEmpSearch("");
    setModalProjSearch("");
    setFormData({
      employee: "",
      projectGoals: [
        {
          project: "",
          projectName: "",
          goals: [{ name: "" }],
        },
      ],
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get('taskId');

    if (taskId && goals.length > 0) {
      const goalDoc = goals.find(g => g._id === taskId);
      if (goalDoc) {
        startEditGoal(goalDoc);
        // Remove the taskId from URL so it doesn't reopen if goals refresh
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [location.search, goals]);

  const handleProjectSelection = useCallback((projectId, projectName) => {
    // Find the project to validate
    const projectObj = projects.find(p => p._id === projectId);

    if (!projectObj) {
      alert('Project not found');
      return;
    }

    // Check if user has access to this project
    // Admins and those with canAssignTasks (like Team Leaders) bypass this check
    if (!isAdmin && !canAssignTasks) {
      const currentUserId = user?.id || user?._id;
      const isAssigned = projectObj.assignedEmployees?.some(
        emp => String(emp._id || emp) === String(currentUserId)
      );

      if (!isAssigned) {
        alert(`You are not assigned to the project "${projectName}"`);
        return;
      }
    }

    // Deadline check —  block selection if project deadline has passed
    if (projectObj.deadline) {
      const deadline = new Date(projectObj.deadline);
      deadline.setHours(23, 59, 59, 999);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (deadline < today) {
        alert(`Cannot create tasks for "${projectName}"\n\nProject deadline (${deadline.toLocaleDateString()}) has already passed.\n\nPlease contact HR to extend the deadline first.`);
        return;
      }
    }

    const isSelected = selectedProjects.find(p => p.id === projectId);

    if (isSelected) {
      // Remove project
      const updatedSelectedProjects = selectedProjects.filter(p => p.id !== projectId);
      const updatedProjectGoals = formData.projectGoals.filter(pg => pg.project !== projectId);

      setSelectedProjects(updatedSelectedProjects);
      setFormData({
        ...formData,
        projectGoals: updatedProjectGoals.length > 0 ? updatedProjectGoals : [{
          project: "",
          projectName: "",
          goals: [{ name: "" }]
        }]
      });
    } else {
      // Add project
      const newProject = { id: projectId, name: projectName };
      const updatedSelectedProjects = [...selectedProjects, newProject];

      // Remove empty project goals and add the new one
      const filteredProjectGoals = formData.projectGoals.filter(pg => pg.project !== "");
      const updatedProjectGoals = [...filteredProjectGoals, {
        project: projectId,
        projectName: projectName,
        goals: [{ name: "" }]
      }];

      setSelectedProjects(updatedSelectedProjects);
      setFormData({
        ...formData,
        projectGoals: updatedProjectGoals
      });
    }

    // Auto-close dropdown after selection
    setShowProjectSelector(false);
  }, [selectedProjects, formData, projects, isAdmin, user, canAssignTasks]);

  // const selectAllProjects = () => {
  //   const availableProjects = getAvailableProjects();
  //   
  //   const allProjectsData = availableProjects.map(project => ({
  //     project: project._id,
  //     projectName: project.name,
  //     goals: [{ name: "" }]
  //   }));

  //   const allSelectedProjects = availableProjects.map(project => ({
  //     id: project._id,
  //     name: project.name
  //   }));

  //   setSelectedProjects(allSelectedProjects);
  //   setFormData({
  //     ...formData,
  //     projectGoals: allProjectsData
  //   });
  // };

  // const clearAllProjects = () => {
  //   setSelectedProjects([]);
  //   setFormData({
  //     ...formData,
  //     projectGoals: [{
  //       project: "",
  //       projectName: "",
  //       goals: [{ name: "" }]
  //     }]
  //   });
  // };

  // const addProjectSection = () => {
  //   setShowProjectSelector(true);
  // };

  // const removeProjectSection = (index) => {
  //   const projectToRemove = formData.projectGoals[index];
  //   if (formData.projectGoals.length > 1) {
  //     const newProjectGoals = formData.projectGoals.filter(
  //       (_, i) => i !== index
  //     );
  //     setFormData({ ...formData, projectGoals: newProjectGoals });

  //     // Also remove from selectedProjects
  //     setSelectedProjects(selectedProjects.filter(p => p.id !== projectToRemove.project));
  //   }
  // };

  // const updateProjectGoal = (index, field, value) => {
  //   const newProjectGoals = [...formData.projectGoals];
  //   newProjectGoals[index] = { ...newProjectGoals[index], [field]: value };
  //   setFormData({ ...formData, projectGoals: newProjectGoals });
  // };

  const updateGoalInProject = (projectIndex, goalIndex, field, value) => {
    const newProjectGoals = [...formData.projectGoals];
    newProjectGoals[projectIndex].goals[goalIndex][field] = value;
    setFormData({ ...formData, projectGoals: newProjectGoals });
  };

  const addGoalToProject = (projectIndex) => {
    const newProjectGoals = [...formData.projectGoals];
    newProjectGoals[projectIndex].goals.push({ name: "" });
    setFormData({ ...formData, projectGoals: newProjectGoals });
  };

  const removeGoalFromProject = (projectIndex, goalIndex) => {
    const newProjectGoals = [...formData.projectGoals];
    if (newProjectGoals[projectIndex].goals.length > 1) {
      newProjectGoals[projectIndex].goals.splice(goalIndex, 1);
      setFormData({ ...formData, projectGoals: newProjectGoals });
    }
  };

  const handleTaskSelection = (taskId) => {
    setSelectedTasks(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      } else {
        return [...prev, taskId];
      }
    });
  };

  const handleGoalToggle = async (goalId, goalItemId, isCompleted, goalOwnerId, goalItem) => {
    // Check if user can modify this goal (own goal or admin)
    const ownerIdStr = goalOwnerId ? String(goalOwnerId) : null;
    const currentUserId = user?.id || user?._id || null;
    if (!canAssignTasks && ownerIdStr !== String(currentUserId)) {
      alert("You can only modify your own goals");
      return;
    }

    // Get the goal object
    const goalObj = goals.find((g) => g._id === goalId);

    try {
      // Update the goal with new completion status directly (no notes modal)
      const updatedGoals = goalObj.goals.map((g) => ({
        _id: g._id,
        name: g.name,
        isCompleted: g._id === goalItemId ? !isCompleted : g.isCompleted,
        notes: g.notes || "",
        completedAt: g._id === goalItemId ? (!isCompleted ? new Date() : null) : g.completedAt
      }));

      const updateData = {
        goals: updatedGoals,
        isEditing: false
      };

      console.log('Updating goal with data:', updateData);
      const response = await api.put(`/goals/${goalId}`, updateData);
      console.log('Goal updated successfully:', response.data);

      fetchGoals(); // Refresh the goals list
      fetchGoalStats();

      // Show success message
      const action = !isCompleted ? 'completed' : 'unchecked';
      alert(`Goal ${action} successfully!`);
    } catch (error) {
      console.error('Error updating goal:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error updating goal';
      alert(`Error updating goal: ${errorMessage}`);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      try {
        await api.delete(`/goals/${goalId}`);
        fetchGoals();
        fetchGoalStats();
      } catch (error) {
        console.error("Error deleting goal:", error);
        alert(error.response?.data?.message || "Error deleting goal");
      }
    }
  };

  const handleAddNote = (goalId, goalItemId, goalItem, goalObj) => {
    // Show notes modal for adding/editing notes
    setCurrentGoalForNotes({
      goalId,
      goalItemId,
      isCompleted: goalItem.isCompleted,
      goalItem,
      goalObj
    });
    setTempNotes(goalItem.notes || "");
    setShowNotesModal(true);
  };

  const handleNotesModalConfirm = async () => {
    try {
      const { goalId, goalItemId, isCompleted, goalObj } = currentGoalForNotes;

      // Update the goal with notes only (completion status doesn't change)
      const updatedGoals = goalObj.goals.map((g) => ({
        _id: g._id,
        name: g.name,
        isCompleted: g.isCompleted,
        notes: g._id === goalItemId ? tempNotes : (g.notes || ""),
        completedAt: g.completedAt
      }));

      const updateData = {
        goals: updatedGoals,
        isEditing: false
      };

      console.log('Updating goal notes with data:', updateData);
      const response = await api.put(`/goals/${goalId}`, updateData);
      console.log('Goal notes updated successfully:', response.data);

      fetchGoals(); // Refresh the goals list
      fetchGoalStats();
      setShowNotesModal(false);
      setCurrentGoalForNotes(null);
      setTempNotes("");

      // Show success message
      alert('Notes updated successfully!');
    } catch (error) {
      console.error('Error updating goal notes:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error updating goal notes';
      alert(`Error updating goal notes: ${errorMessage}`);
    }
  };

  const handleOpenReviewModal = async (goalDoc, allProjectGoals = null) => {
    let updatedGoalDoc = { ...goalDoc };

    // If Team Leader / Admin opens a Pending request, or if Employee opens a Reverted request, mark as seen
    const isEmployee = String(goalDoc.employee?._id || goalDoc.employee) === String(user?.id || user?._id);
    const shouldMarkSeenAsTeamLeader = !isEmployee && goalDoc.reviewRequest?.status === 'Pending';
    const shouldMarkSeenAsEmployee = isEmployee && goalDoc.reviewRequest?.status === 'Reverted';

    if (goalDoc.reviewRequest?.requested && !goalDoc.reviewRequest?.seenAt && (shouldMarkSeenAsTeamLeader || shouldMarkSeenAsEmployee)) {
      try {
        const updateData = {
          reviewRequest: { ...goalDoc.reviewRequest, seenAt: new Date().toISOString() },
          isEditing: false
        };
        const response = await api.put(`/goals/${goalDoc._id}`, updateData);
        updatedGoalDoc = response.data;
        fetchGoals();
      } catch (err) {
        console.error('Error marking request as seen:', err);
      }
    }

    setCurrentReviewData({
      goalDoc: updatedGoalDoc,
      allProjectGoals: allProjectGoals
    });
    setReviewDescription("");
    setSelectedTeamLeader(updatedGoalDoc.reviewRequest?.teamLeader?._id || updatedGoalDoc.reviewRequest?.teamLeader || "");
    setShowReplyForm(false);
    setIsEditingReview(false);
    setShowReviewModal(true);
  };

  const handleEditReviewConfirm = async () => {
    try {
      const { goalDoc } = currentReviewData;
      const currentReq = goalDoc.reviewRequest;
      const updateData = {
        reviewRequest: {
          requested: true,
          description: reviewDescription,
          teamLeader: currentReq.teamLeader?._id || currentReq.teamLeader || undefined,
          status: currentReq.status,
          requestedAt: currentReq.requestedAt,
          seenAt: null
        },
        isEditing: false
      };

      const response = await api.put(`/goals/${goalDoc._id}`, updateData);

      setCurrentReviewData({ goalDoc: response.data });
      fetchGoals();
      setIsEditingReview(false);
      setReviewDescription("");
      alert('Message updated successfully!');
    } catch (err) {
      console.error('Error updating review request:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error updating review request';
      alert(`Error updating: ${errorMessage}`);
    }
  };

  const handleRevertModalConfirm = async () => {
    try {
      const { goalDoc } = currentReviewData;

      const updateData = {
        reviewRequest: {
          requested: true,
          description: reviewDescription,
          teamLeader: goalDoc.reviewRequest?.teamLeader?._id || goalDoc.reviewRequest?.teamLeader || undefined,
          status: 'Reverted',
          requestedAt: new Date().toISOString(),
          seenAt: null
        },
        isEditing: false
      };

      console.log('Reverting review request with data:', updateData);
      const response = await api.put(`/goals/${goalDoc._id}`, updateData);
      console.log('Review request reverted successfully:', response.data);

      fetchGoals();
      setShowReviewModal(false);
      setCurrentReviewData(null);
      setReviewDescription("");
      setSelectedReviewProject("");
      setSelectedReviewTask("");

      alert('Reply sent successfully!');
    } catch (error) {
      console.error('Error replying to review request:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error replying to review request';
      alert(`Error replying: ${errorMessage}`);
    }
  };

  const handleReviewModalConfirm = async () => {
    try {
      const { goalDoc } = currentReviewData;
      const isEmployee = String(goalDoc.employee?._id || goalDoc.employee) === String(user?.id || user?._id);

      if (isEmployee) {
        if (!selectedReviewProject || !selectedReviewTask || !selectedTeamLeader) {
          alert("Please select a project, a task, and a team leader before submitting.");
          return;
        }
      }

      let projectName = '';
      let taskName = '';

      if (selectedReviewProject) {
        const proj = goalDoc.projects?.find(p => String(p.projectId) === String(selectedReviewProject));
        projectName = proj ? proj.projectName : '';
      }

      if (selectedReviewTask) {
        const task = goalDoc.goals?.find(t => String(t._id) === String(selectedReviewTask));
        taskName = task ? task.name : '';
      }

      const updateData = {
        reviewRequest: {
          requested: true,
          description: reviewDescription,
          teamLeader: selectedTeamLeader || undefined,
          status: 'Pending',
          requestedAt: new Date().toISOString(),
          seenAt: null,
          projectId: selectedReviewProject || undefined,
          projectName: projectName || undefined,
          taskId: selectedReviewTask || undefined,
          taskName: taskName || undefined
        },
        isEditing: false
      };

      console.log('Updating review request with data:', updateData);
      const response = await api.put(`/goals/${goalDoc._id}`, updateData);
      console.log('Review request updated successfully:', response.data);

      fetchGoals();
      setShowReviewModal(false);
      setCurrentReviewData(null);
      setReviewDescription("");
      setSelectedReviewProject("");
      setSelectedReviewTask("");

      alert('Review requested successfully!');
    } catch (error) {
      console.error('Error updating review request:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error requesting review';
      alert(`Error requesting review: ${errorMessage}`);
    }
  };


  const handleMarkSelectedAsComplete = async (group) => {
    try {
      // Get all task IDs from this group
      const groupTaskIds = group.goals.flatMap(goalDoc =>
        goalDoc.goals.map(task => task._id)
      );

      // Get selected tasks that belong to this group
      const selectedTasksInGroup = selectedTasks.filter(taskId =>
        groupTaskIds.includes(taskId)
      );

      if (selectedTasksInGroup.length === 0) {
        alert('No tasks selected');
        return;
      }

      // Update each goal document that has selected tasks
      for (const goalDoc of group.goals) {
        const hasSelectedTasks = goalDoc.goals.some(task =>
          selectedTasksInGroup.includes(task._id)
        );

        if (hasSelectedTasks) {
          // Update tasks in this goal document
          const updatedGoals = goalDoc.goals.map((g) => ({
            _id: g._id,
            name: g.name,
            isCompleted: selectedTasksInGroup.includes(g._id) ? true : g.isCompleted,
            notes: g.notes || "",
            completedAt: selectedTasksInGroup.includes(g._id) ? new Date() : g.completedAt
          }));

          const updateData = {
            goals: updatedGoals,
            isEditing: false
          };

          console.log('Marking selected tasks as complete:', updateData);
          await api.put(`/goals/${goalDoc._id}`, updateData);
        }
      }

      // Clear selections and refresh
      setSelectedTasks([]);
      fetchGoals();
      fetchGoalStats();

      alert(`${selectedTasksInGroup.length} tasks marked as complete!`);
    } catch (error) {
      console.error('Error marking tasks as complete:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error marking tasks as complete';
      alert(`Error: ${errorMessage}`);
    }
  };

  // const confirmGoalUpdate = async (goalId) => {
  //   try {
  //     const goal = goals.find((g) => g._id === goalId);
  //     const pendingGoalUpdates = pendingUpdates[goalId] || {};

  //     const updatedGoals = goal.goals.map((g) => ({
  //       ...g,
  //       isCompleted: pendingGoalUpdates.hasOwnProperty(g._id)
  //         ? pendingGoalUpdates[g._id]
  //         : g.isCompleted,
  //     }));

  //     await api.put(`/goals/${goalId}`, { goals: updatedGoals });

  //     // Clear pending updates for this goal
  //     setPendingUpdates((prev) => {
  //       const newPending = { ...prev };
  //       delete newPending[goalId];
  //       return newPending;
  //     });

  //     fetchGoals();
  //     fetchGoalStats();
  //   } catch (error) {
  //     console.error("Error updating goal:", error);
  //     alert(error.response?.data?.message || "Error updating goal");
  //   }
  // };

  // const cancelGoalUpdate = (goalId) => {
  //   setPendingUpdates((prev) => {
  //     const newPending = { ...prev };
  //     delete newPending[goalId];
  //     return newPending;
  //   });
  // };

  const generateMonthlyReport = (employeeId, employeeName, selectedMonth = null, selectedYear = null) => {
    // Get current month and year or use selected ones
    const now = new Date();
    const currentMonth = selectedMonth !== null ? selectedMonth : now.getMonth();
    const currentYear = selectedYear !== null ? selectedYear : now.getFullYear();

    // Get all goals for this employee in current month
    const employeeGoals = goals.filter(goal => {
      const goalEmployee = goal.employee?._id || goal.employee;
      const goalDate = new Date(goal.createdAt);
      return String(goalEmployee) === String(employeeId) &&
        goalDate.getMonth() === currentMonth &&
        goalDate.getFullYear() === currentYear;
    });

    // Get number of days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Create day-wise report
    const dailyReport = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dateStr = date.toISOString().split('T')[0];

      // Find goals created on this day
      const dayGoals = employeeGoals.filter(goal => {
        const goalDate = new Date(goal.createdAt);
        return goalDate.getDate() === day;
      });

      let completed = 0;
      let total = 0;
      let missed = 0;

      dayGoals.forEach(goal => {
        goal.goals.forEach(item => {
          total++;
          if (item.isCompleted) {
            completed++;
          } else {
            missed++;
          }
        });
      });

      if (day <= now.getDate()) {
        dailyReport.push({
          day,
          date: dateStr,
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          completed,
          missed,
          total,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        });
      }
    }

    return {
      employeeName,
      employeeId,
      month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      dailyReport,
      totalCompleted: dailyReport.reduce((sum, day) => sum + day.completed, 0),
      totalMissed: dailyReport.reduce((sum, day) => sum + day.missed, 0),
      totalGoals: dailyReport.reduce((sum, day) => sum + day.total, 0),
      overallPercentage: dailyReport.reduce((sum, day) => sum + day.total, 0) > 0
        ? Math.round((dailyReport.reduce((sum, day) => sum + day.completed, 0) / dailyReport.reduce((sum, day) => sum + day.total, 0)) * 100)
        : 0
    };
  };

  const baseFilteredGoals = useMemo(() => {
    const currentUserId = user?.id || user?._id;

    return goals.filter((goal) => {
      // Role-based filtering: Regular users see only their own tasks
      // Admin, HR Manager, Manager, and HR see all tasks
      const canViewAllTasks = canAssignTasks;

      if (!canViewAllTasks) {
        // Regular users can only see their own tasks
        const goalEmployeeId = String(goal.employee?._id || goal.employee);
        if (goalEmployeeId !== String(currentUserId)) {
          return false;
        }
      }

      const employeeName =
        `${goal.employee?.firstName} ${goal.employee?.lastName}`.toLowerCase();
      const projectName = (
        goal.projectName ||
        goal.project?.name ||
        ""
      ).toLowerCase();
      // Get primary project for deadline filtering - check both single project and projects array
      const primaryProject = goal.project || (goal.projects && goal.projects.length > 0 ? goal.projects[0].projectId : null);
      const deadline = primaryProject?.deadline
        ? new Date(primaryProject.deadline).toLocaleDateString()
        : "";

      const matchesEmployee = employeeName.includes(
        filters.employeeName.toLowerCase()
      );
      const matchesProject = projectName.includes(
        filters.projectName.toLowerCase()
      );
      const matchesDeadline =
        !filters.deadline || deadline === filters.deadline;

      const goalDate = new Date(goal.createdAt);
      let matchesDate = true;
      if (filters.startDate || filters.endDate) {
        if (filters.startDate) {
          const startDate = new Date(filters.startDate);
          startDate.setHours(0, 0, 0, 0);
          if (goalDate < startDate) matchesDate = false;
        }
        if (filters.endDate && matchesDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (goalDate > endDate) matchesDate = false;
        }
      }

      return matchesEmployee && matchesProject && matchesDeadline && matchesDate;
    });
  }, [goals, filters.employeeName, filters.projectName, filters.deadline, filters.startDate, filters.endDate, user, userRoleName, isAdmin]);

  const totalGoalItems = useMemo(() =>
    baseFilteredGoals.reduce((sum, goal) => sum + (goal.goals?.length || 0), 0),
    [baseFilteredGoals]
  );

  const completedGoalItems = useMemo(() =>
    baseFilteredGoals.reduce(
      (sum, goal) => sum + (goal.goals?.filter((item) => item.isCompleted).length || 0),
      0
    ),
    [baseFilteredGoals]
  );

  const pendingGoalItems = useMemo(() =>
    Math.max(totalGoalItems - completedGoalItems, 0),
    [totalGoalItems, completedGoalItems]
  );

  const filteredGoals = useMemo(() => {
    return baseFilteredGoals.map(goal => {
      if (!filters.status) return goal;

      const filteredInnerGoals = goal.goals?.filter(task => {
        if (filters.status === 'completed') return task.isCompleted;
        if (filters.status === 'pending') return !task.isCompleted;
        return true;
      }) || [];

      if (filteredInnerGoals.length === (goal.goals?.length || 0)) return goal;

      return { ...goal, goals: filteredInnerGoals };
    }).filter(goal => goal.goals?.length > 0);
  }, [baseFilteredGoals, filters.status]);

  // Memoize unique employee names for filter dropdown
  const uniqueEmployeeNames = useMemo(() =>
    [...new Set(goals.map(g => `${g.employee?.firstName} ${g.employee?.lastName}`))],
    [goals]
  );

  // Memoize unique project names for filter dropdown
  const uniqueProjectNames = useMemo(() =>
    [...new Set(goals.map(g => g.projectName || g.project?.name).filter(Boolean))],
    [goals]
  );

  // Group filtered goals by employee + creation date
  const groupedFilteredGoals = useMemo(() => {
    const groups = {};
    filteredGoals.forEach(goal => {
      const date = new Date(goal.createdAt);
      date.setHours(0, 0, 0, 0);
      const empId = goal.employee?._id || goal.employee;
      const key = `${empId}_${date.getTime()}`;
      if (!groups[key]) {
        groups[key] = {
          groupKey: key,
          employee: goal.employee,
          createdAt: goal.createdAt,
          goals: []
        };
      }
      groups[key].goals.push(goal);
    });

    // Sort goals within each group by creation time (oldest first)
    Object.values(groups).forEach(group => {
      group.goals.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });

    return Object.values(groups);
  }, [filteredGoals]);

  // Paginated goals for performance
  const paginatedGoals = useMemo(() => {
    const startIndex = (currentPage - 1) * GOALS_PER_PAGE;
    const endIndex = startIndex + GOALS_PER_PAGE;
    return groupedFilteredGoals.slice(startIndex, endIndex);
  }, [groupedFilteredGoals, currentPage]);

  const totalPages = useMemo(() =>
    Math.ceil(groupedFilteredGoals.length / GOALS_PER_PAGE),
    [groupedFilteredGoals.length]
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.employeeName, filters.projectName, filters.deadline, filters.createdDate]);

  // Close custom filter dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setShowEmpFilterDd(false);
      setShowEmpFilterDd(false);
      setShowProjFilterDd(false);
      setShowDateFilterDd(false);

      setShowModalEmpDd(false);
      setShowProjectSelector(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes skeleton-shimmer {
            0% { background-position: -400px 0; }
            100% { background-position: 400px 0; }
          }
          .skeleton-box {
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 800px 100%;
            animation: skeleton-shimmer 1.4s ease-in-out infinite;
            border-radius: 8px;
          }
          @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
          }
          @keyframes goalsDdIn {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .goals-dd-option:hover {
            background: #f0fdf4 !important;
          }
          .goals-page {
            background: linear-gradient(180deg, #edf5ea 0%, #f9fbf8 52%, #edf4e9 100%);
            border-radius: 20px;
            padding: 18px;
            border: 1px solid #dcead8;
            box-shadow: 0 12px 28px rgba(20, 83, 45, 0.08);
          }
          .goals-toolbar {
            background: #ffffff;
            border: 1px solid #e2eee0;
            border-radius: 16px;
            padding: 14px;
            box-shadow: 0 8px 20px rgba(20, 83, 45, 0.05);
          }
          .goals-title {
            color: #14532d;
            letter-spacing: -0.02em;
          }
          .goals-control {
            border: 1px solid #d1e2cf !important;
            border-radius: 10px !important;
            background: #ffffff;
            color: #1f2937;
          }
          .goals-page .card {
            border-radius: 16px;
            border: 1px solid #e3efe1;
            box-shadow: 0 8px 22px rgba(20, 83, 45, 0.07);
          }
          .goals-toolbar-controls {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1 1 auto;
            justify-content: flex-end;
            flex-wrap: wrap;
            min-width: 280px;
          }
          .goals-summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
            gap: 10px;
          }
          .goals-stat-value {
            font-size: 22px;
            font-weight: 500;
            color: #1e293b;
            margin-bottom: 4px;
            letter-spacing: 0;
            line-height: 1.15;
          }
          .goals-stat-subtext {
            font-size: 11px;
            color: #94a3b8;
            font-weight: 500;
          }
          .goals-table-scroll {
            overflow-x: auto;
          }
          .goals-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            min-width: 1150px;
            font-size: 14px;
          }
          .goals-table-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: center;
          }
          @media (max-width: 1024px) {
            .goals-page {
              padding: 14px;
              border-radius: 14px;
            }
            .goals-toolbar {
              padding: 12px;
            }
            .goals-toolbar-controls {
              min-width: 100%;
              justify-content: flex-start;
            }
            .goals-toolbar-controls > * {
              flex: 1 1 170px;
            }
          }
          @media (max-width: 768px) {
            .goals-page {
              padding: 10px;
              border-radius: 12px;
            }
            .goals-toolbar {
              margin-bottom: 12px !important;
              padding: 10px !important;
            }
            .goals-title {
              width: 100%;
              white-space: normal !important;
              font-size: 20px !important;
            }
            .goals-toolbar-controls {
              width: 100%;
              min-width: 100% !important;
              gap: 8px;
              flex: 1 1 100% !important;
              justify-content: flex-start !important;
            }
            .goals-toolbar-controls .goals-control,
            .goals-toolbar-controls .btn {
              width: 100%;
              min-width: 0 !important;
            }
            .goals-summary-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 8px !important;
            }
            .goals-stat-card {
              padding: 10px 12px !important;
            }
            .goals-stat-value {
              font-size: 18px !important;
            }
            .goals-stat-subtext {
              font-size: 10px !important;
            }
            .goals-table {
              min-width: 950px;
            }
            .goals-table-actions button {
              width: 100%;
            }
            .clean-modal {
              width: 96% !important;
              max-width: 96vw !important;
              max-height: 92vh;
            }
            .modal-content-clean {
              padding: 12px !important;
            }
            .modal-header-clean {
              padding: 12px 16px !important;
            }
            .goals-stat-card::before {
              display: none !important;
            }
            .goals-stat-card::after {
              display: none !important;
            }
            .goals-filter-select,
            .goals-filter-date,
            .goals-create-btn {
              font-size: 11px !important;
              padding: 6px 10px !important;
              height: 30px !important;
            }
            /* Card task rows —  stacked layout on mobile */
            .goals-page .card {
              overflow-x: hidden !important;
            }
            /* Hide column header labels row */
            .goal-col-headers { display: none !important; }
            /* Label: wrap so task name takes full width, meta items wrap below */
            .goal-task-label {
              flex-wrap: wrap !important;
              gap: 4px 6px !important;
              align-items: center !important;
            }
            /* Task name: full row */
            .goal-task-name-col { flex: 1 1 100% !important; min-width: 0 !important; }
            /* Hide vertical separators */
            .goal-task-sep { display: none !important; }
            /* Project chip */
            .goal-task-project-cell {
              width: auto !important;
              min-width: 0 !important;
              max-width: 48% !important;
              padding: 0 !important;
              flex: 0 0 auto !important;
            }
            /* Notes: flex fill, truncate */
            .goal-task-notes-cell {
              width: auto !important;
              min-width: 0 !important;
              max-width: 100% !important;
              flex: 1 1 auto !important;
              padding: 2px 6px !important;
            }
            /* Status chip */
            .goal-task-status-cell {
              width: auto !important;
              min-width: 0 !important;
              flex: 0 0 auto !important;
            }
          }
          @media (max-width: 480px) {
            .goals-page {
              padding: 8px;
              border-radius: 10px;
            }
            .goals-summary-grid {
              grid-template-columns: 1fr !important;
            }
            .goals-stat-value {
              font-size: 16px !important;
            }
            .goals-toolbar-controls {
              gap: 6px !important;
            }
            .clean-modal {
              width: 98% !important;
              max-width: 98vw !important;
            }
          }
          /* Bubble float animations - Match Projects.js style */
          @keyframes bubble-float-large {
            0%   { transform: translate(0px, 0px) scale(1); }
            30%  { transform: translate(-5px, -7px) scale(1.04); }
            60%  { transform: translate(4px, -4px) scale(0.97); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          
          @keyframes bubble-float-small {
            0%   { transform: translate(0px, 0px) scale(1); }
            35%  { transform: translate(6px, -9px) scale(1.06); }
            65%  { transform: translate(-4px, -3px) scale(0.95); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          
          /* Stats card bubble effects */
          .goals-stat-card {
            position: relative;
            overflow: hidden;
            isolation: isolate;
          }
          
          .goals-stat-card::before {
            content: '';
            position: absolute;
            z-index: 0;
            width: 90px;
            height: 90px;
            border-radius: 50%;
            background: #667eea;
            opacity: 0.06;
            right: -26px;
            bottom: -26px;
            pointer-events: none;
            animation: bubble-float-large 5.5s ease-in-out infinite;
          }
          
          .goals-stat-card::after {
            content: '';
            position: absolute;
            z-index: 0;
            width: 54px;
            height: 54px;
            border-radius: 50%;
            background: #667eea;
            opacity: 0.04;
            right: 36px;
            bottom: -20px;
            pointer-events: none;
            animation: bubble-float-small 4.2s ease-in-out infinite;
          }
          
          .goals-stat-card:nth-child(1)::before,
          .goals-stat-card:nth-child(1)::after {
            background: #a8e63d;
          }
          
          .goals-stat-card:nth-child(2)::before,
          .goals-stat-card:nth-child(2)::after {
            background: #3b82f6;
          }
          
          .goals-stat-card:nth-child(3)::before,
          .goals-stat-card:nth-child(3)::after {
            background: #0f766e;
          }
          
          .goals-stat-card:nth-child(4)::before,
          .goals-stat-card:nth-child(4)::after {
            background: #ef4444;
          }
        `}
      </style>
      <div className="page-container" style={{ padding: "24px", background: "#f8fafc", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

        <style>{`
          .goals-filter-select {
            padding: 7px 32px 7px 12px;
            border: none;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            background: #ffffff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2316a34a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 10px center;
            appearance: none;
            -webkit-appearance: none;
            outline: none;
            color: #1e293b;
            font-family: 'Inter', 'Poppins', 'Segoe UI', sans-serif;
            transition: background 0.2s;
            box-shadow: none;
            height: 32px;
          }
          .goals-filter-select:hover,
          .goals-filter-select:focus { background-color: #f0fdf4; box-shadow: none; }
          .goals-filter-date {
            padding: 7px 12px;
            border: none;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            background: #ffffff;
            outline: none;
            color: #1e293b;
            font-family: 'Inter', 'Poppins', 'Segoe UI', sans-serif;
            transition: background 0.2s;
            box-shadow: none;
            height: 32px;
          }
          .goals-filter-date:hover,
          .goals-filter-date:focus { background-color: #f0fdf4; box-shadow: none; }
          .goals-create-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 7px 14px;
            border: none;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            background: #166534;
            color: #ffffff;
            outline: none;
            font-family: 'Inter', 'Poppins', 'Segoe UI', sans-serif;
            transition: background 0.2s;
            height: 32px;
            white-space: nowrap;
          }
          .goals-create-btn:hover { background: #14532d; }
        `}</style>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ClipboardList size={18} color="#14532d" />
            <h2 style={{ margin: 0, fontSize: "28px", fontWeight: "600", color: "#0f172a", letterSpacing: "-0.02em" }}>Task Management</h2>
          </div>

          <div className="goals-toolbar-controls" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 520px" }}>
            {/* Notification Badge */}
            <div style={{ position: 'relative' }}>
              <NotificationBell filterType="Task" />
            </div>

            {/* Employee Filter - Only for Admin */}
            {canAssignTasks && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEmpFilterDd(!showEmpFilterDd); setShowProjFilterDd(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '9px 16px', border: '1px solid #e2e8f0', borderRadius: '999px',
                    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                    background: showEmpFilterDd ? '#f0fdf4' : '#ffffff',
                    color: '#475569', outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.25s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = showEmpFilterDd ? '#16a34a' : '#e2e8f0'}
                >
                  <span>{filters.employeeName === "" ? "All Employees" : filters.employeeName}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.2s', transform: showEmpFilterDd ? 'rotate(180deg)' : 'none' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showEmpFilterDd && (
                  <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    background: '#ffffff', borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                    width: '320px', maxWidth: 'calc(100vw - 40px)', padding: '12px', overflow: 'hidden',
                    animation: 'goalsDdIn 0.2s ease'
                  }}>
                    <div style={{ marginBottom: '10px' }}>
                      <input type="text" placeholder="Search employees..."
                        value={empFilterSearch}
                        onChange={(e) => setEmpFilterSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                        style={{
                          width: '100%', padding: '8px 12px', border: '1px solid #f1f5f9',
                          borderRadius: '10px', fontSize: '12px', background: '#f8fafc',
                          outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <div className="goals-dd-option"
                        onClick={() => { setFilters({ ...filters, employeeName: "" }); setShowEmpFilterDd(false); setEmpFilterSearch(""); }}
                        style={{
                          padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                          fontWeight: filters.employeeName === "" ? '600' : '400',
                          cursor: 'pointer', color: filters.employeeName === "" ? '#15803d' : '#1e293b',
                          background: filters.employeeName === "" ? '#dcfce7' : 'transparent',
                          marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                        }}
                      >All Employees</div>
                      {uniqueEmployeeNames.filter(n => n.toLowerCase().includes(empFilterSearch.toLowerCase())).map((name, idx) => (
                        <div key={idx} className="goals-dd-option"
                          onClick={() => { setFilters({ ...filters, employeeName: name }); setShowEmpFilterDd(false); setEmpFilterSearch(""); }}
                          style={{
                            padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                            fontWeight: filters.employeeName === name ? '600' : '400',
                            cursor: 'pointer', color: filters.employeeName === name ? '#15803d' : '#1e293b',
                            background: filters.employeeName === name ? '#dcfce7' : 'transparent',
                            marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                          }}
                        >{name}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Project Filter */}
            {!['Sales', 'Marketing'].includes(userRoleName) && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowProjFilterDd(!showProjFilterDd); setShowEmpFilterDd(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '9px 16px', border: '1px solid #e2e8f0', borderRadius: '999px',
                    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                    background: showProjFilterDd ? '#f0fdf4' : '#ffffff',
                    color: '#475569', outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.25s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = showProjFilterDd ? '#16a34a' : '#e2e8f0'}
                >
                  <span>{filters.projectName === "" ? "All Projects" : filters.projectName}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.2s', transform: showProjFilterDd ? 'rotate(180deg)' : 'none' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showProjFilterDd && (
                  <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    background: '#ffffff', borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                    width: '320px', maxWidth: 'calc(100vw - 40px)', padding: '12px', overflow: 'hidden',
                    animation: 'goalsDdIn 0.2s ease'
                  }}>
                    <div style={{ marginBottom: '10px' }}>
                      <input type="text" placeholder="Search projects..."
                        value={projFilterSearch}
                        onChange={(e) => setProjFilterSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                        style={{
                          width: '100%', padding: '8px 12px', border: '1px solid #f1f5f9',
                          borderRadius: '10px', fontSize: '12px', background: '#f8fafc',
                          outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <div className="goals-dd-option"
                        onClick={() => { setFilters({ ...filters, projectName: "" }); setShowProjFilterDd(false); setProjFilterSearch(""); }}
                        style={{
                          padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                          fontWeight: filters.projectName === "" ? '600' : '400',
                          cursor: 'pointer', color: filters.projectName === "" ? '#15803d' : '#1e293b',
                          background: filters.projectName === "" ? '#dcfce7' : 'transparent',
                          marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                        }}
                      >All Projects</div>
                      {uniqueProjectNames.filter(n => n.toLowerCase().includes(projFilterSearch.toLowerCase())).map((name, idx) => (
                        <div key={idx} className="goals-dd-option"
                          onClick={() => { setFilters({ ...filters, projectName: name }); setShowProjFilterDd(false); setProjFilterSearch(""); }}
                          style={{
                            padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                            fontWeight: filters.projectName === name ? '600' : '400',
                            cursor: 'pointer', color: filters.projectName === name ? '#15803d' : '#1e293b',
                            background: filters.projectName === name ? '#dcfce7' : 'transparent',
                            marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                          }}
                        >{name}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Date Range Filter (Dropdown) */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDateFilterDd(!showDateFilterDd);
                  setShowEmpFilterDd(false);
                  setShowProjFilterDd(false);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  background: (filters.startDate || filters.endDate) ? '#f0fdf4' : '#fff',
                  color: (filters.startDate || filters.endDate) ? '#166534' : '#475569',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                <CalendarDays size={14} />
                {(filters.startDate || filters.endDate) ? 'Date Filter Applied' : 'Date'}
                {(filters.startDate || filters.endDate) && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilters({ ...filters, startDate: '', endDate: '' });
                    }}
                    style={{
                      marginLeft: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#dcfce7',
                      color: '#166534',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      fontSize: '10px'
                    }}
                  >×</span>
                )}
              </button>

              {showDateFilterDd && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    border: '1px solid #e5e7eb',
                    padding: '16px',
                    zIndex: 50,
                    minWidth: '220px',
                  }}
                >
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#1e293b', fontWeight: '600' }}>Filter by Date</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>From</label>
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>To</label>
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Request Task Button - visible to Marketing role only */}
            {userRoleName === 'Marketing' && (
              <button
                onClick={() => {
                  setReqTlSearch("");
                  setShowRequestTaskModal(true);
                }}
                className="goals-create-btn"
                style={{ background: '#166534', border: 'none', boxShadow: 'none' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#14532d'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#166534'}
              >
                Request Task
              </button>
            )}

            {/* View Requests Button - visible to Team Leader and Admin */}
            {(userRoleName === 'Team Leader' || isAdmin) && (
              <button
                onClick={() => setShowViewRequestsModal(true)}
                className="goals-create-btn"
                style={{ background: '#166534', border: 'none', boxShadow: 'none', marginLeft: '10px' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#14532d'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#166534'}
              >
                View Requests
              </button>
            )}

            {showCreateButton && (
              <button
                className="goals-create-btn"
                onClick={() => setShowModal(true)}
              >
                Create Task
              </button>
            )}
          </div>
        </div>

        {/* Stats Summary Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ background: 'white', padding: '14px 16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div className="skeleton-box" style={{ width: '80px', height: '11px' }} />
                  <div className="skeleton-box" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
                </div>
                <div className="skeleton-box" style={{ width: '60px', height: '26px', marginBottom: '4px' }} />
                <div className="skeleton-box" style={{ width: '110px', height: '11px' }} />
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div className="goals-stat-card" style={{
              background: "white",
              padding: "14px 16px",
              borderRadius: "12px",
              border: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              transition: "all 0.22s ease",
              position: "relative",
              cursor: "pointer"
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Goal Records
                </div>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f1f5f9", color: "#667eea", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ClipboardList size={16} strokeWidth={2.5} />
                </div>
              </div>
              <div className="goals-stat-value">
                {baseFilteredGoals.length}
              </div>
              <div className="goals-stat-subtext">Total filtered records</div>
            </div>

            <div className="goals-stat-card" style={{
              background: "white",
              padding: "14px 16px",
              borderRadius: "12px",
              border: filters.status === '' ? "2px solid #a8e63d" : "2px solid transparent",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              transition: "all 0.22s ease",
              position: "relative",
              cursor: "pointer"
            }}
              onClick={() => setFilters({ ...filters, status: '' })}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Total Tasks
                </div>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #a8e63d 0%, #7aad7a 100%)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(168,230,61,0.2)" }}>
                  <BarChart3 size={16} strokeWidth={2.5} />
                </div>
              </div>
              <div className="goals-stat-value">
                {totalGoalItems}
              </div>
              <div className="goals-stat-subtext">Individual task items</div>
            </div>

            <div className="goals-stat-card" style={{
              background: "white",
              padding: "14px 16px",
              borderRadius: "12px",
              border: filters.status === 'completed' ? "2px solid #16a34a" : "2px solid transparent",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              transition: "all 0.22s ease",
              position: "relative",
              cursor: "pointer"
            }}
              onClick={() => setFilters({ ...filters, status: filters.status === 'completed' ? '' : 'completed' })}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Completed
                </div>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                </div>
              </div>
              <div className="goals-stat-value">
                {completedGoalItems}
              </div>
              <div className="goals-stat-subtext">Completed tasks</div>
            </div>

            <div className="goals-stat-card" style={{
              background: "white",
              padding: "14px 16px",
              borderRadius: "12px",
              border: filters.status === 'pending' ? "2px solid #f59e0b" : "2px solid transparent",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              transition: "all 0.22s ease",
              position: "relative",
              cursor: "pointer"
            }}
              onClick={() => setFilters({ ...filters, status: filters.status === 'pending' ? '' : 'pending' })}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Pending
                </div>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fef3c7", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock3 size={16} strokeWidth={2.5} />
                </div>
              </div>
              <div className="goals-stat-value">
                {pendingGoalItems}
              </div>
              <div className="goals-stat-subtext">Pending tasks</div>
            </div>
          </div>
        )}

        {/* Stat Details Modal */}
        {statDetailsModalOpen && (
          <div className="modal-overlay" onClick={() => setStatDetailsModalOpen(false)}>
            <div className="clean-modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header-clean">
                <h3 className="modal-title-clean">{statDetailsTitle}</h3>
                <button className="close-btn-clean" onClick={() => setStatDetailsModalOpen(false)}>&times;</button>
              </div>
              <div className="modal-content-clean custom-scrollbar">
                {loadingStatDetails ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
                ) : statDetailsData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>No employees found in this category.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {statDetailsData.map((item, idx) => (
                      <div key={idx} style={{
                        padding: '12px',
                        border: '1px solid #eee',
                        borderRadius: '0',
                        background: '#f9fafb',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ fontWeight: '600', color: '#1f2937' }}>
                          Ã°Å¸â€˜Â¤ {item.employee?.firstName} {item.employee?.lastName}
                          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '6px' }}>({item.employee?.employeeId})</span>
                        </div>
                        {item.details && item.details.map((detail, dIdx) => (
                          <div key={dIdx} style={{ fontSize: '13px', color: '#4b5563', paddingLeft: '8px', borderLeft: '2px solid #e5e7eb' }}>
                            {detail.message && <div>{detail.message}</div>}
                            {detail.projectName && (
                              <div>
                                <strong>{detail.projectName}</strong>
                                {detail.overdueSince && (
                                  <span style={{ color: '#dc2626', marginLeft: '6px' }}>
                                    (Overdue since {new Date(detail.overdueSince).toLocaleDateString()})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setStatDetailsModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card" style={{ padding: '14px', borderRadius: '14px', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', background: '#ffffff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="skeleton-box" style={{ width: '34px', height: '34px', borderRadius: '10px' }} />
                      <div>
                        <div className="skeleton-box" style={{ width: '140px', height: '16px', marginBottom: '6px' }} />
                        <div className="skeleton-box" style={{ width: '80px', height: '12px' }} />
                      </div>
                    </div>
                    <div className="skeleton-box" style={{ width: '90px', height: '26px', borderRadius: '20px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                    <div className="skeleton-box" style={{ width: '100%', height: '38px', borderRadius: '10px' }} />
                    <div className="skeleton-box" style={{ width: '100%', height: '38px', borderRadius: '10px' }} />
                    <div className="skeleton-box" style={{ width: '75%', height: '38px', borderRadius: '10px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="skeleton-box" style={{ width: '120px', height: '12px' }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div className="skeleton-box" style={{ width: '60px', height: '28px', borderRadius: '10px' }} />
                      <div className="skeleton-box" style={{ width: '72px', height: '28px', borderRadius: '10px' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Removed empty JSX block that caused syntax error */}

              {/* Card View */}
              {viewMode === 'card' && paginatedGoals.map((group) => {
                const firstGoal = group.goals[0];
                // Get primary project for dates from the first goal
                const primaryProject = firstGoal.project || (firstGoal.projects && firstGoal.projects.length > 0 ? firstGoal.projects[0].projectId : null);
                const isPrimaryOverdue = primaryProject?.deadline && new Date(primaryProject.deadline) < new Date();
                const goal = { ...firstGoal, employee: group.employee };
                const cardRoleName = (goal.employee?.role?.name || '').toLowerCase();
                const cardHideProjectInfo = !(cardRoleName.includes('developer') || cardRoleName.includes('admin'));
                const isOwnGroup = String(goal.employee?._id) === String(user?._id || user?.id);
                const isCreator = String(goal.createdBy?._id || goal.createdBy) === String(user?._id || user?.id);
                const canEditGroup = canUpdateGoals && (isAdmin || isOwnGroup || isCreator);
                const canDeleteGroup = canDeleteGoals && (isAdmin || isOwnGroup || isCreator);

                return (
                  <div
                    key={group.groupKey}
                    className="card"
                    style={{
                      padding: '14px',
                      borderRadius: '14px',
                      border: 'none',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)',
                      background: '#ffffff',
                      marginBottom: '10px',
                      transition: 'all 0.22s ease',
                      fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.11), 0 2px 8px rgba(0,0,0,0.06)';
                      e.currentTarget.style.transform = 'translateY(-3px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        {/* Profile header with edit buttons on the same row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '9px',
                              background: 'linear-gradient(135deg, #a8e63d 0%, #7aad7a 100%)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 3px 10px rgba(168,230,61,0.2)'
                            }}>
                              <UserCircle2 size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '15px', fontWeight: '700', lineHeight: '1.25', letterSpacing: '-0.01em' }}>
                                {goal.employee?.firstName} {goal.employee?.lastName}
                              </h3>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>ID: {goal.employee?.employeeId}</span>
                              <span style={{
                                marginLeft: '6px',
                                fontSize: '10px',
                                fontWeight: '600',
                                color: '#6b21a8',
                                background: '#f3e8ff',
                                border: '1px solid #d8b4fe',
                                borderRadius: '999px',
                                padding: '1px 7px',
                                display: 'inline-block',
                                letterSpacing: '0.01em'
                              }}>
                                {(() => { const d = new Date(group.createdAt); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                              </span>
                              <span style={{
                                marginLeft: '6px',
                                fontSize: '10px',
                                fontWeight: '600',
                                color: '#0369a1',
                                background: '#e0f2fe',
                                border: '1px solid #bae6fd',
                                borderRadius: '999px',
                                padding: '1px 7px',
                                display: 'inline-block',
                                letterSpacing: '0.01em'
                              }}>
                                {goal.employee?.role?.name || 'N/A'}
                              </span>
                              {(goal.createdBy && String(goal.createdBy._id) !== String(goal.employee?._id)) && (
                                <>
                                  <span style={{ marginLeft: '8px', fontSize: '10px', color: '#94a3b8', fontWeight: '500' }}>
                                    Assigned by :
                                  </span>
                                  <span style={{
                                    marginLeft: '4px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: '#b45309',
                                    background: '#fffbeb',
                                    border: '1px solid #fde68a',
                                    borderRadius: '999px',
                                    padding: '1px 7px',
                                    display: 'inline-block',
                                    letterSpacing: '0.01em'
                                  }}>
                                    {goal.createdBy.firstName} {goal.createdBy.lastName}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Edit and Done buttons */}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {/* Request Review Button */}
                            {(() => {
                              // Since group.goals is sorted oldest first, we reverse it to search newest first
                              const reversedGoals = [...group.goals].reverse();
                              const unrequestedCompletedGoal = reversedGoals.find(g => !g.reviewRequest?.requested && g.goals.some(t => t.isCompleted));
                              const requestedGoal = reversedGoals.find(g => g.reviewRequest?.requested);
                              const mainGoalDoc = unrequestedCompletedGoal || requestedGoal || reversedGoals[0];
                              const isEmployee = String(mainGoalDoc?.employee?._id) === String(user?.id || user?._id);
                              const hasRequest = mainGoalDoc?.reviewRequest?.requested;
                              const isTeamLeaderOrCreator = (mainGoalDoc?.reviewRequest?.teamLeader && String(mainGoalDoc.reviewRequest.teamLeader?._id || mainGoalDoc.reviewRequest.teamLeader) === String(user?.id || user?._id)) ||
                                (mainGoalDoc?.createdBy && String(mainGoalDoc.createdBy?._id || mainGoalDoc.createdBy) === String(user?.id || user?._id));
                              const canViewReviewBadge = isAdmin || isEmployee || (hasRequest && isTeamLeaderOrCreator);

                              if (canViewReviewBadge && mainGoalDoc) {
                                const hasPendingTasks = group.goals.some(g => g.goals.some(t => !t.isCompleted));
                                const status = mainGoalDoc.reviewRequest?.status;
                                const requested = mainGoalDoc.reviewRequest?.requested;

                                let displayState = 'none';
                                let displayText = 'Request Review';

                                if (!requested) {
                                  displayState = 'none';
                                  displayText = 'Request Review';
                                } else if (hasPendingTasks) {
                                  // If a new pending task was added after a review was already requested or reverted
                                  displayState = 'none';
                                  displayText = 'Request Review';
                                } else {
                                  if (status === 'Pending') {
                                    displayState = 'pending';
                                    displayText = 'Review Requested';
                                  } else if (status === 'Rejected') {
                                    displayState = 'rejected';
                                    displayText = 'Rejected';
                                  } else if (status === 'Reverted') {
                                    displayState = 'reverted';
                                    displayText = 'Reverted';
                                  } else {
                                    displayState = 'other';
                                    displayText = status || 'Request Review';
                                  }
                                }

                                const bgColors = { none: '#ffffff', pending: '#e0f2fe', seen: '#dcfce7', rejected: '#fee2e2', reverted: '#fef3c7', other: '#dcfce7' };
                                const textColors = { none: '#64748b', pending: '#0369a1', seen: '#166534', rejected: '#991b1b', reverted: '#92400e', other: '#166534' };
                                const borderColors = { none: '#e2e8f0', pending: '#bae6fd', seen: '#bbf7d0', rejected: '#fecaca', reverted: '#fde68a', other: '#bbf7d0' };

                                return (
                                  <div
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleOpenReviewModal(mainGoalDoc, group.goals);
                                    }}
                                    style={{
                                      cursor: 'pointer',
                                      backgroundColor: bgColors[displayState],
                                      color: textColors[displayState],
                                      border: `1px solid ${borderColors[displayState]}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: '4px 12px',
                                      borderRadius: '9999px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
                                    onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                                  >
                                    {displayText}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            {(canEditGroup && !group.goals.every(goalDoc => goalDoc.goals.every(task => task.isCompleted))) && (
                              <button
                                className="btn btn-secondary"
                                onClick={() => startEditGoal(group.goals[group.goals.length - 1])}
                                style={{
                                  padding: '0',
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#0ea5e9',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#0284c7';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#0ea5e9';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                                title="Edit tasks"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            )}
                            {(canDeleteGroup && !group.goals.every(goalDoc => goalDoc.goals.every(task => task.isCompleted))) && (
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleDeleteGoal(group.goals[group.goals.length - 1]._id)}
                                style={{
                                  padding: '0',
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#dc2626';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#ef4444';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                                title="Delete tasks"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            )}

                            {(() => {
                              // Check if there are selected tasks from this group
                              const groupTaskIds = group.goals.flatMap(goalDoc =>
                                goalDoc.goals.map(task => task._id)
                              );
                              const hasSelectedTasksInGroup = selectedTasks.some(taskId =>
                                groupTaskIds.includes(taskId)
                              );

                              const allCompleted = group.goals.every(goalDoc =>
                                goalDoc.goals.every(task => task.isCompleted)
                              );

                              // Show Done button only if there are selected tasks in this group
                              if (hasSelectedTasksInGroup) {
                                return (
                                  <button
                                    className="btn btn-success"
                                    onClick={() => handleMarkSelectedAsComplete(group)}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '11px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                      border: 'none',
                                      borderRadius: '6px',
                                      background: '#15803d',
                                      color: 'white',
                                      cursor: 'pointer',
                                      fontWeight: '600',
                                      boxShadow: 'none',
                                    }}
                                    title="Mark selected as done"
                                  >
                                    Done
                                  </button>
                                );
                              } else if (allCompleted) {
                                // Show checkmark only if all completed and no selections
                                return (
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: '#16a34a',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                  }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="none" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10" fill="#16a34a"></circle>
                                      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" fill="none"></path>
                                    </svg>
                                  </div>
                                );
                              }
                              // Don't show anything if no tasks selected and not all completed
                              return null;
                            })()}
                          </div>
                        </div>

                        {/* Column header labels aligned with task row layout */}
                        <div className="goal-col-headers" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px', marginBottom: '4px', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0', margin: '14px 0 4px' }}>
                          <span style={{ minWidth: '20px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textAlign: 'center' }}>Sr</span>
                          <span style={{ minWidth: '16px' }} />{/* checkbox placeholder */}
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ flex: 1, fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>Task</span>
                            <div style={{ width: '1px', background: '#e2e8f0', height: '14px' }} />
                            {!cardHideProjectInfo && <span style={{ width: '110px', maxWidth: '110px', minWidth: '90px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', padding: '0 8px' }}>Project</span>}
                            {!cardHideProjectInfo && <div style={{ width: '1px', background: '#e2e8f0', height: '14px' }} />}
                            <span style={{ width: '150px', maxWidth: '150px', minWidth: '120px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', padding: '0 8px' }}>Notes</span>
                            <div style={{ width: '1px', background: '#e2e8f0', height: '14px' }} />
                            <span style={{ minWidth: '140px', width: '140px', fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>Status</span>
                          </div>
                        </div>



                      </div>
                    </div>

                    <div style={{ marginTop: '12px', paddingTop: '10px' }}>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {group.goals.flatMap(goalDoc => {
                          const projectsArr = goalDoc.projects || [];
                          const singleProjectName = goalDoc.projectName || goalDoc.project?.name || '';
                          const getTaskProjectName = (item, idx) => {
                            if (item.projectName) return item.projectName;
                            if (projectsArr.length === 1) return projectsArr[0].projectName || projectsArr[0].projectId?.name || singleProjectName;
                            if (projectsArr.length > 1) {
                              const tasksPerProject = Math.ceil(goalDoc.goals.length / projectsArr.length);
                              const projIdx = Math.floor(idx / tasksPerProject);
                              const proj = projectsArr[Math.min(projIdx, projectsArr.length - 1)];
                              return proj.projectName || proj.projectId?.name || '';
                            }
                            return singleProjectName;
                          };
                          const created = new Date(goalDoc.createdAt);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          created.setHours(0, 0, 0, 0);
                          const createdToday = String(created) === String(today);
                          const canModify = isAdmin || (String(goalDoc.employee?._id) === String(user?.id || user?._id) && createdToday);
                          // Allow completing/adding notes for own tasks regardless of date
                          const isOwnTask = String(goalDoc.employee?._id) === String(user?.id || user?._id);
                          const canCompleteOrNote = isAdmin || isOwnTask;
                          return goalDoc.goals.map((item, idx) => {
                            const taskProjectName = getTaskProjectName(item, idx);
                            // Global task number across all goalDocs in this group
                            const globalIdx = group.goals.slice(0, group.goals.indexOf(goalDoc)).reduce((sum, g) => sum + g.goals.length, 0) + idx + 1;

                            return (
                              <div key={item._id} className="checkbox-container" style={{
                                marginBottom: '0',
                                padding: '6px 4px',
                                borderRadius: '0',
                                border: 'none',
                                borderBottom: '1px solid #f1f5f9',
                                background: 'transparent',
                                transition: 'all 0.2s',
                                cursor: canCompleteOrNote ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px'
                              }}
                                onMouseEnter={(e) => {
                                  if (canCompleteOrNote) {
                                    e.currentTarget.style.background = '#f8fafc';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <span style={{
                                  minWidth: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: item.isCompleted ? '#dcfce7' : '#e2e8f0',
                                  color: item.isCompleted ? '#166534' : '#64748b',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginTop: '1px'
                                }}>{globalIdx}</span>
                                {!item.isCompleted && (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canCompleteOrNote) handleTaskSelection(item._id);
                                    }}
                                    style={{
                                      marginTop: '2px',
                                      flexShrink: 0,
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '50%',
                                      border: `1.5px solid ${selectedTasks.includes(item._id) ? '#16a34a' : '#cbd5e1'}`,
                                      background: selectedTasks.includes(item._id) ? '#16a34a' : 'white',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: canCompleteOrNote ? 'pointer' : 'default',
                                      transition: 'all 0.2s',
                                      boxShadow: selectedTasks.includes(item._id) ? '0 0 0 2px rgba(22, 163, 74, 0.2)' : 'none'
                                    }}
                                  >
                                    {selectedTasks.includes(item._id) && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                      </svg>
                                    )}
                                  </div>
                                )}

                                <label className="goal-task-label" style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                  <div className="goal-task-name-col" style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: '500', fontSize: '13px', color: item.isCompleted ? '#94a3b8' : '#1e293b', letterSpacing: '0.01em', lineHeight: '1.4', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      {item.name}
                                      {item.isCompleted && (
                                        <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                                      )}
                                    </div>
                                  </div>
                                  {/* Project field */}
                                  {!cardHideProjectInfo && <>
                                    <div className="goal-task-sep" style={{ width: '1px', background: '#e2e8f0', alignSelf: 'stretch', minHeight: '20px' }} />
                                    <div className="goal-task-project-cell" style={{ width: '110px', maxWidth: '110px', minWidth: '90px', padding: '0 8px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                                      {taskProjectName ? (
                                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#7c3aed', letterSpacing: '0.01em', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                          <FolderKanban size={11} color="#7c3aed" style={{ flexShrink: 0 }} />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskProjectName}</span>
                                        </span>
                                      ) : <span style={{ fontSize: '11px', color: '#cbd5e1' }}>-</span>}
                                    </div>
                                  </>}
                                  {/* Notes field - always show for alignment */}
                                  <>
                                    <div className="goal-task-sep" style={{ width: '1px', background: '#e2e8f0', alignSelf: 'stretch', minHeight: '20px' }} />
                                    <div className="goal-task-notes-cell"
                                      onClick={() => {
                                        if (!item.isCompleted && canCompleteOrNote) {
                                          handleAddNote(goalDoc._id, item._id, item, goalDoc);
                                        }
                                      }}
                                      style={{
                                        fontSize: '12px',
                                        color: item.notes ? '#64748b' : '#94a3b8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        minWidth: '120px',
                                        width: '150px',
                                        maxWidth: '150px',
                                        cursor: (!item.isCompleted && canCompleteOrNote) ? 'pointer' : 'default',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        transition: 'all 0.2s',
                                        fontStyle: item.notes ? 'normal' : 'italic',
                                        visibility: (!item.isCompleted || item.notes) ? 'visible' : 'hidden',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!item.isCompleted && canCompleteOrNote) {
                                          e.currentTarget.style.background = '#f8fafc';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                      }}
                                    >
                                      <FileText size={12} color="#94a3b8" style={{ flexShrink: 0 }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.notes || 'Add note...'}
                                      </span>
                                    </div>
                                  </>
                                  {/* Status field - always show for alignment */}
                                  <>
                                    <div className="goal-task-sep" style={{ width: '1px', background: '#e2e8f0', alignSelf: 'stretch', minHeight: '20px' }} />
                                    <div className="goal-task-status-cell" style={{ minWidth: '140px', width: '140px' }}>
                                      {item.isCompleted && item.completedAt ? (
                                        <span style={{ fontSize: '11px', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                          Completed on {new Date(item.completedAt).toLocaleDateString()}
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: '11px', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', fontWeight: '600' }}>
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                  </>
                                </label>
                              </div>
                            );
                          });
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Table View */}
              {viewMode === 'table' && (
                <div className="card" style={{ padding: '12px', borderRadius: '18px', border: '1px solid #dbe8d8', boxShadow: '0 10px 24px rgba(20, 83, 45, 0.08)' }}>
                  <div className="goals-table-scroll" style={{ borderRadius: '14px', border: '1px solid #d9e6d6' }}>
                    <table className="goals-table">
                      <thead>
                        <tr style={{ background: 'linear-gradient(135deg, #166534 0%, #14532d 100%)', color: 'white' }}>
                          <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '700', letterSpacing: '0.02em' }}>S.No</th>
                          <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '700', letterSpacing: '0.02em' }}>Employee</th>
                          <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '700', letterSpacing: '0.02em' }}>Project(s)</th>
                          <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '700', letterSpacing: '0.02em' }}>Tasks</th>
                          <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '700', letterSpacing: '0.02em' }}>Status</th>
                          <th style={{ padding: '14px 12px', textAlign: 'left', fontWeight: '700', letterSpacing: '0.02em' }}>Created</th>
                          <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: '700', letterSpacing: '0.02em' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedGoals.map((goal, index) => {
                          const actualIndex = (currentPage - 1) * GOALS_PER_PAGE + index;
                          const created = new Date(goal.createdAt);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          created.setHours(0, 0, 0, 0);
                          const createdToday = String(created) === String(today);
                          const canModify = isAdmin || (String(goal.employee?._id) === String(user?.id || user?._id) && createdToday);
                          // Allow completing/adding notes for own tasks regardless of date
                          const isOwnTask = String(goal.employee?._id) === String(user?.id || user?._id);
                          const isCreator = String(goal.createdBy?._id || goal.createdBy) === String(user?.id || user?._id);
                          const canCompleteOrNote = isAdmin || isOwnTask;
                          const canEditTaskList = canUpdateGoals && (isAdmin || isOwnTask || isCreator);
                          const canDeleteTaskList = canDeleteGoals && (isAdmin || isOwnTask || isCreator);
                          const rowBg = index % 2 === 0 ? '#ffffff' : '#fbfefb';
                          // Get primary project for dates - check both single project and projects array
                          const primaryProject = goal.project || (goal.projects && goal.projects.length > 0 ? goal.projects[0].projectId : null);

                          return (
                            <tr
                              key={goal._id}
                              style={{ borderBottom: '1px solid #e4eee2', background: rowBg, transition: 'background 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                              onMouseLeave={(e) => e.currentTarget.style.background = rowBg}
                            >
                              <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#14532d' }}>
                                  {actualIndex + 1}
                                </div>
                              </td>
                              <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                  <div style={{ width: '30px', height: '30px', borderRadius: '10px', background: '#e8f5e9', color: '#166534', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                    <UserCircle2 size={17} />
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '700', color: '#1f2937', lineHeight: 1.2, fontSize: '17px' }}>
                                      {goal.employee?.firstName} {goal.employee?.lastName}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                      {goal.employee?.employeeId}
                                    </div>
                                    {canAssignTasks && (
                                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                                        {goal.employee?.role?.name || 'N/A'}
                                      </div>
                                    )}
                                    {(goal.createdBy && String(goal.createdBy._id) !== String(goal.employee?._id)) && (
                                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                                        <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '500', marginRight: '4px' }}>
                                          Assigned by :
                                        </span>
                                        <div style={{
                                          fontSize: '9px',
                                          fontWeight: '600',
                                          color: '#b45309',
                                          background: '#fffbeb',
                                          border: '1px solid #fde68a',
                                          borderRadius: '999px',
                                          padding: '1px 6px',
                                          display: 'inline-block',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {goal.createdBy.firstName} {goal.createdBy.lastName}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
                                {!hideProjectInfo && (goal.projects && goal.projects.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {goal.projects.map((proj, idx) => (
                                      <span
                                        key={idx}
                                        style={{
                                          fontSize: '10px',
                                          fontWeight: '600',
                                          color: '#0369a1',
                                          background: '#e0f2fe',
                                          border: '1px solid #bae6fd',
                                          borderRadius: '999px',
                                          padding: '2px 9px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          letterSpacing: '0.01em',
                                          width: 'fit-content'
                                        }}
                                      >
                                        <FolderKanban size={11} color="#0369a1" />
                                        {proj.projectName || proj.projectId?.name || 'Unknown'}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: '#0369a1',
                                    background: '#e0f2fe',
                                    border: '1px solid #bae6fd',
                                    borderRadius: '999px',
                                    padding: '2px 9px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    letterSpacing: '0.01em'
                                  }}>
                                    <FolderKanban size={11} color="#0369a1" />
                                    {goal.projectName || goal.project?.name || 'Unknown Project'}
                                  </span>
                                ))}
                              </td>

                              <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
                                <div style={{ maxHeight: '140px', overflowY: 'auto', paddingRight: '4px' }}>
                                  {(() => {
                                    const projectsArr = goal.projects || [];
                                    const singleProjectName = goal.projectName || goal.project?.name || '';
                                    const getTaskProjectName = (item, idx) => {
                                      if (item.projectName) return item.projectName;
                                      if (projectsArr.length === 1) return projectsArr[0].projectName || projectsArr[0].projectId?.name || singleProjectName;
                                      if (projectsArr.length > 1) {
                                        const tasksPerProject = Math.ceil(goal.goals.length / projectsArr.length);
                                        const projIdx = Math.floor(idx / tasksPerProject);
                                        const proj = projectsArr[Math.min(projIdx, projectsArr.length - 1)];
                                        return proj.projectName || proj.projectId?.name || '';
                                      }
                                      return singleProjectName;
                                    };
                                    return goal.goals.map((item, idx) => {
                                      const taskProjectName = getTaskProjectName(item, idx);
                                      return (
                                        <div
                                          key={item._id}
                                          style={{
                                            marginBottom: '8px',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '8px',
                                            padding: '8px 10px',
                                            border: '1px solid #e6efe4',
                                            borderRadius: '10px',
                                            background: item.isCompleted ? '#f0fdf4' : '#ffffff',
                                          }}
                                        >
                                          {!item.isCompleted && (
                                            <div
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (canCompleteOrNote) handleTaskSelection(item._id);
                                              }}
                                              style={{
                                                marginTop: '2px',
                                                flexShrink: 0,
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                border: `1.5px solid ${selectedTasks.includes(item._id) ? '#16a34a' : '#cbd5e1'}`,
                                                background: selectedTasks.includes(item._id) ? '#16a34a' : 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: canCompleteOrNote ? 'pointer' : 'default',
                                                transition: 'all 0.2s',
                                                boxShadow: selectedTasks.includes(item._id) ? '0 0 0 2px rgba(22, 163, 74, 0.2)' : 'none'
                                              }}
                                            >
                                              {selectedTasks.includes(item._id) && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                  <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                              )}
                                            </div>
                                          )}

                                          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              {taskProjectName && (
                                                <span style={{
                                                  display: 'inline-flex', alignItems: 'center', gap: '3px', marginBottom: '3px',
                                                  padding: '1px 6px', borderRadius: '5px', background: '#ecfdf3', border: '1px solid #86efac',
                                                  fontSize: '10px', fontWeight: '700', color: '#166534'
                                                }}>
                                                  <FolderKanban size={10} />
                                                  {taskProjectName}
                                                </span>
                                              )}
                                              <div style={{
                                                fontSize: '13px',
                                                color: item.isCompleted ? '#64748b' : '#1f2937',
                                                fontWeight: item.isCompleted ? '500' : '700',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                              }}>
                                                {item.name}
                                                {item.isCompleted && (
                                                  <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                                                )}
                                              </div>
                                            </div>
                                            {/* Notes field - always show for alignment */}
                                            <>
                                              <div style={{ width: '1px', background: '#e2e8f0', alignSelf: 'stretch', minHeight: '20px' }} />
                                              <div
                                                onClick={() => {
                                                  if (!item.isCompleted && canCompleteOrNote) {
                                                    handleAddNote(goal._id, item._id, item, goal);
                                                  }
                                                }}
                                                style={{
                                                  fontSize: '11px',
                                                  color: item.notes ? '#475569' : '#94a3b8',
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '5px',
                                                  minWidth: '100px',
                                                  maxWidth: '120px',
                                                  cursor: (!item.isCompleted && canCompleteOrNote) ? 'pointer' : 'default',
                                                  padding: '4px 8px',
                                                  borderRadius: '6px',
                                                  transition: 'all 0.2s',
                                                  fontStyle: item.notes ? 'normal' : 'italic',
                                                  visibility: (!item.isCompleted || item.notes) ? 'visible' : 'hidden',
                                                  whiteSpace: 'nowrap',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis'
                                                }}
                                                onMouseEnter={(e) => {
                                                  if (!item.isCompleted && canCompleteOrNote) {
                                                    e.currentTarget.style.background = '#f8fafc';
                                                  }
                                                }}
                                                onMouseLeave={(e) => {
                                                  e.currentTarget.style.background = 'transparent';
                                                }}
                                              >
                                                <FileText size={12} color="#166534" style={{ flexShrink: 0 }} />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  {item.notes || 'Add note...'}
                                                </span>
                                              </div>


                                            </>
                                          </div>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </td>

                              <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
                                <span style={{
                                  padding: '6px 11px',
                                  borderRadius: '999px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  textTransform: 'capitalize',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: primaryProject?.status === 'active' ? '#dcfce7' :
                                    primaryProject?.status === 'completed' ? '#e0f2fe' : '#fef3c7',
                                  color: primaryProject?.status === 'active' ? '#166534' :
                                    primaryProject?.status === 'completed' ? '#0c4a6e' : '#92400e',
                                }}>
                                  <CheckCircle2 size={12} />
                                  {primaryProject?.status || 'N/A'}
                                </span>
                              </td>



                              <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
                                <div style={{ fontSize: '12px', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                                  <CalendarDays size={13} color="#166534" />
                                  {new Date(goal.createdAt).toLocaleDateString()}
                                </div>
                              </td>

                              <td style={{ padding: '14px 12px', textAlign: 'center', verticalAlign: 'top' }}>
                                <div className="goals-table-actions">
                                  {canEditTaskList && (
                                    <button
                                      onClick={() => startEditGoal(goal)}
                                      style={{
                                        background: 'transparent',
                                        color: '#0ea5e9',
                                        border: 'none',
                                        padding: '0',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        transition: 'all 0.2s',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.color = '#0284c7';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.color = '#0ea5e9';
                                      }}
                                      title="Edit tasks"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                      </svg>
                                    </button>
                                  )}
                                  {canDeleteTaskList && (
                                    <button
                                      onClick={() => handleDeleteGoal(goal._id)}
                                      style={{
                                        background: 'transparent',
                                        color: '#ef4444',
                                        border: 'none',
                                        padding: '0',
                                        marginLeft: '8px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        transition: 'all 0.2s',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.color = '#dc2626';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.color = '#ef4444';
                                      }}
                                      title="Delete tasks"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 6h18" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {filteredGoals.length === 0 && goals.length > 0 && (
                <div className="card text-center">
                  <p>No tasks match the selected filters</p>
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                  padding: '12px 16px',
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #e2eee0',
                  boxShadow: '0 2px 8px rgba(20, 83, 45, 0.05)',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                    Showing {((currentPage - 1) * GOALS_PER_PAGE) + 1} to {Math.min(currentPage * GOALS_PER_PAGE, filteredGoals.length)} of {filteredGoals.length} tasks
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: '8px 14px',
                        border: '1px solid #d1e2cf',
                        borderRadius: '8px',
                        background: currentPage === 1 ? '#f8fafc' : '#fff',
                        color: currentPage === 1 ? '#94a3b8' : '#166534',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Previous
                    </button>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first page, last page, current page, and pages around current
                          if (totalPages <= 5) return true;
                          if (page === 1 || page === totalPages) return true;
                          if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                          return false;
                        })
                        .map((page, idx, arr) => {
                          // Add ellipsis between non-consecutive pages
                          const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                          return (
                            <React.Fragment key={page}>
                              {showEllipsis && (
                                <span style={{ padding: '8px 6px', color: '#94a3b8' }}>...</span>
                              )}
                              <button
                                onClick={() => setCurrentPage(page)}
                                style={{
                                  minWidth: '36px',
                                  height: '36px',
                                  border: 'none',
                                  borderRadius: '8px',
                                  background: page === currentPage ? 'linear-gradient(135deg, #166534 0%, #14532d 100%)' : '#fff',
                                  color: page === currentPage ? '#fff' : '#166534',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  boxShadow: page === currentPage ? '0 2px 8px rgba(20, 83, 45, 0.2)' : 'none'
                                }}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '8px 14px',
                        border: '1px solid #d1e2cf',
                        borderRadius: '8px',
                        background: currentPage === totalPages ? '#f8fafc' : '#fff',
                        color: currentPage === totalPages ? '#94a3b8' : '#166534',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {goals.length === 0 && (
                <div className="card text-center">
                  <p>No tasks available</p>
                </div>
              )}
            </>
          )}


        </div>

        {/* Modal Styles */}
        <div className="modal-styles">
          <style>{`
            .modal-overlay {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.4);
              backdrop-filter: blur(4px);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 1050;
            }
            .clean-modal {
              background: #ffffff;
              border-radius: 8px;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
              max-width: 650px;
              width: 90%;
              max-height: 90vh;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              animation: slideIn 0.2s ease-out;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .modal-header-clean {
              padding: 16px 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid #e5e7eb;
            }
            .modal-title-clean {
              font-size: 18px;
              font-weight: 600;
              color: #1f2937;
              margin: 0;
            }
            .close-btn-clean {
              background: transparent;
              border: none;
              color: #9ca3af;
              font-size: 20px;
              cursor: pointer;
              padding: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 4px;
            }
            .close-btn-clean:hover {
              background-color: #f3f4f6;
              color: #4b5563;
            }
            .modal-content-clean {
              padding: 24px;
              overflow-y: auto;
              flex: 1;
            }
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: #f1f1f1;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #d1d5db;
              border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #9ca3af;
            }
            .form-group-clean {
              margin-bottom: 20px;
            }
            .label-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            }
            .label-clean {
              font-size: 14px;
              font-weight: 500;
              color: #374151;
            }
            .label-clean span.required {
              color: #dc2626;
              margin-left: 2px;
            }
            .input-clean, .select-clean {
              width: 100%;
              padding: 10px 12px;
              background-color: #f9fafb;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 14px;
              color: #111827;
              outline: none;
              transition: border-color 0.15s;
              box-sizing: border-box;
            }
            .input-clean:focus, .select-clean:focus {
              background-color: #ffffff;
              border-color: #4a7c59;
              box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.1);
            }
            .btn-action-green {
              background-color: #43795b;
              color: white;
              border: none;
              border-radius: 4px;
              padding: 6px 12px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 4px;
            }
            .btn-action-green:hover {
              background-color: #366048;
            }
            .btn-add-project {
               background-color: #43795b;
               color: white;
               border: none;
               border-radius: 4px;
               padding: 6px 16px; 
               font-size: 13px;
               font-weight: 500;
               cursor: pointer;
            }
            .btn-footer {
              padding: 10px 24px;
              border-radius: 6px;
              font-weight: 500;
              font-size: 14px;
              cursor: pointer;
              transition: all 0.2s;
            }
            .btn-footer-cancel {
              background: #f3f4f6;
              border: 1px solid #e5e7eb;
              color: #374151;
            }
            .btn-footer-cancel:hover {
               background: #e5e7eb;
            }
            .btn-footer-primary {
              background: #43795b;
              border: 1px solid #43795b;
              color: white;
            }
            .btn-footer-primary:hover {
               background: #366048;
               box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .project-selector {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 12px;
              marginTop: 8px;
              max-height: 200px;
              overflow-y: auto;
              background: white;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .project-item {
              padding: 10px;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              margin-bottom: 6px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 10px;
              font-size: 14px;
              transition: all 0.15s;
            }
            .project-item:hover {
               background-color: #f9fafb;
            }
            .project-item.selected {
               background-color: #f0fdf4;
               border-color: #bbf7d0;
               color: #166534;
            }
            .selected-tag {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 6px;
              padding: 6px 10px;
              font-size: 13px;
              color: #15803d;
              display: inline-flex;
              align-items: center;
              gap: 8px;
            }
            .project-label-tag {
              background: #f3f4f6;
              color: #6b7280;
              font-size: 11px;
              padding: 2px 8px;
              border-radius: 12px;
              font-weight: 500;
              border: 1px solid #e5e7eb;
            }
          `}</style>
        </div>

        {showModal && (
          <div className="modal-overlay" onClick={() => cancelEdit()}>
            <div className="clean-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-clean">
                <h2 className="modal-title-clean">
                  {editingGoalId ? "Edit Task" : "New Task"}
                </h2>
                <button className="close-btn-clean" onClick={() => cancelEdit()}>&times;</button>
              </div>

              <div className="modal-content-clean custom-scrollbar">
                <form onSubmit={handleSubmit}>
                  {!editingGoalId && canAssignTasks && (
                    <div className="form-group-clean" style={{ marginBottom: '16px' }}>
                      <div className="label-row">
                        <label className="label-clean">Task Type</label>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="radio" checked={isOwnTask} onChange={() => { setIsOwnTask(true); setFormData({ ...formData, employee: "" }); }} style={{ accentColor: '#16a34a' }} />
                          <span style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>My Own Task</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input type="radio" checked={!isOwnTask} onChange={() => setIsOwnTask(false)} style={{ accentColor: '#16a34a' }} />
                          <span style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>Assign to Employee</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {!editingGoalId && canAssignTasks && !isOwnTask && (
                    <div className="form-group-clean">
                      <div className="label-row">
                        <label className="label-clean">
                          Assign To Employee <span className="required">*</span>
                        </label>
                      </div>
                      {/* Hidden input for form validation */}
                      <input type="hidden" value={formData.employee} required />
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowModalEmpDd(!showModalEmpDd); }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                            padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '10px',
                            fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                            background: showModalEmpDd ? '#f0fdf4' : '#ffffff',
                            color: formData.employee ? '#1e293b' : '#9ca3af', outline: 'none',
                            fontFamily: "'Inter', sans-serif",
                            transition: 'all 0.25s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = showModalEmpDd ? '#16a34a' : '#e2e8f0'}
                        >
                          <span>{formData.employee ? (() => { const emp = employees.find(e => e._id === formData.employee); return emp ? `${emp.firstName} ${emp.lastName} (${emp.employeeId})${emp.designation ? ` - ${emp.designation}` : ''}` : 'Select Employee'; })() : 'Select Employee'}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ transition: 'transform 0.2s', transform: showModalEmpDd ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {showModalEmpDd && (
                          <div onClick={e => e.stopPropagation()} style={{
                            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                            background: '#ffffff', borderRadius: '16px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                            padding: '12px', overflow: 'hidden',
                            animation: 'goalsDdIn 0.2s ease'
                          }}>
                            <div style={{ marginBottom: '10px' }}>
                              <input type="text" placeholder="Search employees..."
                                value={modalEmpSearch}
                                onChange={(e) => setModalEmpSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                autoFocus
                                style={{
                                  width: '100%', padding: '8px 12px', border: '1px solid #f1f5f9',
                                  borderRadius: '10px', fontSize: '12px', background: '#f8fafc',
                                  outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box'
                                }}
                              />
                            </div>
                            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                              {employees.filter(emp => emp.isActive === true && `${emp.firstName} ${emp.lastName} ${emp.employeeId}`.toLowerCase().includes(modalEmpSearch.toLowerCase())).map((emp) => (
                                <div key={emp._id} className="goals-dd-option"
                                  onClick={() => { setFormData({ ...formData, employee: emp._id }); setShowModalEmpDd(false); setModalEmpSearch(""); }}
                                  style={{
                                    padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                                    fontWeight: formData.employee === emp._id ? '600' : '400',
                                    cursor: 'pointer', color: formData.employee === emp._id ? '#15803d' : '#1e293b',
                                    background: formData.employee === emp._id ? '#dcfce7' : 'transparent',
                                    marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                                  }}
                                >{emp.firstName} {emp.lastName} ({emp.employeeId}) {emp.designation ? `- ${emp.designation}` : ''}</div>
                              ))}
                              {employees.filter(emp => emp.isActive === true && `${emp.firstName} ${emp.lastName} ${emp.employeeId}`.toLowerCase().includes(modalEmpSearch.toLowerCase())).length === 0 && (
                                <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No employees found</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!editingGoalId && !hideProjectSelection && (
                    <div className="form-group-clean">
                      <div className="label-row">
                        <label className="label-clean">Select Project {!canCreateWithoutProject && <span className="required">*</span>}
                          {canCreateWithoutProject && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>(Optional)</span>}
                        </label>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowProjectSelector(!showProjectSelector); setShowModalEmpDd(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                            padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '10px',
                            fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                            background: showProjectSelector ? '#f0fdf4' : '#ffffff',
                            color: selectedProjects.length > 0 ? '#1e293b' : '#9ca3af', outline: 'none',
                            fontFamily: "'Inter', sans-serif",
                            transition: 'all 0.25s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = showProjectSelector ? '#16a34a' : '#e2e8f0'}
                        >
                          <span>{selectedProjects.length === 0 ? 'Select Project' : selectedProjects.map(p => p.name).join(', ')}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ transition: 'transform 0.2s', transform: showProjectSelector ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {showProjectSelector && (
                          <div onClick={e => e.stopPropagation()} style={{
                            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                            background: '#ffffff', borderRadius: '16px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                            padding: '12px', overflow: 'hidden',
                            animation: 'goalsDdIn 0.2s ease'
                          }}>
                            <div style={{ marginBottom: '10px' }}>
                              <input type="text" placeholder="Search projects..."
                                value={modalProjSearch}
                                onChange={(e) => setModalProjSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                autoFocus
                                style={{
                                  width: '100%', padding: '8px 12px', border: '1px solid #f1f5f9',
                                  borderRadius: '10px', fontSize: '12px', background: '#f8fafc',
                                  outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box'
                                }}
                              />
                            </div>
                            {expiredProjectsCount > 0 && (
                              <div style={{
                                padding: '10px 12px', marginBottom: '8px',
                                background: '#fef3c7', border: '1px solid #fbbf24',
                                borderRadius: '8px', fontSize: '11px', color: '#92400e', lineHeight: '1.4'
                              }}>
                                <div style={{ fontWeight: '600', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <AlertTriangle size={12} />
                                  {expiredProjectsCount} project{expiredProjectsCount > 1 ? 's' : ''} with expired deadline{expiredProjectsCount > 1 ? 's' : ''}
                                </div>
                                <div>Contact HR to extend the deadline first.</div>
                              </div>
                            )}
                            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                              {getAvailableProjects.filter(p => p.name.toLowerCase().includes(modalProjSearch.toLowerCase())).length === 0 ? (
                                <div style={{ padding: '12px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                                  {expiredProjectsCount > 0
                                    ? 'All projects have expired deadlines.'
                                    : !isAdmin && projects.length > 0
                                      ? 'No projects assigned to you'
                                      : 'No projects available'}
                                </div>
                              ) : (
                                getAvailableProjects.filter(p => p.name.toLowerCase().includes(modalProjSearch.toLowerCase())).map((project) => {
                                  const isSelected = selectedProjects.find(p => p.id === project._id);
                                  return (
                                    <div key={project._id} className="goals-dd-option"
                                      onClick={() => handleProjectSelection(project._id, project.name)}
                                      style={{
                                        padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                                        fontWeight: isSelected ? '600' : '400',
                                        cursor: 'pointer', color: isSelected ? '#15803d' : '#1e293b',
                                        background: isSelected ? '#dcfce7' : 'transparent',
                                        marginBottom: '4px', fontFamily: "'Inter', sans-serif",
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                      }}
                                    >
                                      <div style={{
                                        width: '16px', height: '16px', borderRadius: '4px', border: '1px solid #d1d5db',
                                        background: isSelected ? '#15803d' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: '11px', flexShrink: 0
                                      }}>
                                        {isSelected ? '✓' : ''}
                                      </div>
                                      <span>
                                        {project.name}
                                        {project.deadline && (
                                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                                            (Due: {new Date(project.deadline).toLocaleDateString()})
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                            <div style={{ textAlign: 'right', marginTop: '8px', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
                              <button type="button" onClick={() => { setShowProjectSelector(false); setModalProjSearch(""); }} style={{ background: 'none', border: 'none', color: '#15803d', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                                Done
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {formData.projectGoals.map((projectGoal, projectIndex) => (
                    <div key={projectIndex}>
                      <div className="label-row" style={{ marginTop: '24px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className="label-clean">Task Title <span className="required">*</span></label>
                          {projectGoal.projectName && (
                            <span className="project-label-tag">
                              {projectGoal.projectName}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn-action-green"
                          onClick={() => addGoalToProject(projectIndex)}
                        >
                          + Add Task
                        </button>
                      </div>

                      {projectGoal.goals.map((goal, goalIndex) => (
                        <div key={goalIndex} style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                          <input
                            type="text"
                            className="input-clean"
                            value={goal.name ? goal.name : ""}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              updateGoalInProject(projectIndex, goalIndex, "name", newValue);
                            }}
                            placeholder="Enter the title of the task"
                            autoFocus={projectIndex === 0 && goalIndex === 0}
                          />
                          {projectGoal.goals.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeGoalFromProject(projectIndex, goalIndex)}
                              style={{
                                background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca',
                                borderRadius: '6px', width: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                              title="Remove Goal"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}

                  <div style={{
                    marginTop: "32px",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "12px",
                    paddingTop: "24px",
                    borderTop: "1px solid #e5e7eb"
                  }}>
                    <button
                      type="button"
                      className="btn-footer btn-footer-cancel"
                      onClick={() => cancelEdit()}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-footer btn-footer-primary"
                      disabled={isSubmitting}
                      style={{
                        opacity: isSubmitting ? 0.6 : 1,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isSubmitting ? (editingGoalId ? "Saving..." : "Creating...") : (editingGoalId ? "Save Changes" : "Create Task")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateProjectModal && (
          <div className="modal-overlay" onClick={() => setShowCreateProjectModal(false)}>
            <div className="clean-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', height: 'auto', minHeight: 'auto' }}>
              <div className="modal-header-clean">
                <h2 className="modal-title-clean">Create New Project</h2>
                <button className="close-btn-clean" onClick={() => setShowCreateProjectModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleCreateProject}>
                <div className="modal-content-clean" style={{ paddingBottom: '0' }}>
                  <div className="form-group-clean">
                    <label className="label-clean">Project Name <span className="required">*</span></label>
                    <input
                      type="text"
                      className="input-clean"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="e.g. Website Redesign"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" className="btn-footer btn-footer-cancel" onClick={() => setShowCreateProjectModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-footer btn-footer-primary">
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notes Modal */}
        {showNotesModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "30px",
                borderRadius: "12px",
                minWidth: "400px",
                maxWidth: "500px",
                boxShadow: "0 15px 35px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h3 style={{ marginBottom: "20px", color: "#166534" }}>
                Add Notes
              </h3>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  Goal: {currentGoalForNotes?.goalItem?.name}
                </label>
                <textarea
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  placeholder="Add notes for this goal..."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "2px solid #e1e5e9",
                    borderRadius: "8px",
                    fontSize: "14px",
                    resize: "vertical",
                    outline: "none",
                    transition: "border-color 0.3s ease",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#166534")}
                  onBlur={(e) => (e.target.style.borderColor = "#e1e5e9")}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setShowNotesModal(false);
                    setCurrentGoalForNotes(null);
                    setTempNotes("");
                  }}
                  style={{
                    padding: "10px 20px",
                    border: "2px solid #ccc",
                    backgroundColor: "white",
                    color: "#666",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleNotesModalConfirm}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    backgroundColor: "#166534",
                    color: "white",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review Request Modal */}
        {showReviewModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "30px",
                borderRadius: "12px",
                minWidth: "750px",
                maxWidth: "1000px",
                width: "90%",
                boxShadow: "0 15px 35px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h3 style={{ marginBottom: "20px", color: "#166534" }}>
                {String(currentReviewData?.goalDoc?.employee?._id || currentReviewData?.goalDoc?.employee) === String(user?.id || user?._id) ? "Request Review" : "Review Request"}
                <div style={{ fontSize: "14px", color: "#6b7280", fontWeight: "normal", marginTop: "8px" }}>
                  Task: {currentReviewData?.goalDoc?.reviewRequest?.taskName || currentReviewData?.goalDoc?.goals?.map(g => g.name).join(', ') || 'No tasks'}
                </div>
              </h3>

              {(() => {
                const isEmployee = String(currentReviewData?.goalDoc?.employee?._id || currentReviewData?.goalDoc?.employee) === String(user?.id || user?._id);
                const hasCurrent = currentReviewData?.goalDoc?.reviewRequest?.requested;
                let allRequests = [];
                if (currentReviewData?.allProjectGoals) {
                  currentReviewData.allProjectGoals.forEach(g => {
                    const docToUse = String(g._id) === String(currentReviewData.goalDoc._id) ? currentReviewData.goalDoc : g;
                    if (docToUse.reviewRequest?.history) {
                      allRequests.push(...docToUse.reviewRequest.history);
                    }
                    if (docToUse.reviewRequest?.requested) {
                      allRequests.push(docToUse.reviewRequest);
                    }
                  });
                  allRequests.sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
                } else {
                  const history = currentReviewData?.goalDoc?.reviewRequest?.history || [];
                  allRequests = [...history];
                  if (hasCurrent) allRequests.push(currentReviewData.goalDoc.reviewRequest);
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '65vh' }}>
                    <div style={{ display: 'flex', gap: '40px', flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
                      {/* Left Side: Submit Request Card or Reply Card */}
                      {(isEmployee || showReplyForm || isEditingReview) && (
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: "0 0 15px 0", color: "#374151", fontSize: "15px" }}>
                            {isEditingReview
                              ? "Edit Message"
                              : (isEmployee
                                ? (allRequests.length > 0 ? "Submit New Review Request" : "Submit Review Request")
                                : "Reply to Request")}
                          </h4>
                          <div style={{ marginBottom: "20px" }}>
                            {!isEmployee && (
                              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                                Project: {currentReviewData?.goalDoc?.reviewRequest?.projectName || currentReviewData?.goalDoc?.projects?.map(p => p.projectName).join(', ') || 'N/A'}
                              </label>
                            )}
                            {isEmployee && (
                              <div style={{ marginBottom: "15px" }}>
                                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "14px" }}>
                                  Select Project <span style={{ color: "red" }}>*</span>
                                </label>
                                <select
                                  value={selectedReviewProject}
                                  onChange={(e) => {
                                    setSelectedReviewProject(e.target.value);
                                    setSelectedReviewTask("");
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "10px",
                                    border: "2px solid #e1e5e9",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                    outline: "none",
                                    backgroundColor: "white",
                                    marginBottom: "15px"
                                  }}
                                >
                                  <option value="">Select a project</option>
                                  {currentReviewData?.goalDoc?.projects?.map(p => (
                                    <option key={p.projectId?._id || p.projectId} value={p.projectId?._id || p.projectId}>{p.projectName}</option>
                                  ))}
                                </select>

                                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "14px" }}>
                                  Select Task <span style={{ color: "red" }}>*</span>
                                </label>
                                <select
                                  value={selectedReviewTask}
                                  onChange={(e) => setSelectedReviewTask(e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "10px",
                                    border: "2px solid #e1e5e9",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                    outline: "none",
                                    backgroundColor: "white",
                                    marginBottom: "15px"
                                  }}
                                >
                                  <option value="">Select a task</option>
                                  {currentReviewData?.goalDoc?.goals
                                    ?.filter(t => {
                                      const taskProjId = t.projectId?._id || t.projectId || currentReviewData?.goalDoc?.project?._id || currentReviewData?.goalDoc?.project;
                                      return !selectedReviewProject || String(taskProjId) === String(selectedReviewProject);
                                    })
                                    .map(t => (
                                      <option key={t._id} value={t._id}>{t.name}</option>
                                    ))
                                  }
                                </select>

                                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "14px" }}>
                                  Team Leader <span style={{ color: "red" }}>*</span>
                                </label>
                                <select
                                  value={selectedTeamLeader}
                                  onChange={(e) => setSelectedTeamLeader(e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "10px",
                                    border: "2px solid #e1e5e9",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                    outline: "none",
                                    backgroundColor: "white",
                                  }}
                                >
                                  <option value="">Select</option>
                                  {employees.filter(emp => emp.role?.name?.trim().toLowerCase() === 'team leader').map(leader => (
                                    <option key={leader._id} value={leader._id}>
                                      {leader.firstName} {leader.lastName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "14px" }}>
                              {isEmployee ? "Message (Optional)" : "Reply Message"}
                            </label>
                            <textarea
                              value={reviewDescription}
                              onChange={(e) => setReviewDescription(e.target.value)}
                              placeholder={isEmployee ? "Type your message here..." : "Type your reply here..."}
                              rows={4}
                              style={{
                                width: "100%",
                                padding: "12px",
                                border: "2px solid #e1e5e9",
                                borderRadius: "8px",
                                fontSize: "14px",
                                resize: "vertical",
                                outline: "none",
                                transition: "border-color 0.3s ease",
                              }}
                              onFocus={(e) => (e.target.style.borderColor = "#166534")}
                              onBlur={(e) => (e.target.style.borderColor = "#e1e5e9")}
                            />
                          </div>
                        </div>
                      )}

                      {/* Right Side: Timeline History */}
                      {allRequests.length > 0 && (
                        <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
                          <h4 style={{ margin: "0 0 15px 0", color: "#374151", fontSize: "15px" }}>
                            Request History
                          </h4>
                          <div style={{ flex: 1, overflowY: 'auto', marginBottom: "24px", padding: "8px 12px", fontFamily: "'Inter', sans-serif" }}>
                            <div style={{ position: "relative", paddingLeft: "28px" }}>
                              {/* Vertical connector line */}
                              <div style={{ position: "absolute", left: "6px", top: "24px", bottom: "16px", width: "1px", background: "#e5e7eb" }}></div>

                              {allRequests.map((req, index) => {
                                const isTeamLeaderReply = req.status === 'Reverted';
                                const tlId = typeof req.teamLeader === 'object' ? req.teamLeader?._id : req.teamLeader;
                                const tlObj = typeof req.teamLeader === 'object' && req.teamLeader?.firstName
                                  ? req.teamLeader
                                  : (employees || []).find(e => String(e._id) === String(tlId));
                                const tlName = tlObj?.firstName ? `${tlObj.firstName} ${tlObj.lastName}` : 'Team Leader';

                                return (
                                  <div key={index} style={{ marginBottom: "24px" }}>
                                    {/* Action block */}
                                    <div style={{ position: "relative", paddingBottom: "16px" }}>
                                      <div style={{ position: "absolute", left: "-27px", top: "5px", width: "11px", height: "11px", borderRadius: "50%", background: "#fff", border: "2px solid #3b82f6", zIndex: 1, boxShadow: "0 0 0 4px #fff" }}></div>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px", flexWrap: "wrap", gap: "4px" }}>
                                        <h4 style={{ margin: "0", fontSize: "14px", color: "#111827", fontWeight: "600", letterSpacing: "0.01em" }}>
                                          {isTeamLeaderReply
                                            ? `Reviewed by ${tlName}`
                                            : `Review Requested ${index === allRequests.length - 1 && req.status === 'Pending' ? '(Latest)' : ''}`
                                          }
                                        </h4>
                                        <span style={{ fontSize: "12px", color: "#9ca3af", fontWeight: "500", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                                          <span>{req.requestedAt ? new Date(req.requestedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date not available'}</span>
                                          {index === allRequests.length - 1 && !req.seenAt && !isEditingReview && (
                                            ((req.status === 'Pending' && isEmployee) || (req.status === 'Reverted' && !isEmployee)) && (
                                              <button
                                                onClick={() => {
                                                  setIsEditingReview(true);
                                                  setReviewDescription(req.description);
                                                  if (isEmployee) {
                                                    setSelectedReviewProject(req.projectId || "");
                                                    setSelectedReviewTask(req.taskId || "");
                                                    setSelectedTeamLeader(typeof req.teamLeader === 'object' ? req.teamLeader?._id : req.teamLeader || "");
                                                  }
                                                }}
                                                style={{
                                                  padding: "4px 10px",
                                                  backgroundColor: "#10b981",
                                                  color: "white",
                                                  border: "none",
                                                  borderRadius: "4px",
                                                  cursor: "pointer",
                                                  fontSize: "12px",
                                                  fontWeight: "500"
                                                }}
                                              >
                                                Edit
                                              </button>
                                            )
                                          )}
                                        </span>
                                      </div>
                                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "#4b5563" }}>
                                        {!isTeamLeaderReply && (
                                          <div style={{ display: "flex", gap: "12px", marginBottom: "6px" }}>
                                            <span style={{ color: "#9ca3af", width: "70px", flexShrink: 0 }}>Task</span>
                                            <span style={{ color: "#4b5563", lineHeight: "1.5" }}>
                                              {req.taskName || (currentReviewData?.goalDoc?.goals?.map(g => g.name).join(', ') || 'No tasks')}
                                            </span>
                                          </div>
                                        )}
                                        {isTeamLeaderReply && index > 0 && (
                                          <div style={{ display: "flex", gap: "12px", marginBottom: "6px" }}>
                                            <span style={{ color: "#9ca3af", width: "70px", flexShrink: 0 }}>Message</span>
                                            <span style={{ color: "#4b5563", lineHeight: "1.5" }}>
                                              {allRequests[index - 1]?.description || 'No message provided'}
                                            </span>
                                          </div>
                                        )}
                                        <div style={{ display: "flex", gap: "12px" }}>
                                          <span style={{ color: "#9ca3af", width: "70px", flexShrink: 0 }}>
                                            {isTeamLeaderReply ? "Response" : "Message"}
                                          </span>
                                          <span style={{ color: req.description ? "#4b5563" : "#d1d5db", fontStyle: req.description ? "normal" : "italic", lineHeight: "1.5" }}>
                                            {req.description || 'No additional details provided'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Step 2: Seen / Actioned */}
                                    <div style={{ position: "relative", paddingBottom: "16px" }}>
                                      <div style={{ position: "absolute", left: "-27px", top: "5px", width: "11px", height: "11px", borderRadius: "50%", background: "#10b981", border: `2px solid #10b981`, zIndex: 1, boxShadow: "0 0 0 4px #fff" }}></div>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "4px" }}>
                                        <h4 style={{ margin: "0", fontSize: "14px", color: "#111827", fontWeight: "600", letterSpacing: "0.01em" }}>
                                          {req.seenAt
                                            ? `Seen by ${req.status === 'Reverted' ? `${currentReviewData?.goalDoc?.employee?.firstName} ${currentReviewData?.goalDoc?.employee?.lastName}` : tlName}`
                                            : (req.status === 'Pending'
                                              ? `Pending Review by ${tlName}`
                                              : (req.status === 'Reverted'
                                                ? `Pending Review by ${currentReviewData?.goalDoc?.employee?.firstName} ${currentReviewData?.goalDoc?.employee?.lastName}`
                                                : `Pending Review by ${tlName}`
                                              )
                                            )
                                          }
                                        </h4>
                                        <span style={{ fontSize: "12px", color: "#9ca3af", fontWeight: "500", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                                          <span>{req.seenAt ? new Date(req.seenAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending...'}</span>
                                          {req.status === 'Pending' && !isEmployee && index === allRequests.length - 1 && !showReplyForm && (
                                            <button
                                              onClick={() => setShowReplyForm(true)}
                                              style={{
                                                padding: "4px 10px",
                                                backgroundColor: "#3b82f6",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "4px",
                                                cursor: "pointer",
                                                fontSize: "12px",
                                                fontWeight: "500"
                                              }}
                                            >
                                              Reply
                                            </button>
                                          )}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Step 3: Status (If present) */}
                                    {req.status && ['Approved', 'Rejected'].includes(req.status) && (
                                      <div style={{ position: "relative", paddingBottom: "16px" }}>
                                        <div style={{ position: "absolute", left: "-27px", top: "3px", width: "11px", height: "11px", borderRadius: "50%", background: req.status === 'Approved' ? "#10b981" : "#ef4444", border: `2px solid ${req.status === 'Approved' ? "#10b981" : "#ef4444"}`, zIndex: 1, boxShadow: "0 0 0 4px #fff" }}></div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                          <h4 style={{ margin: "0", fontSize: "14px", color: req.status === 'Approved' ? "#059669" : "#dc2626", fontWeight: "600", letterSpacing: "0.01em" }}>
                                            {req.status}
                                          </h4>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px", paddingTop: "15px", borderTop: "1px solid #e5e7eb" }}>
                      <button
                        onClick={() => {
                          setShowReviewModal(false);
                          setCurrentReviewData(null);
                          setReviewDescription("");
                          setIsEditingReview(false);
                          setShowReplyForm(false);
                        }}
                        style={{
                          padding: "10px 20px",
                          border: "2px solid #ccc",
                          backgroundColor: "white",
                          color: "#666",
                          borderRadius: "6px",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                        }}
                      >
                        {isEmployee ? 'Cancel' : 'Close'}
                      </button>
                      {isEmployee ? (
                        <button
                          onClick={handleReviewModalConfirm}
                          style={{
                            padding: "10px 20px",
                            border: "none",
                            backgroundColor: "#166534",
                            color: "white",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                          }}
                        >
                          Submit Request
                        </button>
                      ) : (
                        isEditingReview ? (
                          <button
                            onClick={handleEditReviewConfirm}
                            style={{
                              padding: "10px 20px",
                              border: "none",
                              backgroundColor: "#10b981",
                              color: "white",
                              borderRadius: "6px",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                            }}
                          >
                            Update Message
                          </button>
                        ) : showReplyForm ? (
                          <button
                            onClick={handleRevertModalConfirm}
                            style={{
                              padding: "10px 20px",
                              border: "none",
                              backgroundColor: "#3b82f6",
                              color: "white",
                              borderRadius: "6px",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                            }}
                          >
                            Send Reply
                          </button>
                        ) : null
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ============ REQUEST TASK MODAL ============ */}
      {showRequestTaskModal && (
        <div
          onClick={() => setShowRequestTaskModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
              width: '100%',
              maxWidth: '780px',
              maxHeight: '80vh',
              overflowY: 'auto',
              animation: 'goalsDdIn 0.25s ease'
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px 16px',
              borderBottom: '1px solid #f1f5f9',
              position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '20px 20px 0 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#166534',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Request Task</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                    Requested by: <strong style={{ color: '#15803d' }}>{user?.firstName} {user?.lastName}</strong>
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleOpenViewRequests}
                  style={{
                    background: '#f8fafc', border: '1px solid #cbd5e1', color: '#1e293b',
                    padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                >
                  View Requests
                  {hasUnreadTaskUpdates && (
                    <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', border: '2px solid #fff' }}></span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequestTaskModal(false)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    border: 'none', background: '#f8fafc',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#64748b', fontSize: '18px', lineHeight: 1
                  }}
                >×</button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleRequestTaskSubmit} style={{ padding: '16px 24px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Project Selector - custom dropdown */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Select Project <span style={{ color: '#94a3b8', fontWeight: '400' }}>(Optional)</span>
                  </label>
                  {/* Trigger button */}
                  <button
                    type="button"
                    onClick={() => { setShowReqProjDd(!showReqProjDd); setReqProjSearch(""); }}
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: showReqProjDd ? '1.5px solid #16a34a' : '1.5px solid #e2e8f0',
                      borderRadius: '10px', fontSize: '13px',
                      color: requestTaskForm.projectId ? '#1e293b' : '#94a3b8',
                      background: showReqProjDd ? '#f0fdf4' : '#f8fafc',
                      outline: 'none', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontFamily: "'Inter', sans-serif",
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>{requestTaskForm.projectName || 'Select Project'}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ transition: 'transform 0.2s', transform: showReqProjDd ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Dropdown panel */}
                  {showReqProjDd && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        background: '#ffffff', borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                        border: '1px solid #e2e8f0',
                        zIndex: 200, overflow: 'hidden',
                        animation: 'goalsDdIn 0.18s ease'
                      }}
                    >
                      {/* Search */}
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search projects..."
                          value={reqProjSearch}
                          onChange={(e) => setReqProjSearch(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                          style={{
                            width: '100%', padding: '7px 10px',
                            border: '1px solid #e2e8f0', borderRadius: '8px',
                            fontSize: '12px', background: '#f8fafc',
                            outline: 'none', fontFamily: "'Inter', sans-serif",
                            boxSizing: 'border-box', color: '#1e293b'
                          }}
                        />
                      </div>

                      {/* Options list */}
                      <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '6px 8px' }}>
                        {/* Clear option */}
                        {requestTaskForm.projectId && (
                          <div
                            onClick={() => {
                              setRequestTaskForm(prev => ({ ...prev, projectId: '', projectName: '' }));
                              setShowReqProjDd(false);
                            }}
                            style={{
                              padding: '8px 10px', borderRadius: '7px', fontSize: '13px',
                              cursor: 'pointer', color: '#64748b', fontStyle: 'italic',
                              fontFamily: "'Inter', sans-serif", marginBottom: '2px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            — None (clear selection) —
                          </div>
                        )}

                        {getAvailableProjects.filter(p =>
                          p.name.toLowerCase().includes(reqProjSearch.toLowerCase())
                        ).length === 0 ? (
                          <div style={{
                            padding: '16px 10px', textAlign: 'center',
                            fontSize: '13px', color: '#94a3b8',
                            fontFamily: "'Inter', sans-serif"
                          }}>No projects available</div>
                        ) : (
                          getAvailableProjects
                            .filter(p => p.name.toLowerCase().includes(reqProjSearch.toLowerCase()))
                            .map(p => (
                              <div
                                key={p._id}
                                onClick={() => {
                                  setRequestTaskForm(prev => ({ ...prev, projectId: p._id, projectName: p.name }));
                                  setShowReqProjDd(false);
                                  setReqProjSearch("");
                                }}
                                style={{
                                  padding: '8px 10px', borderRadius: '7px', fontSize: '13px',
                                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                  fontWeight: requestTaskForm.projectId === p._id ? '600' : '400',
                                  color: requestTaskForm.projectId === p._id ? '#15803d' : '#1e293b',
                                  background: requestTaskForm.projectId === p._id ? '#dcfce7' : 'transparent',
                                  marginBottom: '2px', transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => { if (requestTaskForm.projectId !== p._id) e.currentTarget.style.background = '#f0fdf4'; }}
                                onMouseLeave={(e) => { if (requestTaskForm.projectId !== p._id) e.currentTarget.style.background = 'transparent'; }}
                              >
                                {p.name}
                              </div>
                            ))
                        )}
                      </div>

                      {/* Done button */}
                      <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setShowReqProjDd(false)}
                          style={{
                            padding: '5px 14px', border: 'none', borderRadius: '7px',
                            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                            background: 'transparent', color: '#15803d',
                            fontFamily: "'Inter', sans-serif"
                          }}
                        >Done</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Request To - Team Leader selector */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Request To <span style={{ color: '#94a3b8', fontWeight: '400' }}>(Team Leader)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowReqTlDd(!showReqTlDd); setReqTlSearch(""); setShowReqProjDd(false); }}
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: showReqTlDd ? '1.5px solid #16a34a' : '1.5px solid #e2e8f0',
                      borderRadius: '10px', fontSize: '13px',
                      color: requestTaskForm.requestToId ? '#1e293b' : '#94a3b8',
                      background: showReqTlDd ? '#f0fdf4' : '#f8fafc',
                      outline: 'none', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontFamily: "'Inter', sans-serif",
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {requestTaskForm.requestToId && (
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          background: '#166534', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', flexShrink: 0
                        }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                      )}
                      {requestTaskForm.requestToName || 'Select Team Leader'}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ transition: 'transform 0.2s', transform: showReqTlDd ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showReqTlDd && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        background: '#ffffff', borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                        border: '1px solid #e2e8f0',
                        zIndex: 202, overflow: 'hidden',
                        animation: 'goalsDdIn 0.18s ease'
                      }}
                    >
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search team leaders..."
                          value={reqTlSearch}
                          onChange={(e) => setReqTlSearch(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                          style={{
                            width: '100%', padding: '7px 10px',
                            border: '1px solid #e2e8f0', borderRadius: '8px',
                            fontSize: '12px', background: '#f8fafc',
                            outline: 'none', fontFamily: "'Inter', sans-serif",
                            boxSizing: 'border-box', color: '#1e293b'
                          }}
                        />
                      </div>

                      <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '6px 8px' }}>
                        {requestTaskForm.requestToId && (
                          <div
                            onClick={() => {
                              setRequestTaskForm(prev => ({ ...prev, requestToId: '', requestToName: '' }));
                              setShowReqTlDd(false);
                            }}
                            style={{
                              padding: '8px 10px', borderRadius: '7px', fontSize: '13px',
                              cursor: 'pointer', color: '#64748b', fontStyle: 'italic',
                              fontFamily: "'Inter', sans-serif", marginBottom: '2px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            — None (clear selection) —
                          </div>
                        )}

                        {(() => {
                          const tls = employees.filter(emp => {
                            const roleName = emp.role?.name || '';
                            const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
                            return roleName === 'Team Leader' && fullName.includes(reqTlSearch.toLowerCase());
                          });
                          return tls.length === 0 ? (
                            <div style={{
                              padding: '16px 10px', textAlign: 'center',
                              fontSize: '13px', color: '#94a3b8',
                              fontFamily: "'Inter', sans-serif"
                            }}>No team leaders found</div>
                          ) : tls.map(emp => {
                            const empId = emp._id || emp.id;
                            const fullName = `${emp.firstName} ${emp.lastName}`;
                            const isSelected = requestTaskForm.requestToId === empId;
                            return (
                              <div
                                key={empId}
                                onClick={() => {
                                  setRequestTaskForm(prev => ({ ...prev, requestToId: empId, requestToName: fullName }));
                                  setShowReqTlDd(false);
                                  setReqTlSearch("");
                                }}
                                style={{
                                  padding: '8px 10px', borderRadius: '7px', fontSize: '13px',
                                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                  display: 'flex', alignItems: 'center', gap: '8px',
                                  fontWeight: isSelected ? '600' : '400',
                                  color: isSelected ? '#15803d' : '#1e293b',
                                  background: isSelected ? '#dcfce7' : 'transparent',
                                  marginBottom: '2px', transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f0fdf4'; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <div style={{
                                  width: '26px', height: '26px', borderRadius: '50%',
                                  background: isSelected ? '#166534' : '#e2e8f0',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isSelected ? '#fff' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                                  </svg>
                                </div>
                                <div>
                                  <div>{fullName}</div>
                                  {emp.employeeId && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{emp.employeeId}</div>}
                                </div>
                                {isSelected && (
                                  <svg style={{ marginLeft: 'auto' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>

                      <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setShowReqTlDd(false)}
                          style={{
                            padding: '5px 14px', border: 'none', borderRadius: '7px',
                            fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                            background: 'transparent', color: '#15803d',
                            fontFamily: "'Inter', sans-serif"
                          }}
                        >Done</button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Task Title <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter task title..."
                    value={requestTaskForm.taskTitle}
                    onChange={(e) => setRequestTaskForm(prev => ({ ...prev, taskTitle: e.target.value }))}
                    required
                    style={{
                      width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0',
                      borderRadius: '10px', fontSize: '13px', color: '#1e293b',
                      background: '#f8fafc', outline: 'none',
                      fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#16a34a'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                {/* Priority Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>

                  {/* Priority Custom Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Priority</label>
                    <button
                      type="button"
                      onClick={() => { setShowReqPriorityDd(!showReqPriorityDd); setShowReqStatusDd(false); }}
                      style={{
                        width: '100%', padding: '10px 14px',
                        border: showReqPriorityDd ? '1.5px solid #16a34a' : '1.5px solid #e2e8f0',
                        borderRadius: '10px', fontSize: '13px',
                        color: '#1e293b',
                        background: showReqPriorityDd ? '#f0fdf4' : '#f8fafc',
                        outline: 'none', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontFamily: "'Inter', sans-serif",
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="10" height="10" viewBox="0 0 10 10">
                          <circle cx="5" cy="5" r="5" fill={
                            requestTaskForm.priority === 'High' ? '#ef4444' :
                              requestTaskForm.priority === 'Moderate' ? '#f59e0b' : '#22c55e'
                          } />
                        </svg>
                        {requestTaskForm.priority}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ transition: 'transform 0.2s', transform: showReqPriorityDd ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {showReqPriorityDd && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                          background: '#ffffff', borderRadius: '12px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                          border: '1px solid #e2e8f0',
                          zIndex: 201, overflow: 'hidden',
                          animation: 'goalsDdIn 0.18s ease'
                        }}
                      >
                        <div style={{ padding: '6px 8px' }}>
                          {[
                            { value: 'Low', color: '#22c55e', label: 'Low' },
                            { value: 'Moderate', color: '#f59e0b', label: 'Moderate' },
                            { value: 'High', color: '#ef4444', label: 'High' },
                          ].map(opt => (
                            <div
                              key={opt.value}
                              onClick={() => { setRequestTaskForm(prev => ({ ...prev, priority: opt.value })); setShowReqPriorityDd(false); }}
                              style={{
                                padding: '9px 10px', borderRadius: '7px', fontSize: '13px',
                                cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                display: 'flex', alignItems: 'center', gap: '10px',
                                fontWeight: requestTaskForm.priority === opt.value ? '600' : '400',
                                color: requestTaskForm.priority === opt.value ? '#15803d' : '#1e293b',
                                background: requestTaskForm.priority === opt.value ? '#dcfce7' : 'transparent',
                                marginBottom: '2px', transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => { if (requestTaskForm.priority !== opt.value) e.currentTarget.style.background = '#f0fdf4'; }}
                              onMouseLeave={(e) => { if (requestTaskForm.priority !== opt.value) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                                <circle cx="5" cy="5" r="5" fill={opt.color} />
                              </svg>
                              {opt.label}
                              {requestTaskForm.priority === opt.value && (
                                <svg style={{ marginLeft: 'auto' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>



                </div>

                {/* Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Notes</label>
                  <textarea
                    placeholder="Type Notes..."
                    value={requestTaskForm.notes}
                    onChange={(e) => setRequestTaskForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={5}
                    style={{
                      width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0',
                      borderRadius: '10px', fontSize: '13px', color: '#1e293b',
                      background: '#f8fafc', outline: 'none', resize: 'vertical',
                      fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                      boxSizing: 'border-box', transition: 'border-color 0.2s',
                      lineHeight: '1.6'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#16a34a'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>



                {/* Deadline Date - standalone full width */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Deadline Date</label>
                  <input
                    type="date"
                    value={requestTaskForm.deadlineDate}
                    onChange={(e) => setRequestTaskForm(prev => ({ ...prev, deadlineDate: e.target.value }))}
                    style={{
                      width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0',
                      borderRadius: '10px', fontSize: '13px', color: '#1e293b',
                      background: '#f8fafc', outline: 'none',
                      fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#16a34a'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setShowRequestTaskModal(false)}
                    style={{
                      padding: '10px 20px', border: '1.5px solid #e2e8f0',
                      borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                      cursor: 'pointer', background: '#f8fafc', color: '#475569',
                      fontFamily: "'Inter', sans-serif", transition: 'all 0.2s'
                    }}
                  >Cancel</button>
                  <button
                    type="submit"
                    disabled={isSubmittingRequest}
                    style={{
                      padding: '10px 24px', border: 'none',
                      borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                      cursor: isSubmittingRequest ? 'not-allowed' : 'pointer',
                      background: isSubmittingRequest ? '#86efac' : '#166534',
                      color: '#ffffff',
                      fontFamily: "'Inter', sans-serif",
                      transition: 'all 0.2s',
                      boxShadow: 'none'
                    }}
                  >
                    {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ VIEW REQUESTS MODAL (TEAM LEADER) ============ */}
      {showViewRequestsModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1250px',
            maxHeight: '90vh',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>View Task Requests</h3>
              <button
                onClick={() => setShowViewRequestsModal(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  color: '#64748b', transition: 'all 0.2s', borderRadius: '6px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'none'; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div style={{ padding: '24px', flex: 1, position: 'relative' }}>
              <style>{`@keyframes goalsSpin { 100% { transform: rotate(360deg); } }`}</style>
              {taskRequests.length === 0 ? (
                isFetchingRequests ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                    <svg style={{ animation: 'goalsSpin 1s linear infinite', color: '#3b82f6' }} width="40" height="40" viewBox="0 0 24 24" fill="none">
                      <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No task requests found.</div>
                )
              ) : (
                <>
                  {isFetchingRequests && (
                    <div style={{ position: 'absolute', top: '24px', left: '24px', right: '24px', bottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(2px)', borderRadius: '12px' }}>
                      <svg style={{ animation: 'goalsSpin 1s linear infinite', color: '#3b82f6' }} width="40" height="40" viewBox="0 0 24 24" fill="none">
                        <circle opacity="0.25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                  <div style={{ overflowX: 'auto', overflowY: 'auto', minHeight: '350px', maxHeight: '550px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Sr.</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Task Title</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                          {(userRoleName === 'Team Leader' || isAdmin) ? 'Requested By' : 'Requested To'}
                        </th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Requested On</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Deadline</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Priority</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Notes</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Project</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Status</th>
                        <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskRequests.map((req, index) => (
                        <tr key={req._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#1e293b' }}>{index + 1}</td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#1e293b' }}>
                            {req.taskTitle?.split(' ').length > 2 ? (
                                <span
                                  title={req.taskTitle}
                                  onClick={() => { setViewTitleText(req.taskTitle); setShowViewTitleModal(true); }}
                                  style={{ cursor: 'pointer', color: '#3b82f6' }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#2563eb'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = '#3b82f6'}
                              >
                                {req.taskTitle.split(' ').slice(0, 2).join(' ')}...
                              </span>
                            ) : (
                              req.taskTitle
                            )}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#1e293b' }}>
                            {(userRoleName === 'Team Leader' || isAdmin) ? (
                              <>{req.requestedBy?.firstName} {req.requestedBy?.lastName}</>
                            ) : (
                              <>{req.requestTo?.firstName} {req.requestTo?.lastName}</>
                            )}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                            {req.requestedDate ? new Date(req.requestedDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                            {req.deadlineDate ? new Date(req.deadlineDate).toLocaleDateString('en-GB').replace(/\//g, '-') : '-'}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ 
                              padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
                              background: req.priority === 'High' ? '#fee2e2' : (req.priority === 'Moderate' || req.priority === 'Medium') ? '#ffedd5' : '#dbeafe',
                              color: req.priority === 'High' ? '#991b1b' : (req.priority === 'Moderate' || req.priority === 'Medium') ? '#ea580c' : '#1d4ed8'
                            }}>
                              {req.priority || 'Low'}
                            </span>
                          </td>
                          <td style={{ padding: '16px' }}>
                            {req.notes ? (
                              <button
                                onClick={() => { 
                                  setViewNoteText(req.notes); 
                                  setEditNoteId(req._id);
                                  setIsEditingNote(false);
                                  setCanEditNote(req.status !== 'Completed' && (req.requestedBy?._id === user?._id || req.requestedBy === user?._id));
                                  setShowViewNoteModal(true); 
                                }}
                                style={{
                                  background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe',
                                  padding: '4px 10px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#bfdbfe'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#dbeafe'}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                  <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                View
                              </button>
                            ) : (
                              <span style={{ fontSize: '13px', color: '#475569' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>{req.projectName || '-'}</td>
                          <td style={{ padding: '16px' }}>
                            {(userRoleName === 'Team Leader' || isAdmin) ? (
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setOpenStatusDdId(openStatusDdId === req._id ? null : req._id); }}
                                  style={{
                                    padding: '4px 10px', borderRadius: '20px', border: '1px solid transparent', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px', outline: 'none',
                                    background: req.status === 'Completed' ? '#dcfce7' : req.status === 'Progress' ? '#dbeafe' : req.status === 'Cancelled' ? '#fee2e2' : req.status === 'Hold' ? '#f1f5f9' : '#ffedd5',
                                    color: req.status === 'Completed' ? '#166534' : req.status === 'Progress' ? '#1e40af' : req.status === 'Cancelled' ? '#991b1b' : req.status === 'Hold' ? '#475569' : '#c2410c'
                                  }}
                                >
                                  {req.status}
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: openStatusDdId === req._id ? 'rotate(180deg)' : 'none' }}>
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </button>
                                
                                {openStatusDdId === req._id && (
                                  <div
                                    style={{
                                      position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                                      background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                      border: '1px solid #e2e8f0', zIndex: 50, minWidth: '110px', overflow: 'hidden'
                                    }}
                                  >
                                    {['Pending', 'Progress', 'Hold', 'Completed', 'Cancelled'].map(st => (
                                      <div
                                        key={st}
                                        onClick={() => { handleInlineUpdate(req._id, 'status', st); setOpenStatusDdId(null); }}
                                        style={{
                                          padding: '8px 12px', fontSize: '12px', cursor: 'pointer',
                                          background: req.status === st ? '#f1f5f9' : '#fff',
                                          color: '#1e293b', fontWeight: req.status === st ? '600' : '400',
                                          borderLeft: req.status === st ? '3px solid #3b82f6' : '3px solid transparent'
                                        }}
                                        onMouseEnter={(e) => { if(req.status !== st) e.currentTarget.style.background = '#f8fafc'; }}
                                        onMouseLeave={(e) => { if(req.status !== st) e.currentTarget.style.background = '#fff'; }}
                                      >
                                        {st}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ 
                                padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
                                background: req.status === 'Completed' ? '#dcfce7' : req.status === 'Progress' ? '#dbeafe' : req.status === 'Cancelled' ? '#fee2e2' : req.status === 'Hold' ? '#f1f5f9' : '#ffedd5',
                                color: req.status === 'Completed' ? '#166534' : req.status === 'Progress' ? '#1e40af' : req.status === 'Cancelled' ? '#991b1b' : req.status === 'Hold' ? '#475569' : '#c2410c'
                              }}>
                                {req.status}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '16px' }}>
                            {req.remarks ? (
                              <button
                                onClick={() => { setEditingRequestId(req._id); setViewRemarkText(req.remarks); setShowViewRemarkModal(true); }}
                                style={{
                                  background: '#fae8ff', color: '#86198f', border: '1px solid #f5d0fe',
                                  padding: '4px 10px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f5d0fe'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#fae8ff'}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                  <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                View
                              </button>
                            ) : (userRoleName === 'Team Leader' || isAdmin) && req.status !== 'Completed' ? (
                              <button
                                onClick={() => { setEditingRequestId(req._id); setAddRemarkText(""); setShowAddRemarkModal(true); }}
                                style={{
                                  background: '#f1f5f9', color: '#334155', border: '1px dashed #cbd5e1',
                                  padding: '4px 10px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="12" y1="5" x2="12" y2="19"></line>
                                  <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Add
                              </button>
                            ) : (
                              <span style={{ fontSize: '13px', color: '#475569' }}>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ VIEW REMARK MODAL ============ */}
      {showViewRemarkModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'goalsDdIn 0.25s ease'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Remark</h3>
              <button
                onClick={() => setShowViewRemarkModal(false)}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: 'none', background: '#e2e8f0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', fontSize: '16px', lineHeight: 1
                }}
              >×</button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {viewRemarkText}
              </p>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }}>
              <button
                onClick={() => setShowViewRemarkModal(false)}
                style={{
                  background: '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                }}
              >
                Close
              </button>
              {(userRoleName === 'Team Leader' || isAdmin) && taskRequests.find(r => r._id === editingRequestId)?.status !== 'Completed' && (
                <button
                  onClick={() => {
                    setShowViewRemarkModal(false);
                    setAddRemarkText(viewRemarkText);
                    setShowAddRemarkModal(true);
                  }}
                  style={{
                    background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ VIEW NOTE MODAL ============ */}
      {showViewNoteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'goalsDdIn 0.25s ease'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Notes</h3>
              <button
                onClick={() => setShowViewNoteModal(false)}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: 'none', background: '#e2e8f0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', fontSize: '16px', lineHeight: 1
                }}
              >×</button>
            </div>
            <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
              {isEditingNote ? (
                <textarea
                  value={editNoteText}
                  onChange={(e) => setEditNoteText(e.target.value)}
                  rows={5}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical' }}
                />
              ) : (
                <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {viewNoteText}
                </p>
              )}
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }}>
              {isEditingNote ? (
                <>
                  <button onClick={() => setIsEditingNote(false)} style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Cancel</button>
                  <button onClick={() => { handleInlineUpdate(editNoteId, 'notes', editNoteText); setShowViewNoteModal(false); }} style={{ background: '#166534', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Save Note</button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowViewNoteModal(false)} style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Close</button>
                  {canEditNote && (
                    <button onClick={() => { setEditNoteText(viewNoteText); setIsEditingNote(true); }} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Edit</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ VIEW TITLE MODAL ============ */}
      {showViewTitleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'goalsDdIn 0.25s ease'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Task Title</h3>
              <button
                onClick={() => setShowViewTitleModal(false)}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: 'none', background: '#e2e8f0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', fontSize: '16px', lineHeight: 1
                }}
              >×</button>
            </div>
            <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ margin: 0, fontSize: '15px', color: '#1e293b', lineHeight: '1.6', fontWeight: '500', whiteSpace: 'pre-wrap' }}>
                {viewTitleText}
              </p>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button
                onClick={() => setShowViewTitleModal(false)}
                style={{
                  background: '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ ADD REMARK MODAL ============ */}
      {showAddRemarkModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'goalsDdIn 0.25s ease'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Add Remark</h3>
              <button
                onClick={() => setShowAddRemarkModal(false)}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: 'none', background: '#e2e8f0',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', fontSize: '16px', lineHeight: 1
                }}
              >×</button>
            </div>
            <div style={{ padding: '24px' }}>
              <textarea
                value={addRemarkText}
                onChange={(e) => setAddRemarkText(e.target.value)}
                placeholder="Type your remark here..."
                rows={5}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical' }}
              />
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }}>
              <button
                onClick={() => setShowAddRemarkModal(false)}
                style={{
                  background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleInlineUpdate(editingRequestId, 'remarks', addRemarkText);
                  setShowAddRemarkModal(false);
                }}
                style={{
                  background: '#166534', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                }}
              >
                Save Remark
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
export default Goals;

