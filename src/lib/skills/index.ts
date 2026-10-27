import fs from "node:fs";
import path from "node:path";

export type Skill = { name: string; description: string; body: string };

const SKILLS_DIR = path.join(process.cwd(), "skills");

function parse(raw: string): Skill | null {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) return null;
	const meta: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const separator = line.indexOf(":");
		if (separator > 0) meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
	}
	if (!meta.name || !meta.description) return null;
	return { name: meta.name, description: meta.description, body: match[2].trim() };
}

let cache: Skill[] | null = null;

export function getSkills(): Skill[] {
	if (cache) return cache;
	const skills: Skill[] = [];
	try {
		for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			try {
				const raw = fs.readFileSync(path.join(SKILLS_DIR, entry.name, "SKILL.md"), "utf8");
				const skill = parse(raw);
				if (skill) skills.push(skill);
			} catch {
				// Ignore unavailable playbooks.
			}
		}
	} catch {
		// Skills are optional when the directory is not present in a deployment.
	}
	cache = skills.sort((a, b) => a.name.localeCompare(b.name));
	return cache;
}

export function skillIndex(): string {
	return getSkills().map((skill) => `- ${skill.name}: ${skill.description}`).join("\n");
}
