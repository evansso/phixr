// Appearance for Clerk components embedded in our own settings UI (same
// pattern as moflay's dashboard): hide Clerk's navbar/header/card chrome so
// only the active page renders inside our dialog.
export const clerkSettingsAppearance = {
	elements: {
		navbar: { display: "none" },
		navbarMobileMenuRow: { display: "none !important" },
		rootBox: { width: "100%", height: "100%", padding: "0" },
		card: { boxShadow: "none", borderWidth: "0", borderStyle: "none", padding: "0" },
		cardBox: {
			display: "block",
			width: "100%",
			height: "100%",
			boxShadow: "none",
			borderWidth: "0",
			borderStyle: "none",
			background: "transparent",
			padding: "0",
		},
		pageScrollBox: { padding: "0 !important", overflow: "hidden" },
		// Per Clerk's element keys: `scrollBox` is the framed box around the
		// profile content (border + radius + background), and
		// `profilePageContent` carries the padding surrounding that content.
		scrollBox: {
			borderWidth: "0",
			borderStyle: "none",
			borderRadius: "0",
			backgroundColor: "transparent",
			boxShadow: "none",
			marginBlock: "0",
			marginInlineEnd: "0",
		},
		profilePageContent: { padding: "0 !important" },
		header: { display: "none" },
		// Clerk hardcodes borderTopWidth/Style/Color on every profileSection
		// (the separators in Account/Security). Shorthand `borderTop: "none"`
		// doesn't override those longhands, so clear them explicitly.
		profileSection: {
			borderTopWidth: "0",
			borderTopStyle: "none",
			borderBottomWidth: "0",
			borderBottomStyle: "none",
		},
		page: { padding: "0" },
	},
} as const;
