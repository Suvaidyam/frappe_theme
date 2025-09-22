frappe.pages['wren-ai'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Wren-ai',
		single_column: true
	});

	let url = frappe.boot.my_theme?.embed_url ?? '';
	if (url) {
		$(page.parent).html(`
			<iframe id="wrenAIFrame" src="${url}"width="100%" height="800" frameborder="0" ></iframe>
		`);
	}else{
		$(page.parent).html(`
			<div class="alert alert-danger">
				No URL found
			</div>
		`);
	}
}