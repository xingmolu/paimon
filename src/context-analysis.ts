import {
	type ContextAnalysis,
	type FileSuggestion,
	getContextIdentifierManager,
} from "./context-identifier.js";

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

function getPrimaryFiles(analysis: ContextAnalysis, maxFiles: number): FileSuggestion[] {
	const prioritized = analysis.suggestedFiles.filter(
		(file) => file.category === "primary" || file.category === "secondary",
	);
	const source = prioritized.length > 0 ? prioritized : analysis.suggestedFiles;
	return source.slice(0, maxFiles);
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
