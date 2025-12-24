frappe.ui.Sidebar = class CustomSidebar extends frappe.ui.Sidebar {
	// Improved method to handle sidebar item clicks
	handle_sidebar_click(item_element, item_name, item_title) {
		// Remove active from ALL sidebar items first
		$(".standard-sidebar-item").removeClass("active-sidebar");

		// Add active only to the specific clicked item
		const $clickedItem = $(item_element).closest(".standard-sidebar-item");
		$clickedItem.addClass("active-sidebar");

		this.active_item = $clickedItem;
		localStorage.setItem("sidebar-active-item", item_name || item_title);
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
				if ($target.data("processing")) return false;
				$target.data("processing", true);

				const item_name = $target.closest(".sidebar-item-container").attr("item-name");
				const item_title = $target.attr("title");

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

		if (
			sidebar_section.find(".sidebar-item-container").length &&
			sidebar_section.find("> [item-is-hidden='0']").length == 0
		) {
			sidebar_section.addClass("hidden show-in-edit-mode");
		}
	}
};
