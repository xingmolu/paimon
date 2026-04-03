/**
 * Frontend Design Manager (Claude Code Pattern)
 *
 * Provides guidance for creating distinctive, production-grade frontend interfaces
 * that avoid generic AI aesthetics. Auto-invoked for frontend work with guidance
 * on bold design choices, typography, animations, and visual details.
 */

export interface DesignPrinciple {
	id: string;
	name: string;
	description: string;
	category: DesignCategory;
	examples: string[];
	antiPatterns: string[];
	priority: number;
}

export type DesignCategory =
	| "typography"
	| "color"
	| "spacing"
	| "animation"
	| "layout"
	| "interaction"
	| "accessibility"
	| "performance";

export interface DesignGuidance {
	principles: DesignPrinciple[];
	recommendations: string[];
	antiPatternWarnings: string[];
	contextType: FrontendContext;
	confidence: number;
}

export type FrontendContext =
	| "new-component"
	| "refactor"
	| "style-update"
	| "responsive-design"
	| "animation-work"
	| "typography-work"
	| "layout-work"
	| "general-frontend";

export interface FrontendDesignConfig {
	enabled: boolean;
	autoInvoke: boolean;
	verboseGuidance: boolean;
	showAntiPatterns: boolean;
	maxPrinciples: number;
	preferredStyle: "minimal" | "bold" | "playful" | "professional" | "custom";
}

export interface FrontendDesignStats {
	guidanceProvided: number;
	principlesShown: number;
	antiPatternsWarned: number;
	contextsDetected: Record<FrontendContext, number>;
	topPrinciples: string[];
	sessionsEnhanced: number;
}

export const DEFAULT_PRINCIPLES: DesignPrinciple[] = [
	// Typography
	{
		id: "distinctive-typography",
		name: "Distinctive Typography",
		description:
			"Use distinctive fonts that reflect brand personality. Avoid generic system fonts unless specifically chosen for neutrality.",
		category: "typography",
		examples: [
			"Use Inter or DM Sans for modern tech feel",
			"Use Playfair Display for editorial elegance",
			"Use Space Grotesk for technical personality",
			"Pair a distinctive headline font with a complementary body font",
		],
		antiPatterns: [
			"Using -apple-system, BlinkMacSystemFont without consideration",
			"Using Roboto for everything (Android default)",
			"Not defining a clear typography scale",
			"Mixing too many font families",
		],
		priority: 90,
	},
	{
		id: "typography-scale",
		name: "Typography Scale",
		description:
			"Establish a consistent typography scale with clear hierarchy. Use modular scale ratios (1.25, 1.333, 1.5) for harmonious sizing.",
		category: "typography",
		examples: [
			"Use clamp() for fluid typography: font-size: clamp(1rem, 2vw + 1rem, 2rem)",
			"Define 5-7 heading levels with clear progression",
			"Use consistent letter-spacing for headings",
			"Consider reading distance for body text (16-18px baseline)",
		],
		antiPatterns: [
			"Random font sizes without pattern",
			"Inconsistent heading hierarchy",
			"Not considering accessibility (min 16px for body)",
			"Using pixels only instead of relative units",
		],
		priority: 85,
	},

	// Color
	{
		id: "intentional-color",
		name: "Intentional Color Palette",
		description:
			"Choose colors with intention. Each color should have a purpose and contribute to the overall aesthetic story.",
		category: "color",
		examples: [
			"Define semantic colors: primary, secondary, accent, neutral, success, warning, error",
			"Use HSL for better color manipulation",
			"Create color variations programmatically (light/dark modes)",
			"Consider color psychology and cultural associations",
		],
		antiPatterns: [
			"Using generic blue (#007bff) as primary without reason",
			"Not defining dark mode variations",
			"Inconsistent color usage across components",
			"Too many similar colors creating confusion",
		],
		priority: 88,
	},
	{
		id: "bold-accents",
		name: "Bold Accent Colors",
		description:
			"Use bold, distinctive accent colors that make your interface memorable. Avoid safe, muted choices.",
		category: "color",
		examples: [
			"Electric blue (#00D9FF) for tech-forward feel",
			"Hot coral (#FF6B6B) for energetic personality",
			"Deep purple (#6366F1) for sophisticated tech",
			"Vibrant gradients for visual impact",
		],
		antiPatterns: [
			"Using muted grays for everything",
			"Safe corporate blue with no personality",
			"No accent color defined",
			"Colors that blend into background",
		],
		priority: 80,
	},

	// Spacing
	{
		id: "spacing-system",
		name: "Consistent Spacing System",
		description:
			"Use a consistent spacing system (4px, 8px, 16px multiples) for rhythm and visual harmony.",
		category: "spacing",
		examples: [
			"Define spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96",
			"Use gap properties for flex/grid spacing",
			"Consistent padding on interactive elements",
			"Visual rhythm through consistent margins",
		],
		antiPatterns: [
			"Arbitrary margin values (15px, 23px, 47px)",
			"Inconsistent padding on buttons/inputs",
			"No spacing scale defined",
			"Using negative margins for alignment",
		],
		priority: 85,
	},

	// Animation
	{
		id: "meaningful-animation",
		name: "Meaningful Animations",
		description:
			"Animations should serve a purpose: provide feedback, guide attention, or create atmosphere. Avoid decorative animation.",
		category: "animation",
		examples: [
			"Hover states with clear visual feedback (scale, color shift)",
			"Loading states with progress indication",
			"Transition durations: fast (100ms), normal (250ms), slow (500ms)",
			"Use transform and opacity for GPU-accelerated animations",
		],
		antiPatterns: [
			"Animations that slow down user interaction",
			"Decorative animations without purpose",
			"Inconsistent animation timing across components",
			"Over-animating everything",
		],
		priority: 82,
	},
	{
		id: "entrance-animations",
		name: "Entrance Animations",
		description:
			"Use thoughtful entrance animations to create visual hierarchy and draw attention. Avoid generic fade-in.",
		category: "animation",
		examples: [
			"Staggered reveal for lists and grids",
			"Slide-up with fade for modal dialogs",
			"Scale-up with fade for important elements",
			"Consider animation Choreography for complex reveals",
		],
		antiPatterns: [
			"Everything fades in uniformly",
			"No animation consideration",
			"Animations that feel disconnected",
			"Too many simultaneous animations",
		],
		priority: 75,
	},

	// Layout
	{
		id: "layout-hierarchy",
		name: "Clear Layout Hierarchy",
		description:
			"Create clear visual hierarchy through layout. Important elements should be visually prominent.",
		category: "layout",
		examples: [
			"Use CSS Grid for macro layout structure",
			"Flexbox for component-level alignment",
			"Define clear container widths (max-width, fluid)",
			"Use z-index intentionally for stacking",
		],
		antiPatterns: [
			"Nested flex containers without reason",
			"No clear layout pattern",
			"Mixing positioning strategies randomly",
			"Not considering content overflow",
		],
		priority: 87,
	},
	{
		id: "responsive-intention",
		name: "Intentional Responsive Design",
		description:
			"Design breakpoints based on content needs, not device sizes. Let content dictate the layout changes.",
		category: "layout",
		examples: [
			"Use container queries for component responsiveness",
			"Define breakpoints where layout breaks, not at arbitrary widths",
			"Test on actual viewport sizes, not just Chrome device mode",
			"Consider touch vs mouse interactions",
		],
		antiPatterns: [
			"Only using 768px/1024px breakpoints",
			"Not testing on real mobile devices",
			"Hiding content instead of adapting it",
			"Horizontal scroll on narrow screens",
		],
		priority: 80,
	},

	// Interaction
	{
		id: "micro-interactions",
		name: "Micro-Interactions",
		description:
			"Add thoughtful micro-interactions that provide feedback and create polish. Small details matter.",
		category: "interaction",
		examples: [
			"Button press states with scale/shadow change",
			"Focus states that are visible but not intrusive",
			"Form validation feedback with clear messaging",
			"Checkbox/radio custom states with animation",
		],
		antiPatterns: [
			"No hover or focus states",
			"Generic browser default focus rings",
			"No feedback for user actions",
			"Inconsistent interaction patterns",
		],
		priority: 78,
	},

	// Accessibility
	{
		id: "accessible-design",
		name: "Accessible Design",
		description: "Design for all users from the start. Accessibility is not an afterthought.",
		category: "accessibility",
		examples: [
			"Color contrast ratios: 4.5:1 for text, 3:1 for UI components",
			"Focus indicators visible on all interactive elements",
			"Form labels properly associated",
			"Skip links for keyboard navigation",
		],
		antiPatterns: [
			"Low contrast text (light gray on white)",
			"Removing focus indicators",
			"Using only color to convey meaning",
			"No keyboard navigation support",
		],
		priority: 95,
	},

	// Performance
	{
		id: "performance-conscious",
		name: "Performance-Conscious Design",
		description:
			"Design decisions impact performance. Choose approaches that balance aesthetics with efficiency.",
		category: "performance",
		examples: [
			"Use system fonts for body text (custom fonts for headlines)",
			"Limit custom font weights (400, 700 typical)",
			"Use CSS containment for complex components",
			"Consider will-change for known animations",
		],
		antiPatterns: [
			"Loading many custom fonts",
			"Large images without optimization",
			"CSS that triggers layout thrashing",
			"Not considering rendering performance",
		],
		priority: 70,
	},
];

export const CONTEXT_KEYWORDS: Record<FrontendContext, string[]> = {
	"new-component": ["create", "new", "component", "build", "implement", "add"],
	refactor: ["refactor", "restructure", "improve", "clean", "update"],
	"style-update": ["style", "css", "styling", "appearance", "visual", "design"],
	"responsive-design": ["responsive", "mobile", "breakpoint", "viewport", "adapt"],
	"animation-work": ["animation", "animate", "transition", "motion", "movement"],
	"typography-work": ["font", "typography", "text", "heading", "typeface"],
	"layout-work": ["layout", "grid", "flex", "position", "container", "spacing"],
	"general-frontend": ["frontend", "ui", "interface", "web", "page"],
};

export const DEFAULT_CONFIG: FrontendDesignConfig = {
	enabled: true,
	autoInvoke: true,
	verboseGuidance: false,
	showAntiPatterns: true,
	maxPrinciples: 5,
	preferredStyle: "bold",
};

export class FrontendDesignManager {
	private principles: DesignPrinciple[] = DEFAULT_PRINCIPLES;
	private config: FrontendDesignConfig = DEFAULT_CONFIG;
	private stats: FrontendDesignStats = {
		guidanceProvided: 0,
		principlesShown: 0,
		antiPatternsWarned: 0,
		contextsDetected: {} as Record<FrontendContext, number>,
		topPrinciples: [],
		sessionsEnhanced: 0,
	};
	private principleUsage: Map<string, number> = new Map();

	constructor() {
		this.loadState();
	}

	private loadState(): void {
		try {
			const statePath = this.getStatePath();
			const fs = require("node:fs");
			if (fs.existsSync(statePath)) {
				const data = JSON.parse(fs.readFileSync(statePath, "utf-8"));
				this.config = data.config || DEFAULT_CONFIG;
				this.stats = data.stats || this.stats;
				this.principleUsage = new Map(Object.entries(data.principleUsage || {}));
			}
		} catch {
			// Use defaults if state cannot be loaded
		}
	}

	private saveState(): void {
		try {
			const statePath = this.getStatePath();
			const fs = require("node:fs");
			const path = require("node:path");
			const dir = path.dirname(statePath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(
				statePath,
				JSON.stringify({
					config: this.config,
					stats: this.stats,
					principleUsage: Object.fromEntries(this.principleUsage),
				}),
			);
		} catch {
			// Silently fail if state cannot be saved
		}
	}

	private getStatePath(): string {
		const os = require("node:os");
		const path = require("node:path");
		return path.join(os.homedir(), ".paimon", "frontend-design.json");
	}

	detectContext(input: string, files?: string[]): FrontendContext {
		const inputLower = input.toLowerCase();

		// Check file patterns
		if (files) {
			for (const file of files) {
				if (file.includes("animation") || file.includes("motion")) return "animation-work";
				if (file.includes("responsive") || file.includes("mobile")) return "responsive-design";
				if (file.includes("typography") || file.includes("font")) return "typography-work";
				if (file.includes("layout") || file.includes("grid")) return "layout-work";
			}
		}

		// Check keywords
		for (const [context, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
			for (const keyword of keywords) {
				if (inputLower.includes(keyword)) {
					return context as FrontendContext;
				}
			}
		}

		return "general-frontend";
	}

	getGuidance(
		context: FrontendContext,
		taskDescription?: string,
		files?: string[],
	): DesignGuidance {
		// Get relevant principles based on context and priority
		const relevantPrinciples = this.principles
			.filter((p) => this.isPrincipleRelevant(p, context, taskDescription))
			.sort((a, b) => b.priority - a.priority)
			.slice(0, this.config.maxPrinciples);

		// Generate recommendations based on context
		const recommendations = this.generateRecommendations(context, relevantPrinciples);

		// Generate anti-pattern warnings if enabled
		const antiPatternWarnings = this.config.showAntiPatterns
			? this.generateAntiPatternWarnings(context, relevantPrinciples)
			: [];

		// Calculate confidence based on context match
		const confidence = this.calculateConfidence(context, taskDescription, files);

		// Update stats
		this.stats.guidanceProvided++;
		this.stats.principlesShown += relevantPrinciples.length;
		this.stats.antiPatternsWarned += antiPatternWarnings.length;
		this.stats.contextsDetected[context] = (this.stats.contextsDetected[context] || 0) + 1;

		for (const principle of relevantPrinciples) {
			const count = this.principleUsage.get(principle.id) || 0;
			this.principleUsage.set(principle.id, count + 1);
		}

		this.updateTopPrinciples();
		this.saveState();

		return {
			principles: relevantPrinciples,
			recommendations,
			antiPatternWarnings,
			contextType: context,
			confidence,
		};
	}

	private isPrincipleRelevant(
		principle: DesignPrinciple,
		context: FrontendContext,
		taskDescription?: string,
	): boolean {
		// Always include accessibility and performance
		if (principle.category === "accessibility" || principle.category === "performance") {
			return true;
		}

		// Context-specific matching
		const contextCategoryMap: Record<FrontendContext, DesignCategory[]> = {
			"new-component": ["layout", "spacing", "interaction", "color"],
			refactor: ["layout", "spacing", "performance"],
			"style-update": ["color", "typography", "spacing"],
			"responsive-design": ["layout", "spacing"],
			"animation-work": ["animation", "interaction", "performance"],
			"typography-work": ["typography"],
			"layout-work": ["layout", "spacing"],
			"general-frontend": ["typography", "color", "spacing", "layout", "animation"],
		};

		const relevantCategories = contextCategoryMap[context] || [];
		return relevantCategories.includes(principle.category);
	}

	private generateRecommendations(
		context: FrontendContext,
		principles: DesignPrinciple[],
	): string[] {
		const recommendations: string[] = [];

		// Add general recommendations
		recommendations.push("Avoid generic AI design patterns - be intentional with every choice");

		if (this.config.preferredStyle === "bold") {
			recommendations.push("Consider bold, distinctive choices over safe defaults");
		}

		// Add principle-specific recommendations
		for (const principle of principles) {
			if (principle.examples.length > 0) {
				recommendations.push(`${principle.name}: ${principle.examples[0]}`);
			}
		}

		// Context-specific recommendations
		const contextRecommendations: Record<FrontendContext, string[]> = {
			"new-component": [
				"Consider component composition and reusability",
				"Define clear props interface before implementation",
			],
			refactor: [
				"Preserve visual identity while improving structure",
				"Test visual regression after changes",
			],
			"style-update": [
				"Ensure changes are consistent across all affected components",
				"Consider design tokens for systematic updates",
			],
			"responsive-design": [
				"Test on real devices, not just Chrome device mode",
				"Consider touch targets on mobile (min 44px)",
			],
			"animation-work": [
				"Use transform and opacity for GPU-acceleration",
				"Test on slower devices for performance",
			],
			"typography-work": [
				"Limit font loading to essential weights",
				"Test readability at target sizes",
			],
			"layout-work": [
				"Use CSS Grid for macro layout, Flexbox for alignment",
				"Define clear container widths",
			],
			"general-frontend": [
				"Establish design system foundations first",
				"Document design decisions for consistency",
			],
		};

		recommendations.push(...(contextRecommendations[context] || []));

		return recommendations;
	}

	private generateAntiPatternWarnings(
		context: FrontendContext,
		principles: DesignPrinciple[],
	): string[] {
		const warnings: string[] = [];

		for (const principle of principles) {
			if (principle.antiPatterns.length > 0) {
				warnings.push(`Avoid: ${principle.antiPatterns[0]}`);
			}
		}

		return warnings;
	}

	private calculateConfidence(
		context: FrontendContext,
		taskDescription?: string,
		files?: string[],
	): number {
		let confidence = 0.5; // Base confidence

		// Higher confidence if files match
		if (files && files.length > 0) {
			confidence += 0.2;
		}

		// Higher confidence if specific context detected
		if (context !== "general-frontend") {
			confidence += 0.2;
		}

		// Higher confidence if task description contains frontend keywords
		if (taskDescription) {
			const keywords = ["css", "style", "design", "ui", "frontend", "component"];
			const matches = keywords.filter((k) => taskDescription.toLowerCase().includes(k));
			confidence += matches.length * 0.05;
		}

		return Math.min(confidence, 1);
	}

	private updateTopPrinciples(): void {
		const sorted = [...this.principleUsage.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([id]) => id);
		this.stats.topPrinciples = sorted;
	}

	getPrinciple(id: string): DesignPrinciple | undefined {
		return this.principles.find((p) => p.id === id);
	}

	getPrinciplesByCategory(category: DesignCategory): DesignPrinciple[] {
		return this.principles.filter((p) => p.category === category);
	}

	getAllPrinciples(): DesignPrinciple[] {
		return this.principles;
	}

	addPrinciple(principle: DesignPrinciple): void {
		this.principles.push(principle);
		this.saveState();
	}

	removePrinciple(id: string): boolean {
		const index = this.principles.findIndex((p) => p.id === id);
		if (index >= 0) {
			this.principles.splice(index, 1);
			this.saveState();
			return true;
		}
		return false;
	}

	getConfig(): FrontendDesignConfig {
		return this.config;
	}

	updateConfig(updates: Partial<FrontendDesignConfig>): void {
		this.config = { ...this.config, ...updates };
		this.saveState();
	}

	getStats(): FrontendDesignStats {
		return this.stats;
	}

	resetStats(): void {
		this.stats = {
			guidanceProvided: 0,
			principlesShown: 0,
			antiPatternsWarned: 0,
			contextsDetected: {} as Record<FrontendContext, number>,
			topPrinciples: [],
			sessionsEnhanced: 0,
		};
		this.principleUsage.clear();
		this.saveState();
	}

	incrementSessionsEnhanced(): void {
		this.stats.sessionsEnhanced++;
		this.saveState();
	}

	generateSessionStartContext(): string {
		const topPrinciples = this.principles
			.slice(0, 3)
			.map((p) => `- **${p.name}**: ${p.description}`);

		return `## Frontend Design Guidance

This session includes **Frontend Design Skill** for creating distinctive interfaces.

Top design principles:
${topPrinciples.join("\n")}

Use \`frontendDesign({action: 'guidance', context: 'new-component'})\` for detailed guidance on frontend work.

Key reminder: **Avoid generic AI design patterns**. Be intentional with typography, color, spacing, and animation choices.`;
	}
}

export default FrontendDesignManager;
