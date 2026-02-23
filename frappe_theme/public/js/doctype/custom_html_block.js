frappe.ui.form.on("Custom HTML Block", {
	refresh(frm) {
		frm.set_query("custom_filter_report", () => ({
			filters: [["Report", "custom_is_filter", "=", 1]],
		}));
		frm.set_query("custom_data_report", () => ({
			filters: [["Report", "custom_is_filter", "!=", 1]],
		}));

		handle_collapse(frm);
		frm._resume_from = null;
		frm._chat_minimized = frm._chat_minimized || false;

		if (frm.doc.custom_is_dashboard && !frm.is_new()) {
			render_ai_chat(frm);
		}
	},
	custom_is_dashboard(frm) {
		handle_collapse(frm);
		if (frm.doc.custom_is_dashboard && !frm.is_new()) {
			render_ai_chat(frm);
		} else {
			cleanup_chat();
			show_native_fields(frm);
		}
	},
	before_route_change(frm) {
		cleanup_chat();
	},
});

function cleanup_chat() {
	$("body > .ai-float-chat").remove();
	// Remove any lingering realtime listeners for AI
	["ai_block_start", "ai_block_result", "ai_block_error"].forEach((evt) => {
		frappe.realtime.off(evt);
	});
}

function handle_collapse(frm) {
	["html_section", "javascript_section", "css_section", "roles_section"].forEach((f) => {
		if (frm.fields_dict[f]) frm.fields_dict[f].collapse(frm.doc.custom_is_dashboard);
	});
}

const NATIVE_FIELDS = [
	"custom_provider",
	"custom_ai_prompt",
	"custom_ask_ai",
	"custom_filter_report",
	"custom_data_report",
];

function hide_native_fields(frm) {
	NATIVE_FIELDS.forEach((f) => {
		if (frm.fields_dict[f]) {
			frm.fields_dict[f].$wrapper.closest(".frappe-control").hide();
		}
	});
	frm.fields_dict.custom_filter_report?.$wrapper.closest(".form-section").hide();
}

function show_native_fields(frm) {
	NATIVE_FIELDS.forEach((f) => {
		if (frm.fields_dict[f]) {
			frm.fields_dict[f].$wrapper.closest(".frappe-control").show();
		}
	});
	frm.fields_dict.custom_filter_report?.$wrapper.closest(".form-section").show();
}

// ─── CSS ───────────────────────────────────────────────────────────────────────
const CHAT_CSS = `
/* ── Float Shell ─────────────────────────── */
.ai-float-chat {
	position:fixed; bottom:24px; right:24px; z-index:1060;
	width:520px; max-height:calc(100vh - 48px);
	display:flex; flex-direction:column;
	border-radius:16px; overflow:hidden;
	background:var(--fg-color);
	box-shadow:0 12px 48px rgba(130,33,34,0.18), 0 2px 12px rgba(0,0,0,0.08);
	transition:all 0.35s cubic-bezier(0.4,0,0.2,1);
	font-family:var(--font-stack);
}
.ai-float-chat.minimized {
	max-height:48px; border-radius:24px; width:auto; min-width:0;
	cursor:pointer; box-shadow:0 4px 24px rgba(130,33,34,0.22);
}
.ai-float-chat.minimized:hover {
	box-shadow:0 6px 32px rgba(130,33,34,0.3);
	transform:translateY(-2px);
}
.ai-float-chat.minimized .ai-fc-body,
.ai-float-chat.minimized .ai-fc-input-area,
.ai-float-chat.minimized .ai-fc-resume-bar,
.ai-float-chat.minimized .ai-fc-config { display:none !important; }

/* ── Header ──────────────────────────────── */
.ai-fc-header {
	display:flex; align-items:center; justify-content:space-between;
	padding:12px 18px;
	background:linear-gradient(135deg, #822122 0%, #6b1a1b 100%);
	color:white; flex-shrink:0; cursor:pointer; user-select:none;
}
.ai-fc-header-left { display:flex; align-items:center; gap:10px; }
.ai-fc-header-dot {
	width:8px; height:8px; border-radius:50%; background:#f0abab;
	box-shadow:0 0 6px rgba(240,171,171,0.5);
	animation:ai-pulse 2s infinite;
}
@keyframes ai-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
.ai-fc-header-title { font-weight:600; font-size:13.5px; letter-spacing:0.01em; white-space:nowrap; }
.ai-fc-header-badge {
	background:rgba(255,255,255,0.18); font-size:10.5px; padding:2px 8px;
	border-radius:10px; font-weight:600; backdrop-filter:blur(4px);
}
.ai-fc-header-actions { display:flex; gap:3px; }
.ai-fc-header-actions button {
	background:rgba(255,255,255,0.12); border:none; color:rgba(255,255,255,0.85);
	width:28px; height:28px; border-radius:8px; cursor:pointer;
	display:flex; align-items:center; justify-content:center;
	font-size:12px; transition:all 0.2s;
}
.ai-fc-header-actions button:hover {
	background:rgba(255,255,255,0.25); color:white;
}

/* ── Config Panel (Reports) ──────────────── */
.ai-fc-config {
	border-bottom:1px solid var(--border-color); background:var(--subtle-fg);
}
.ai-fc-config.collapsed { display:none; }
.ai-fc-config-inner { padding:14px 18px; overflow:visible; }
.ai-fc-config-section { margin-bottom:12px; }
.ai-fc-config-section:last-child { margin-bottom:0; }
.ai-fc-config-label {
	font-size:11px; font-weight:600; color:#822122;
	text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;
}
.ai-fc-pills {
	display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px; min-height:4px;
}
.ai-fc-pill {
	display:inline-flex; align-items:center; gap:4px;
	background:#fdf2f2; border:1px solid #e8b4b4;
	padding:4px 10px; border-radius:8px; font-size:12px; font-weight:500;
	color:#822122; animation:ai-pill-in 0.2s ease;
}
@keyframes ai-pill-in { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
.ai-fc-pill .remove-pill {
	cursor:pointer; color:var(--text-muted); font-size:14px;
	line-height:1; margin-left:2px; transition:color 0.15s;
}
.ai-fc-pill .remove-pill:hover { color:var(--red-500); }
.ai-fc-link-input-wrap { position:relative; z-index:2; }
.ai-fc-config-section { position:relative; overflow:visible; }
.ai-fc-link-input {
	width:100%; padding:6px 10px; border:1px solid var(--border-color);
	border-radius:8px; font-size:12px; background:var(--fg-color);
	outline:none; color:var(--text-color);
}
.ai-fc-link-input:focus { border-color:#822122; }
.ai-fc-link-input::placeholder { color:var(--text-light); }
.ai-fc-suggestions {
	position:absolute; top:100%; left:0; right:0; z-index:20;
	background:var(--fg-color); border:1px solid var(--border-color);
	border-radius:8px; margin-top:4px; max-height:180px; overflow-y:auto;
	box-shadow:0 4px 16px rgba(0,0,0,0.12); display:none;
}
.ai-fc-suggestions.open { display:block; }
.ai-fc-suggestion {
	padding:8px 12px; font-size:12px; cursor:pointer; transition:background 0.1s;
}
.ai-fc-suggestion:hover { background:#fdf2f2; color:#822122; }
.ai-fc-suggestion:first-child { border-radius:8px 8px 0 0; }
.ai-fc-suggestion:last-child { border-radius:0 0 8px 8px; }

/* ── Messages ────────────────────────────── */
.ai-fc-body { flex:1; overflow:hidden; display:flex; flex-direction:column; min-height:0; }
.ai-fc-messages {
	flex:1; overflow-y:auto; padding:16px 18px; display:flex;
	flex-direction:column; gap:14px; scroll-behavior:smooth; min-height:0;
}
.ai-fc-empty {
	flex:1; display:flex; flex-direction:column; align-items:center;
	justify-content:center; color:var(--text-muted); text-align:center;
	gap:6px; padding:30px 0;
}
.ai-fc-empty-icon { font-size:36px; opacity:0.6; }
.ai-fc-empty-title { font-size:14px; font-weight:600; color:#822122; }
.ai-fc-empty-desc { font-size:12px; max-width:280px; line-height:1.5; }

/* ── Message Bubbles ─────────────────────── */
.ai-msg { display:flex; flex-direction:column; max-width:88%; animation:ai-fade-in 0.25s ease; }
@keyframes ai-fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
.ai-msg-user { align-self:flex-end; }
.ai-msg-assistant { align-self:flex-start; }
.ai-msg-meta {
	font-size:10px; color:var(--text-muted); margin-bottom:3px; padding:0 2px;
	display:flex; align-items:center; gap:5px;
}
.ai-msg-user .ai-msg-meta { justify-content:flex-end; }
.ai-msg-bubble-user {
	background:linear-gradient(135deg, #822122 0%, #9b2829 100%); color:white;
	padding:10px 14px; border-radius:14px 14px 4px 14px; font-size:12.5px;
	line-height:1.55; white-space:pre-wrap; word-break:break-word;
}
.ai-msg-bubble-ai {
	background:var(--fg-color); border:1px solid var(--border-color);
	padding:12px 14px; border-radius:14px 14px 14px 4px; font-size:12.5px; line-height:1.4;
	box-shadow:0 1px 2px rgba(0,0,0,0.03);
}
.ai-msg-status { display:flex; align-items:center; gap:6px; margin-bottom:8px; font-weight:500; font-size:12px; }
.ai-msg-prompt-ref {
	font-size:11px; color:var(--text-muted); font-style:italic;
	padding:6px 10px; margin-bottom:8px; border-left:2px solid #822122;
	background:var(--subtle-fg); border-radius:0 6px 6px 0;
	line-height:1.45; word-break:break-word;
}
.ai-msg-changed {
	font-size:10px; color:var(--text-muted); background:var(--subtle-fg);
	padding:3px 8px; border-radius:6px; display:inline-block; margin-bottom:8px;
}
.ai-msg-actions { display:flex; gap:5px; flex-wrap:wrap; }
.ai-msg-actions .btn {
	font-size:11px; padding:4px 10px; border-radius:8px; font-weight:500;
	display:inline-flex; align-items:center; gap:3px;
	border-color:#d4a0a0; color:#822122;
}
.ai-msg-actions .btn:hover { background:#fdf2f2; border-color:#822122; }
.ai-msg-loading {
	align-self:flex-start; display:flex; align-items:center; gap:8px;
	padding:10px 16px; background:var(--fg-color); border:1px solid var(--border-color);
	border-radius:14px; font-size:12px; color:var(--text-muted);
	animation:ai-fade-in 0.25s ease;
}
.ai-loading-text { display:flex; align-items:baseline; }
.ai-loading-status { font-weight:500; }
.ai-typing-dots { display:flex; gap:3px; }
.ai-typing-dots span {
	width:5px; height:5px; border-radius:50%; background:var(--text-muted);
	animation:ai-bounce 1.4s infinite ease-in-out both;
}
.ai-typing-dots span:nth-child(1) { animation-delay:-0.32s; }
.ai-typing-dots span:nth-child(2) { animation-delay:-0.16s; }
@keyframes ai-bounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }

/* ── Resume Bar ──────────────────────────── */
.ai-fc-resume-bar { flex-shrink:0; }
.ai-fc-resume-badge {
	display:flex; align-items:center; gap:6px; padding:7px 12px; margin:0 18px 8px;
	background:#fdf2f2; border:1px solid #e8b4b4; border-radius:8px;
	font-size:11px; color:#822122; font-weight:500;
}
.ai-fc-resume-badge .btn-xs { font-size:10px; padding:1px 6px; margin-left:auto; }

/* ── Input Area ──────────────────────────── */
.ai-fc-input-area {
	padding:12px 18px; border-top:1px solid var(--border-color);
	background:var(--fg-color); flex-shrink:0;
}
.ai-fc-input-row { display:flex; align-items:flex-end; gap:8px; }
.ai-fc-provider-select {
	font-size:11px; padding:7px 8px; border:1px solid var(--border-color);
	border-radius:8px; background:var(--fg-color); color:var(--text-color);
	cursor:pointer; min-width:90px; flex-shrink:0; height:36px;
}
.ai-fc-input-box {
	flex:1; display:flex; align-items:flex-end;
	border:1px solid var(--border-color); border-radius:10px;
	background:var(--control-bg); transition:border-color 0.2s; overflow:hidden;
}
.ai-fc-input-box:focus-within { border-color:#822122; }
.ai-fc-input-box textarea {
	flex:1; border:none; background:transparent; padding:8px 12px;
	font-size:12.5px; line-height:1.45; resize:none; outline:none;
	color:var(--text-color); max-height:100px; min-height:18px; font-family:inherit;
}
.ai-fc-send-btn {
	border:none; background:linear-gradient(135deg, #822122 0%, #9b2829 100%);
	color:white; width:34px; height:34px;
	border-radius:10px; cursor:pointer; display:flex; align-items:center;
	justify-content:center; flex-shrink:0; margin:2px; transition:all 0.15s;
}
.ai-fc-send-btn:hover { opacity:0.9; transform:scale(1.05); }
.ai-fc-send-btn:disabled { opacity:0.35; cursor:not-allowed; transform:none; }

/* ── Preview Dialog ──────────────────────── */
.fullscreen-preview .modal-dialog {
	width:100vw !important; max-width:100vw !important;
	height:100vh !important; margin:0 !important;
}
.fullscreen-preview .modal-content {
	height:100vh; border-radius:0; display:flex; flex-direction:column;
}
.fullscreen-preview .modal-body { flex:1; overflow:hidden; padding:12px 20px; }
.vp-tabs .vp-tab-bar { display:flex; gap:2px; margin-bottom:0; }
.vp-tabs .vp-tab-btn {
	padding:7px 16px; border:none; background:var(--subtle-fg); cursor:pointer;
	font-size:12px; font-weight:500; border-radius:6px 6px 0 0;
	color:var(--text-muted); transition:all 0.2s;
}
.vp-tabs .vp-tab-btn.active {
	background:var(--fg-color); color:#822122;
	box-shadow:0 -2px 4px rgba(130,33,34,0.08);
}
.vp-tabs .vp-panel { display:none; background:var(--fg-color); border-radius:0 8px 8px 8px; }
.vp-tabs .vp-panel.active { display:block; }
.vp-tabs pre {
	margin:0; padding:14px; height:calc(100vh - 180px); overflow:auto;
	font-size:11.5px; line-height:1.5; white-space:pre-wrap; word-break:break-word;
	background:var(--fg-color); color:var(--text-color);
}
.vp-tabs .vp-rendered { height:calc(100vh - 180px); overflow:auto; background:#f8fafc; }
.vp-tabs .vp-stats {
	padding:6px 14px; font-size:10px; color:var(--text-muted);
	border-top:1px solid var(--border-color); display:flex; gap:16px;
}
`;

// ─── RENDER CHAT ───────────────────────────────────────────────────────────────
function render_ai_chat(frm) {
	cleanup_chat();
	hide_native_fields(frm);

	let providerOptions = (frm.fields_dict.custom_provider?.df.options || "Anthropic\nOpenai")
		.split("\n")
		.filter(Boolean);
	let currentProvider = frm.doc.custom_provider || providerOptions[0];
	let providerOpts = providerOptions
		.map(
			(p) => `<option value="${p}" ${p === currentProvider ? "selected" : ""}>${p}</option>`,
		)
		.join("");

	let $chat = $(`
		<style>${CHAT_CSS}</style>
		<div class="ai-float-chat ${frm._chat_minimized ? "minimized" : ""}">
			<div class="ai-fc-header">
				<div class="ai-fc-header-left">
					<span class="ai-fc-header-dot"></span>
					<span class="ai-fc-header-title">AI Dashboard Builder</span>
					<span class="ai-fc-header-badge ai-fc-msg-count" style="display:none;">0</span>
				</div>
				<div class="ai-fc-header-actions">
					<button class="ai-fc-btn-config" title="Configure Reports">
						<i class="fa fa-cog"></i>
					</button>
					<button class="ai-fc-btn-rollback" title="Rollback" style="display:none;">
						<i class="fa fa-undo"></i>
					</button>
					<button class="ai-fc-btn-minimize" title="Minimize">
						<i class="fa ${frm._chat_minimized ? "fa-chevron-up" : "fa-chevron-down"}"></i>
					</button>
				</div>
			</div>
			<div class="ai-fc-config collapsed">
				<div class="ai-fc-config-inner">
					<div class="ai-fc-config-section">
						<div class="ai-fc-config-label">Filter Reports</div>
						<div class="ai-fc-pills" data-report-type="filter"></div>
						<div class="ai-fc-link-input-wrap">
							<input class="ai-fc-link-input" data-report-type="filter"
								placeholder="Type to add filter report..." autocomplete="off" />
							<div class="ai-fc-suggestions" data-report-type="filter"></div>
						</div>
					</div>
					<div class="ai-fc-config-section">
						<div class="ai-fc-config-label">Data Reports</div>
						<div class="ai-fc-pills" data-report-type="data"></div>
						<div class="ai-fc-link-input-wrap">
							<input class="ai-fc-link-input" data-report-type="data"
								placeholder="Type to add data report..." autocomplete="off" />
							<div class="ai-fc-suggestions" data-report-type="data"></div>
						</div>
					</div>
				</div>
			</div>
			<div class="ai-fc-body">
				<div class="ai-fc-messages">
					<div class="ai-fc-empty">
						<div class="ai-fc-empty-icon">&#10024;</div>
						<div class="ai-fc-empty-title">Start building your dashboard</div>
						<div class="ai-fc-empty-desc">
							Describe what you want and AI will generate it.
							Use <b>&#9881;</b> to configure reports first.
						</div>
					</div>
				</div>
			</div>
			<div class="ai-fc-resume-bar"></div>
			<div class="ai-fc-input-area">
				<div class="ai-fc-input-row">
					<select class="ai-fc-provider-select">${providerOpts}</select>
					<div class="ai-fc-input-box">
						<textarea class="ai-fc-input" rows="1"
							placeholder="Describe your dashboard or edits..."></textarea>
					</div>
					<button class="ai-fc-send-btn" title="Send">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
							stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<line x1="22" y1="2" x2="11" y2="13"></line>
							<polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
						</svg>
					</button>
				</div>
			</div>
		</div>
	`);

	$("body").append($chat);
	let $w = $("body > .ai-float-chat");

	// ── Minimize / Maximize ──
	$w.find(".ai-fc-btn-minimize").on("click", (e) => {
		e.stopPropagation();
		toggle_minimize(frm);
	});
	$w.find(".ai-fc-header").on("click", (e) => {
		if ($w.hasClass("minimized") && !$(e.target).closest("button").length) {
			toggle_minimize(frm);
		}
	});

	// ── Config Toggle ──
	$w.find(".ai-fc-btn-config").on("click", (e) => {
		e.stopPropagation();
		$w.find(".ai-fc-config").toggleClass("collapsed");
	});

	// ── Textarea auto-grow ──
	let $input = $w.find(".ai-fc-input");
	$input.on("input", function () {
		this.style.height = "auto";
		this.style.height = Math.min(this.scrollHeight, 100) + "px";
	});
	$input.on("keydown", function (e) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send_ai_prompt(frm);
		}
	});

	$w.find(".ai-fc-send-btn").on("click", () => send_ai_prompt(frm));
	$w.find(".ai-fc-provider-select").on("change", function () {
		frm.set_value("custom_provider", $(this).val());
	});

	// ── Message action delegates ──
	$w.on("click", ".ai-msg-preview", function () {
		let vn = $(this).data("version");
		frappe.call({
			method: "frappe_theme.apis.ai.service.get_version_code",
			args: { block_name: frm.doc.name, version_name: vn },
			freeze: true,
			freeze_message: "Loading...",
			callback(r) {
				if (r.message) show_version_preview(frm, vn, r.message);
			},
		});
	});
	$w.on("click", ".ai-msg-resume", function () {
		let vn = $(this).data("version");
		frappe.call({
			method: "frappe_theme.apis.ai.service.get_version_code",
			args: { block_name: frm.doc.name, version_name: vn },
			callback(r) {
				if (r.message) {
					frm._resume_from = r.message;
					show_resume_badge(frm, vn);
					$w.find(".ai-fc-input").focus();
				}
			},
		});
	});
	$w.find(".ai-fc-btn-rollback").on("click", (e) => {
		e.stopPropagation();
		show_rollback_dialog(frm);
	});

	// ── Report pills + inputs ──
	init_report_pills(frm);
	init_report_inputs(frm);

	// ── Load history ──
	load_chat_history(frm);
}

// ─── MINIMIZE ──────────────────────────────────────────────────────────────────
function toggle_minimize(frm) {
	let $w = $("body > .ai-float-chat");
	let isMin = $w.hasClass("minimized");
	$w.toggleClass("minimized");
	frm._chat_minimized = !isMin;
	$w.find(".ai-fc-btn-minimize i")
		.toggleClass("fa-chevron-down", !isMin)
		.toggleClass("fa-chevron-up", isMin);
	if (isMin) {
		$w.find(".ai-fc-msg-count").hide();
		setTimeout(() => scroll_chat(frm), 100);
	}
}

// ─── REPORT PILLS ──────────────────────────────────────────────────────────────
function init_report_pills(frm) {
	render_pills(frm, "filter");
	render_pills(frm, "data");
}

function render_pills(frm, type) {
	let $w = $("body > .ai-float-chat");
	let $pills = $w.find(`.ai-fc-pills[data-report-type="${type}"]`);
	let table = type === "filter" ? frm.doc.custom_filter_report : frm.doc.custom_data_report;
	$pills.empty();
	(table || []).forEach((row) => {
		if (!row.report) return;
		$pills.append(`
			<span class="ai-fc-pill" data-report="${encodeAttr(row.report)}" data-row="${row.name}">
				${escapeHtml(row.report)}
				<span class="remove-pill" title="Remove">&times;</span>
			</span>
		`);
	});

	$pills.off("click", ".remove-pill").on("click", ".remove-pill", function () {
		let $pill = $(this).parent();
		let report = decodeAttr($pill.data("report"));
		let fieldname = type === "filter" ? "custom_filter_report" : "custom_data_report";
		let tbl = frm.doc[fieldname] || [];
		let idx = tbl.findIndex((r) => r.report === report);
		if (idx >= 0) {
			tbl.splice(idx, 1);
			frm.refresh_field(fieldname);
			frm.dirty();
		}
		$pill.remove();
	});
}

function init_report_inputs(frm) {
	let $w = $("body > .ai-float-chat");

	["filter", "data"].forEach((type) => {
		let $input = $w.find(`.ai-fc-link-input[data-report-type="${type}"]`);
		let $suggest = $w.find(`.ai-fc-suggestions[data-report-type="${type}"]`);
		let debounceTimer;

		// Show all on focus (like Frappe Link field)
		$input.on("focus", function () {
			clearTimeout(debounceTimer);
			let val = $(this).val().trim();
			fetch_reports(frm, type, val, $suggest);
		});

		$input.on("input", function () {
			clearTimeout(debounceTimer);
			let val = $(this).val().trim();
			debounceTimer = setTimeout(() => fetch_reports(frm, type, val, $suggest), 200);
		});

		$input.on("blur", function () {
			setTimeout(() => $suggest.removeClass("open").empty(), 200);
		});

		$suggest.on("mousedown", ".ai-fc-suggestion", function () {
			let report = $(this).text().trim();
			add_report(frm, type, report);
			$input.val("");
			$suggest.removeClass("open").empty();
		});
	});
}

function fetch_reports(frm, type, query, $suggest) {
	let filters = type === "filter" ? { custom_is_filter: 1 } : { custom_is_filter: ["!=", 1] };

	let searchFilters = { ...filters };
	if (query) {
		searchFilters.name = ["like", `%${query}%`];
	}

	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Report",
			filters: searchFilters,
			fields: ["name"],
			limit_page_length: 10,
			order_by: "name asc",
		},
		async: true,
		callback(r) {
			$suggest.empty();
			let existing = get_existing_reports(frm, type);
			let results = (r.message || []).filter((d) => !existing.includes(d.name));
			if (!results.length) {
				$suggest.empty().removeClass("open");
				return;
			}
			results.forEach((d) => {
				$suggest.append(`<div class="ai-fc-suggestion">${escapeHtml(d.name)}</div>`);
			});
			$suggest.addClass("open");
		},
	});
}

function add_report(frm, type, report) {
	let fieldname = type === "filter" ? "custom_filter_report" : "custom_data_report";
	let existing = get_existing_reports(frm, type);
	if (existing.includes(report)) return;

	frm.add_child(fieldname, { report: report });
	frm.refresh_field(fieldname);
	frm.dirty();
	render_pills(frm, type);
}

function get_existing_reports(frm, type) {
	let tbl = type === "filter" ? frm.doc.custom_filter_report : frm.doc.custom_data_report;
	return (tbl || []).map((r) => r.report).filter(Boolean);
}

// ─── CHAT HISTORY ──────────────────────────────────────────────────────────────
function load_chat_history(frm) {
	let $w = $("body > .ai-float-chat");
	let $msgs = $w.find(".ai-fc-messages");

	frappe.call({
		method: "frappe_theme.apis.ai.service.get_chat_history",
		args: { block_name: frm.doc.name },
		callback(r) {
			let messages = r.message || [];
			if (!messages.length) return;

			$msgs.empty();
			let count = 0;

			let lastPrompt = "";
			messages.forEach((msg) => {
				if (msg.type === "user") {
					lastPrompt = msg.content || "";
					$msgs.append(render_user_msg(msg.content, msg.timestamp, msg.provider));
					count++;
				} else if (msg.type === "assistant") {
					$msgs.append(
						render_ai_msg(msg.version, msg.timestamp, msg.changed, lastPrompt),
					);
					lastPrompt = "";
					count++;
				}
			});

			$w.find(".ai-fc-btn-rollback").show();
			update_msg_count(frm, count);
			scroll_chat(frm);
		},
	});
}

function update_msg_count(frm, count) {
	let $badge = $("body > .ai-float-chat .ai-fc-msg-count");
	if (count > 0) {
		$badge.text(count).show();
	} else {
		$badge.hide();
	}
}

function render_user_msg(content, timestamp, provider) {
	let time = frappe.datetime.prettyDate(timestamp);
	let badge = provider
		? `<span style="text-transform:capitalize">${escapeHtml(provider)}</span> &middot; `
		: "";
	return `
		<div class="ai-msg ai-msg-user">
			<div class="ai-msg-meta">${badge}${time}</div>
			<div class="ai-msg-bubble-user">${escapeHtml(content)}</div>
		</div>
	`;
}

function render_ai_msg(version, timestamp, changed, prompt) {
	let time = frappe.datetime.prettyDate(timestamp);
	let changedStr = escapeHtml((changed || []).join(", "));
	let promptSnippet = "";
	if (prompt) {
		let truncated = prompt.length > 80 ? prompt.substring(0, 80) + "..." : prompt;
		promptSnippet = `<div class="ai-msg-prompt-ref">&ldquo;${escapeHtml(truncated)}&rdquo;</div>`;
	}
	return `
		<div class="ai-msg ai-msg-assistant">
			<div class="ai-msg-meta">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5z"/>
					<path d="M2 17l3.5-2L12 18l6.5-3L22 17"/><path d="M12 18v4"/>
				</svg>
				AI &middot; ${time}
			</div>
			<div class="ai-msg-bubble-ai">
				${promptSnippet}
				<div class="ai-msg-status">
					<span>&#9989;</span> Dashboard updated
				</div>
				<div class="ai-msg-changed">Changed: ${changedStr}</div>
				<div class="ai-msg-actions">
					<button class="btn btn-xs btn-default ai-msg-preview" data-version="${encodeAttr(version)}">
						<i class="fa fa-eye"></i> Preview
					</button>
					<button class="btn btn-xs btn-default ai-msg-resume" data-version="${encodeAttr(version)}">
						<i class="fa fa-code-fork"></i> Resume
					</button>
				</div>
			</div>
		</div>
	`;
}

// ─── SEND PROMPT (Realtime / Socket) ───────────────────────────────────────────
function send_ai_prompt(frm) {
	let $w = $("body > .ai-float-chat");
	let $input = $w.find(".ai-fc-input");
	let $msgs = $w.find(".ai-fc-messages");
	let $sendBtn = $w.find(".ai-fc-send-btn");

	let prompt = $input.val().trim();
	if (!prompt) return;

	let provider = $w.find(".ai-fc-provider-select").val();

	$msgs.find(".ai-fc-empty").remove();
	$msgs.append(render_user_msg(prompt, new Date().toISOString(), provider));

	// Animated loading with elapsed timer
	let loadingId = "ai-loading-" + Date.now();
	$msgs.append(`
		<div class="ai-msg-loading" id="${loadingId}">
			<div class="ai-typing-dots"><span></span><span></span><span></span></div>
			<div class="ai-loading-text">
				<span class="ai-loading-status">Queued...</span>
				<span class="ai-loading-timer" style="font-size:10px;opacity:0.7;margin-left:6px;">0s</span>
			</div>
		</div>
	`);
	scroll_chat(frm);

	$input.val("").css("height", "auto");
	$sendBtn.prop("disabled", true);

	// Elapsed timer
	let startTime = Date.now();
	let timerInterval = setInterval(() => {
		let elapsed = Math.round((Date.now() - startTime) / 1000);
		let $timer = $msgs.find(`#${loadingId} .ai-loading-timer`);
		if ($timer.length) {
			$timer.text(elapsed + "s");
		} else {
			clearInterval(timerInterval);
		}
	}, 1000);

	// ── Realtime listeners ──
	let taskId = null;

	function onStart(data) {
		if (taskId && data.task_id !== taskId) return;
		$msgs.find(`#${loadingId} .ai-loading-status`).text("Generating...");
	}

	function onResult(data) {
		if (data.task_id !== taskId) return;
		cleanup();
		$msgs.find(`#${loadingId}`).remove();

		if (data.result) {
			frm.set_value("html", data.result.html);
			frm.set_value("script", data.result.script);
			frm.set_value("style", data.result.style);
			frm.set_value("custom_ai_prompt", prompt);
			frm.set_value("custom_provider", provider);
			frm.save().then(() => {
				frm._resume_from = null;
				$w.find(".ai-fc-resume-bar").empty();
				$w.find(".ai-fc-btn-rollback").show();
				load_chat_history(frm);
			});
		} else {
			append_error_msg($msgs, "Empty response from AI");
			scroll_chat(frm);
		}
	}

	function onError(data) {
		if (data.task_id !== taskId) return;
		cleanup();
		$msgs.find(`#${loadingId}`).remove();
		append_error_msg($msgs, data.error || "Generation failed");
		scroll_chat(frm);
	}

	function cleanup() {
		clearInterval(timerInterval);
		frappe.realtime.off("ai_block_start", onStart);
		frappe.realtime.off("ai_block_result", onResult);
		frappe.realtime.off("ai_block_error", onError);
		$sendBtn.prop("disabled", false);
		$input.focus();
	}

	// Subscribe BEFORE making the HTTP call
	frappe.realtime.on("ai_block_start", onStart);
	frappe.realtime.on("ai_block_result", onResult);
	frappe.realtime.on("ai_block_error", onError);

	// Short HTTP call — returns task_id instantly, no timeout risk
	frappe.call({
		method: "frappe_theme.apis.ai.service.generate_html_block_async",
		args: {
			provider: provider,
			client_prompt: prompt,
			block_name: frm.doc.name,
			custom_filter_report: JSON.stringify(get_existing_reports(frm, "filter")),
			custom_data_report: JSON.stringify(get_existing_reports(frm, "data")),
			resume_from: frm._resume_from ? JSON.stringify(frm._resume_from) : null,
		},
		callback(r) {
			if (r.message && r.message.task_id) {
				taskId = r.message.task_id;
				$msgs.find(`#${loadingId} .ai-loading-status`).text("Generating...");
			} else {
				cleanup();
				$msgs.find(`#${loadingId}`).remove();
				append_error_msg($msgs, "Failed to start generation");
				scroll_chat(frm);
			}
		},
		error() {
			cleanup();
			$msgs.find(`#${loadingId}`).remove();
			append_error_msg($msgs, "Failed to enqueue - check server logs");
			scroll_chat(frm);
		},
	});

	// Safety timeout: 5 minutes — if socket never fires, clean up
	setTimeout(
		() => {
			if ($msgs.find(`#${loadingId}`).length) {
				cleanup();
				$msgs.find(`#${loadingId}`).remove();
				append_error_msg($msgs, "Timed out after 5 minutes — check background jobs");
				scroll_chat(frm);
			}
		},
		5 * 60 * 1000,
	);
}

function append_error_msg($msgs, text) {
	$msgs.append(`
		<div class="ai-msg ai-msg-assistant">
			<div class="ai-msg-bubble-ai" style="border-color:#fca5a5;">
				<div class="ai-msg-status"><span>&#10060;</span> ${escapeHtml(text)}</div>
			</div>
		</div>
	`);
}

function scroll_chat(frm) {
	let $msgs = $("body > .ai-float-chat .ai-fc-messages");
	setTimeout(() => {
		$msgs.scrollTop($msgs[0]?.scrollHeight || 0);
	}, 60);
}

function show_resume_badge(frm, versionName) {
	let $bar = $("body > .ai-float-chat .ai-fc-resume-bar");
	$bar.html(`
		<div class="ai-fc-resume-badge">
			<i class="fa fa-code-fork"></i>
			Resuming from <strong>${escapeHtml(versionName)}</strong>
			<button class="btn btn-xs btn-default ai-resume-clear">&times;</button>
		</div>
	`);
	$bar.find(".ai-resume-clear").on("click", () => {
		frm._resume_from = null;
		$bar.empty();
	});
}

// ─── PREVIEW DIALOG ────────────────────────────────────────────────────────────
function show_version_preview(frm, version_name, code) {
	let dlg = new frappe.ui.Dialog({
		title: "Preview: " + version_name,
		size: "extra-large",
		fields: [{ fieldtype: "HTML", fieldname: "preview_content" }],
		primary_action_label: "Use this Version",
		primary_action() {
			frm._resume_from = code;
			dlg.hide();
			show_resume_badge(frm, version_name);
			$("body > .ai-float-chat .ai-fc-input").focus();
		},
		secondary_action_label: "Close",
		secondary_action() {
			dlg.hide();
		},
	});

	let ehtml = escapeHtml(code.html || "");
	let escript = escapeHtml(code.script || "");
	let estyle = escapeHtml(code.style || "");

	dlg.fields_dict.preview_content.$wrapper.html(`
		<div class="vp-tabs">
			<div class="vp-tab-bar">
				<button class="vp-tab-btn active" data-vp-tab="rendered">Live Preview</button>
				<button class="vp-tab-btn" data-vp-tab="html">HTML <span class="text-muted">(${(code.html || "").length})</span></button>
				<button class="vp-tab-btn" data-vp-tab="script">Script <span class="text-muted">(${(code.script || "").length})</span></button>
				<button class="vp-tab-btn" data-vp-tab="style">Style <span class="text-muted">(${(code.style || "").length})</span></button>
			</div>
			<div class="vp-panel active" data-vp-tab="rendered">
				<div class="vp-rendered" id="vp-live-container"></div>
			</div>
			<div class="vp-panel" data-vp-tab="html">
				<pre><code>${ehtml || "<em>Empty</em>"}</code></pre>
				<div class="vp-stats"><span>${(code.html || "").length} chars</span></div>
			</div>
			<div class="vp-panel" data-vp-tab="script">
				<pre><code>${escript || "<em>Empty</em>"}</code></pre>
				<div class="vp-stats"><span>${(code.script || "").length} chars</span></div>
			</div>
			<div class="vp-panel" data-vp-tab="style">
				<pre><code>${estyle || "<em>Empty</em>"}</code></pre>
				<div class="vp-stats"><span>${(code.style || "").length} chars</span></div>
			</div>
		</div>
	`);

	dlg.$wrapper.on("click", ".vp-tab-btn", function () {
		let tab = $(this).data("vp-tab");
		dlg.$wrapper.find(".vp-tab-btn").removeClass("active");
		$(this).addClass("active");
		dlg.$wrapper.find(".vp-panel").removeClass("active");
		dlg.$wrapper.find(`.vp-panel[data-vp-tab="${tab}"]`).addClass("active");
	});

	dlg.show();
	dlg.$wrapper.addClass("fullscreen-preview");

	setTimeout(() => {
		let container = dlg.$wrapper.find("#vp-live-container")[0];
		if (container && code.html) {
			try {
				let shadow = container.attachShadow({ mode: "open" });
				if (code.style) {
					let s = document.createElement("style");
					s.textContent = code.style;
					shadow.appendChild(s);
				}
				let w = document.createElement("div");
				w.innerHTML = code.html;
				shadow.appendChild(w);
				if (code.script) {
					let root_element = shadow;
					let fn = new Function("root_element", code.script);
					fn(root_element);
				}
			} catch (e) {
				container.innerHTML = `<div style="padding:20px;color:#ef4444;">
					<strong>Preview Error:</strong> ${escapeHtml(e.message)}</div>`;
				console.error("Preview error:", e);
			}
		}
	}, 200);
}

// ─── ROLLBACK ──────────────────────────────────────────────────────────────────
function show_rollback_dialog(frm) {
	frappe.call({
		method: "frappe_theme.apis.ai.service.get_versions",
		args: { block_name: frm.doc.name },
		callback(r) {
			if (!r.message?.length) {
				frappe.msgprint("No versions found");
				return;
			}
			let options = r.message.map(
				(v) =>
					`${v.version} - ${frappe.datetime.prettyDate(v.created)} (${v.changed.join(", ")})`,
			);
			frappe.prompt(
				{
					fieldtype: "Select",
					label: "Rollback to before this version",
					fieldname: "version",
					options: options.join("\n"),
					reqd: 1,
					description: "Restores code to BEFORE the selected version.",
				},
				(values) => {
					let vn = values.version.split(" - ")[0];
					frappe.confirm(
						`Overwrite current code with state before <b>${vn}</b>?`,
						() => {
							frappe.call({
								method: "frappe_theme.apis.ai.service.rollback",
								args: { block_name: frm.doc.name, version_name: vn },
								freeze: true,
								freeze_message: "Rolling back...",
								callback(r2) {
									if (r2.message) {
										frm.set_value("html", r2.message.html);
										frm.set_value("script", r2.message.script);
										frm.set_value("style", r2.message.style);
										frm._resume_from = null;
										frm.save().then(() => {
											frappe.show_alert({
												message: "Rolled back",
												indicator: "green",
											});
											load_chat_history(frm);
										});
									}
								},
							});
						},
					);
				},
				__("Rollback"),
				__("Rollback"),
			);
		},
	});
}

// ─── UTILS ─────────────────────────────────────────────────────────────────────
function escapeHtml(str) {
	if (!str) return "";
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
function encodeAttr(str) {
	return (str || "").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function decodeAttr(str) {
	return (str || "").replace(/&quot;/g, '"').replace(/&#039;/g, "'");
}
