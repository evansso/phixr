import { tool } from "ai";
import { z } from "zod";
import { getSkills } from "./index";

const names = getSkills().map((skill) => skill.name);

export const load_skill = names.length > 0
	? tool({
			description: "Load a troubleshooting playbook by name when its description matches the situation. Load only what you need, at most two per turn. Skills add detail to core rules and never override them.",
			inputSchema: z.object({ name: z.enum(names as [string, ...string[]]) }),
			execute: async ({ name }) => {
				const skill = getSkills().find((item) => item.name === name);
				return skill ? { name: skill.name, instructions: skill.body } : { error: "Unknown skill." };
			},
		})
	: undefined;
