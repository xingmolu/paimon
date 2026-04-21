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

export function isPositiveScorecardResult(value?: string): boolean {
	return (value || "").trim() === "✅";
}

export function isNegativeScorecardResult(value?: string): boolean {
	return (value || "").trim() === "❌";
}

export function hasRecordedImpact(value?: string): boolean {
	return /^(high|medium|low)$/i.test((value || "").trim());
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

		parsedRows.push({
			date,
			taskType,
			description,
			time,
			result: getCell(row, "Result"),
			firstTry: getCell(row, "First Try"),
			errors: getCell(row, "Errors"),
			rework: getCell(row, "Rework", "Rework?"),
			impact: getCell(row, "Impact"),
			skillsUsed: getCell(row, "Skills Used"),
			enables: getCell(row, "Enables"),
		});
	}

	return parsedRows;
}
