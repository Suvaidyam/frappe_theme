/** @type {import('eslint').Linter.Config} */
module.exports = {
	env: {
		browser: true,
		node: true,
		es2022: true,
	},
	parserOptions: {
		sourceType: "module",
	},
	extends: ["eslint:recommended"],
	globals: {
		frappe: "readonly",
		SVAHTTP: "readonly",
		setupFieldComments: "readonly",
	},
	rules: {
		// Allow known globals but still catch real undefined vars
		"no-undef": "warn",
		"no-unsafe-optional-chaining": "warn",
		// Optional: stylistic consistency
		"no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
		"no-console": "off",
	},
};
