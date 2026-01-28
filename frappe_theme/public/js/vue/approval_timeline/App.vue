<template>
	<div class="approval-timeline">
		<!-- Header -->
		<div class="timeline-header">
			<div class="timeline-title-section">
				<h3>{{ workflowData.workflow || "Workflow Audit" }}</h3>
				<div class="timeline-subtitle">
					{{ documentId }} {{ documentTitle ? "• " + documentTitle : "" }}
				</div>
			</div>
			<span
				v-if="currentState"
				:class="['current-status', getStateConfig(currentState).statusClass]"
			>
				<!-- Dynamic icon based on state - matching progress bar icons -->
				<svg
					v-if="isApprovedState(currentState)"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
				<svg
					v-else-if="isRejectedState(currentState)"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
				<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<polyline points="12 6 12 12 16 14" />
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
					{ 'step-success': step.isSuccess, 'step-rejected': step.isRejected },
				]"
			>
				<div class="progress-dot">
					<!-- Show cross icon for rejected -->
					<svg
						v-if="step.isRejected"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
					<!-- Show checkmark for completed -->
					<svg
						v-else-if="step.completed"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
					<!-- Show clock for active/pending (not completed) -->
					<svg
						v-else
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="10" />
						<polyline points="12 6 12 12 16 14" />
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
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<line x1="12" y1="16" x2="12.01" y2="16" />
			</svg>
			<p>{{ error }}</p>
		</div>

		<!-- Timeline Items -->
		<div v-else class="timeline-container">
			<!-- No actions message -->
			<div v-if="timelineItems.length === 0" class="no-actions-message">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<polyline points="12 6 12 12 16 14" />
				</svg>
				<p>Awaiting action</p>
			</div>

			<!-- Timeline items -->
			<div
				v-for="(item, index) in timelineItems"
				:key="item.name"
				:class="['timeline-item', { pending: index === 0 && !item.completed }]"
			>
				<!-- Left Panel -->
				<div class="timeline-left">
					<div :class="['timeline-node', getNodeClass(item)]">
						<component :is="getIconComponent(item)" />
					</div>
					<div class="left-content">
						<span
							:class="[
								'state-badge',
								getStateConfig(item.workflow_state_current).stateClass,
							]"
						>
							{{ item.workflow_state_current }}
						</span>
						<template v-if="!item.isPlaceholder">
							<div class="action-label">
								{{ item.workflow_action || "Action Performed" }}
							</div>
							<div class="user-info">
								<div :class="['user-avatar', getRoleAvatar(item.role)]">
									{{ getInitials(item.user) }}
								</div>
								<div class="user-details">
									<div class="user-name">{{ getUserName(item.user) }}</div>
									<div class="user-role">{{ item.role || "User" }}</div>
								</div>
							</div>
							<div class="timestamp">
								{{ formatDate(item.creation) }}
							</div>
						</template>
					</div>
				</div>

				<!-- Right Panel -->
				<div class="timeline-right">
					<div class="data-card">
						<!-- Dialog Field Values -->
						<template
							v-if="
								(item.action_data && item.action_data.length > 0) || item.comment
							"
						>
							<div class="data-section-title">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
									/>
									<polyline points="14 2 14 8 20 8" />
								</svg>
								Field Values
							</div>
							<div
								v-if="
									item.approval_assignments &&
									item.approval_assignments.length > 0
								"
								class="field-item approval-assignments-field"
							>
								<div class="field-label">Approval Assignments</div>
								<div class="field-value">
									<table
										v-if="item?.approval_assignments?.length"
										style="width: 100%; border-collapse: collapse"
									>
										<!-- TABLE HEADER -->
										<thead>
											<tr style="text-align: center">
												<th
													v-for="field in item.approval_assignments[0]
														.fields"
													:key="field.fieldname"
													:style="{
														border: '1px solid #e2e8f0',
														padding: '5px',
														width: [
															'comment',
															'assignment_remark',
														].includes(field.fieldname)
															? '250px'
															: 'auto',
													}"
												>
													{{ field.label }}
												</th>
											</tr>
										</thead>

										<!-- TABLE BODY -->
										<tbody>
											<tr
												v-for="assignment in item.approval_assignments"
												:key="assignment.name"
												style="text-align: center"
											>
												<td
													v-for="field in assignment.fields"
													:key="field.fieldname"
													style="border: 1px solid #e2e8f0; padding: 5px"
												>
													{{ field.value ?? "-" }}
												</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>
							<div class="field-grid">
								<!-- Comment Section - Show at top if present -->
								<div v-if="item.comment" class="field-item comment-field">
									<div class="field-label">Comments</div>
									<div class="field-value">
										{{ item.comment }}
									</div>
								</div>
								<!-- Field Values -->
								<div
									v-for="(field, fieldIndex) in item.action_data"
									:key="field.fieldname"
									v-show="
										showAllFields[item.name] ||
										(!item.comment && fieldIndex < 2)
									"
									class="field-item"
								>
									<div class="field-label">
										{{ field.label || formatFieldLabel(field.fieldname) }}
									</div>
									<div
										v-if="
											field.fieldtype === 'Attach' ||
											field.fieldtype === 'Attach Image'
										"
										class="field-value"
									>
										<a :href="field.value" target="_blank">{{
											field.value || "N/A"
										}}</a>
									</div>
									<div v-else class="field-value">
										{{ field.value || "N/A" }}
									</div>
								</div>

								<!-- Show More/Less Button - Inside the grid -->
								<div
									v-if="getHiddenFieldsCount(item) > 0"
									class="show-more-container"
								>
									<button
										@click="toggleShowAllFields(item.name)"
										class="show-more-btn"
									>
										<span v-if="!showAllFields[item.name]">
											Show More ({{ getHiddenFieldsCount(item) }})
											<svg
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<polyline points="6 9 12 15 18 9" />
											</svg>
										</span>
										<span v-else>
											Show Less
											<svg
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<polyline points="18 15 12 9 6 15" />
											</svg>
										</span>
									</button>
								</div>
							</div>
						</template>

						<!-- No Data Message -->
						<div v-if="!item.action_data?.length && !item.comment" class="no-data">
							{{
								index === 0 &&
								!item.completed &&
								!isFinalState(item.workflow_state_current)
									? "Awaiting action"
									: "No additional data"
							}}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, h } from "vue";

// Props
const props = defineProps({
	doctype: {
		type: String,
		required: true,
	},
	referenceName: {
		type: String,
		default: null,
	},
	documentTitle: {
		type: String,
		default: "",
	},
	workflowState: {
		type: String,
		default: null,
	},
	autoLoad: {
		type: Boolean,
		default: true,
	},
});

// Reactive State
const workflowData = ref({});
const loading = ref(false);
const error = ref(null);
const currentState = ref(null);
const documentId = computed(() => props.referenceName || props.doctype);
const showAllFields = ref({});

// Toggle show all fields for a specific item
const toggleShowAllFields = (itemName) => {
	showAllFields.value[itemName] = !showAllFields.value[itemName];
};

// Helper function to check if state is approved/accepted/receipt confirmed
const isApprovedState = (state) => {
	if (!state) return false;
	const normalizedState = state.trim().toLowerCase();
	return (
		normalizedState === "approved" ||
		normalizedState === "accepted" ||
		normalizedState === "receipt confirmed"
	);
};

// Helper function to check if state is rejected
const isRejectedState = (state) => {
	if (!state) return false;
	const normalizedState = state.trim().toLowerCase();
	return normalizedState === "rejected";
};

// Get count of hidden fields based on whether comment is present
const getHiddenFieldsCount = (item) => {
	const actionDataLength = item.action_data?.length || 0;
	const hasComment = !!item.comment;

	// If comment exists, hide all fields and show them in "Show More"
	// If no comment, show 2 fields by default, hide the rest
	if (hasComment) {
		return actionDataLength; // All fields are hidden
	} else {
		const hiddenCount = actionDataLength - 2;
		return hiddenCount > 0 ? hiddenCount : 0;
	}
};

// Helper function to check if state is final
const isFinalState = (state) => {
	if (!state) return false;
	const normalizedState = state.trim().toLowerCase();
	return (
		normalizedState === "approved" ||
		normalizedState === "accepted" ||
		normalizedState === "receipt confirmed" ||
		normalizedState === "rejected"
	);
};

// Timeline Items - Show minimal placeholder if no actions
const timelineItems = computed(() => {
	const actions = workflowData.value.actions || [];
	const currentDocState = props.workflowState || workflowData.value.current_doc_state;

	// If no actions and we have current state, show minimal placeholder
	if (actions.length === 0 && currentDocState) {
		return [
			{
				workflow_state_current: currentDocState,
				isPlaceholder: true,
			},
		];
	}

	return actions;
});

// Progress Steps - Show only executed states from actions
const progressSteps = computed(() => {
	const actions = timelineItems.value || [];
	const currentDocState = props.workflowState || workflowData.value.current_doc_state;

	if (actions.length === 0) {
		// No actions yet, show only current state if we have it
		if (currentDocState) {
			const normalizedState = currentDocState.trim().toLowerCase();
			return [
				{
					label: currentDocState,
					completed: false,
					active: true,
					timestamp: new Date().toISOString(),
					index: 0,
					isSuccess:
						normalizedState === "approved" ||
						normalizedState === "accepted" ||
						normalizedState === "receipt confirmed",
					isRejected: normalizedState === "rejected",
					isFinalState:
						normalizedState === "approved" ||
						normalizedState === "accepted" ||
						normalizedState === "receipt confirmed" ||
						normalizedState === "rejected",
				},
			];
		}
		return [];
	}

	const steps = [];
	const stateMap = new Map();

	// Process actions in chronological order (oldest first)
	[...actions].reverse().forEach((item, index) => {
		const previousState = item.workflow_state_previous;
		const currentState = item.workflow_state_current;

		// Add previous state if this is the first action
		if (index === 0 && previousState && !stateMap.has(previousState)) {
			const normalizedPrevState = previousState.trim().toLowerCase();
			stateMap.set(previousState, {
				label: previousState,
				completed: true,
				timestamp: item.creation,
				index: steps.length,
				isSuccess:
					normalizedPrevState === "approved" ||
					normalizedPrevState === "accepted" ||
					normalizedPrevState === "receipt confirmed",
				isRejected: normalizedPrevState === "rejected",
				isFinalState:
					normalizedPrevState === "approved" ||
					normalizedPrevState === "accepted" ||
					normalizedPrevState === "receipt confirmed" ||
					normalizedPrevState === "rejected",
			});
			steps.push(stateMap.get(previousState));
		}

		// Add current state (allow duplicates for loops like: submitted -> under review -> submitted)
		if (currentState) {
			const normalizedState = currentState.trim().toLowerCase();
			const stateKey = `${currentState}_${index}`; // Allow same state multiple times

			stateMap.set(stateKey, {
				label: currentState,
				completed: true,
				timestamp: item.creation,
				index: steps.length,
				isSuccess:
					normalizedState === "approved" ||
					normalizedState === "accepted" ||
					normalizedState === "receipt confirmed",
				isRejected: normalizedState === "rejected",
				isFinalState:
					normalizedState === "approved" ||
					normalizedState === "accepted" ||
					normalizedState === "receipt confirmed" ||
					normalizedState === "rejected",
			});
			steps.push(stateMap.get(stateKey));
		}
	});

	// Mark the last step as active (not completed) if it's not a final state
	if (steps.length > 0) {
		const lastStep = steps[steps.length - 1];
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
			method: "frappe_theme.apis.approval_timeline.get_workflow_audit",
			args: {
				doctype: props.doctype,
				reference_name: props.referenceName,
			},
		});

		if (response.message && response.message.success) {
			workflowData.value = response.message;
			if (response.message.type === "no_action") {
				// Set current state from workflowState prop or current_doc_state
				currentState.value = props.workflowState || response.message.current_doc_state;
			} else {
				// Set current state from the most recent action
				if (response.message.actions && response.message.actions.length > 0) {
					currentState.value = response.message.actions[0].workflow_state_current;
				}
			}
		} else {
			error.value = response.message?.message || "Failed to load workflow data";
			console.error("API Error:", error.value);
		}
	} catch (err) {
		error.value = err.message || "An error occurred while loading data";
		console.error("Workflow Audit Error:", err);
	} finally {
		loading.value = false;
	}
};

// Helper Functions
const getStateConfig = (state) => {
	// Normalize state for matching
	const normalizedState = state?.trim().toLowerCase() || "";

	// Bootstrap-style color mapping
	const stateMap = {
		// Success states (Green)
		approved: {
			statusClass: "status-success",
			stateClass: "state-success",
			nodeClass: "node-success",
		},
		accepted: {
			statusClass: "status-success",
			stateClass: "state-success",
			nodeClass: "node-success",
		},
		"receipt confirmed": {
			statusClass: "status-success",
			stateClass: "state-success",
			nodeClass: "node-success",
		},

		// Danger state (Red)
		rejected: {
			statusClass: "status-danger",
			stateClass: "state-danger",
			nodeClass: "node-danger",
		},

		// Info states (Blue)
		draft: {
			statusClass: "status-info",
			stateClass: "state-info",
			nodeClass: "node-info",
		},
		disbursed: {
			statusClass: "status-info",
			stateClass: "state-info",
			nodeClass: "node-info",
		},
	};

	// Exact match (case-insensitive)
	if (stateMap[normalizedState]) {
		return stateMap[normalizedState];
	}

	// Default gray for all other states
	return {
		statusClass: "status-default",
		stateClass: "state-default",
		nodeClass: "node-default",
	};
};

const getNodeClass = (item) => {
	const state = item.workflow_state_current || "";
	return getStateConfig(state).nodeClass;
};

const getProgressStepClass = (step, index) => {
	if (step.active) return "active";
	if (step.completed) return "completed";
	return "";
};

const getRoleAvatar = (role) => {
	// Check if theme colors are available
	if (frappe?.boot?.my_theme?.navbar_color && frappe?.boot?.my_theme?.navbar_text_color) {
		return "avatar-theme";
	}

	// Use default color for all roles
	return "avatar-default";
};

const getInitials = (email) => {
	if (!email) return "U";
	const parts = email.split("@")[0].split(".");
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return email.substring(0, 2).toUpperCase();
};

const getUserName = (email) => {
	if (!email) return "Unknown User";
	const username = email.split("@")[0];
	return username
		.split(".")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
};

const formatFieldLabel = (fieldname) => {
	if (!fieldname) return "";
	return fieldname.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDate = (dateStr) => {
	if (!dateStr) return "N/A";

	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now - date;
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
	if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
	if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

	const options = {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	};
	return date.toLocaleDateString("en-US", options);
};

const getCommentClass = (item) => {
	const action = item.workflow_action?.toLowerCase() || "";
	if (action.includes("send back")) return "comment-sent-back";
	if (action.includes("approve")) return "comment-approved";
	if (action.includes("reject")) return "comment-rejected";
	return "comment-info";
};

// Icon Components - Based on actions (original logic)
const getIconComponent = (item) => {
	const action = item.workflow_action?.toLowerCase() || "";
	const state = item.workflow_state_current?.toLowerCase() || "";

	if (action.includes("approve") || state.includes("approved")) {
		return h(
			"svg",
			{ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2" },
			h("polyline", { points: "20 6 9 17 4 12" })
		);
	}

	if (action.includes("reject") || state.includes("rejected")) {
		return h(
			"svg",
			{ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2" },
			[
				h("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
				h("line", { x1: "6", y1: "6", x2: "18", y2: "18" }),
			]
		);
	}

	if (action.includes("send back")) {
		return h(
			"svg",
			{ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2" },
			h("polyline", { points: "9 14 4 9 9 4" })
		);
	}

	if (action.includes("submit") || state.includes("submitted")) {
		return h(
			"svg",
			{ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2" },
			h("polyline", { points: "20 6 9 17 4 12" })
		);
	}

	// Default clock icon
	return h(
		"svg",
		{ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2" },
		[
			h("circle", { cx: "12", cy: "12", r: "10" }),
			h("polyline", { points: "12 6 12 12 16 14" }),
		]
	);
};

// Lifecycle
onMounted(() => {
	// Set theme colors from frappe.boot if available
	if (frappe?.boot?.my_theme?.navbar_color && frappe?.boot?.my_theme?.navbar_text_color) {
		const root = document.documentElement;
		root.style.setProperty("--navbar-bg-color", frappe.boot.my_theme.navbar_color);
		root.style.setProperty("--navbar-text-color", frappe.boot.my_theme.navbar_text_color);
	}

	if (props.autoLoad) {
		loadWorkflowData();
	}
});

// Expose methods for parent component
defineExpose({
	loadWorkflowData,
});
</script>

<style scoped>
.approval-timeline {
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

/* Success States (Green) - Approved, Accepted, Receipt Confirmed */
.status-success {
	background: #d1fae5;
	color: #065f46;
}

/* Danger State (Red) - Rejected */
.status-danger {
	background: #fee2e2;
	color: #991b1b;
}

/* Info States (Blue) - Draft, Disbursed */
.status-info {
	background: #dbeafe;
	color: #1e40af;
}

/* Default/Other States (Gray) */
.status-default {
	background: #f5f5f5;
	color: #475569;
}

/* ========================================
   STATE BADGES - Timeline Left Panel
   ======================================== */

/* Success States (Green) - Approved, Accepted, Receipt Confirmed */
.state-success {
	background: #d1fae5;
	color: #065f46;
}

/* Danger State (Red) - Rejected */
.state-danger {
	background: #fee2e2;
	color: #991b1b;
}

/* Info States (Blue) - Draft, Disbursed */
.state-info {
	background: #dbeafe;
	color: #1e40af;
}

/* Default/Other States (Gray) */
.state-default {
	background: #f5f5f5;
	color: #475569;
}

/* ========================================
   TIMELINE NODES - Timeline Dots
   ======================================== */

/* Success States (Green) - Approved, Accepted, Receipt Confirmed */
.node-success {
	border-color: #10b981;
	background: #ecfdf5;
}
.node-success svg {
	color: #10b981;
}

/* Danger State (Red) - Rejected */
.node-danger {
	border-color: #ef4444;
	background: #fef2f2;
}
.node-danger svg {
	color: #ef4444;
}

/* Info States (Blue) - Draft, Disbursed */
.node-info {
	border-color: #3b82f6;
	background: #eff6ff;
}
.node-info svg {
	color: #3b82f6;
}

/* Default/Other States (Gray) */
.node-default {
	border-color: #94a3b8;
	background: #f5f5f5;
}
.node-default svg {
	color: #64748b;
}

/* Workflow Progress Bar */
.workflow-progress {
	display: flex;
	align-items: flex-start;
	gap: 0;
	margin-bottom: 20px;
	padding: 14px 12px;
	background: #f5f5f5;
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
	content: "";
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

/* Success States (Green) - Approved, Accepted, Receipt Confirmed */
.progress-step.step-success .progress-dot {
	background: #10b981;
	border-color: #10b981;
	color: #fff;
}

.progress-step.step-success.completed:not(:last-child)::after {
	background: #10b981;
}

/* Rejected State (Red) */
.progress-step.step-rejected .progress-dot {
	background: #dc2626;
	border-color: #dc2626;
	color: #fff;
}

.progress-step.step-rejected.completed:not(:last-child)::after {
	background: #dc2626;
}

/* Active State (non-final states) - Gray border (no pulsing) */
.progress-step.active .progress-dot {
	background: #fff;
	border-color: #94a3b8;
	color: #64748b;
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

.progress-step.step-success .progress-label {
	color: #059669;
	font-weight: 600;
}

.progress-step.step-rejected .progress-label {
	color: #b91c1c;
	font-weight: 600;
}

.progress-step.active .progress-label {
	color: #64748b;
	font-weight: 600;
}

/* Timeline Container */
.timeline-container {
	position: relative;
}

/* No Actions Message */
.no-actions-message {
	text-align: center;
	padding: 40px 20px;
	color: #94a3b8;
}

.no-actions-message svg {
	width: 48px;
	height: 48px;
	color: #cbd5e1;
	margin: 0 auto 12px;
}

.no-actions-message p {
	font-size: 13px;
	font-style: italic;
	margin: 0;
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
	content: "";
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
   USER AVATAR COLORS
   ======================================== */

/* Theme-based avatar (from frappe.boot.my_theme) */
.avatar-theme {
	background: var(--navbar-bg-color, #811622);
	color: var(--navbar-text-color, #ffffff);
}

/* Default avatar (when no theme colors) */
.avatar-default {
	background: #811622;
	color: #ffffff;
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
	background: #f5f5f5;
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
	grid-template-columns: repeat(2, 1fr);
	gap: 10px;
}

.field-item {
	background: #fff;
	border: 1px solid #e2e8f0;
	border-radius: 4px;
	padding: 8px 10px;
}

.field-item.comment-field {
	grid-column: 1 / -1;
}

.field-label {
	font-size: 9px;
	font-weight: 600;
	letter-spacing: 0.3px;
	margin-bottom: 4px;
}

.field-value {
	font-size: 11px;
	color: #1e293b;
	font-weight: 500;
	word-break: break-word;
}

/* Show More Button */
.show-more-container {
	grid-column: 1;
	margin-top: 0;
	display: inline-block;
}

.show-more-btn {
	background: transparent;
	border: none;
	padding-left: 1px !important;
	font-size: 11px;
	font-weight: 500;
	color: #811622;
	cursor: pointer;
	transition: all 0.2s ease;
	display: inline-flex;
}

.show-more-btn svg {
	width: 14px;
	height: 14px;
}

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
	to {
		transform: rotate(360deg);
	}
}

.error-state svg {
	width: 32px;
	height: 32px;
	color: #ef4444;
	margin: 0 auto 12px;
}

/* Approval Assignments Section */
.assignment-item {
	display: flex;
	flex-direction: column;
	gap: 4px;
	border: 1px solid #e2e8f0;
	border-radius: 4px;
	padding: 8px 10px;
}

.assignment {
	font-size: 11px;
	color: #1e293b;
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
