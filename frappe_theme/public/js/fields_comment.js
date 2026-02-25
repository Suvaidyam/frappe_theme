// Place these function definitions near the top of the file, outside any other function scopes.
const primaryColor = frappe.boot.my_theme?.button_background_color || "#171717";
// Variable to store the context of the currently viewed field's comments
let current_field_context = null;

// Helper: returns true for NGO or Vendor team users (external parties)
const isExternalUser = () => ["NGO", "Vendor"].includes(frappe.boot.user_team);

// Add these color constants at the top of the file with other constants
const STATUS_COLORS = {
	Open: "#4A90E2", // Blue
	Resolved: "#50C878", // Green
	Closed: "#FF4444", // Red
};

// Add this helper function to get status color
function getStatusColor(status) {
	return STATUS_COLORS[status] || "#A9A9A9";
}

// Add permission check function
function check_comment_permissions() {
	return new Promise((resolve, reject) => {
		frappe.call({
			method: "frappe_theme.api.get_permissions",
			args: { doctype: "DocType Field Comment" },
			callback: function (response) {
				resolve(response.message);
			},
			error: function (err) {
				reject(err);
			},
		});
	});
}

const getLightColor = (color) => {
	const r = parseInt(color.slice(1, 3), 16);
	const g = parseInt(color.slice(3, 5), 16);
	const b = parseInt(color.slice(5, 7), 16);
	return `rgb(${Math.min(255, r + 102)}, ${Math.min(255, g + 102)}, ${Math.min(255, b + 102)})`;
};

const getLighterColor = (color) => {
	const r = parseInt(color.slice(1, 3), 16);
	const g = parseInt(color.slice(3, 5), 16);
	const b = parseInt(color.slice(5, 7), 16);
	return `rgb(${Math.min(255, r + 153)}, ${Math.min(255, g + 153)}, ${Math.min(255, b + 153)})`;
};

const getUserColor = (username) => {
	const colors = [
		"#4A90E2",
		"#50C878",
		"#FFA07A",
		"#B19CD9",
		"#FF6B6B",
		"#48D1CC",
		"#D2B48C",
		"#A9A9A9",
		"#BDB76B",
		"#FFB6C1",
	];
	const index =
		username.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
	return colors[index];
};

function get_comment_html(comment, commentMap) {
	const userColor = getUserColor(comment.user);
	const isCurrentUser = comment.user === frappe.session.user;
	const renderedComment = frappe.format(comment.comment, "Markdown");
	return `
        <div class="comment-item" style="margin-bottom: 28px; position: relative; display: flex; ${
			isCurrentUser ? "justify-content: flex-end;" : "justify-content: flex-start;"
		}">
            ${
				!isCurrentUser
					? `
                <div style="background: ${userColor}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    ${getUserAvatar(comment.full_name || comment.user)}
                </div>
            `
					: ""
			}
            <div style="width: fit-content; max-width: 80%;">
                ${
					!isCurrentUser
						? `
                    <div style="margin-bottom: 6px;">
                        <div style="font-weight: 600; font-size: 13px; color: ${userColor}; display: flex; align-items: center; gap: 6px;">
                            ${comment.full_name || comment.user}
                            <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">${frappe.datetime.prettyDate(
								comment.creation_date
							)}</span>
                            ${
								comment.is_external && !isExternalUser()
									? `<span style="font-size: 10px; background: #e3f2fd; color: #1976d2; border: 1px solid #90caf9; border-radius: 4px; padding: 0px 5px; font-weight: 600;">NGO</span>`
									: ""
							}
                            ${
								comment.is_vendor && !isExternalUser()
									? `<span style="font-size: 10px; background: #fff3e0; color: #e65100; border: 1px solid #ffcc80; border-radius: 4px; padding: 0px 5px; font-weight: 600;">Vendor</span>`
									: ""
							}
                        </div>
                    </div>
                `
						: ""
				}
                <div class="comment-content" style="padding: 12px 16px; border-radius: 16px; border: 1px solid #ececec; position: relative; background: ${
					isCurrentUser ? "#f5f7fa" : "#fff"
				}; margin-bottom: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); width: fit-content;">
                    ${
						!isCurrentUser
							? `
                        <div style="position: absolute; left: -7px; top: 16px; width: 12px; height: 12px; background: #fff; border-left: 1px solid #ececec; border-bottom: 1px solid #ececec; transform: rotate(45deg);"></div>
                    `
							: `
                        <div style="position: absolute; right: -7px; top: 16px; width: 12px; height: 12px; background: #f5f7fa; border-right: 1px solid #ececec; border-bottom: 1px solid #ececec; transform: rotate(45deg);"></div>
                    `
					}
                    <div style="font-size: 14px; line-height: 1.6; color: #222; word-wrap: break-word; white-space: pre-wrap;word-break: break-all; overflow-wrap: anywhere;">${renderedComment}</div>
                </div>
                <div style="display: flex; justify-content: ${
					isCurrentUser ? "flex-end" : "flex-start"
				}; margin-top: 4px; align-items: center; gap: 8px;">
                    ${
						isCurrentUser
							? `
                        <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                            ${frappe.datetime.prettyDate(comment.creation_date)}
                        </div>
                    `
							: ""
					}
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px; align-items: center; gap: 8px; flex-direction: column; margin-left: 10px;">
                ${
					isCurrentUser
						? `
                    <div style="background: ${userColor}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-left: 10px; font-weight: 600; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        You
                    </div>
                    ${
						comment.is_external && !isExternalUser()
							? '<span style="margin-left:6px;font-size:10px;background:#e3f2fd;color:#1976d2;border:1px solid #90caf9;border-radius:4px;padding:0 5px;font-weight:600;">NGO</span>'
							: ""
					}
                    ${
						comment.is_vendor && !isExternalUser()
							? '<span style="margin-left:6px;font-size:10px;background:#fff3e0;color:#e65100;border:1px solid #ffcc80;border-radius:4px;padding:0 5px;font-weight:600;">Vendor</span>'
							: ""
					}
                 `
						: ""
				}
            </div>
        </div>
    `;
}

// ─── Refresh the summary container at the top of the global sidebar ──────────
function refreshSummaryContainer(frm) {
	// Summary container not shown to NGO users
	if (isExternalUser()) return;
	frappe.call({
		method: "frappe_theme.api.get_comments_summary",
		args: {
			doctype_name: frm.doctype,
			docname: frm.docname,
		},
		callback: function (r) {
			if (!r.message) return;
			const { open, closed, summary_comments } = r.message;

			// Update count pills
			$(".summary-count-open").text(open || 0);
			$(".summary-count-closed").text(closed || 0);
			$(".summary-count-total").text((open || 0) + (closed || 0));

			const summaryList = $(".summary-comments-list");
			const emptyMsg = $(".summary-empty-msg");
			summaryList.empty();

			// Only show the single most-recent summary comment
			const latest =
				summary_comments && summary_comments.length > 0
					? summary_comments[summary_comments.length - 1]
					: null;

			if (latest) {
				// Has a summary — show the summary section
				$(".comments-summary-container .summary-body-wrap").show();
				emptyMsg.hide();
				const sc = latest;
				const userColor = getUserColor(sc.user);
				const fullName = sc.full_name || sc.user;
				const initial = fullName[0].toUpperCase();
				const fieldLabel = sc.field_label || sc.field_name;

				const card = $(`
					<div class="summary-card" data-field="${sc.field_name}"
						style="padding: 8px 10px; border-radius: 8px; background: #fffbea; border: 1px solid #ffe082; font-size: 12px; cursor: pointer; transition: box-shadow 0.15s ease;"
						title="Click to go to this comment">
						<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
							<div style="background: ${userColor}; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; flex-shrink: 0;">${initial}</div>
							<span style="font-weight: 600; color: ${userColor}; font-size: 11px;">${fullName}</span>
							<span style="color: var(--text-muted); font-size: 10px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px; padding: 0 5px; flex-shrink: 0;">${fieldLabel}</span>
							<span style="color: var(--text-muted); font-size: 10px; margin-left: auto; flex-shrink: 0;">${frappe.datetime.prettyDate(
								sc.creation_date
							)}</span>
						</div>
						<div style="color: #333; line-height: 1.5; padding-left: 26px; word-break: break-all; overflow-wrap: anywhere;">${frappe.format(
							sc.comment,
							"Markdown"
						)}</div>
					</div>
				`);

				card.on("mouseenter", function () {
					$(this).css("box-shadow", "0 2px 8px rgba(255,193,7,0.4)");
				});
				card.on("mouseleave", function () {
					$(this).css("box-shadow", "none");
				});

				// Click → scroll to that field section in comments list below, or load it
				card.on("click", function () {
					const fieldName = sc.field_name;

					// Try to find the section already rendered in the global list
					const target = $(".comments-list .field-comment-section").filter(function () {
						const h5Text = $(this).find("h5").first().text().trim();
						return h5Text.startsWith(fieldLabel) || h5Text.includes(fieldLabel);
					});

					if (target.length) {
						const container = $(".comments-container");
						container.animate(
							{
								scrollTop:
									container.scrollTop() +
									target.offset().top -
									container.offset().top -
									10,
							},
							300
						);
						target.css("box-shadow", "0 0 0 2px #ffc107");
						setTimeout(() => target.css("box-shadow", ""), 1800);
					} else {
						// Not in global view — load field-specific comments
						const allFields = [
							...frm.fields.map((f) => ({ ...f, variant: "field" })),
							...(frm?.layout?.tabs?.map((t) => ({ ...t, variant: "tab" })) || []),
						];
						const field = allFields.find((f) => f.df.fieldname === fieldName);
						if (field) {
							current_field_context = { fieldName, field, frm };
							load_field_comments(fieldName, field, frm);
						}
					}
				});

				summaryList.append(card);
			} else {
				// No summary — hide the summary section entirely
				$(".comments-summary-container .summary-body-wrap").hide();
			}
		},
	});
}

function create_new_comment_thread(fieldName, field, frm) {
	return new Promise((resolve, reject) => {
		frappe.call({
			method: "frappe_theme.api.create_new_comment_thread",
			args: {
				doctype_name: frm.doctype,
				docname: frm.docname,
				field_name: fieldName,
				field_label: field.df.label || fieldName,
			},
			callback: function (response) {
				if (response.message) {
					load_field_comments(fieldName, field, frm).then(() => {
						updateTotalCommentCount(frm);
						frappe.show_alert({
							message: __("New comment thread created"),
							indicator: "green",
						});
						resolve(response.message);
					});
				} else {
					frappe.show_alert({
						message: __("Error creating new comment thread"),
						indicator: "red",
					});
					reject();
				}
			},
			error: function (err) {
				frappe.show_alert({
					message: __("Error creating new comment thread"),
					indicator: "red",
				});
				reject(err);
			},
		});
	});
}

function load_field_comments(fieldName, field, frm) {
	return new Promise((resolve, reject) => {
		frappe.call({
			method: "frappe_theme.api.load_field_comments",
			args: {
				doctype_name: frm.doctype,
				docname: frm.docname,
				field_name: fieldName,
			},
			callback: function (response) {
				const comments_list = $(".field-comments-sidebar").find(".comments-list");
				comments_list.empty();

				// Field-level view: hide summary container (global only)
				$(".comments-summary-container").hide();
				$(".comments-container").css("height", "calc(100vh - 108px)");

				const field_section = $(`
                    <div class="field-comment-section" style="margin-bottom: 25px; padding: 15px; border-radius: 12px; border: none; box-shadow: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                            <h5 style="margin: 0; font-size: 15px;">${
								field.df.label || fieldName
							}</h5>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-default btn-sm new-thread-btn" style="padding: 4px 8px; display: none;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
                                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="threads-container"></div>
                    </div>
                `);

				field_section.find(".new-thread-btn").click(() => {
					create_new_comment_thread(fieldName, field, frm);
				});

				if (response.message && response.message.threads) {
					let threadsToShow = response.message.threads;
					if (isExternalUser()) {
						threadsToShow = response.message.threads.filter(
							(thread) => thread.comments && thread.comments.length > 0
						);
					}

					threadsToShow.forEach((thread, index) => {
						const thread_section = $(`
                            <div class="thread-section" style="margin-bottom: 20px; padding: 15px; border-radius: 8px; background: ${
								index === 0 ? "var(--fg-color)" : "var(--bg-color)"
							}; border: 1px solid var(--border-color);">
                                <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
                                    <div class="status-pill-container" style="position: relative;">
                                        ${renderStatusPill(thread.status || "Open")}
                                    </div>
                                </div>
                                <div class="field-comments"></div>
                                <div class="comment-input" style="margin-top: 15px; display: none;">
                                    <div style="display: flex; align-items: center;">
                                        <div style="flex-grow: 1; display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 20px; padding: 3px 6px; background-color: var(--control-bg); box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s ease;">
                                            <div class="comment-box" style="flex-grow: 1; min-height: 24px; margin-right: 8px;"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `);

						let currentStatus = thread.status || "Open";

						// Hide comment input if thread is Closed
						if (currentStatus === "Closed") {
							thread_section.find(".comment-input").hide();
							if (index === 0) field_section.find(".new-thread-btn").show();
						}

						thread_section.on("click", ".status-option", (e) => {
							e.preventDefault();
							const newStatus = $(e.target).data("status");

							check_comment_permissions().then((permissions) => {
								if (!permissions.includes("write")) {
									frappe.show_alert({
										message: __("You do not have permission to change status"),
										indicator: "red",
									});
									return;
								}
								if (!isValidStatusTransition(currentStatus, newStatus)) {
									const validNext = currentStatus === "Open" ? "Closed" : "Open";
									frappe.show_alert({
										message: __(
											`Status can only be changed from ${currentStatus} to ${validNext}`
										),
										indicator: "red",
									});
									return;
								}
								frappe.db
									.set_value(
										"DocType Field Comment",
										thread.name,
										"status",
										newStatus
									)
									.then(() => {
										currentStatus = newStatus;
										frappe.show_alert({
											message: __("Status updated successfully"),
											indicator: "green",
										});
										updateStatusPill(
											thread_section.find(".status-pill"),
											newStatus
										);
										if (newStatus === "Closed") {
											thread_section.find(".comment-input").hide();
											field_section.find(".new-thread-btn").show();
										} else {
											thread_section.find(".comment-input").show();
											field_section.find(".new-thread-btn").hide();
										}
										updateTotalCommentCount(frm);
										refreshSummaryContainer(frm);
									});
							});
						});

						if (!thread.comments || thread.comments.length === 0) {
							thread_section.find(".field-comments").html(`
                                <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                                    <div class="text-muted" style="text-align: center;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-chat-square-text" viewBox="0 0 16 16" style="margin-bottom: 10px;">
                                            <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                                            <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                                        </svg>
                                        <div>No comments yet</div>
                                    </div>
                                </div>
                            `);
						} else {
							const commentMap = {};
							thread.comments.forEach((c) => (commentMap[c.name] = c));
							const sortedComments = thread.comments.sort(
								(a, b) => new Date(a.creation_date) - new Date(b.creation_date)
							);
							sortedComments.forEach((c) => {
								thread_section
									.find(".field-comments")
									.append(get_comment_html(c, commentMap));
							});
						}

						field_section.find(".threads-container").append(thread_section);

						if (currentStatus !== "Closed") {
							check_comment_permissions().then((permissions) => {
								if (permissions.includes("create")) {
									initializeCommentControl(
										thread_section,
										fieldName,
										field,
										get_comment_html
									);
									thread_section.find(".comment-input").show();
								}
							});
						}
					});

					if (threadsToShow.length === 0) {
						const new_thread_section = $(`
                            <div class="thread-section" style="margin-bottom: 20px; padding: 15px; border-radius: 8px; background: var(--fg-color); border: 1px solid var(--border-color);">
                                <div class="field-comments">
                                    <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                                        <div class="text-muted" style="text-align: center;">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-chat-square-text" viewBox="0 0 16 16" style="margin-bottom: 10px;">
                                                <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                                                <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                                            </svg>
                                            <div>No comments yet</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="comment-input" style="margin-top: 15px;">
                                    <div style="display: flex; align-items: center;">
                                        <div style="flex-grow: 1; display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 20px; padding: 3px 6px; background-color: var(--control-bg); box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s ease;">
                                            <div class="comment-box" style="flex-grow: 1; min-height: 24px; margin-right: 8px; "></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `);
						field_section.find(".threads-container").append(new_thread_section);
						check_comment_permissions().then((permissions) => {
							if (permissions.includes("create")) {
								initializeCommentControl(
									new_thread_section,
									fieldName,
									field,
									get_comment_html
								);
								new_thread_section.find(".comment-input").show();
							}
						});
					}
				}

				comments_list.append(field_section);
				// Bottom spacer so last comment isn't flush against screen edge
				comments_list.find(".bottom-spacer").remove();
				comments_list.append('<div class="bottom-spacer" style="height: 40px;"></div>');
				initializeDropdowns();
				resolve();
			},
			error: function (err) {
				console.error("Error loading field comments:", err);
				reject(err);
			},
		});
	});
}

function load_all_comments(frm) {
	return new Promise((resolve, reject) => {
		frappe.call({
			method: "frappe_theme.api.load_all_comments",
			args: {
				doctype_name: frm.doctype,
				docname: frm.docname,
			},
			callback: function (response) {
				const comments_list = $(".field-comments-sidebar").find(".comments-list");
				comments_list.empty();

				// Global view: show summary container only for non-NGO
				if (!isExternalUser()) {
					$(".comments-summary-container").show();
					$(".comments-container").css("height", "calc(100vh - 165px)");
				} else {
					$(".comments-summary-container").hide();
					$(".comments-container").css("height", "calc(100vh - 108px)");
				}

				let fieldsToShow = response.message || [];
				if (frappe.boot.user_team === "NGO") {
					// NGO sees only fields that have at least one is_external comment
					fieldsToShow = (response.message || []).filter(
						(data) => data.comments && data.comments.some((c) => c.is_external)
					);
				} else if (frappe.boot.user_team === "Vendor") {
					// Vendor sees only fields that have at least one is_vendor comment
					fieldsToShow = (response.message || []).filter(
						(data) => data.comments && data.comments.some((c) => c.is_vendor)
					);
				}

				if (
					!response.message ||
					response.message.length === 0 ||
					(isExternalUser() && fieldsToShow.length === 0)
				) {
					comments_list.html(`
                        <div style="display: flex; justify-content: center; align-items: center; height: 200px;">
                            <div class="text-muted" style="text-align: center;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-chat-square-text" viewBox="0 0 16 16" style="margin-bottom: 10px;">
                                    <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                                    <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                                </svg>
                                <div>No comments yet</div>
                            </div>
                        </div>
                    `);
					resolve();
					return;
				}

				fieldsToShow.forEach((data) => {
					let fields = [
						...frm.fields.map((f) => ({ ...f, variant: "field" })),
						...frm?.layout?.tabs?.map((t) => ({ ...t, variant: "tab" })),
					];
					const field = fields.find((f) => f.df.fieldname == data.field_name);
					if (!field) return;

					const field_section = $(`
                        <div class="field-comment-section" style="margin-bottom: 25px; padding: 15px; border-radius: 12px; border: none; box-shadow: none;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                <h5 style="margin: 0; font-size: 15px;">
                                  ${data.field_label || data.field_name}
                                  ${
										field.tab && field.tab.df && field.tab.df.label
											? `<span style="color: #888; font-size: 12px; font-weight: 400;">(${field.tab.df.label})</span>`
											: ""
									}
                                </h5>
                                <div class="status-pill-container" style="margin-left: auto;">
                                    ${renderStatusPill(data.status || "Open")}
                                </div>
                            </div>
                            <div class="field-comments"></div>
                            <div class="comment-input" style="margin-top: 15px; display: none;">
                                <div style="display: flex; align-items: center;">
                                    <div style="flex-grow: 1; display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 20px; padding: 3px 6px; background-color: var(--control-bg); box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s ease;">
                                        <div class="comment-box" style="flex-grow: 1; min-height: 24px; margin-right: 8px; "></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `);

					let currentStatus = data.status || "Open";

					if (data.comments && data.comments.length > 0) {
						field_section.find(".status-pill-container").show();
						if (currentStatus === "Closed") {
							field_section
								.find(".status-pill")
								.css({ opacity: "0.7", cursor: "not-allowed" });
							field_section.find(".comment-input").hide();
						}
					}

					field_section.find(".status-pill").click((e) => {
						e.preventDefault();
						e.stopPropagation();
					});

					field_section.on("click", ".status-option", (e) => {
						e.preventDefault();
						const newStatus = $(e.target).data("status");
						const statusPill = field_section.find(".status-pill");

						check_comment_permissions().then((permissions) => {
							if (!permissions.includes("write")) {
								frappe.show_alert({
									message: __("You do not have permission to change status"),
									indicator: "red",
								});
								return;
							}
							if (!isValidStatusTransition(currentStatus, newStatus)) {
								const validNext = currentStatus === "Open" ? "Closed" : "Open";
								frappe.show_alert({
									message: __(
										`Status can only be changed from ${currentStatus} to ${validNext}`
									),
									indicator: "red",
								});
								return;
							}

							frappe.db
								.get_list("DocType Field Comment", {
									filters: {
										doctype_name: frm.doctype,
										docname: frm.docname,
										field_name: data.field_name,
									},
									fields: ["name"],
									limit: 1,
								})
								.then((comment_doc_list) => {
									if (comment_doc_list && comment_doc_list.length > 0) {
										frappe.db
											.set_value(
												"DocType Field Comment",
												comment_doc_list[0].name,
												"status",
												newStatus
											)
											.then(() => {
												currentStatus = newStatus;
												frappe.show_alert({
													message: __("Status updated successfully"),
													indicator: "green",
												});
												setTimeout(() => {
													updateTotalCommentCount(frm);
												}, 100);
												if (newStatus === "Closed") {
													field_section.find(".dropdown-menu").remove();
													statusPill
														.removeAttr("data-toggle")
														.removeAttr("aria-haspopup")
														.removeAttr("aria-expanded");
													statusPill.css({
														opacity: "0.7",
														cursor: "not-allowed",
													});
													field_section.find(".comment-input").hide();
												} else {
													statusPill.css({
														opacity: "1",
														cursor: "pointer",
													});
													field_section.find(".comment-input").show();
												}
												updateStatusPill(statusPill, newStatus);
												updateTotalCommentCount(frm);
												refreshSummaryContainer(frm);
											});
									}
								});
						});
					});

					if (!data.comments || data.comments.length === 0) {
						field_section.find(".field-comments").html(`
                            <div style="display: flex; justify-content: center; align-items: center; height: 100px;">
                                <div class="text-muted" style="text-align: center;">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-chat-square-text" viewBox="0 0 16 16" style="margin-bottom: 10px;">
                                        <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                                        <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                                    </svg>
                                    <div>No comments yet</div>
                                </div>
                            </div>
                        `);
					} else {
						const commentMap = {};
						data.comments.forEach((c) => (commentMap[c.name] = c));
						const sortedComments = data.comments.sort(
							(a, b) => new Date(a.creation_date) - new Date(b.creation_date)
						);
						sortedComments.forEach((c) => {
							field_section
								.find(".field-comments")
								.append(get_comment_html(c, commentMap));
						});
					}

					comments_list.append(field_section);
					if (currentStatus !== "Closed") {
						check_comment_permissions().then((permissions) => {
							if (permissions.includes("create")) {
								initializeCommentControl(
									field_section,
									data.field_name,
									field,
									get_comment_html
								);
								field_section.find(".comment-input").show();
							}
						});
					}
				});

				// Add comment icons to each field (but NOT for NGO users)
				if (!isExternalUser()) {
					[
						...frm.fields.map((f) => ({ ...f, variant: "field" })),
						...frm?.layout?.tabs?.map((t) => ({ ...t, variant: "tab" })),
					].forEach((f) => {
						const field = f;
						const fieldname = f?.df?.fieldname || "details_tab";
						if (!field || !field.df) return;
						const selector = field?.label_area || field?.tab_link || field?.head;
						if (!selector) return;
						if (
							field.df.read_only ||
							["Column Break", "HTML", "Button"].includes(field.df.fieldtype)
						)
							return;

						if (selector && !$(selector).find(".field-comment-icon").length) {
							const count = commentCountCache[fieldname] || 0;
							const comment_icon = $(`
                                <div class="field-comment-icon" style="display: none; position: absolute; right: -30px; top: -2px; z-index: 10;">
                                    <button class="btn" style="padding: 2px 8px; position: relative;" tabindex="-1" type="button">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-chat" viewBox="0 0 16 16">
                                            <path d="M2.678 11.894a1 1 0 0 1 .287.801 10.97 10.97 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8.06 8.06 0 0 0 8 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105z"/>
                                        </svg>
                                        <span class="comment-count-badge" style="position: absolute; top: -4px; right: -8px; background: ${
											count > 0 ? primaryColor : "#e0e0e0"
										}; color: ${
								count > 0 ? "#fff" : "#666"
							}; border-radius: 50%; min-width: 16px; height: 16px; font-size: 10px; font-weight: 600; display: flex !important; align-items: center; justify-content: center; padding: 0 4px; box-shadow: ${
								count > 0
									? "0 2px 6px rgba(0,0,0,0.2)"
									: "0 1px 3px rgba(0,0,0,0.1)"
							}; border: 1.5px solid #fff; z-index: 9999; opacity: ${
								count > 0 ? 1 : 0.9
							}; transition: all 0.2s ease; transform-origin: center; transform: ${
								count > 0 ? "scale(1)" : "scale(0.9)"
							};">${count}</span>
                                    </button>
                                </div>
                            `);
							$(selector).css("position", "relative");
							$(selector).append(comment_icon);
							$(field.$wrapper).hover(
								function () {
									comment_icon.show();
								},
								function () {
									comment_icon.hide();
								}
							);
							comment_icon.find("button").on("click", function (e) {
								e.preventDefault();
								e.stopPropagation();
								$(".field-comments-sidebar").show();
								$(".field-comments-sidebar")[0].offsetHeight;
								$(".field-comments-sidebar").css("right", "0");
								current_field_context = {
									fieldName: fieldname,
									field: field,
									frm: frm,
								};
								load_field_comments(fieldname, field, frm).then(() => {
									refreshSummaryContainer(frm);
								});
							});
							comment_icon.find("button").on("keydown keyup keypress", function (e) {
								e.preventDefault();
								e.stopPropagation();
								return false;
							});
						} else {
							const commentCountBadge = $(selector).find(".comment-count-badge");
							if (commentCountBadge.length) {
								const count = commentCountCache[fieldname] || 0;
								commentCountBadge.text(count);
								commentCountBadge.css({
									background: count > 0 ? primaryColor : "#e0e0e0",
									color: count > 0 ? "#fff" : "#666",
									"box-shadow":
										count > 0
											? "0 2px 6px rgba(0,0,0,0.2)"
											: "0 1px 3px rgba(0,0,0,0.1)",
									opacity: count > 0 ? 1 : 0.9,
									transform: count > 0 ? "scale(1)" : "scale(0.9)",
								});
							}
						}
					});
				} else {
					[
						...frm.fields.map((f) => ({ ...f, variant: "field" })),
						...frm?.layout?.tabs?.map((t) => ({ ...t, variant: "tab" })),
					].forEach((f) => {
						const field = f;
						const fieldname = f?.df?.fieldname || "details_tab";
						if (!field || !field.df) return;
						const selector = field?.label_area || field?.tab_link || field?.head;
						if (!selector) return;
						const existingIcon = $(selector).find(".field-comment-icon");
						if (existingIcon.length) existingIcon.remove();
					});
				}

				initializeDropdowns();
				// Bottom spacer so last comment isn't flush against screen edge
				comments_list.find(".bottom-spacer").remove();
				comments_list.append('<div class="bottom-spacer" style="height: 40px;"></div>');
				resolve();
			},
			error: function (err) {
				console.error("Error loading all comments:", err);
				reject(err);
			},
		});
	});
}

function initializeCommentControl(field_section, fieldName, field, get_comment_html) {
	const commentBox = field_section.find(".comment-box")[0];
	let control;

	control = frappe.ui.form.make_control({
		parent: $(commentBox),
		df: {
			fieldtype: "Comment",
			fieldname: "comment",
			placeholder: __("Type your message...Use @ to mention someone"),
		},
		render_input: true,
		only_input: true,
		enable_mentions: true,
	});

	$(commentBox).find(".avatar-frame.standard-image").css("min-width", "33px");
	$(commentBox).find('[data-fieldtype="Comment"]').css("max-width", "252px");
	$(commentBox).find(".comment-input-header").remove();
	$(commentBox).closest(".comment-input").css({ margin: "0", padding: "0" });
	$(commentBox).closest(".comment-box").css({ margin: "0", padding: "0" });

	// ─── CHECKBOXES + BUTTON: stacked layout ─────────────────────────
	setTimeout(() => {
		const commentButton = $(commentBox).find(".btn-comment");
		if (commentButton.length) {
			// Detach the button from wherever Frappe placed it
			commentButton.detach();

			// Build footer: single row with all checkboxes + button row
			const footer = $(`
				<div class="comment-action-container" style="margin-top: 8px; padding: 0 4px;">
					<div class="comment-rows-wrap" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; overflow: hidden;"></div>
					<div style="display: flex; justify-content: flex-end;"></div>
				</div>
			`);

			const rowsWrap = footer.find(".comment-rows-wrap");
			const buttonRow = footer.find("div:last-child");

			if (!isExternalUser()) {
				rowsWrap.append(`
					<div style="display: flex; align-items: center; gap: 6px;">
						<input type="checkbox" id="new_comment_summary_${fieldName}" class="summary-checkbox" style="margin: 0; width: 14px; height: 14px; cursor: pointer;">
						<label for="new_comment_summary_${fieldName}" style="font-size: 11px; color: var(--text-muted); cursor: pointer; margin: 0; font-weight: 500; user-select: none; white-space: nowrap;">Mark as Summary</label>
					</div>
					<span style="font-size: 11px; color: var(--text-muted); font-weight: 900; white-space: nowrap;">Show to :</span>
					<div style="display: flex; align-items: center; gap: 5px;">
						<input type="checkbox" id="new_comment_external_${fieldName}" class="external-checkbox" style="margin: 0; width: 14px; height: 14px; cursor: pointer;">
						<label for="new_comment_external_${fieldName}" style="font-size: 11px; color: var(--text-muted); cursor: pointer; margin: 0; font-weight: 500; user-select: none; white-space: nowrap;">NGO</label>
					</div>
					<div style="display: flex; align-items: center; gap: 5px;">
						<input type="checkbox" id="new_comment_vendor_${fieldName}" class="vendor-checkbox" style="margin: 0; width: 14px; height: 14px; cursor: pointer;">
						<label for="new_comment_vendor_${fieldName}" style="font-size: 11px; color: var(--text-muted); cursor: pointer; margin: 0; font-weight: 500; user-select: none; white-space: nowrap;">Vendor</label>
					</div>
				`);
			}

			// Re-style and place the Comment button
			commentButton.css({
				background: primaryColor,
				color: "#fff",
				border: "none",
				"border-radius": "6px",
				padding: "5px 18px",
				"font-size": "13px",
				"font-weight": "500",
				cursor: "pointer",
			});
			buttonRow.append(commentButton);

			// Append footer after the comment box
			$(commentBox).closest(".comment-input").find("div").first().after(footer);
		}
	}, 100);

	$(commentBox)
		.find(".btn-comment")
		.off("click")
		.on("click", () => {
			if (!control) return;
			const comment = control.get_value();
			if (!comment) return;

			// NGO users auto-mark as external; Vendor users auto-mark as vendor
			// Internal users use the checkboxes
			let isExternal = 0;
			let isVendor = 0;
			if (frappe.boot.user_team === "NGO") {
				isExternal = 1;
			} else if (frappe.boot.user_team === "Vendor") {
				isVendor = 1;
			} else {
				isExternal = $(`#new_comment_external_${fieldName}`).is(":checked") ? 1 : 0;
				isVendor = $(`#new_comment_vendor_${fieldName}`).is(":checked") ? 1 : 0;
			}

			// ─── read is_summary flag ─────────────────────────────────────────
			const isSummary = $(`#new_comment_summary_${fieldName}`).is(":checked") ? 1 : 0;

			const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
			const mentions = new Set();
			let match;
			while ((match = mentionRegex.exec(comment)) !== null) {
				mentions.add(match[1]);
			}

			frappe.call({
				method: "frappe_theme.api.save_field_comment",
				args: {
					doctype_name: field.frm.doctype,
					docname: field.frm.docname,
					field_name: fieldName,
					field_label: field.df.label || fieldName,
					comment_text: comment,
					is_external: isExternal,
					is_vendor: isVendor,
					is_summary: isSummary,
				},
				callback: function (response) {
					if (response.message) {
						const newCommentEntry = response.message;
						control.set_value("");
						$(`#new_comment_external_${fieldName}`).prop("checked", false);
						$(`#new_comment_vendor_${fieldName}`).prop("checked", false);
						$(`#new_comment_summary_${fieldName}`).prop("checked", false);

						frappe.show_alert({
							message: __("Comment added successfully"),
							indicator: "green",
						});
						field_section.find(".status-pill-container").show();

						if (mentions.size > 0) {
							Array.from(mentions).forEach((mention) => {
								frappe.call({
									method: "frappe_theme.api.send_mention_notification",
									args: {
										mentioned_user: mention,
										comment_doc: newCommentEntry.parent,
										doctype: field.frm.doctype,
										docname: field.frm.docname,
										field_name: fieldName,
										field_label: field.df.label || fieldName,
										comment: comment,
									},
								});
							});
						}

						const isAllCommentsView =
							$(".field-comments-sidebar").find(".comments-list").children().length >
							1;
						if (isAllCommentsView) {
							load_all_comments(field.frm).then(() => {
								updateTotalCommentCount(field.frm);
								refreshSummaryContainer(field.frm); // ─── NEW ───
							});
						} else {
							load_field_comments(fieldName, field, field.frm).then(() => {
								updateCommentCount(fieldName, field.frm);
								updateTotalCommentCount(field.frm);
								refreshSummaryContainer(field.frm); // ─── NEW ───
							});
						}

						setTimeout(() => {
							updateTotalCommentCount(field.frm);
							refreshSummaryContainer(field.frm); // ─── NEW ───
						}, 500);
					} else {
						console.error("Error saving comment:", response);
						frappe.show_alert({
							message: __("Error adding comment"),
							indicator: "red",
						});
					}
				},
			});
		});

	return control;
}

let commentCountCache = {};

function updateCommentCount(fieldName, frm) {
	const field = [
		...frm.fields.map((f) => ({ ...f, variant: "field" })),
		...frm?.layout?.tabs?.map((t) => ({ ...t, variant: "tab" })),
	].find((f) => f.df.fieldname == fieldName);
	let selector = field?.label_area || field?.tab_link || field?.head;
	const commentCountBadge = $(selector).find(".comment-count-badge");
	if (!commentCountBadge.length) return;

	if (commentCountCache[fieldName] !== undefined) {
		const count = commentCountCache[fieldName];
		commentCountBadge.text(count);
		commentCountBadge.css({
			display: "flex !important",
			visibility: "visible",
			opacity: count > 0 ? 1 : 0.9,
			transform: count > 0 ? "scale(1)" : "scale(0.9)",
			background: count > 0 ? primaryColor : "#e0e0e0",
			color: count > 0 ? "#fff" : "#666",
			boxShadow: count > 0 ? "0 2px 6px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.1)",
		});
		return;
	}

	frappe.call({
		method: "frappe_theme.api.get_all_field_comment_counts",
		args: { doctype_name: frm.doctype, docname: frm.docname },
		callback: function (r) {
			if (r.message) {
				commentCountCache = r.message;
				const count = r.message[fieldName] || 0;
				commentCountBadge.text(count);
				commentCountBadge.css({
					display: "flex !important",
					visibility: "visible",
					opacity: count > 0 ? 1 : 0.9,
					transform: count > 0 ? "scale(1)" : "scale(0.9)",
					background: count > 0 ? primaryColor : "#e0e0e0",
					color: count > 0 ? "#fff" : "#666",
					boxShadow:
						count > 0 ? "0 2px 6px rgba(0,0,0,0.2)" : "0 1px 3px rgba(0,0,0,0.1)",
				});
				updateTotalCommentCount(frm);
			}
		},
	});
}

function setupFieldComments(frm) {
	if (!frm.is_new()) {
		if (!frm.doc || !frm.doc.doctype) return;
		if (frappe.boot.my_theme && frappe.boot.my_theme.hide_fields_comment) return;

		meta = frappe.get_meta(frm.doc.doctype);
		let is_core_module = ["Core", "Website", "Integrations", "Automation"].includes(
			meta?.module
		);
		let is_core_doctype = [
			"Comment",
			"DocType Field Comment",
			"Workflow",
			"Notification",
			"Notification Log",
		].includes(meta?.name);
		if (is_core_module || is_core_doctype) return;

		check_comment_permissions().then((permissions) => {
			if (!permissions.includes("read")) return;

			const lightPrimaryColor = getLightColor(primaryColor);
			const lighterPrimaryColor = getLighterColor(primaryColor);

			if (!$(".field-comments-sidebar").length) {
				const comment_sidebar = $(`
                    <div class="field-comments-sidebar" style="display: none; position: fixed; right: -400px; top: 48px; width: 400px; height: calc(100vh - 48px); background: var(--fg-color); box-shadow: -2px 0 8px rgba(0,0,0,0.1); z-index: 100; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);">
                        <div style="padding: 15px; border-bottom: none;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h5 style="margin: 0; font-size: 18px; font-weight: 600;">Comments</h5>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn btn-default btn-sm refresh-comments" style="padding: 4px 8px;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" style="vertical-align: middle;" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16">
                                            <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                                        </svg>
                                    </button>
                                    <button class="btn btn-default btn-sm close-comments" style="padding: 4px 8px;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" style="vertical-align: middle;" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
                                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- ─── Summary Container (global sidebar only) ── -->
                        <div class="comments-summary-container" style="margin: 0 15px 10px 15px; border-radius: 10px; background: var(--bg-color); border: 1px solid var(--border-color);">
                            <!-- Count pills row -->
                            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 14px 6px 14px; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; background: #EEF2FF; border: 1px solid #c7d0f8;">
                                    <span style="width: 7px; height: 7px; border-radius: 50%; background: #3b5bdb; display: inline-block;"></span>
                                    <span style="font-size: 12px; color: #3b5bdb; font-weight: 500;">Total</span>
                                    <span class="summary-count-total" style="font-size: 12px; color: #3b5bdb; font-weight: 700;">0</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; background: #FDEAEA; border: 1px solid #f5c6c6;">
                                    <span style="width: 7px; height: 7px; border-radius: 50%; background: #D32F2F; display: inline-block;"></span>
                                    <span style="font-size: 12px; color: #D32F2F; font-weight: 500;">Open</span>
                                    <span class="summary-count-open" style="font-size: 12px; color: #D32F2F; font-weight: 700;">0</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; background: #E6F4EA; border: 1px solid #b7dfbf;">
                                    <span style="width: 7px; height: 7px; border-radius: 50%; background: #218838; display: inline-block;"></span>
                                    <span style="font-size: 12px; color: #218838; font-weight: 500;">Closed</span>
                                    <span class="summary-count-closed" style="font-size: 12px; color: #218838; font-weight: 700;">0</span>
                                </div>
                            </div>
                            <div class="summary-body-wrap" style="display: none;">
                                <!-- Divider + Summary label -->
                                <div style="display: flex; align-items: center; gap: 6px; padding: 4px 14px 4px 14px; border-top: 1px solid var(--border-color);">
                                    <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">📌 Summary</span>
                                </div>
                                <div style="padding: 2px 14px 10px 14px;">
                                    <div class="summary-comments-list"></div>
                                </div>
                            </div>
                        </div>
                        <!-- ──────────────────────────────────────────────────────── -->

                        <div class="comments-container" style="height: calc(100vh - 165px); overflow-y: auto; padding: 15px 15px 40px 15px;">
                            <div class="comments-list"></div>
                        </div>
                    </div>
                `);

				$("body").append(comment_sidebar);

				comment_sidebar.find(".close-comments").click(() => {
					comment_sidebar.css("right", "-400px");
					setTimeout(() => {
						comment_sidebar.hide();
					}, 400);
				});

				comment_sidebar.find(".refresh-comments").click(() => {
					if (!cur_frm) return;
					const refreshBtn = comment_sidebar.find(".refresh-comments");
					refreshBtn.prop("disabled", true);
					refreshBtn.find("svg").css("animation", "spin 1s linear infinite");

					let loadCommentsPromise;
					if (current_field_context) {
						loadCommentsPromise = load_field_comments(
							current_field_context.fieldName,
							current_field_context.field,
							current_field_context.frm
						);
					} else {
						loadCommentsPromise = load_all_comments(frm);
					}

					loadCommentsPromise
						.then(() => {
							refreshBtn.prop("disabled", false);
							refreshBtn.find("svg").css("animation", "");
							updateTotalCommentCount(frm);
							refreshSummaryContainer(frm); // ─── NEW ───
							frappe.show_alert({
								message: __("Comments refreshed"),
								indicator: "green",
							});
						})
						.catch(() => {
							refreshBtn.prop("disabled", false);
							refreshBtn.find("svg").css("animation", "");
							frappe.show_alert({
								message: __("Error refreshing comments"),
								indicator: "red",
							});
						});
				});
			}

			if (
				permissions.includes("read") &&
				!frm.page.sidebar.find(".field-comments-btn").length
			) {
				frappe.call({
					method: "frappe_theme.api.get_total_open_resolved_comment_count",
					args: { doctype_name: frm.doctype, docname: frm.docname },
					callback: function (r) {
						let count = r.message || 0;
						let label =
							count > 0
								? __("Comments") + ` <span class="comments-badge">${count}</span>`
								: __("Comments");
						let btn = frm.add_custom_button(label, function () {
							$(".field-comments-sidebar").show();
							$(".field-comments-sidebar")[0].offsetHeight;
							$(".field-comments-sidebar").css("right", "0");
							current_field_context = null;
							load_all_comments(frm).then(() => {
								refreshSummaryContainer(frm);
							});
						});
						$(btn).find(".comments-badge").css({
							background: primaryColor,
							color: "#fff",
							"border-radius": "10px",
							padding: "3px 6px",
							"font-size": "10px",
							"margin-left": "2px",
						});
						btn.addClass("field-comments-btn");
						frm.commentsButton = btn;
					},
				});
			}

			frappe.call({
				method: "frappe_theme.api.get_all_field_comment_counts",
				args: { doctype_name: frm.doctype, docname: frm.docname },
				callback: function (r) {
					if (r.message) {
						commentCountCache = r.message;

						if (!isExternalUser()) {
							[
								...frm.fields.map((f) => ({ ...f, variant: "field" })),
								...frm?.layout?.tabs?.map((t) => ({ ...t, variant: "tab" })),
							].forEach((f) => {
								const field = f;
								const fieldname = f?.df?.fieldname || "details_tab";
								if (!field || !field.df) return;
								const selector =
									field?.label_area || field?.tab_link || field?.head;
								if (!selector) return;
								if (
									field.df.read_only ||
									["Column Break", "HTML", "Button"].includes(field.df.fieldtype)
								)
									return;

								if (selector && !$(selector).find(".field-comment-icon").length) {
									const count = commentCountCache[fieldname] || 0;
									const comment_icon = $(`
                                        <div class="field-comment-icon" style="display: none;position: absolute; right: ${
											field.variant == "field" ? "-20px" : "-10px"
										}; top: ${
										field.variant == "field" ? "-2px" : "7px"
									}; z-index: 10;">
                                            <button class="btn" style="padding: 2px 8px; position: relative;" tabindex="-1" type="button">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-chat" viewBox="0 0 16 16">
                                                    <path d="M2.678 11.894a1 1 0 0 1 .287.801 10.97 10.97 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8.06 8.06 0 0 0 8 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105z"/>
                                                </svg>
                                                <span class="comment-count-badge" style="position: absolute; top: -4px; right: -8px; background: ${
													count > 0 ? primaryColor : "#e0e0e0"
												}; color: ${
										count > 0 ? "#fff" : "#666"
									}; border-radius: 50%; min-width: 16px; height: 16px; font-size: 10px; font-weight: 600; display: flex !important; align-items: center; justify-content: center; padding: 0 4px; box-shadow: ${
										count > 0
											? "0 2px 6px rgba(0,0,0,0.2)"
											: "0 1px 3px rgba(0,0,0,0.1)"
									}; border: 1.5px solid #fff; z-index: 9999; opacity: ${
										count > 0 ? 1 : 0.9
									}; transition: all 0.2s ease; transform-origin: center; transform: ${
										count > 0 ? "scale(1)" : "scale(0.9)"
									};">${count}</span>
                                            </button>
                                        </div>
                                    `);

									$(selector).css("position", "relative");
									$(selector).css("cursor", "pointer");
									$(selector).append(comment_icon);

									$(selector).hover(
										function () {
											comment_icon.show();
										},
										function () {
											comment_icon.hide();
										}
									);

									comment_icon.find("button").on("click", function (e) {
										e.preventDefault();
										e.stopPropagation();
										$(".field-comments-sidebar").show();
										$(".field-comments-sidebar")[0].offsetHeight;
										$(".field-comments-sidebar").css("right", "0");
										current_field_context = {
											fieldName: fieldname,
											field: field,
											frm: frm,
										};
										load_field_comments(fieldname, field, frm).then(() => {
											refreshSummaryContainer(frm);
										});
									});

									comment_icon
										.find("button")
										.on("keydown keyup keypress", function (e) {
											e.preventDefault();
											e.stopPropagation();
											return false;
										});
								} else {
									const commentCountBadge =
										$(selector).find(".comment-count-badge");
									if (commentCountBadge.length) {
										const count = commentCountCache[fieldname] || 0;
										commentCountBadge.text(count);
										commentCountBadge.css({
											background: count > 0 ? primaryColor : "#e0e0e0",
											color: count > 0 ? "#fff" : "#666",
											"box-shadow":
												count > 0
													? "0 2px 6px rgba(0,0,0,0.2)"
													: "0 1px 3px rgba(0,0,0,0.1)",
											opacity: count > 0 ? 1 : 0.9,
											transform: count > 0 ? "scale(1)" : "scale(0.9)",
										});
									}
								}
							});
						} else {
							[
								...frm.fields.map((f) => ({ ...f, variant: "field" })),
								...frm?.layout?.tabs?.map((t) => ({ ...t, variant: "tab" })),
							].forEach((f) => {
								const field = f;
								const fieldname = f?.df?.fieldname || "details_tab";
								if (!field || !field.df) return;
								const selector =
									field?.label_area || field?.tab_link || field?.head;
								if (!selector) return;
								const existingIcon = $(selector).find(".field-comment-icon");
								if (existingIcon.length) existingIcon.remove();
							});
						}
					}
					updateTotalCommentCount(frm);
				},
			});
		});
	}
}

frappe.ui.form.on("*", {
	refresh: function (frm) {
		setupFieldComments(frm);
	},
});

function getStatusPillStyle(status) {
	if (status === "Closed") return { dot: "#218838", bg: "#E6F4EA", text: "#218838" };
	if (status === "Open") return { dot: "#D32F2F", bg: "#FDEAEA", text: "#D32F2F" };
	return { dot: "#444", bg: "#F2F2F2", text: "#444" };
}

function renderStatusPill(status) {
	const style = getStatusPillStyle(status);
	const isClosed = status === "Closed";

	// Only Open ↔ Closed — no Resolved
	const statusOptions = `
            <a class="dropdown-item status-option" data-status="Open" href="#">Open</a>
            <a class="dropdown-item status-option" data-status="Closed" href="#">Closed</a>
        `;

	return `
        <div class="status-pill-container" style="position: relative;">
            <button class="status-pill" type="button"
                ${
					isClosed
						? ""
						: 'data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"'
				}
                style="display: inline-flex; align-items: center; gap: 6px; padding: 2px 18px 2px 12px; border-radius: 999px; background: ${
					style.bg
				} !important; color: ${
		style.text
	} !important; font-weight: 500 !important; font-size: 13px !important; line-height: 1.2; cursor: ${
		isClosed ? "not-allowed" : "pointer"
	}; border: none; margin: 0; opacity: ${isClosed ? "0.7" : "1"}; box-shadow: none;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${
					style.dot
				}; margin-right: 6px;"></span>
                ${status}
            </button>
            ${
				!isClosed
					? `
                <div class="dropdown-menu" style="min-width: 120px; padding: 8px 0; margin: 0; border: 1px solid #E0E0E0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    ${statusOptions}
                </div>
            `
					: ""
			}
        </div>
    `;
}

function initializeDropdowns() {
	check_comment_permissions().then((permissions) => {
		if (permissions.includes("write")) {
			$(".status-pill").each(function () {
				$(this).dropdown();
			});
		} else {
			$(".status-pill").each(function () {
				$(this)
					.removeAttr("data-toggle")
					.removeAttr("aria-haspopup")
					.removeAttr("aria-expanded")
					.css("cursor", "default");
			});
			$(".dropdown-menu").remove();
		}
	});
}

function updateStatusPill(element, newStatus) {
	const style = getStatusPillStyle(newStatus);
	const isClosed = newStatus === "Closed";

	check_comment_permissions().then((permissions) => {
		const canShowDropdown = permissions.includes("write");
		// Only Open ↔ Closed — no Resolved
		const statusOptions = `
                <a class="dropdown-item status-option" data-status="Open" href="#">Open</a>
                <a class="dropdown-item status-option" data-status="Closed" href="#">Closed</a>
            `;

		element.attr(
			"style",
			`display: inline-flex; align-items: center; gap: 6px; padding: 2px 18px 2px 12px; border-radius: 999px; background: ${
				style.bg
			} !important; color: ${
				style.text
			} !important; font-weight: 500 !important; font-size: 13px !important; line-height: 1.2; cursor: ${
				isClosed ? "not-allowed" : canShowDropdown ? "pointer" : "default"
			}; border: none; margin: 0; opacity: ${isClosed ? "0.7" : "1"}; box-shadow: none;`
		);

		element.html(`
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${style.dot}; margin-right: 6px;"></span>
            ${newStatus}
        `);

		if (!isClosed && canShowDropdown) {
			element
				.attr("data-toggle", "dropdown")
				.attr("aria-haspopup", "true")
				.attr("aria-expanded", "false");
		} else {
			element
				.removeAttr("data-toggle")
				.removeAttr("aria-haspopup")
				.removeAttr("aria-expanded");
		}

		let dropdownMenu = element.siblings(".dropdown-menu");
		if (!isClosed && canShowDropdown) {
			if (dropdownMenu.length === 0) {
				dropdownMenu = $(
					`<div class="dropdown-menu" style="min-width: 120px; padding: 8px 0; margin: 0; border: 1px solid #E0E0E0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">${statusOptions}</div>`
				);
				element.parent().append(dropdownMenu);
			} else {
				dropdownMenu.html(statusOptions);
			}
		} else {
			dropdownMenu.remove();
		}

		if (!isClosed && canShowDropdown) element.dropdown();
	});
}

frappe.router.on("change", function () {
	$(".field-comments-sidebar").css("right", "-400px");
	setTimeout(() => {
		$(".field-comments-sidebar").hide();
	}, 400);
});

function isValidStatusTransition(currentStatus, newStatus) {
	const validTransitions = {
		Open: ["Closed"],
		Closed: ["Open"],
	};
	return validTransitions[currentStatus]?.includes(newStatus) || false;
}

function updateExternalFlag(commentName, isExternal) {
	frappe.call({
		method: "frappe_theme.api.update_comment_external_flag",
		args: { comment_name: commentName, is_external: isExternal ? 1 : 0 },
		callback: function (response) {
			if (response.message) {
				frappe.show_alert({
					message: __("External flag updated successfully"),
					indicator: "green",
				});
			} else {
				frappe.show_alert({
					message: __("Error updating external flag"),
					indicator: "red",
				});
				const checkbox = document.getElementById(`external_${commentName}`);
				if (checkbox) checkbox.checked = !isExternal;
			}
		},
		error: function () {
			frappe.show_alert({ message: __("Error updating external flag"), indicator: "red" });
			const checkbox = document.getElementById(`external_${commentName}`);
			if (checkbox) checkbox.checked = !isExternal;
		},
	});
}

$(document).ready(function () {
	const style = document.createElement("style");
	style.textContent = `
        .external-checkbox {
            appearance: none; -webkit-appearance: none; -moz-appearance: none;
            width: 16px !important; height: 16px !important;
            border: 2px solid #cbd5e0; border-radius: 3px; background-color: white;
            cursor: pointer; position: relative; transition: all 0.2s ease; margin: 0 !important;
        }
        .external-checkbox:checked { background-color: #007bff; border-color: #007bff; }
        .external-checkbox:checked::after { content: '✓'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 10px; font-weight: bold; line-height: 1; }
        .external-checkbox:hover { border-color: #007bff; box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1); }
        .external-checkbox:focus { outline: none; border-color: #007bff; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2); }
        .summary-checkbox {
            appearance: none; -webkit-appearance: none; -moz-appearance: none;
            width: 16px !important; height: 16px !important;
            border: 2px solid #ffc107; border-radius: 3px; background-color: white;
            cursor: pointer; position: relative; transition: all 0.2s ease; margin: 0 !important;
        }
        .summary-checkbox:checked { background-color: #ffc107; border-color: #ffc107; }
        .summary-checkbox:checked::after { content: '✓'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 10px; font-weight: bold; line-height: 1; }
        .summary-checkbox:hover { border-color: #ffc107; box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.2); }
        .summary-checkbox:focus { outline: none; border-color: #ffc107; box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.3); }
        .vendor-checkbox {
            appearance: none; -webkit-appearance: none; -moz-appearance: none;
            width: 16px !important; height: 16px !important;
            border: 2px solid #fd7e14; border-radius: 3px; background-color: white;
            cursor: pointer; position: relative; transition: all 0.2s ease; margin: 0 !important;
        }
        .vendor-checkbox:checked { background-color: #fd7e14; border-color: #fd7e14; }
        .vendor-checkbox:checked::after { content: '✓'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 10px; font-weight: bold; line-height: 1; }
        .vendor-checkbox:hover { border-color: #fd7e14; box-shadow: 0 0 0 2px rgba(253, 126, 20, 0.2); }
        .vendor-checkbox:focus { outline: none; border-color: #fd7e14; box-shadow: 0 0 0 3px rgba(253, 126, 20, 0.3); }
        .comment-item .external-checkbox-container { transition: all 0.2s ease; }
        .comment-item .external-checkbox-container:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    `;
	document.head.appendChild(style);
});

let totalCommentCountUpdateTimeout = null;

function updateTotalCommentCount(frm) {
	if (totalCommentCountUpdateTimeout) clearTimeout(totalCommentCountUpdateTimeout);
	totalCommentCountUpdateTimeout = setTimeout(() => {
		frappe.call({
			method: "frappe_theme.api.get_total_open_resolved_comment_count",
			args: { doctype_name: frm.doctype, docname: frm.docname },
			callback: function (r) {
				let count = r.message || 0;
				let commentsBtn = frm.commentsButton;
				if (!commentsBtn || !commentsBtn.length) {
					commentsBtn =
						frm.page.sidebar.find(".field-comments-btn") ||
						frm.page.sidebar.find('button:contains("Comments")') ||
						$('button:contains("Comments")').filter(function () {
							return $(this).closest(".form-sidebar").length > 0;
						});
				}
				if (commentsBtn && commentsBtn.length) {
					let label =
						count > 0
							? __("Comments") + ` <span class="comments-badge">${count}</span>`
							: __("Comments");
					commentsBtn.html(label);
					commentsBtn.find(".comments-badge").css({
						background: primaryColor,
						color: "#fff",
						"border-radius": "10px",
						padding: "2px 2px",
						"font-size": "11px",
						"margin-left": "2px",
					});
				}
			},
			error: function (err) {
				console.error("Error updating total comment count:", err);
			},
		});
	}, 300);
}
