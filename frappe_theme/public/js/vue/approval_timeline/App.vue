<template>
  <div class="approval-timeline">
    <!-- Header -->
    <div class="timeline-header">
      <div class="timeline-title-section">
        <h3>{{ workflowData.workflow || 'Workflow Audit' }}</h3>
        <div class="timeline-subtitle">
          {{ documentId }} {{ documentTitle ? '• ' + documentTitle : '' }}
        </div>
      </div>
      <span v-if="currentState" :class="['current-status', getStateConfig(currentState).statusClass]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        {{ currentState }}
      </span>
    </div>

    <!-- Progress Bar -->
    <div v-if="progressSteps.length > 0" class="workflow-progress">
      <div 
        v-for="(step, index) in progressSteps" 
        :key="`step-${index}-${step.timestamp}`"
        :class="[
          'progress-step', 
          getProgressStepClass(step, index),
          { 'step-approved': step.isApproved, 'step-rejected': step.isRejected }
        ]"
      >
        <div class="progress-dot">
          <!-- Show cross icon for rejected, checkmark for others -->
          <svg v-if="step.isRejected" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="progress-label">{{ step.label }}</div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading workflow data...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>{{ error }}</p>
    </div>

    <!-- Timeline Items -->
    <div v-else class="timeline-container">
      <div 
        v-for="(item, index) in timelineItems" 
        :key="item.name"
        :class="['timeline-item', { 'pending': index === 0 && !item.completed }]"
      >
        <!-- Left Panel -->
        <div class="timeline-left">
          <div :class="['timeline-node', getNodeClass(item)]">
            <component :is="getIconComponent(item)" />
          </div>
          <div class="left-content">
            <span :class="['state-badge', getStateConfig(item.workflow_state_current).stateClass]">
              {{ item.workflow_state_current }}
            </span>
            <div class="action-label">
              {{ item.workflow_action || 'Action Performed' }}
              <span class="role-badge">{{ item.role || 'N/A' }}</span>
            </div>
            <div class="user-info">
              <div :class="['user-avatar', getRoleAvatar(item.role)]">
                {{ getInitials(item.user) }}
              </div>
              <div class="user-details">
                <div class="user-name">{{ getUserName(item.user) }}</div>
                <div class="user-role">{{ item.role || 'User' }}</div>
              </div>
            </div>
            <div class="timestamp">
              {{ formatDate(item.creation) }}
            </div>
          </div>
        </div>

        <!-- Right Panel -->
        <div class="timeline-right">
          <div class="data-card">
            <!-- Dialog Field Values -->
            <template v-if="item.action_data && item.action_data.length > 0">
              <div class="data-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Dialog Field Values
              </div>
              <div class="field-grid">
                <div 
                  v-for="field in item.action_data" 
                  :key="field.fieldname"
                  class="field-item"
                >
                  <div class="field-label">{{ formatFieldLabel(field.fieldname) }}</div>
                  <div class="field-value">{{ field.value || 'N/A' }}</div>
                </div>
              </div>
            </template>

            <!-- Comment Section -->
            <template v-if="item.comment">
              <div v-if="item.action_data && item.action_data.length > 0" style="margin-top: 10px;">
                <div class="data-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Comments
                </div>
              </div>
              <div v-else class="data-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Comments
              </div>
              <div :class="['comment-box', getCommentClass(item)]">
                {{ item.comment }}
              </div>
            </template>

            <!-- No Data Message -->
            <div v-if="!item.action_data?.length && !item.comment" class="no-data">
              {{ index === 0 && !item.completed ? 'Awaiting action' : 'No additional data' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue';

// Props
const props = defineProps({
  doctype: {
    type: String,
    required: true
  },
  referenceName: {
    type: String,
    default: null
  },
  documentTitle: {
    type: String,
    default: ''
  },
  autoLoad: {
    type: Boolean,
    default: true
  }
});

// Reactive State
const workflowData = ref({});
const loading = ref(false);
const error = ref(null);
const currentState = ref(null);
const documentId = computed(() => props.referenceName || props.doctype);

// Timeline Items
const timelineItems = computed(() => {
  if (!workflowData.value.actions) return [];
  return workflowData.value.actions;
});

// Progress Steps - Show ALL states in chronological order (including duplicates)
const progressSteps = computed(() => {
  if (!timelineItems.value.length) return [];
  
  const steps = [];
  
  // Process in reverse chronological order (oldest first)
  [...timelineItems.value].reverse().forEach((item, index) => {
    const state = item.workflow_state_current;
    if (state) {
      const normalizedState = state.trim().toLowerCase();
      // Exact match only for Approved and Rejected
      const isApproved = normalizedState === 'approved';
      const isRejected = normalizedState === 'rejected';
      const isFinalState = isApproved || isRejected;
      
      steps.push({
        label: state,
        completed: true,
        timestamp: item.creation,
        index: index,
        isApproved: isApproved,
        isRejected: isRejected,
        isFinalState: isFinalState
      });
    }
  });
  
  // Mark the last step as active (current state)
  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    // If final state (Approved/Rejected), keep it as completed
    if (!lastStep.isFinalState) {
      lastStep.completed = false;
      lastStep.active = true;
    }
  }
  
  return steps;
});

// Load Data from API
const loadWorkflowData = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await frappe.call({
      method: 'frappe_theme.apis.approval_timeline.get_workflow_audit',
      args: {
        doctype: props.doctype,
        reference_name: props.referenceName,
      }
    });
    console.log('Workflow Audit Response:', response);
    
    if (response.message && response.message.success) {
      workflowData.value = response.message;
      
      // Set current state from the most recent action
      if (response.message.actions && response.message.actions.length > 0) {
        currentState.value = response.message.actions[0].workflow_state_current;
      }
    } else {
      error.value = response.message?.message || 'Failed to load workflow data';
    }
  } catch (err) {
    error.value = err.message || 'An error occurred while loading data';
    console.error('Workflow Audit Error:', err);
  } finally {
    loading.value = false;
  }
};

// Helper Functions
const getStateConfig = (state) => {
  // Standard workflow states with specific colors
  const stateMap = {
    // Initial States
    'Draft': { 
      statusClass: 'status-draft', 
      stateClass: 'state-draft', 
      nodeClass: 'node-draft' 
    },
    'Pending': { 
      statusClass: 'status-pending', 
      stateClass: 'state-pending', 
      nodeClass: 'node-pending' 
    },
    
    // Submission States
    'Submitted': { 
      statusClass: 'status-submitted', 
      stateClass: 'state-submitted', 
      nodeClass: 'node-submitted' 
    },
    'Proposal Submitted': { 
      statusClass: 'status-proposal-submitted', 
      stateClass: 'state-proposal-submitted', 
      nodeClass: 'node-proposal-submitted' 
    },
    
    // Review States
    'Review': { 
      statusClass: 'status-review', 
      stateClass: 'state-review', 
      nodeClass: 'node-review' 
    },
    'Proposal Under Review': { 
      statusClass: 'status-proposal-review', 
      stateClass: 'state-proposal-review', 
      nodeClass: 'node-proposal-review' 
    },
    'Under Review': { 
      statusClass: 'status-proposal-review', 
      stateClass: 'state-proposal-review', 
      nodeClass: 'node-proposal-review' 
    },
    
    // Approval States
    'Approved': { 
      statusClass: 'status-approved', 
      stateClass: 'state-approved', 
      nodeClass: 'node-approved' 
    },
    
    // Rejection States
    'Rejected': { 
      statusClass: 'status-rejected', 
      stateClass: 'state-rejected', 
      nodeClass: 'node-rejected' 
    },
    
    // Send Back States
    'Sent Back': { 
      statusClass: 'status-sent-back', 
      stateClass: 'state-sent-back', 
      nodeClass: 'node-sent-back' 
    },
    'Sent Back to NGO': { 
      statusClass: 'status-sent-back-ngo', 
      stateClass: 'state-sent-back-ngo', 
      nodeClass: 'node-sent-back-ngo' 
    },
  };
  
  // Normalize state for matching
  const normalizedState = state?.trim() || '';
  
  // Exact match first
  if (stateMap[normalizedState]) {
    return stateMap[normalizedState];
  }
  
  // Partial match (case-insensitive)
  const lowerState = normalizedState.toLowerCase();
  for (const [key, value] of Object.entries(stateMap)) {
    if (lowerState.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerState)) {
      return value;
    }
  }
  
  // Default for custom/client-specific states
  return { 
    statusClass: 'status-custom', 
    stateClass: 'state-custom', 
    nodeClass: 'node-custom' 
  };
};

const getNodeClass = (item) => {
  const state = item.workflow_state_current || '';
  return getStateConfig(state).nodeClass;
};

const getProgressStepClass = (step, index) => {
  if (step.active) return 'active';
  if (step.completed) return 'completed';
  return '';
};

const getRoleAvatar = (role) => {
  // Standard product roles with specific colors
  const roleMap = {
    // Admin Roles
    'Administrator': 'avatar-red',
    'mGrant Donor Admin': 'avatar-crimson',
    'Donor Admin': 'avatar-crimson',
    'NGO Admin': 'avatar-orange',
    
    // Project Management Roles
    'PL': 'avatar-blue',
    'PM': 'avatar-blue',
    'SPM': 'avatar-purple',
    'Project Lead': 'avatar-blue',
    'Project Manager': 'avatar-blue',
    'Senior Project Manager': 'avatar-purple',
  };
  
  // Normalize role for matching
  const normalizedRole = role?.trim() || '';
  
  // Exact match first (case-insensitive)
  const exactMatch = Object.keys(roleMap).find(
    key => key.toLowerCase() === normalizedRole.toLowerCase()
  );
  if (exactMatch) {
    return roleMap[exactMatch];
  }
  
  // Partial match
  const upperRole = normalizedRole.toUpperCase();
  for (const [key, value] of Object.entries(roleMap)) {
    if (upperRole.includes(key.toUpperCase()) || key.toUpperCase().includes(upperRole)) {
      return value;
    }
  }
  
  // Default for custom/client-specific roles
  return 'avatar-teal';
};

const getInitials = (email) => {
  if (!email) return 'U';
  const parts = email.split('@')[0].split('.');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
};

const getUserName = (email) => {
  if (!email) return 'Unknown User';
  const username = email.split('@')[0];
  return username.split('.').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join(' ');
};

const formatFieldLabel = (fieldname) => {
  if (!fieldname) return '';
  return fieldname
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  const options = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
};

const getCommentClass = (item) => {
  const action = item.workflow_action?.toLowerCase() || '';
  if (action.includes('send back')) return 'comment-sent-back';
  if (action.includes('approve')) return 'comment-approved';
  if (action.includes('reject')) return 'comment-rejected';
  return 'comment-info';
};

// Icon Components - Based on actions (original logic)
const getIconComponent = (item) => {
  const action = item.workflow_action?.toLowerCase() || '';
  const state = item.workflow_state_current?.toLowerCase() || '';
  
  if (action.includes('approve') || state.includes('approved')) {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
      h('polyline', { points: '20 6 9 17 4 12' })
    );
  }
  
  if (action.includes('reject') || state.includes('rejected')) {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
      h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
    ]);
  }
  
  if (action.includes('send back')) {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
      h('polyline', { points: '9 14 4 9 9 4' })
    );
  }
  
  if (action.includes('submit') || state.includes('submitted')) {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
      h('polyline', { points: '20 6 9 17 4 12' })
    );
  }
  
  // Default clock icon
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('polyline', { points: '12 6 12 12 16 14' })
  ]);
};

// Lifecycle
onMounted(() => {
  console.log("ApprovalTimeline mounted with doctype:", props.doctype, "and referenceName:", props.referenceName);
  if (props.autoLoad) {
    loadWorkflowData();
  }
});

// Expose methods for parent component
defineExpose({
  loadWorkflowData
});
</script>

<style scoped>
.approval-timeline {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

/* Header */
.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 12px;
}

.timeline-title-section h3 {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: #1a202c;
}

.timeline-subtitle {
  font-size: 12px;
  color: #64748b;
}

.current-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.current-status svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

/* ========================================
   STATUS COLORS - Current State Badge (Header)
   ======================================== */

/* Draft State - Gray */
.status-draft { 
  background: #f1f5f9; 
  color: #475569; 
}

/* Pending State - Amber */
.status-pending { 
  background: #fef3c7; 
  color: #92400e; 
}

/* Submitted State - Blue */
.status-submitted { 
  background: #dbeafe; 
  color: #1e40af; 
}

/* Proposal Submitted - Sky Blue */
.status-proposal-submitted { 
  background: #e0f2fe; 
  color: #075985; 
}

/* Review State - Indigo */
.status-review { 
  background: #e0e7ff; 
  color: #3730a3; 
}

/* Proposal Under Review - Purple */
.status-proposal-review { 
  background: #ede9fe; 
  color: #6d28d9; 
}

/* Approved State - Green */
.status-approved { 
  background: #d1fae5; 
  color: #065f46; 
}

/* Rejected State - Red */
.status-rejected { 
  background: #fee2e2; 
  color: #991b1b; 
}

/* Sent Back - Orange */
.status-sent-back { 
  background: #ffedd5; 
  color: #9a3412; 
}

/* Sent Back to NGO - Deep Orange */
.status-sent-back-ngo { 
  background: #fed7aa; 
  color: #7c2d12; 
}

/* Custom/Client States - Teal (Standard for all custom states) */
.status-custom { 
  background: #ccfbf1; 
  color: #115e59; 
}

/* ========================================
   STATE BADGES - Timeline Left Panel
   ======================================== */

/* Draft State - Gray */
.state-draft { 
  background: #f1f5f9; 
  color: #475569; 
}

/* Pending State - Amber */
.state-pending { 
  background: #fef3c7; 
  color: #92400e; 
}

/* Submitted State - Blue */
.state-submitted { 
  background: #dbeafe; 
  color: #1e40af; 
}

/* Proposal Submitted - Sky Blue */
.state-proposal-submitted { 
  background: #e0f2fe; 
  color: #075985; 
}

/* Review State - Indigo */
.state-review { 
  background: #e0e7ff; 
  color: #3730a3; 
}

/* Proposal Under Review - Purple */
.state-proposal-review { 
  background: #ede9fe; 
  color: #6d28d9; 
}

/* Approved State - Green */
.state-approved { 
  background: #d1fae5; 
  color: #065f46; 
}

/* Rejected State - Red */
.state-rejected { 
  background: #fee2e2; 
  color: #991b1b; 
}

/* Sent Back - Orange */
.state-sent-back { 
  background: #ffedd5; 
  color: #9a3412; 
}

/* Sent Back to NGO - Deep Orange */
.state-sent-back-ngo { 
  background: #fed7aa; 
  color: #7c2d12; 
}

/* Custom/Client States - Teal (Standard for all custom states) */
.state-custom { 
  background: #ccfbf1; 
  color: #115e59; 
}

/* ========================================
   TIMELINE NODES - Timeline Dots
   ======================================== */

/* Draft Node - Gray */
.node-draft { 
  border-color: #94a3b8; 
  background: #f1f5f9; 
}
.node-draft svg { 
  color: #64748b; 
}

/* Pending Node - Amber */
.node-pending { 
  border-color: #f59e0b; 
  background: #fffbeb; 
}
.node-pending svg { 
  color: #f59e0b; 
}

/* Submitted Node - Blue */
.node-submitted { 
  border-color: #3b82f6; 
  background: #eff6ff; 
}
.node-submitted svg { 
  color: #3b82f6; 
}

/* Proposal Submitted Node - Sky Blue */
.node-proposal-submitted { 
  border-color: #0ea5e9; 
  background: #f0f9ff; 
}
.node-proposal-submitted svg { 
  color: #0369a1; 
}

/* Review Node - Indigo */
.node-review { 
  border-color: #6366f1; 
  background: #eef2ff; 
}
.node-review svg { 
  color: #4f46e5; 
}

/* Proposal Under Review Node - Purple */
.node-proposal-review { 
  border-color: #8b5cf6; 
  background: #f5f3ff; 
}
.node-proposal-review svg { 
  color: #7c3aed; 
}

/* Approved Node - Green */
.node-approved { 
  border-color: #10b981; 
  background: #ecfdf5; 
}
.node-approved svg { 
  color: #10b981; 
}

/* Rejected Node - Red */
.node-rejected { 
  border-color: #ef4444; 
  background: #fef2f2; 
}
.node-rejected svg { 
  color: #ef4444; 
}

/* Sent Back Node - Orange */
.node-sent-back { 
  border-color: #f97316; 
  background: #fff7ed; 
}
.node-sent-back svg { 
  color: #f97316; 
}

/* Sent Back to NGO Node - Deep Orange */
.node-sent-back-ngo { 
  border-color: #ea580c; 
  background: #ffedd5; 
}
.node-sent-back-ngo svg { 
  color: #c2410c; 
}

/* Custom/Client States Node - Teal (Standard for all custom states) */
.node-custom { 
  border-color: #14b8a6; 
  background: #f0fdfa; 
}
.node-custom svg { 
  color: #0f766e; 
}

/* Workflow Progress Bar */
.workflow-progress {
  display: flex;
  align-items: flex-start;
  gap: 0;
  margin-bottom: 20px;
  padding: 14px 12px;
  background: #f8fafc;
  border-radius: 8px;
  overflow-x: auto;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 60px;
  position: relative;
}

.progress-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 12px;
  left: 50%;
  width: 100%;
  height: 2px;
  background: #e2e8f0;
  z-index: 0;
}

.progress-step.completed:not(:last-child)::after {
  background: #10b981;
}

.progress-step.active:not(:last-child)::after {
  background: linear-gradient(90deg, #10b981 50%, #e2e8f0 50%);
}

.progress-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  font-size: 10px;
  font-weight: 600;
  color: #94a3b8;
  transition: all 0.3s ease;
}

.progress-dot svg {
  width: 12px;
  height: 12px;
}

.progress-step.completed .progress-dot {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
}

/* Approved State - Orange */
.progress-step.step-approved .progress-dot {
  background: #f97316;
  border-color: #f97316;
  color: #fff;
}

.progress-step.step-approved.completed:not(:last-child)::after {
  background: #f97316;
}

/* Rejected State - Red */
.progress-step.step-rejected .progress-dot {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

.progress-step.step-rejected.completed:not(:last-child)::after {
  background: #dc2626;
}

/* Active State (non-final states) - White circle with pulsing violet border */
.progress-step.active .progress-dot {
  background: #fff;
  border-color: #c026d3;
  color: #c026d3;
  box-shadow: 0 0 0 4px rgba(192, 38, 211, 0.25);
  animation: pulse-violet 2s ease-in-out infinite;
}

@keyframes pulse-violet {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(192, 38, 211, 0.25);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(192, 38, 211, 0.15);
  }
}

.progress-label {
  margin-top: 6px;
  font-size: 9px;
  color: #64748b;
  text-align: center;
  max-width: 55px;
  line-height: 1.2;
}

.progress-step.completed .progress-label { 
  color: #059669; 
  font-weight: 500; 
}

.progress-step.step-approved .progress-label { 
  color: #c2410c; 
  font-weight: 600; 
}

.progress-step.step-rejected .progress-label { 
  color: #b91c1c; 
  font-weight: 600; 
}

.progress-step.active .progress-label { 
  color: #a21caf; 
  font-weight: 600; 
}

/* Timeline Container */
.timeline-container {
  position: relative;
}

/* Timeline Item */
.timeline-item {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  min-height: 80px;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

/* Left Panel */
.timeline-left {
  width: 260px;
  flex-shrink: 0;
  position: relative;
  padding-right: 20px;
  padding-left: 32px;
}

.timeline-left::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 0;
  bottom: -16px;
  width: 2px;
  background: #e2e8f0;
}

.timeline-item:last-child .timeline-left::before {
  display: none;
}

/* Timeline Node */
.timeline-node {
  position: absolute;
  left: 0;
  top: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 2px solid #e2e8f0;
  z-index: 1;
}

.timeline-node svg {
  width: 12px;
  height: 12px;
  display: block;
  margin: auto;
}

/* Left Content */
.left-content {
  padding-top: 0;
}

.state-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  margin-bottom: 6px;
}

.action-label {
  font-weight: 600;
  font-size: 12px;
  color: #1e293b;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: #f1f5f9;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 500;
  color: #64748b;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

/* ========================================
   USER AVATAR COLORS - Role-based
   ======================================== */

/* Administrator - Red */
.avatar-red { 
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); 
}

/* mGrant Donor Admin / Donor Admin - Crimson/Rose */
.avatar-crimson { 
  background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); 
}

/* PL/PM/Project Roles - Blue */
.avatar-blue { 
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
}

/* SPM - Purple */
.avatar-purple { 
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); 
}

/* NGO Admin - Orange */
.avatar-orange { 
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); 
}

/* Custom/Client Roles - Teal (Standard for all custom roles) */
.avatar-teal { 
  background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); 
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 10px;
  color: #64748b;
}

.timestamp {
  font-size: 10px;
  color: #94a3b8;
}

/* Right Panel */
.timeline-right {
  flex: 1;
  min-width: 0;
}

.data-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
}

.data-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 8px;
}

.data-section-title svg {
  width: 12px;
  height: 12px;
  color: #64748b;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.field-item {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 8px 10px;
}

.field-label {
  font-size: 9px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 4px;
}

.field-value {
  font-size: 11px;
  color: #1e293b;
  font-weight: 500;
  word-break: break-word;
}

.comment-box {
  background: #fff;
  border-left: 3px solid #cbd5e1;
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 11px;
  line-height: 1.5;
  color: #475569;
}

.comment-info { border-left-color: #3b82f6; background: #eff6ff; }
.comment-approved { border-left-color: #10b981; background: #ecfdf5; }
.comment-rejected { border-left-color: #ef4444; background: #fef2f2; }
.comment-sent-back { border-left-color: #f97316; background: #fff7ed; }

.no-data {
  text-align: center;
  padding: 20px;
  color: #94a3b8;
  font-size: 11px;
  font-style: italic;
}

/* Loading & Error States */
.loading-state,
.error-state {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state svg {
  width: 32px;
  height: 32px;
  color: #ef4444;
  margin: 0 auto 12px;
}

/* Responsive */
@media (max-width: 768px) {
  .timeline-item {
    flex-direction: column;
  }
  
  .timeline-left {
    width: 100%;
    padding-right: 0;
    padding-bottom: 12px;
  }
  
  .timeline-left::before {
    display: none;
  }
  
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>