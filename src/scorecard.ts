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

export type ScorecardErrorType = "typescript" | "test" | "lint" | "runtime";

export interface ScorecardGuardrailSuggestion {
	date: string;
	description: string;
	errorType: ScorecardErrorType;
	message: string;
	priority: number;
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

export function normalizeScorecardErrors(errors?: string): ScorecardErrorType[] {
	const normalized = (errors || "").trim().toLowerCase();
	if (!normalized || normalized === "none") {
		return [];
	}

	return normalized
		.split(/[\/,]|\band\b/)
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			if (part === "ts") return "typescript";
			return part;
		})
		.filter(
			(part): part is ScorecardErrorType =>
				part === "typescript" || part === "test" || part === "lint" || part === "runtime",
		);
}

export function normalizeScorecardSkillNames(skillsUsed?: string): string[] {
	return (skillsUsed || "")
		.split(/[,/]|\band\b|\+/i)
		.map((skill) => skill.trim().toLowerCase())
		.filter(Boolean)
		.map((skill) => skill.replace(/^skills? used:\s*/u, ""))
		.map((skill) => skill.replace(/^[-*]\s*/u, ""))
		.map((skill) => skill.replace(/\s+/g, "-"))
		.filter(Boolean);
}

export function normalizeScorecardReworkFlag(rework?: string): boolean {
	const normalized = (rework || "").trim().toLowerCase();
	return normalized === "yes" || normalized === "y" || normalized === "true" || normalized === "✅";
}

export function getScorecardGuardrailPriority(row: ScorecardRow): number {
	const result = normalizeScorecardResult(row.result, row.firstTry);
	const rework = normalizeScorecardReworkFlag(row.rework);
	const normalizedSkills = normalizeScorecardSkillNames(row.skillsUsed);
	const hasDebugging = normalizedSkills.includes("systematic-debugging");
	const hasReview = normalizedSkills.includes("review-changes");
	const hasAssess = normalizedSkills.includes("assess");

	if (result === "negative") {
		return hasDebugging ? 0 : hasReview ? 1 : hasAssess ? 2 : 3;
	}
	if (result === "positive" && rework) {
		if (hasReview) return 4;
		if (hasDebugging || hasAssess) return 5;
		return 6;
	}
	if (result === "positive") {
		return hasDebugging || hasReview || hasAssess ? 7 : 8;
	}
	return 9;
}

export function buildScorecardPreventionNote(
	errorType: ScorecardErrorType,
	skillsUsed?: string,
	rework?: boolean,
	result?: "positive" | "negative" | "unknown",
): string {
	const normalizedSkills = normalizeScorecardSkillNames(skillsUsed);
	const hasReview = normalizedSkills.includes("review-changes");
	const hasDebugging = normalizedSkills.includes("systematic-debugging");
	const hasAssess = normalizedSkills.includes("assess");
	const hasVerificationSkill = hasReview || hasAssess;

	if (result === "negative") {
		if (hasDebugging) {
			return `Prevention: re-run systematic-debugging before editing to isolate the failing ${errorType} path.`;
		}
		if (hasReview) {
			return `Prevention: inspect the last review-changes findings before retrying so the unresolved ${errorType} path does not repeat.`;
		}
		if (hasAssess) {
			return `Prevention: revisit the last assess/build-test failure details before editing so the unresolved ${errorType} path is reproduced and fixed deliberately.`;
		}
		if (errorType === "test") {
			return "Prevention: capture the failing test name, expected output, and latest diff before editing so the regression path is explicit.";
		}
	}
	if (rework && hasReview) {
		return `Prevention: run review-changes before assess/build-test so similar ${errorType} regressions are caught earlier.`;
	}
	if (result === "positive" && rework && hasAssess) {
		return `Prevention: after fixing the ${errorType} issue, rerun assess/build-test immediately to confirm the recovery path stays green.`;
	}
	if (result === "positive" && hasDebugging) {
		return `Prevention: reuse systematic-debugging early if the ${errorType} failure pattern reappears.`;
	}
	if (result === "positive" && rework && !hasVerificationSkill && errorType === "test") {
		return "Prevention: preserve the recovered test command and failing assertion details so the same recovery path can be replayed quickly.";
	}

	return "";
}

export function getScorecardGuardrailSuggestions(
	rows: ScorecardRow[],
	errorType: ScorecardErrorType,
	maxSuggestions = 3,
): ScorecardGuardrailSuggestion[] {
	const seenDescriptions = new Set<string>();
	const rankedRows = rows
		.map((row, index) => ({ row, index }))
		.sort((a, b) => {
			const priorityDelta =
				getScorecardGuardrailPriority(a.row) - getScorecardGuardrailPriority(b.row);
			if (priorityDelta !== 0) {
				return priorityDelta;
			}
			return a.index - b.index;
		});

	const suggestions: ScorecardGuardrailSuggestion[] = [];
	for (const { row } of rankedRows) {
		const normalizedErrors = normalizeScorecardErrors(row.errors);
		if (!normalizedErrors.includes(errorType)) {
			continue;
		}

		const description = row.description.trim();
		if (!description) {
			continue;
		}
		const descriptionKey = description.toLowerCase();
		if (seenDescriptions.has(descriptionKey)) {
			continue;
		}
		seenDescriptions.add(descriptionKey);

		const result = normalizeScorecardResult(row.result, row.firstTry);
		const rework = normalizeScorecardReworkFlag(row.rework);
		const preventionNote = buildScorecardPreventionNote(errorType, row.skillsUsed, rework, result);
		const message =
			result === "negative"
				? `Recent MEMORY.md failure on ${row.date}: ${description}. This ${errorType} issue remained unresolved.${preventionNote ? ` ${preventionNote}` : ""}`
				: result === "positive" && rework
					? `Recent recovered session on ${row.date}: ${description}. ${errorType} issues required rework before finishing cleanly.${preventionNote ? ` ${preventionNote}` : ""}`
					: `Recent clean success on ${row.date}: ${description}. Review it as a lower-priority reference for avoiding ${errorType} regressions.${preventionNote ? ` ${preventionNote}` : ""}`;

		suggestions.push({
			date: row.date,
			description,
			errorType,
			message,
			priority: getScorecardGuardrailPriority(row),
		});
		if (suggestions.length >= maxSuggestions) {
			break;
		}
	}

	return suggestions;
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
