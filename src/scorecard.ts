export interface ScorecardRow {
	date: string;
	taskType: string;
	description: string;
	time: string;
	result?: string;
	firstTry?: string;
	errors?: string;
	rework?: string;
	impact?: string;
	skillsUsed?: string;
	enables?: string;
}

export function normalizeBooleanFlag(value?: string): "yes" | "no" | "unknown" {
	const normalized = (value || "").trim().toLowerCase();
	if (["yes", "y", "true", "✅"].includes(normalized)) {
		return "yes";
	}
	if (["no", "n", "false", "❌"].includes(normalized)) {
		return "no";
	}
	return "unknown";
}

export function normalizeImpact(value?: string): "high" | "medium" | "low" | "unknown" {
	const normalized = (value || "").trim().toLowerCase();
	if (normalized === "high") return "high";
	if (normalized === "medium") return "medium";
	if (normalized === "low") return "low";
	return "unknown";
}

export function normalizeScorecardResult(
	result?: string,
	firstTry?: string,
): "positive" | "negative" | "unknown" {
	const normalizedResult = (result || "").trim();
	if (normalizedResult === "✅") {
		return "positive";
	}
	if (normalizedResult === "❌") {
		return "negative";
	}

	const normalizedFirstTry = (firstTry || "").trim();
	if (normalizedFirstTry === "✅") {
		return "positive";
	}
	if (normalizedFirstTry === "❌") {
		return "negative";
	}

	return "unknown";
}

export function isPositiveScorecardResult(result?: string, firstTry?: string): boolean {
	return normalizeScorecardResult(result, firstTry) === "positive";
}

export function isNegativeScorecardResult(result?: string, firstTry?: string): boolean {
	return normalizeScorecardResult(result, firstTry) === "negative";
}

export function hasRecordedImpact(value?: string): boolean {
	return normalizeImpact(value) !== "unknown";
}

function normalizeHeader(header: string): string {
	return header
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function getCell(row: Record<string, string>, ...names: string[]): string {
	for (const name of names) {
		const value = row[normalizeHeader(name)];
		if (value !== undefined) return value;
	}
	return "";
}

export function extractScorecardTableLines(content: string): string[] {
	const headings = ["## Recent Scorecard", "## Evolution Scorecard", "## Scorecard"];

	for (const heading of headings) {
		const start = content.indexOf(heading);
		if (start === -1) continue;

		const afterHeading = content.slice(start + heading.length);
		const lines = afterHeading
			.split("\n")
			.map((line) => line.trim())
			.filter((line, index, allLines) => line.length > 0 || index < allLines.length - 1);

		const tableStart = lines.findIndex((line) => line.startsWith("|"));
		if (tableStart === -1) continue;

		const tableLines: string[] = [];
		for (const line of lines.slice(tableStart)) {
			if (!line.startsWith("|")) break;
			tableLines.push(line);
		}

		if (tableLines.length >= 3) {
			return tableLines;
		}
	}

	return [];
}

export function parseScorecardRows(content: string): ScorecardRow[] {
	const tableLines = extractScorecardTableLines(content);
	if (tableLines.length < 3) return [];

	const headers = tableLines[0]
		.split("|")
		.map((part) => part.trim())
		.filter(Boolean)
		.map((header) => normalizeHeader(header));
	const rows = tableLines.slice(2);

	const parsedRows: ScorecardRow[] = [];

	for (const line of rows) {
		if (!line.startsWith("|")) continue;

		const values = line
			.split("|")
			.map((part) => part.trim())
			.filter(Boolean);
		if (values.length !== headers.length) continue;

		const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));

		const date = getCell(row, "Date");
		const taskType = getCell(row, "Task Type", "Type");
		const description = getCell(row, "Task Description", "Description");
		const time = getCell(row, "Time");

		if (!date || !taskType || !description || !time) continue;

		const result = getCell(row, "Result");
		const firstTry = getCell(row, "First Try");
		const rework = getCell(row, "Rework", "Rework?");
		const normalizedResult = normalizeScorecardResult(result, firstTry);
		const normalizedRework = normalizeBooleanFlag(rework);
		const inferredFirstTry =
			firstTry ||
			(normalizedResult === "positive" ? "✅" : normalizedResult === "negative" ? "❌" : "");
		const inferredRework =
			rework ||
			(normalizedRework !== "unknown"
				? normalizedRework === "yes"
					? "Yes"
					: "No"
				: normalizedResult === "positive"
					? "No"
					: normalizedResult === "negative"
						? "Yes"
						: "");

		parsedRows.push({
			date,
			taskType,
			description,
			time,
			result,
			firstTry: inferredFirstTry,
			errors: getCell(row, "Errors"),
			rework: inferredRework,
			impact: getCell(row, "Impact"),
			skillsUsed: getCell(row, "Skills Used"),
			enables: getCell(row, "Enables"),
		});
	}

	return parsedRows;
}
