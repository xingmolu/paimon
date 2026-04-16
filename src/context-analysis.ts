import {
	type ContextAnalysis,
	type FileSuggestion,
	getContextIdentifierManager,
} from "./context-identifier.js";

export interface GroupedFileSuggestions {
	primary: FileSuggestion[];
	secondary: FileSuggestion[];
	reference: FileSuggestion[];
}

export interface ContextTaskCandidate {
	taskDescription: string;
	minimumConfidence?: number;
	maxFiles?: number;
}

export interface ContextTaskInsight {
	taskDescription: string;
	analysis: ContextAnalysis;
	primaryFiles: FileSuggestion[];
	topFiles: string[];
	confidencePercent: number;
}

export function groupFileSuggestions(suggestions: FileSuggestion[]): GroupedFileSuggestions {
	return {
		primary: suggestions.filter((file) => file.category === "primary"),
		secondary: suggestions.filter((file) => file.category === "secondary"),
		reference: suggestions.filter((file) => file.category === "reference"),
	};
}

function getPrimaryFiles(analysis: ContextAnalysis, maxFiles: number): FileSuggestion[] {
	const prioritized = analysis.suggestedFiles.filter(
		(file) => file.category === "primary" || file.category === "secondary",
	);
	const source = prioritized.length > 0 ? prioritized : analysis.suggestedFiles;
	return source.slice(0, maxFiles);
}

export function formatContextAnalysis(analysis: ContextAnalysis): string {
	const lines: string[] = [];
	const groupedSuggestions = groupFileSuggestions(analysis.suggestedFiles);

	lines.push("## Context Analysis Results\n");
	lines.push(`**Task:** ${analysis.taskDescription}`);
	lines.push(`**Confidence:** ${(analysis.confidence * 100).toFixed(0)}%\n`);

	if (analysis.suggestedFiles.length === 0) {
		lines.push(
			"No relevant files found. Consider providing more context in the task description.\n",
		);
		lines.push(`### Reasoning\n${analysis.reasoning}`);
		return lines.join("\n");
	}

	lines.push("### Suggested Files\n");

	const sections: Array<{
		title: string;
		files: FileSuggestion[];
		includeReason: boolean;
	}> = [
		{
			title: "**Primary Files (highly relevant):**",
			files: groupedSuggestions.primary,
			includeReason: true,
		},
		{
			title: "**Secondary Files (moderately relevant):**",
			files: groupedSuggestions.secondary,
			includeReason: false,
		},
		{
			title: "**Reference Files (may be useful):**",
			files: groupedSuggestions.reference,
			includeReason: false,
		},
	];

	for (const section of sections) {
		if (section.files.length === 0) continue;
		lines.push(section.title);
		for (const file of section.files) {
			lines.push(`- \`${file.path}\` (${(file.relevance * 100).toFixed(0)}%)`);
			if (file.symbols.length > 0) {
				lines.push(`  - Symbols: ${file.symbols.slice(0, 3).join(", ")}`);
			}
			if (section.includeReason) {
				lines.push(`  - Reason: ${file.reason}`);
			}
		}
		lines.push("");
	}

	lines.push(`### Reasoning\n${analysis.reasoning}`);
	return lines.join("\n");
}

export function formatRelatedFileSuggestions(suggestions: FileSuggestion[]): string {
	if (suggestions.length === 0) {
		return "No related files found.";
	}

	const lines: string[] = ["## Related Files\n"];
	for (const file of suggestions) {
		lines.push(`- \`${file.path}\` (${(file.relevance * 100).toFixed(0)}%)`);
		if (file.symbols.length > 0) {
			lines.push(`  - Shared symbols: ${file.symbols.join(", ")}`);
		}
	}

	return lines.join("\n");
}

export function analyzeContextTasks(candidates: ContextTaskCandidate[]): ContextTaskInsight[] {
	const manager = getContextIdentifierManager();
	const insights: ContextTaskInsight[] = [];

	for (const candidate of candidates) {
		const analysis = manager.analyze(candidate.taskDescription);
		const minimumConfidence = candidate.minimumConfidence ?? 0;
		if (analysis.suggestedFiles.length === 0 || analysis.confidence < minimumConfidence) {
			continue;
		}

		const primaryFiles = getPrimaryFiles(analysis, candidate.maxFiles ?? 3);
		insights.push({
			taskDescription: candidate.taskDescription,
			analysis,
			primaryFiles,
			topFiles: primaryFiles.map((file) => file.path),
			confidencePercent: Math.round(analysis.confidence * 100),
		});
	}

	return insights.sort((a, b) => {
		if (b.analysis.confidence !== a.analysis.confidence) {
			return b.analysis.confidence - a.analysis.confidence;
		}
		return b.primaryFiles.length - a.primaryFiles.length;
	});
}

export function buildContextAnalyzeCommand(taskDescription: string): string {
	return `context({action: 'analyze', taskDescription: '${taskDescription}'})`;
}
