import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Superpowers skill installer
 *
 * Downloads and installs skills from obra/superpowers repository
 * into a local directory for Paimon to scan and use.
 */

export interface SuperpowersConfig {
	/** Target directory to install superpowers skills (default: skills/superpowers) */
	targetDir?: string;
	/** Whether to force reinstall even if skills exist (default: false) */
	forceReinstall?: boolean;
	/** Subset of skills to install (default: all from MINIMUM_SKILLS) */
	skills?: string[];
	/** Git ref to use (default: main) */
	ref?: string;
}

/**
 * Minimum viable skill subset for self-evolution
 * These are the most valuable skills for Paimon's evolution workflow
 */
export const MINIMUM_SKILLS = [
	"using-superpowers",
	"brainstorming",
	"writing-plans",
	"systematic-debugging",
	"verification-before-completion",
	"requesting-code-review",
];

/**
 * All available superpowers skills
 */
export const ALL_SKILLS = [
	"brainstorming",
	"dispatching-parallel-agents",
	"executing-plans",
	"finishing-a-development-branch",
	"receiving-code-review",
	"requesting-code-review",
	"subagent-driven-development",
	"systematic-debugging",
	"test-driven-development",
	"using-git-worktrees",
	"using-superpowers",
	"verification-before-completion",
	"writing-plans",
	"writing-skills",
];

/**
 * Install superpowers skills from GitHub
 *
 * Strategy: Clone the repo to a temp directory, then copy specific skills
 * to the target directory. This is more efficient than downloading each
 * skill file individually via HTTP.
 */
export function installSuperpowers(config: SuperpowersConfig = {}): {
	success: boolean;
	installedSkills: string[];
	message: string;
} {
	const targetDir = config.targetDir || "skills/superpowers";
	const forceReinstall = config.forceReinstall ?? false;
	const skillsToInstall = config.skills || MINIMUM_SKILLS;
	const ref = config.ref || "main";

	// Check if already installed
	if (existsSync(targetDir) && !forceReinstall) {
		const existingSkills = readdirSync(targetDir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name);

		if (existingSkills.length >= skillsToInstall.length) {
			return {
				success: true,
				installedSkills: existingSkills,
				message: `Superpowers already installed (${existingSkills.length} skills found)`,
			};
		}
	}

	// Create target directory
	mkdirSync(targetDir, { recursive: true });

	// Clone superpowers repo to temp directory
	const tempDir = join("/tmp", `superpowers-${Date.now()}`);
	const repoUrl = "https://github.com/obra/superpowers.git";

	try {
		console.log("→ Cloning superpowers repository...");
		execSync(`git clone --depth 1 --branch ${ref} ${repoUrl} ${tempDir}`, {
			encoding: "utf-8",
			timeout: 60000,
			stdio: "pipe",
		});

		// Copy specified skills to target directory
		const installedSkills: string[] = [];
		const sourceSkillsDir = join(tempDir, "skills");

		for (const skillName of skillsToInstall) {
			const sourceSkillDir = join(sourceSkillsDir, skillName);
			const targetSkillDir = join(targetDir, skillName);

			if (existsSync(sourceSkillDir)) {
				// Remove existing if force reinstall
				if (existsSync(targetSkillDir) && forceReinstall) {
					rmSync(targetSkillDir, { recursive: true });
				}

				// Copy skill directory
				mkdirSync(targetSkillDir, { recursive: true });
				cpSync(sourceSkillDir, targetSkillDir, { recursive: true });
				installedSkills.push(skillName);
				console.log(`  ✓ Installed: ${skillName}`);
			} else {
				console.log(`  ⚠ Skill not found: ${skillName}`);
			}
		}

		// Cleanup temp directory
		rmSync(tempDir, { recursive: true, force: true });

		return {
			success: true,
			installedSkills,
			message: `Successfully installed ${installedSkills.length} superpowers skills`,
		};
	} catch (error) {
		// Cleanup on failure
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}

		return {
			success: false,
			installedSkills: [],
			message: `Failed to install superpowers: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Verify superpowers are installed and accessible
 */
export function verifySuperpowers(config: SuperpowersConfig = {}): {
	success: boolean;
	skills: string[];
	message: string;
} {
	const targetDir = config.targetDir || "skills/superpowers";
	const requiredSkills = config.skills || MINIMUM_SKILLS;

	if (!existsSync(targetDir)) {
		return {
			success: false,
			skills: [],
			message: `Superpowers directory not found: ${targetDir}`,
		};
	}

	const installedSkills = readdirSync(targetDir, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => e.name);

	// Check if all required skills are present
	const missingSkills = requiredSkills.filter((s) => !installedSkills.includes(s));

	if (missingSkills.length > 0) {
		return {
			success: false,
			skills: installedSkills,
			message: `Missing skills: ${missingSkills.join(", ")}`,
		};
	}

	return {
		success: true,
		skills: installedSkills,
		message: `All ${installedSkills.length} superpowers skills available`,
	};
}

/**
 * Get superpowers skills index for prompt injection
 * Returns XML format compatible with buildSkillsIndex
 */
export function getSuperpowersIndex(config: SuperpowersConfig = {}): string {
	const targetDir = config.targetDir || "skills/superpowers";

	if (!existsSync(targetDir)) {
		return "";
	}

	// Import buildSkillsIndex logic inline
	const entries = readdirSync(targetDir, { withFileTypes: true });
	const skills: Array<{ name: string; dir: string }> = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const skillFile = join(targetDir, entry.name, "SKILL.md");
			if (existsSync(skillFile)) {
				// Use skill name from directory
				skills.push({
					name: entry.name,
					dir: `superpowers/${entry.name}`,
				});
			}
		}
	}

	if (skills.length === 0) return "";

	let xml = "<superpowers>\n";
	for (const skill of skills) {
		xml += "<skill>\n";
		xml += `<name>${skill.name}</name>\n`;
		xml += "<source>obra/superpowers</source>\n";
		xml += `<path>skills/${skill.dir}/SKILL.md</path>\n`;
		xml += "</skill>\n";
	}
	xml += "</superpowers>";

	return xml;
}
