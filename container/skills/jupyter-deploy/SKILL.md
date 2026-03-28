---
name: jupyter-deploy
description: Create a Jupyter notebook from a user's request, execute it to generate outputs, convert to HTML, and deploy to Vercel. Use when the user says "notebook", "ノートブック", "Jupyter", "ジュピター", "データ分析", "data analysis notebook", "create notebook", "ノートブック作って", "分析して", "analyze and deploy", "notebook deploy", or asks to create a notebook and share/deploy the results.
---

# Jupyter Notebook Deploy

Create, execute, and deploy Jupyter notebooks as interactive HTML pages on Vercel.

## Step 1: Understand the Request

The user will describe what they want analyzed, visualized, or computed. Clarify if needed, but generally proceed directly with creating the notebook.

## Step 2: Create the Notebook

Use the `NotebookEdit` tool to create a `.ipynb` file in the working directory.

**File naming:** Use a descriptive slug based on the request, e.g., `sales-analysis.ipynb`, `prime-numbers.ipynb`. If the user specifies a name, use that.

**Notebook structure guidelines:**
- First cell: Markdown title and description of the analysis
- Import cells: Group all imports in one cell near the top
- Logic cells: Break the work into logical steps, each in its own cell
- Visualization cells: Use matplotlib/pandas plotting; always call `plt.show()` or use inline display
- **Matplotlib setup:** Always include this in your setup cell:
  ```python
  import matplotlib
  matplotlib.rcParams['font.family'] = 'Noto Sans CJK JP'  # Japanese font support
  ```
  Use the default matplotlib style (white background, black text). Do NOT use dark themes — they are hard to read in notebook HTML output.
- Summary cell: Final markdown cell summarizing findings
- Only use libraries available in the container: `numpy`, `pandas`, `matplotlib` (standard library modules are also available)
- If the user needs a library that is not installed, tell them it is unavailable and suggest an alternative using the installed libraries

**Important:** Set the kernel to `python3` in the notebook metadata.

## Step 3: Execute the Notebook

Run the notebook to generate outputs (charts, tables, printed values):

```bash
jupyter nbconvert --to notebook --execute --inplace <notebook-file>.ipynb
```

This executes the notebook and writes outputs back in-place. Do NOT use `jupyter execute` as it may not persist outputs to the file.

**If execution fails:**
1. Read the error from the output
2. Fix the notebook using `NotebookEdit`
3. Re-execute
4. Retry up to 2 times. If it still fails, report the error to the user and stop.

## Step 4: Convert to HTML

```bash
jupyter nbconvert --to html --template classic <notebook-file>.ipynb
```

**IMPORTANT:** Always use `--template classic`. The default `lab` template uses JupyterLab CSS variables (`--jp-*`) that are undefined outside JupyterLab, causing the page to render with no styling. The `classic` template produces self-contained, standalone HTML that looks correct in any browser.

By default, code cells are shown (notebook style with `In [n]:` prompts). If the user explicitly asks to hide the code, add `--no-input` to produce a clean report-style output.

The output file will be `<notebook-file>.html` in the same directory.

## Step 5: Read the HTML

Read the generated HTML file using the `Read` tool.

**If the HTML is too large** (over 500KB), the Vercel deploy may fail. In that case:
1. Try `--no-input` if not already used
2. Reduce the number of high-resolution plots
3. Report to the user if it cannot be reduced

## Step 6: Deploy to Vercel

Determine the project name:
- If the user specified a name, use it (lowercase, hyphens only)
- Otherwise, generate from the notebook filename: e.g., `sales-analysis.ipynb` becomes `jupyter-sales-analysis`
- Always prefix with `jupyter-` to avoid collisions with other projects

Deploy using the MCP tool:

```
mcp__vercel__vercel_deploy({
  name: "<project-name>",
  files: [
    { file: "index.html", data: "<the full HTML content>" }
  ]
})
```

## Step 7: Return Result

Respond to the user with:
1. The deployed URL
2. A brief summary of what the notebook contains
3. Key outputs or findings (if applicable)

Example:
```
Notebook deployed!

URL: https://jupyter-sales-analysis-xxx.vercel.app

Created a sales analysis notebook with:
- Monthly revenue trends (line chart)
- Top 10 products by sales (bar chart)
- Summary statistics table

The notebook used sample data with 1,000 transactions.
```

## Error Handling

- **Notebook creation fails:** Report the NotebookEdit error to the user
- **Execution fails after retries:** Share the error message and the notebook file (user can debug)
- **nbconvert fails:** Try without `--no-input`; if still failing, report error
- **Vercel deploy fails:** Check if HTML is too large; report error with details
- **Missing library:** Do NOT try to pip install (will fail as non-root). Tell the user which libraries are available and suggest alternatives
