/**
 * Skills parsing and indexing.
 * Provides progressive disclosure of skill information.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Parsed frontmatter from a SKILL.md file
 */
export interface SkillFrontmatter {
	name?: string;
	description?: string;
}

/**
 * Skill entry in the index
 */
export interface SkillEntry {
	name: string;
	description: string;
	dir: string;
	source?: string;
}

/**
 * Parse YAML frontmatter from a SKILL.md file
 */
export function parseFrontmatter(content: string): SkillFrontmatter {
	let name: string | undefined;
	let description: string | undefined;

	let inFrontmatter = false;
	for (const line of content.split("\n")) {
		if (line === "---") {
			inFrontmatter = !inFrontmatter;
			continue;
		}
		if (inFrontmatter) {
			if (line.startsWith("name:")) {
				name = line.slice(5).trim();
			} else if (line.startsWith("description:")) {
				description = line.slice(12).trim();
			}
		}
	}

	return { name, description };
}

/**
 * Build a skills index from the skills directory.
 * Uses progressive disclosure: only includes name and description,
 * not full skill content. Agent loads full skill on-demand.
 *
 * Supports multiple skill roots: project skills + superpowers skills
 */
export function buildSkillsIndex(skillsDir: string): string {
	if (!existsSync(skillsDir)) return "";

	const entries = readdirSync(skillsDir, { withFileTypes: true });
	const skills: SkillEntry[] = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const skillFile = join(skillsDir, entry.name, "SKILL.md");
			if (existsSync(skillFile)) {
				const content = readFileSync(skillFile, "utf-8");
				const { name, description } = parseFrontmatter(content);

				// Check if this is a superpowers skill (nested directory)
				const isSuperpowers = entry.name === "superpowers";

				if (isSuperpowers) {
					// Scan superpowers subdirectory for skills
					const superpowersDir = join(skillsDir, "superpowers");
					const superpowersEntries = readdirSync(superpowersDir, { withFileTypes: true });

					for (const spEntry of superpowersEntries) {
						if (spEntry.isDirectory()) {
							const spSkillFile = join(superpowersDir, spEntry.name, "SKILL.md");
							if (existsSync(spSkillFile)) {
								const spContent = readFileSync(spSkillFile, "utf-8");
								const { name: spName, description: spDescription } = parseFrontmatter(spContent);
								skills.push({
									name: spName || spEntry.name,
									description: spDescription || "No description",
									dir: `superpowers/${spEntry.name}`,
									source: "obra/superpowers",
								});
							}
						}
					}
				} else {
					// Regular project skill
					skills.push({
						name: name || entry.name,
						description: description || "No description",
						dir: entry.name,
						source: "project",
					});
				}
			}
		}
	}

	if (skills.length === 0) return "";

	// Generate XML format per Agent Skills standard
	// Separate project skills from superpowers for clarity
	let xml = "<skills>\n";

	// Project skills first
	const projectSkills = skills.filter((s) => s.source === "project");
	for (const skill of projectSkills) {
		xml += "<skill>\n";
		xml += `<name>${skill.name}</name>\n`;
		xml += `<description>${skill.description}</description>\n`;
		xml += `<path>skills/${skill.dir}/SKILL.md</path>\n`;
		xml += "<source>project</source>\n";
		xml += "</skill>\n";
	}

	// Superpowers skills
	const superpowersSkills = skills.filter((s) => s.source === "obra/superpowers");
	if (superpowersSkills.length > 0) {
		xml += "\n<!-- Superpowers skills from obra/superpowers -->\n";
		for (const skill of superpowersSkills) {
			xml += "<skill>\n";
			xml += `<name>${skill.name}</name>\n`;
			xml += `<description>${skill.description}</description>\n`;
			xml += `<path>skills/${skill.dir}/SKILL.md</path>\n`;
			xml += "<source>obra/superpowers</source>\n";
			xml += "</skill>\n";
		}
	}

	xml += "</skills>";

	return xml;
}
