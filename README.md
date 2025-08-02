### Frappe Theme

A custom app to customize color theme of frappe desk and web along with adding custom element inside the forms and workspaces

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI (STABLE):
```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch main
bench install-app frappe_theme
```
You can install this app using the [bench](https://github.com/frappe/bench) CLI (LATEST):
```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch development
bench install-app frappe_theme
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/frappe_theme
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
# frappe_theme (All the below features can be achieved through the configurations only):
## Heatmaps in the workspace
![image](https://github.com/user-attachments/assets/ac26b819-3df2-4697-a74d-3dfae57e6f90)

## Custom table of any doctype in the workspace
![image](https://github.com/user-attachments/assets/d3b65bbf-bbbe-4fae-a5f8-a19556e5c3b6)

## Number Cards/Charts inside the tabs of the doctype forms
![image](https://github.com/user-attachments/assets/93181000-ad65-4a90-84ab-d4ad694ab06c)

## Custom table of linked doctypes inside the tabs of doctype forms
![image](https://github.com/user-attachments/assets/b27bdb58-0e4d-489a-93ef-ec434098eca4)

## Change the colors of the given elements
![image](https://github.com/user-attachments/assets/f56fca43-229a-4246-9fdb-b0e534df6f8b)

