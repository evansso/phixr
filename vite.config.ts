import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { redact } from '@tanstack/redact/vite';
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	server: {
		port: 3000,
	},
	preview: {
		port: 3000,
	},
	build: {
		rolldownOptions: {
			checks: {
				moduleLevelDirective: false,
			},
		},
	},
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		nitro({ rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		redact(),
	],
});

export default config;
