module.exports = {
	env: {
		browser: true,
		es2021: true,
	},
	globals: {
		frappe: "readonly",
		SVAHTTP: "readonly",
		setupFieldComments: "readonly",
	},
	rules: {
		"no-undef": "off",
		"no-unsafe-optional-chaining": "warn",
	},
};
