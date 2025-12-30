frappe.ui.Sidebar = class CustomSidebar extends frappe.ui.Sidebar {
	// Improved method to handle sidebar item clicks
	handle_sidebar_click(item_element, item_name, item_title) {
		// Remove active from ALL sidebar items first
		$(".standard-sidebar-item").removeClass("active-sidebar");

		// Add active only to the specific clicked item
		const $clickedItem = $(item_element).closest(".standard-sidebar-item");
		$clickedItem.addClass("active-sidebar");

		this.active_item = $clickedItem;

		// Store in localStorage for URL workspaces
		localStorage.setItem("sidebar-active-item", item_name || item_title);
		localStorage.setItem("sidebar-active-url", window.location.href);
	}

	// Method to restore active state after page load
	restore_active_state() {
		const activeItem = localStorage.getItem("sidebar-active-item");
		const activeUrl = localStorage.getItem("sidebar-active-url");

		if (activeItem && activeUrl && window.location.href === activeUrl) {
			const $match = this.$sidebar.find(
				`.sidebar-item-container[item-name="${activeItem}"]`
			);
			if ($match.length) {
				$(".standard-sidebar-item").removeClass("active-sidebar");
				const $targetItem = $match.find(".standard-sidebar-item").first();
				$targetItem.addClass("active-sidebar");
				this.active_item = $match;
			}
		}
	}

	// Override to remove target="_blank" for URL type workspaces
	get_sidebar_item(item) {
		let path;
		if (item.link_type) {
			if (item.link_type === "Report") {
				path = frappe.utils.generate_route({
					type: item.link_type,
					name: item.link_to,
					is_query_report: item.report.report_type === "Query Report",
					report_ref_doctype: item.report.ref_doctype,
				});
			} else {
				path = frappe.utils.generate_route({ type: item.link_type, name: item.link_to });
			}
		} else if (item.type === "URL") {
			path = item.external_link;
		} else {
			if (item.public) {
				path = "/app/" + frappe.router.slug(item.name);
			} else {
				path = "/app/private/" + frappe.router.slug(item.name.split("-")[0]);
			}
		}

		return $(`
			<div
				class="sidebar-item-container ${item.is_editable ? "is-draggable" : ""}"
				item-parent="${item.parent_page}"
				item-name="${item.name}"
				item-title="${item.title}"
				item-public="${item.public || 0}"
				item-is-hidden="${item.is_hidden || 0}"
			>
				<div class="standard-sidebar-item ${item.selected ? "selected" : ""}">
					<a
						href="${path}"
						class="item-anchor ${item.is_editable ? "" : "block-click"}" title="${__(item.title)}"
					>
						<span class="sidebar-item-icon" item-icon=${item.icon || "folder-normal"}>
							${
								item.public || item.icon
									? frappe.utils.icon(item.icon || "folder-normal", "md")
									: `<span class="indicator ${item.indicator_color}"></span>`
							}
						</span>
						<span class="sidebar-item-label">${__(item.title)}<span>
					</a>
					${this.get_sidebar_item_control(item)}
				</div>
				${this.get_child_sidebar_items(item)}
			</div>
		`);
	}
	set_active_workspace_item() {
		const current_route = frappe.get_route();
		if (!current_route || !current_route.length) return;

		const current_item = current_route[1];
		if (!current_item) return;

		const $match = this.$sidebar.find(`.sidebar-item-container[item-name="${current_item}"]`);
		if ($match.length) {
			// Clear ALL active states first
			this.$sidebar.find(".standard-sidebar-item").removeClass("active-sidebar");

			// Set active only on the matched item
			const $targetItem = $match.find(".standard-sidebar-item").first();
			$targetItem.addClass("active-sidebar");
			this.active_item = $match;

			// If nested, expand parent but don't make parent active
			const $parent_container = $match.closest(".sidebar-child-item");
			if ($parent_container.length) {
				$parent_container.removeClass("hidden");
				const $toggle_btn = $parent_container
					.siblings(".sidebar-item-control")
					.find(".drop-icon");
				$toggle_btn.find("use").attr("href", "#icon-chevron-up");
			}
		}
	}
	build_sidebar_section(title, root_pages) {
		let sidebar_section = $(
			`<div class="standard-sidebar-section nested-container" data-title="${title}"></div>`
		);

		this.prepare_sidebar(root_pages, sidebar_section, this.wrapper.find(".sidebar-items"));

		if (Object.keys(root_pages).length === 0) {
			sidebar_section.addClass("hidden");
		}

		// Fixed single-click active + breadcrumb update
		$(".item-anchor")
			.off("click")
			.on("click", (e) => {
				const $target = $(e.currentTarget);
				const item_name = $target.closest(".sidebar-item-container").attr("item-name");
				const item_title = $target.attr("title");

				// Check if this is a URL type workspace and prevent new tab
				if ($target.attr("target") === "_blank") {
					e.preventDefault();
					// Store the target URL and item info for restoration
					const targetUrl = $target.attr("href");
					localStorage.setItem("sidebar-active-item", item_name || item_title);
					localStorage.setItem("sidebar-active-url", targetUrl);
					// Update active state before navigation
					this.handle_sidebar_click(e.currentTarget, item_name, item_title);
					window.location.href = targetUrl;
					return false;
				}

				if ($target.data("processing")) return false;
				$target.data("processing", true);

				// Immediate active state update
				this.handle_sidebar_click(e.currentTarget, item_name, item_title);

				// Delay only for route-dependent updates
				setTimeout(() => {
					this.set_active_workspace_item();
					frappe.breadcrumbs.update();
					$target.removeData("processing");

					// Scroll to item if needed
					if (!frappe.dom.is_element_in_viewport($target)) {
						$target[0].scrollIntoView({ behavior: "smooth", block: "center" });
					}
				}, 100);

				$(".list-sidebar.hidden-xs.hidden-sm").removeClass("opened");
				$("body").css("overflow", "auto");

				if (frappe.is_mobile()) {
					this.close_sidebar();
				}
			});

		// Smooth dropdown toggle for parent items
		$(".drop-icon")
			.off("click")
			.on("click", (e) => {
				e.preventDefault();
				e.stopPropagation();

				const $dropIcon = $(e.currentTarget);
				const $childContainer = $dropIcon
					.closest(".sidebar-item-container")
					.find(".sidebar-child-item");
				const $iconUse = $dropIcon.find("use");

				if ($childContainer.hasClass("hidden")) {
					$childContainer.removeClass("hidden");
					$iconUse.attr("href", "#es-line-up");
				} else {
					$childContainer.addClass("hidden");
					$iconUse.attr("href", "#es-line-down");
				}
			});

		if (
			sidebar_section.find(".sidebar-item-container").length &&
			sidebar_section.find("> [item-is-hidden='0']").length == 0
		) {
			sidebar_section.addClass("hidden show-in-edit-mode");
		}

		// Restore active state after sidebar is built
		setTimeout(() => {
			this.restore_active_state();
		}, 100);
	}
};
