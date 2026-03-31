const ActionColumnMixin = {
	createActionColumn(row, primaryKey) {
		const dropdown = document.createElement("div");
		dropdown.classList.add("dropdown");

		const dropdownBtn = document.createElement("span");
		dropdownBtn.style.fontSize = "16px";
		dropdownBtn.style.lineHeight = "1";
		dropdownBtn.style.display = "inline-flex";
		dropdownBtn.style.alignItems = "center";
		dropdownBtn.innerHTML = "&#8942;";
		if (this.connection.connection_type != "Report") {
			dropdownBtn.style.cursor = "pointer";
			dropdownBtn.setAttribute("data-toggle", "dropdown");
		} else {
			dropdownBtn.style.cursor = "not-allowed";
			dropdownBtn.setAttribute("disabled", "disabled");
			dropdownBtn.setAttribute("title", "This action is not allowed for reports");
		}

		const dropdownMenu = document.createElement("div");
		dropdownMenu.classList.add("dropdown-menu");
		dropdownMenu.classList.add("sva-dt-action-dropdown");
		// Fallback to "unknown" so the key is always a valid non-empty string.
		// Frappe doctype names can contain spaces/special chars so we never use
		// this value inside a CSS selector — comparison is done via dataset directly.
		const _dtTableKey = `${this?.doctype || this?.link_report || "unknown"}-${
			this?.connection?.html_field || "unknown"
		}`;
		dropdownMenu.dataset.dtTableKey = _dtTableKey;
		dropdownMenu.style.position = "fixed";
		dropdownMenu.style.zIndex = "9999";
		dropdownMenu.style.display = "none";

		const appendDropdownOption = (text, onClickHandler) => {
			const option = document.createElement("a");
			option.classList.add("dropdown-item");
			option.innerHTML = text;
			option.addEventListener("click", onClickHandler);
			dropdownMenu.appendChild(option);
		};

		// View Button
		if (
			this.crud.read &&
			this.conf_perms.length &&
			this.permissions.length &&
			this.permissions.includes("read")
		) {
			appendDropdownOption(`${frappe.utils.icon("view", "sm")} View`, async () => {
				if (this.connection?.redirect_to_main_form) {
					let route = frappe.get_route();
					frappe.set_route("Form", this.doctype, primaryKey).then(() => {
						cur_frm.add_custom_button("Back", () => {
							frappe.set_route(route);
						});
					});
				} else {
					await this.createFormDialog(this.doctype, primaryKey, "view");
				}
			});
		}

		// Edit and Delete Buttons
		if (
			!["1", "2"].includes(row.docstatus) &&
			(this.frm ? this.frm?.doc?.docstatus == 0 : true)
		) {
			let wf_editable_roles = this?.workflow?.states
				?.filter((s) => s.state == row[this?.workflow?.workflow_state_field])
				?.map((s) => s.allow_edit);
			let wf_editable = this.workflow
				? wf_editable_roles?.some((role) => frappe.user_roles.includes(role))
				: true;
			let is_editable = this.connection?.disable_edit_depends_on
				? !frappe.utils.custom_eval(this.connection?.disable_edit_depends_on, row)
				: true;
			if (
				this.crud.write &&
				wf_editable &&
				this.permissions.includes("write") &&
				this.conf_perms.includes("write") &&
				is_editable
			) {
				if (
					(this.wf_positive_closure || this.wf_negative_closure) &&
					row["workflow_state"]
				) {
					if (
						![this.wf_positive_closure, this.wf_negative_closure].includes(
							row["workflow_state"]
						)
					) {
						appendDropdownOption(
							`${frappe.utils.icon("edit", "sm")} ${__("Edit")}`,
							async () => {
								if (this.connection?.redirect_to_main_form) {
									let route = frappe.get_route();
									frappe.set_route("Form", this.doctype, primaryKey).then(() => {
										cur_frm["sva_dt_prev_route"] = route;
									});
								} else {
									await this.createFormDialog(this.doctype, primaryKey, "write");
								}
							}
						);
					}
				} else {
					appendDropdownOption(
						`${frappe.utils.icon("edit", "sm")} ${__("Edit")}`,
						async () => {
							if (this.connection?.redirect_to_main_form) {
								let route = frappe.get_route();
								frappe.set_route("Form", this.doctype, primaryKey).then(() => {
									cur_frm["sva_dt_prev_route"] = route;
								});
							} else {
								await this.createFormDialog(this.doctype, primaryKey, "write");
							}
						}
					);
				}
			}
			let is_deletable = this.connection?.disable_delete_depends_on
				? !frappe.utils.custom_eval(this.connection?.disable_delete_depends_on, row)
				: true;
			if (
				this.crud.delete &&
				wf_editable &&
				this.permissions.includes("delete") &&
				this.conf_perms.includes("delete") &&
				is_deletable
			) {
				if (
					(this.wf_positive_closure || this.wf_negative_closure) &&
					row["workflow_state"]
				) {
					if (
						![this.wf_positive_closure, this.wf_negative_closure].includes(
							row["workflow_state"]
						)
					) {
						appendDropdownOption(
							`${frappe.utils.icon("delete", "sm")} ${__("Delete")}`,
							async () => {
								await this.deleteRecord(this.doctype, primaryKey);
							}
						);
					}
				} else {
					appendDropdownOption(
						`${frappe.utils.icon("delete", "sm")} ${__("Delete")}`,
						async () => {
							await this.deleteRecord(this.doctype, primaryKey);
						}
					);
				}
			}
		}

		if (this.workflow && this.frm?.has_permission_for_workflow_action_log) {
			appendDropdownOption(
				`${frappe.utils.icon("workflow", "sm")} ${__("Approval Timeline")}`,
				async () => {
					open_approval_timeline_dialog(
						this.doctype,
						primaryKey,
						this.title_field ? row[this.title_field] : ""
					);
				}
			);
		}
		// ========================= Print Button ======================
		if (this.permissions.includes("print")) {
			appendDropdownOption(`${frappe.utils.icon("printer", "sm")} ${__("Print")}`, () => {
				frappe.utils.print(
					this.doctype,
					primaryKey,
					this.meta?.default_print_format || "Standard",
					"No Letterhead",
					frappe.boot?.lang || "en"
				);
			});
		}

		// Child Links
		if (this.childLinks?.length) {
			this.childLinks.forEach(async (link) => {
				let can_be_visible = link?.display_depends_on
					? frappe.utils.custom_eval(link.display_depends_on, row)
					: true;
				if (!can_be_visible) {
					return;
				}
				appendDropdownOption(
					`${frappe.utils.icon("external-link", "sm")} ${__(
						link?.title || link.link_doctype
					)}`,
					async () => {
						await this.childTableDialog(link.link_doctype, primaryKey, row, link);
					}
				);
			});
		}

		// ========================= Integration Button ======================
		if (this.frm?.["dt_events"]?.[this.doctype]?.["additional_row_actions"]) {
			let actions = this.frm["dt_events"][this.doctype]["additional_row_actions"];
			for (let action of Object.keys(actions)) {
				let action_obj = actions[action];
				if (action_obj.condition) {
					if (!this.checkCondition(action_obj.condition, row, primaryKey)) {
						continue;
					}
				}
				appendDropdownOption(`${action_obj.icon} ${action_obj.label}`, async () => {
					let fn = action_obj.action;
					if (this.isAsync(fn)) {
						await fn(this, row, primaryKey);
					} else {
						fn(this, row, primaryKey);
					}
				});
			}
		}
		if (this.frm?.["dt_global_events"]?.["additional_row_actions"]) {
			let actions = this.frm["dt_global_events"]["additional_row_actions"];
			for (let action of Object.keys(actions)) {
				let action_obj = actions[action];
				if (action_obj.condition) {
					if (!this.checkCondition(action_obj.condition, row, primaryKey)) {
						continue;
					}
				}
				appendDropdownOption(`${action_obj.icon} ${action_obj.label}`, async () => {
					let fn = action_obj.action;
					if (this.isAsync(fn)) {
						await fn(this, row, primaryKey);
					} else {
						fn(this, row, primaryKey);
					}
				});
			}
		}
		// ========================= Integration Button End ======================

		// ========================= Comment Button (standalone) ======================
		const primaryColor = frappe.boot.my_theme?.button_background_color || "#171717";
		let commentBtn = null;
		const _commentDoctype = this?.frm?.parent_frm?.doctype || this?.frm?.doctype;
		const _commentDocname =
			this?.frm?.parent_frm?.docname || this?.frm?.docname || this?.frm?.doc?.name;
		if (
			_commentDoctype &&
			_commentDocname &&
			this.connection.connection_type !== "Report" &&
			!(frappe.boot.my_theme && frappe.boot.my_theme.hide_fields_comment)
		) {
			const rowDocname = row.name || primaryKey;
			const rowDocType = this.doctype;
			const rowTitle =
				this.title_field && row[this.title_field] ? row[this.title_field] : row.name;

			commentBtn = document.createElement("span");
			commentBtn.style.cursor = "pointer";
			commentBtn.style.position = "relative";
			commentBtn.style.display = "inline-flex";
			commentBtn.style.alignItems = "center";
			commentBtn.style.marginLeft = "0";
			// spacing is controlled by the action dropdown container gap
			commentBtn.style.marginRight = "0";
			commentBtn.title = __("Comments");
			commentBtn.innerHTML = frappe.utils.icon("message", "sm");

			const countBadge = document.createElement("span");
			countBadge.style.cssText =
				"position:absolute;top:-9px;right:-20px;transition:opacity 0.2s ease;";
			commentBtn.appendChild(countBadge);

			// Hover-reveal: badge hidden by default unless theme setting is checked
			const alwaysShowBadge = !!frappe.boot.my_theme?.show_comment_count_default;
			if (!alwaysShowBadge) {
				countBadge.style.opacity = "0";
				commentBtn.addEventListener("mouseenter", function () {
					countBadge.style.opacity = "1";
				});
				commentBtn.addEventListener("mouseleave", function () {
					countBadge.style.opacity = "0";
				});
			}

			const self = this;
			const refreshCountBadge = async function () {
				const counts = await self._fetchThreadCounts(_commentDoctype, _commentDocname);
				const detail = counts[rowDocname] || {};
				const openCount = detail.open || 0;
				const closedCount = detail.closed || 0;
				if (typeof window.renderThreadCountBadge === "function") {
					countBadge.innerHTML = window.renderThreadCountBadge(openCount, closedCount);
				} else {
					countBadge.textContent = openCount;
				}
				countBadge.style.display = "flex";

				// Store counts for tooltip
				countBadge.dataset.openCount = openCount;
				countBadge.dataset.closedCount = closedCount;
			};

			// Initial count load
			refreshCountBadge();

			commentBtn.addEventListener("click", function (event) {
				event.stopPropagation();
				if (typeof window.openCommentsForDoc === "function") {
					let frm = Object.assign(self?.frm?.parent_frm || self?.frm, {
						child_row: Object.assign(row, { doctype: rowDocType, __title: rowTitle }),
					});
					window.openCommentsForDoc(
						_commentDoctype,
						_commentDocname,
						self.doctype,
						rowDocname,
						frm
					);
				}
				// If inside a dialog, raise sidebar z-index above it
				const sidebar = document.querySelector(".field-comments-sidebar");
				if (sidebar) {
					const parentModal = commentBtn.closest(".modal");
					if (parentModal) {
						const modalZIndex =
							parseInt(window.getComputedStyle(parentModal).zIndex) || 1050;
						sidebar.style.zIndex = modalZIndex + 10;
						sidebar.style.top = "0";
						sidebar.style.height = "100vh";
					}
				}
				// Store refresh function for this row
				window.__dtActiveCommentRefresh = refreshCountBadge;
				// Set up MutationObserver on sidebar once to detect close
				if (!window.__dtCommentSidebarObserver) {
					const sidebar = document.querySelector(".field-comments-sidebar");
					if (sidebar) {
						window.__dtCommentSidebarObserver = new MutationObserver(function () {
							if (
								sidebar.style.display === "none" &&
								typeof window.__dtActiveCommentRefresh === "function"
							) {
								window.__dtActiveCommentRefresh();
								window.__dtActiveCommentRefresh = null;
							}
						});
						window.__dtCommentSidebarObserver.observe(sidebar, {
							attributes: true,
							attributeFilter: ["style"],
						});
					}
				}
			});
		}

		dropdown.style.display = "flex";
		dropdown.style.alignItems = "center";
		dropdown.style.justifyContent = "center";
		dropdown.style.gap = "23px";
		if (commentBtn) {
			dropdown.appendChild(commentBtn);
		}
		dropdown.appendChild(dropdownBtn);
		if (this.connection.connection_type != "Report") {
			document.body.appendChild(dropdownMenu);
		}

		// Helper: detach scroll listeners stored on a menu element
		const detachScrollHandlers = (menu) => {
			try {
				if (menu && typeof menu._removeScrollHandler === "function") {
					menu._removeScrollHandler();
					menu._removeScrollHandler = null;
				}
			} catch (e) {
				// Silently ignore — listener may have already been removed
			}
		};

		// Close only dropdowns belonging to the same table instance.
		// Uses dataset comparison instead of a CSS attribute selector to safely
		// handle doctype names that contain spaces or other special characters.
		const closeAllActionDropdowns = () => {
			document.querySelectorAll(".sva-dt-action-dropdown").forEach((menu) => {
				if (menu.dataset.dtTableKey === _dtTableKey) {
					detachScrollHandlers(menu);
					menu.style.display = "none";
					menu.style.visibility = "visible";
				}
			});
		};

		const toggleDropdown = (event) => {
			try {
				event.stopPropagation();

				// Report-type buttons render as disabled visually but <span> elements still
				// receive click events — bail out early so no menu is ever shown.
				if (this?.connection?.connection_type === "Report") return;

				// Bail out if the menu was never mounted (defensive, shouldn't happen)
				if (!dropdownMenu.isConnected) return;

				const isOpen = dropdownMenu.style.display !== "none";

				// Always close all open action dropdowns first (also cleans up scroll handlers)
				closeAllActionDropdowns();

				// If this one was already open, toggling means we leave it closed
				if (isOpen) return;

				// Temporarily render off-screen to measure actual dimensions
				dropdownMenu.style.visibility = "hidden";
				dropdownMenu.style.display = "block";
				dropdownMenu.style.top = "-9999px";
				dropdownMenu.style.left = "-9999px";

				const dropdownHeight = dropdownMenu.offsetHeight || 120;
				const dropdownWidth = dropdownMenu.offsetWidth || 150;

				// Reposition the dropdown relative to the current button position.
				// Called once on open and again on every scroll event.
				// Uses only viewport coordinates — dropdown is position:fixed so no
				// container bounds are needed, and scrollable-ancestor detection caused
				// false positives with Frappe's overflow:hidden wrappers.
				const positionDropdown = () => {
					// Guard: dropdown already closed (e.g. by a concurrent closeAll call)
					if (!dropdownMenu || dropdownMenu.style.display === "none") return;

					// Guard: button removed from DOM (table row refreshed/destroyed)
					if (!dropdownBtn.isConnected) {
						detachScrollHandlers(dropdownMenu);
						dropdownMenu.style.display = "none";
						dropdownMenu.style.visibility = "visible";
						return;
					}

					try {
						const rect = dropdownBtn.getBoundingClientRect();

						// Button scrolled completely out of the viewport — close and clean up
						if (rect.bottom < 0 || rect.top > window.innerHeight) {
							detachScrollHandlers(dropdownMenu);
							dropdownMenu.style.display = "none";
							dropdownMenu.style.visibility = "visible";
							return;
						}

						const spaceBelow = window.innerHeight - rect.bottom;
						const spaceAbove = rect.top;

						// Open upward if not enough space below AND more space above
						const top =
							spaceBelow < dropdownHeight && spaceAbove >= dropdownHeight
								? rect.top - dropdownHeight
								: rect.bottom;

						dropdownMenu.style.top = `${top}px`;
						dropdownMenu.style.left = `${rect.left - dropdownWidth}px`;
					} catch (e) {
						// Positioning failed — hide gracefully rather than show in wrong place
						detachScrollHandlers(dropdownMenu);
						dropdownMenu.style.display = "none";
						dropdownMenu.style.visibility = "visible";
					}
				};

				// Initial position then make visible
				positionDropdown();
				// Only reveal if positionDropdown didn't close it (e.g. button out of viewport)
				if (dropdownMenu.style.display !== "none") {
					dropdownMenu.style.visibility = "visible";
				}

				// Capture phase catches scroll from ANY nested container (scroll doesn't bubble)
				document.addEventListener("scroll", positionDropdown, {
					passive: true,
					capture: true,
				});

				// Store cleanup so closeAllActionDropdowns can detach the listener
				dropdownMenu._removeScrollHandler = () => {
					document.removeEventListener("scroll", positionDropdown, { capture: true });
				};
			} catch (e) {
				// Last-resort catch — prevent any error from surfacing to the user
				console.error("[sva-datatable] toggleDropdown error:", e);
			}
		};

		dropdownBtn.addEventListener("click", toggleDropdown);

		// Close all action dropdowns when clicking outside — register only once per page.
		// Uses a flag on document so multiple table instances don't stack listeners.
		if (!document.__svaDtOutsideClickBound) {
			document.__svaDtOutsideClickBound = true;
			document.addEventListener("click", () => {
				try {
					document.querySelectorAll(".sva-dt-action-dropdown").forEach((menu) => {
						detachScrollHandlers(menu);
						menu.style.display = "none";
						menu.style.visibility = "visible";
					});
				} catch (e) {
					// Ignore
				}
			});
		}

		return dropdown;
	},
	checkCondition(condition, row, primaryKey) {
		if (typeof condition === "function") {
			return condition(this, row, primaryKey);
		}
		return condition;
	},
	// Deduplicates concurrent get_all_field_thread_counts_detailed calls across all rows.
	// All rows rendered in the same tick share a single in-flight promise, so N rows
	// produce exactly 1 API request instead of N.
	_fetchThreadCounts(doctype, docname) {
		if (!this._threadCountPromises) {
			this._threadCountPromises = {};
		}
		const cacheKey = `${doctype}::${docname}`;
		if (this._threadCountPromises[cacheKey]) {
			return this._threadCountPromises[cacheKey];
		}
		const promise = new Promise((resolve) => {
			frappe.call({
				method: "frappe_theme.api.get_all_field_thread_counts_detailed",
				args: { doctype_name: doctype, docname: docname },
				callback: (r) => {
					delete this._threadCountPromises[cacheKey];
					resolve(r.message || {});
				},
				error: () => {
					// Clean up so the next render attempt retries rather than
					// waiting on a promise that will never settle.
					delete this._threadCountPromises[cacheKey];
					resolve({});
				},
			});
		});
		this._threadCountPromises[cacheKey] = promise;
		return promise;
	},
};

export default ActionColumnMixin;
