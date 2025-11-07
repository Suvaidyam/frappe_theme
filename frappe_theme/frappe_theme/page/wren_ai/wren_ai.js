frappe.pages["wren-ai"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Wren-ai",
		single_column: true,
	});

	let url = frappe.boot.my_theme?.embed_url ?? "";
	function sendUser(toWindow) {
		const dataToSend = { userId: frappe.session.user };
		toWindow.postMessage(dataToSend, "*");
	}
	if (url) {
		$(page.parent).html(`
            <iframe id="wrenAIFrame" src="${url}" width="100%" height="800" frameborder="0"></iframe>
        `);

		let el = page.parent.querySelector("#wrenAIFrame");

		if (el) {
			el.onload = function () {
				sendUser(el.contentWindow);
			};
		}

		// listen for messages from iframe
		window.addEventListener("message", function (event) {
			if (event && event.data && event.data.type === "WRENAI_REQUEST_USER") {
				sendUser(el?.contentWindow || window);
			}
		});
	} else {
		$(page.parent).html(`
            <div class="alert alert-danger">
                No URL found
            </div>
        `);
	}
};
